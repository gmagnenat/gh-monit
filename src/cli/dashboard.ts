import type { Command } from 'commander';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { serve } from '@hono/node-server';
import { DEFAULT_DB_PATH, openDatabase, resolveDbPath } from '../core/db.js';
import { createServer } from '../core/server.js';

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
      const app = createServer(db, dashboardDir);
      const url = `http://localhost:${port}`;

      const server = serve({ fetch: app.fetch, port }, () => {
        console.log(chalk.bold('\n  gh-monit Dashboard\n'));
        console.log(`  ${chalk.green('➜')}  ${chalk.cyan(url)}\n`);
        console.log(chalk.gray('  Press Ctrl+C to stop\n'));

        if (options.open) {
          openBrowser(url);
        }
      });

      // Graceful shutdown on SIGINT
      process.on('SIGINT', () => {
        console.log(chalk.gray('\nShutting down...'));
        server.close();
        db.close();
        process.exit(0);
      });
    });
}
