import type { Command } from 'commander';
import { z } from 'zod';
import chalk from 'chalk';
import {
  DEFAULT_DB_PATH,
  getFixAdvisor,
  openDatabase,
  resolveDbPath,
} from '../core/db.js';
import type { FixAction, FixAdvisorResponse } from '../types.js';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'unknown'];

const repoSchema = z
  .string()
  .regex(/^[^/]+\/[^/]+$/, 'Repo must be in owner/name format');

type FixPlanOptions = {
  repo?: string;
  db: string;
  json?: boolean;
};

export function registerFixPlanCommand(program: Command): void {
  program
    .command('fix-plan')
    .description('Show grouped fix recommendations for Dependabot alerts')
    .option('--repo <owner/name>', 'GitHub repo in owner/name format')
    .option('--db <path>', 'Path to sqlite db', DEFAULT_DB_PATH)
    .option('--json', 'Output as JSON', false)
    .action((options: FixPlanOptions) => {
      if (options.repo) {
        const result = repoSchema.safeParse(options.repo);
        if (!result.success) {
          console.error(chalk.red('Repo must be in owner/name format.'));
          process.exitCode = 1;
          return;
        }
      }

      const dbPath = resolveDbPath(options.db);
      const db = openDatabase(dbPath);

      const data = getFixAdvisor(db, options.repo ?? null);

      if (options.json) {
        process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
        return;
      }

      renderFixPlan(data);
    });
}

function renderFixPlan(data: FixAdvisorResponse): void {
  const isCrossRepo = data.repo === 'all';
  const header = isCrossRepo
    ? 'Fix Plan (all repos)'
    : `Fix Plan for ${data.repo}`;

  const fixableAlerts = data.actions.reduce((s, a) => s + a.alertCount, 0);
  console.log(
    chalk.bold(`\n${header} — ${data.totalAlerts} alerts, ${fixableAlerts} fixable\n`)
  );

  if (data.totalAlerts === 0) {
    console.log(chalk.green('  No open alerts.'));
    return;
  }

  // Group actions by severity tier
  for (const severity of SEVERITY_ORDER) {
    const tier = data.actions.filter((a) => a.groupSeverity === severity);
    if (tier.length === 0) continue;

    const tierAlerts = tier.reduce((s, a) => s + a.alertCount, 0);
    const severityColor = getSeverityColor(severity);
    console.log(
      severityColor(`${severity.toUpperCase()} (${tier.length} fixes, ${tierAlerts} alerts)`)
    );

    for (const action of tier) {
      renderAction(action, isCrossRepo);
    }
    console.log();
  }

  // No fix available section
  if (data.noFixAvailable.length > 0) {
    const noFixAlerts = data.noFixAvailable.reduce((s, a) => s + a.alertCount, 0);
    console.log(
      chalk.gray(
        `NO FIX AVAILABLE (${data.noFixAvailable.length} packages, ${noFixAlerts} alerts)`
      )
    );

    for (const action of data.noFixAvailable) {
      const eco = action.ecosystem ? ` (${action.ecosystem})` : '';
      const repos = action.affectedRepos
        ? ` — ${action.affectedRepos} repos`
        : '';
      console.log(
        chalk.gray(
          `  ${action.packageName}${eco} — ${action.alertCount} alert${action.alertCount > 1 ? 's' : ''} — no patched version yet${repos}`
        )
      );
    }
    console.log();
  }
}

function renderAction(action: FixAction, showRepos: boolean): void {
  const eco = action.ecosystem ? ` (${action.ecosystem})` : '';
  const version = action.patchedVersion
    ? ` — update to >=${action.patchedVersion}`
    : '';
  const repos = showRepos && action.affectedRepos
    ? ` — ${action.affectedRepos} repos`
    : '';

  console.log(
    `  ${action.packageName}${eco} — ${action.alertCount} alert${action.alertCount > 1 ? 's' : ''}${version}${repos}`
  );

  const ids = [...action.ghsaIds, ...action.cveIds.filter((id) => !action.ghsaIds.length)];
  const manifestInfo = action.manifestPaths.length > 0
    ? ` (via ${action.manifestPaths.join(', ')})`
    : '';

  if (ids.length > 0 || manifestInfo) {
    console.log(chalk.gray(`    ${ids.join(', ')}${manifestInfo}`));
  }
}

function getSeverityColor(severity: string): typeof chalk.red {
  switch (severity) {
    case 'critical':
      return chalk.red.bold;
    case 'high':
      return chalk.red;
    case 'medium':
      return chalk.yellow;
    case 'low':
      return chalk.blue;
    default:
      return chalk.gray;
  }
}
