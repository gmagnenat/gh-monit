import type { Command } from 'commander';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { serve } from '@hono/node-server';
import {
  DEFAULT_DB_PATH,
  openDatabase,
  resolveDbPath,
} from '../core/db.js';
import { createGitHubClient } from '../core/github-client.js';
import { createServer } from '../core/server.js';
import { startScheduler, stopScheduler } from '../core/scheduler.js';

const DEFAULT_CRON_SCHEDULE = '0 6 * * *';

type DashboardOptions = {
  port: string;
  host: string;
  open: boolean;
  db: string;
};

/**
 * Returns true if the bind address is a wildcard that accepts any
 * incoming interface (0.0.0.0 for IPv4, :: for IPv6).
 */
function isWildcardHost(host: string): boolean {
  return host === '0.0.0.0' || host === '::';
}

/**
 * Returns the external IPv4 addresses the host is reachable at,
 * used to print helpful LAN URLs when binding to a wildcard address.
 */
function getLanAddresses(): string[] {
  const nets = os.networkInterfaces();
  const addresses: string[] = [];
  for (const ifaces of Object.values(nets)) {
    if (!ifaces) continue;
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

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

export function registerDashboardCommand(program: Command): void {
  program
    .command('dashboard')
    .description('Start the web dashboard to browse Dependabot alerts')
    .option('--port <number>', 'Port to listen on', '3847')
    .option(
      '--host <address>',
      'Host/interface to bind to (use 0.0.0.0 to expose on the LAN)',
      '127.0.0.1'
    )
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
      const host = options.host;
      const wildcard = isWildcardHost(host);
      // Wildcard binds aren't clickable URLs — use localhost for the
      // primary display/auto-open, and list LAN addresses separately.
      const primaryUrl = `http://${wildcard ? 'localhost' : host}:${port}`;

      const cronExpression =
        process.env.GH_MONIT_REFRESH_SCHEDULE || DEFAULT_CRON_SCHEDULE;

      const server = serve({ fetch: app.fetch, port, hostname: host }, () => {
        console.log(chalk.bold('\n  gh-monit Dashboard\n'));
        console.log(`  ${chalk.green('➜')}  Local:   ${chalk.cyan(primaryUrl)}`);
        if (wildcard) {
          const lan = getLanAddresses();
          if (lan.length === 0) {
            console.log(
              `  ${chalk.green('➜')}  Network: ${chalk.gray('no external interfaces found')}`
            );
          } else {
            for (const addr of lan) {
              console.log(
                `  ${chalk.green('➜')}  Network: ${chalk.cyan(`http://${addr}:${port}`)}`
              );
            }
          }
        }
        console.log('');

        startScheduler(db, octokit, cronExpression);
        console.log(
          chalk.gray(`  Auto-refresh scheduled: ${cronExpression}\n`)
        );

        console.log(chalk.gray('  Press Ctrl+C to stop\n'));

        if (options.open) {
          openBrowser(primaryUrl);
        }

      });

      let shuttingDown = false;
      const shutdown = () => {
        if (shuttingDown) return;
        shuttingDown = true;

        console.log(chalk.gray('\nShutting down...'));
        stopScheduler();

        const forceExit = setTimeout(() => {
          console.warn(chalk.yellow('Shutdown timed out, forcing exit'));
          db.close();
          process.exit(1);
        }, 5000);
        forceExit.unref();

        server.close(() => {
          clearTimeout(forceExit);
          db.close();
          process.exit(0);
        });
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    });
}
