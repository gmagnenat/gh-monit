import type { Command } from 'commander';
import type { Octokit } from '@octokit/rest';
import type Database from 'better-sqlite3';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { serve } from '@hono/node-server';
import {
  DEFAULT_DB_PATH,
  getAllRepoSummaries,
  openDatabase,
  resolveDbPath,
  saveAlerts,
} from '../core/db.js';
import { normalizeAlerts } from '../core/alerts.js';
import { createGitHubClient } from '../core/github-client.js';
import {
  fetchDependabotAlerts,
  listOrgRepos,
  listUserRepos,
} from '../core/github.js';
import { createServer } from '../core/server.js';
import { startScheduler, stopScheduler } from '../core/scheduler.js';
import type { RepoRef } from '../types.js';

const DEFAULT_CRON_SCHEDULE = '0 6 * * *';

type DashboardOptions = {
  port: string;
  open: boolean;
  db: string;
};

/**
 * Resolves the dashboard static directory.
 * In production (bundled by tsup), import.meta.url points to dist/index.js,
 * so the dashboard is at dist/dashboard/.
 * In dev (tsx), we fall back to dist/dashboard/ from the project root.
 */
function resolveDashboardDir(): string | null {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(currentDir, 'dashboard'),
    path.join(currentDir, '..', '..', 'dist', 'dashboard'),
  ];

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (
      fs.existsSync(resolved) &&
      fs.existsSync(path.join(resolved, 'index.html'))
    ) {
      return resolved;
    }
  }

  return null;
}

/**
 * Opens the given URL in the default browser.
 * Uses platform-specific commands to avoid an extra dependency.
 */
function openBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'start'
        : 'xdg-open';

  exec(`${cmd} ${url}`, (error) => {
    if (error) {
      console.warn(
        chalk.yellow(`Could not open browser automatically. Visit ${url}`)
      );
    }
  });
}

/**
 * If the database is empty and GH_MONIT_USER or GH_MONIT_ORG env vars are set,
 * fetches all repos and their alerts in the background.
 */
function seedIfEmpty(db: Database.Database, octokit: Octokit): void {
  const existing = getAllRepoSummaries(db);
  if (existing.length > 0) {
    return;
  }

  const user = process.env.GH_MONIT_USER;
  const org = process.env.GH_MONIT_ORG;

  if (!user && !org) {
    return;
  }

  const targets = [
    ...(user ? user.split(',').map((u) => ({ type: 'user' as const, value: u.trim() })) : []),
    ...(org ? org.split(',').map((o) => ({ type: 'org' as const, value: o.trim() })) : []),
  ];

  console.log(
    chalk.cyan(
      `  Seeding database for: ${targets.map((t) => `${t.type}:${t.value}`).join(', ')}...`
    )
  );

  seedRepos(db, octokit, targets).then((count) => {
    console.log(chalk.green(`  Seed complete: ${count} repos synced.\n`));
  }).catch((error) => {
    console.error(chalk.red('  Seed failed:'), error);
  });
}

async function seedRepos(
  db: Database.Database,
  octokit: Octokit,
  targets: { type: 'user' | 'org'; value: string }[]
): Promise<number> {
  const repos: RepoRef[] = [];

  for (const target of targets) {
    const list =
      target.type === 'user'
        ? await listUserRepos(octokit, target.value, false)
        : await listOrgRepos(octokit, target.value, false);

    if (list) {
      repos.push(...list);
    }
  }

  let synced = 0;
  for (const repo of repos) {
    const raw = await fetchDependabotAlerts(octokit, repo);
    if (raw) {
      const alerts = normalizeAlerts(repo.fullName, raw);
      saveAlerts(db, repo.fullName, alerts, new Date().toISOString());
      synced++;
      console.log(chalk.gray(`    ✓ ${repo.fullName} (${alerts.length} alerts)`));
    }
  }

  return synced;
}

export function registerDashboardCommand(program: Command): void {
  program
    .command('dashboard')
    .description('Start the web dashboard to browse Dependabot alerts')
    .option('--port <number>', 'Port to listen on', '3847')
    .option('--no-open', 'Skip opening the browser automatically')
    .option('--db <path>', 'Path to sqlite db', DEFAULT_DB_PATH)
    .action((options: DashboardOptions) => {
      const dashboardDir = resolveDashboardDir();
      if (!dashboardDir) {
        console.error(
          chalk.red(
            'Dashboard files not found. Run `npm run build:dashboard` first.'
          )
        );
        process.exitCode = 1;
        return;
      }

      const port = Number(options.port);
      if (Number.isNaN(port) || port < 1 || port > 65535) {
        console.error(
          chalk.red('Invalid port number. Must be between 1 and 65535.')
        );
        process.exitCode = 1;
        return;
      }

      const dbPath = resolveDbPath(options.db);
      const db = openDatabase(dbPath);

      const octokit = createGitHubClient();
      if (!octokit) {
        return;
      }

      const app = createServer(db, octokit, dashboardDir);
      const url = `http://localhost:${port}`;

      const cronExpression =
        process.env.GH_MONIT_REFRESH_SCHEDULE || DEFAULT_CRON_SCHEDULE;

      const server = serve({ fetch: app.fetch, port }, () => {
        console.log(chalk.bold('\n  gh-monit Dashboard\n'));
        console.log(`  ${chalk.green('➜')}  ${chalk.cyan(url)}\n`);

        startScheduler(db, octokit, cronExpression);
        console.log(
          chalk.gray(`  Auto-refresh scheduled: ${cronExpression}\n`)
        );

        console.log(chalk.gray('  Press Ctrl+C to stop\n'));

        if (options.open) {
          openBrowser(url);
        }

        seedIfEmpty(db, octokit);
      });

      process.on('SIGINT', () => {
        console.log(chalk.gray('\nShutting down...'));
        stopScheduler();
        server.close();
        db.close();
        process.exit(0);
      });
    });
}
