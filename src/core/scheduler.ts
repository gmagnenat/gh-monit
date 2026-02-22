import cron from 'node-cron';
import type Database from 'better-sqlite3';
import type { Octokit } from '@octokit/rest';
import chalk from 'chalk';
import { getAllRepoSummaries, saveAlerts } from './db.js';
import { normalizeAlerts } from './alerts.js';
import { fetchDependabotAlerts } from './github.js';

export type RefreshResult = {
  refreshed: number;
  failed: number;
  total: number;
  results: { repo: string; success: boolean }[];
};

export type SchedulerState = {
  running: boolean;
  lastRun: string | null;
  lastResult: Omit<RefreshResult, 'results'> | null;
  nextRun: string | null;
  cronExpression: string;
};

const STAGGER_DELAY_MS = 2000;

let state: SchedulerState = {
  running: false,
  lastRun: null,
  lastResult: null,
  nextRun: null,
  cronExpression: '',
};

let task: cron.ScheduledTask | null = null;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getNextRunDate(expression: string): string | null {
  try {
    const interval = cron.getTasks();
    const now = new Date();
    const parts = expression.split(' ');
    if (parts.length !== 5) return null;

    const [minute, hour] = parts;
    const next = new Date(now);

    const targetHour = hour === '*' ? now.getHours() : Number(hour);
    const targetMinute = minute === '*' ? now.getMinutes() : Number(minute);

    next.setHours(targetHour, targetMinute, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next.toISOString();
  } catch {
    return null;
  }
}

/**
 * Refreshes all tracked repos sequentially with a staggered delay.
 * Shared by the cron scheduler and the manual refresh-all endpoint.
 */
export async function refreshAllRepos(
  db: Database.Database,
  octokit: Octokit
): Promise<RefreshResult> {
  const repos = getAllRepoSummaries(db);
  const results: { repo: string; success: boolean }[] = [];

  for (let i = 0; i < repos.length; i++) {
    const { repo } = repos[i];
    const [owner, name] = repo.split('/');

    try {
      const raw = await fetchDependabotAlerts(octokit, {
        owner,
        name,
        fullName: repo,
      });
      if (raw) {
        const alerts = normalizeAlerts(repo, raw);
        saveAlerts(db, repo, alerts, new Date().toISOString());
        results.push({ repo, success: true });
      } else {
        results.push({ repo, success: false });
      }
    } catch {
      results.push({ repo, success: false });
    }

    if (i < repos.length - 1) {
      await delay(STAGGER_DELAY_MS);
    }
  }

  const refreshed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return { refreshed, failed, total: repos.length, results };
}

export function getSchedulerStatus(): SchedulerState {
  return { ...state };
}

/**
 * Starts the cron scheduler that periodically refreshes all tracked repos.
 * Returns the initial scheduler state. Only one scheduler can run at a time.
 */
export function startScheduler(
  db: Database.Database,
  octokit: Octokit,
  cronExpression: string
): SchedulerState {
  if (task) {
    task.stop();
  }

  state = {
    running: false,
    lastRun: null,
    lastResult: null,
    nextRun: getNextRunDate(cronExpression),
    cronExpression,
  };

  task = cron.schedule(cronExpression, async () => {
    if (state.running) {
      console.log(
        chalk.yellow('  Scheduler: skipping run — previous refresh still in progress')
      );
      return;
    }

    state.running = true;
    const startTime = new Date();
    console.log(
      chalk.cyan(`  Scheduler: starting auto-refresh at ${startTime.toISOString()}`)
    );

    try {
      const result = await refreshAllRepos(db, octokit);
      state.lastRun = startTime.toISOString();
      state.lastResult = {
        refreshed: result.refreshed,
        failed: result.failed,
        total: result.total,
      };
      state.nextRun = getNextRunDate(cronExpression);

      console.log(
        chalk.green(
          `  Scheduler: refresh complete — ${result.refreshed}/${result.total} repos updated` +
            (result.failed > 0 ? `, ${result.failed} failed` : '')
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`  Scheduler: refresh failed — ${message}`));
    } finally {
      state.running = false;
    }
  });

  return { ...state };
}

export function stopScheduler(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
