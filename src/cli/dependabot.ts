import type { Command } from "commander";
import { z } from "zod";
import chalk from "chalk";
import {
  DEFAULT_DB_PATH,
  getCachedAlerts,
  openDatabase,
  resolveDbPath,
  saveAlerts,
} from "../core/db.js";
import { filterAlertsBySince, normalizeAlerts } from "../core/alerts.js";
import {
  fetchDependabotAlerts,
  listOrgRepos,
  listUserRepos,
} from "../core/github.js";
import type { RepoAlertsResult, RepoRef } from "../types.js";
import {
  renderOrgOutput,
  renderRepoOutput,
  renderUserOutput,
} from "../ui/output.js";

const repoSchema = z
  .string()
  .regex(/^[^/]+\/[^/]+$/, "Repo must be in owner/name format");

type DependabotOptions = {
  repo?: string;
  user?: string;
  org?: string;
  includeForks?: boolean;
  db: string;
  since?: string;
  json?: boolean;
  refresh?: boolean;
};

export function registerDependabotCommand(program: Command): void {
  program
    .command("dependabot")
    .description("Fetch Dependabot alerts for a repo or user")
    .option("--repo <owner/name>", "GitHub repo in owner/name format")
    .option("--user <username>", "GitHub username")
    .option("--org <org>", "GitHub organization")
    .option("--include-forks", "Include forked repos", false)
    .option("--db <path>", "Path to sqlite db", DEFAULT_DB_PATH)
    .option("--since <date>", "Filter alerts updated since ISO date")
    .option("--json", "Output alerts as JSON", false)
    .option("--refresh", "Bypass cache and fetch fresh data", false)
    .action(async (options: DependabotOptions) => {
      const target = resolveTarget(options);
      if (!target) {
        return;
      }

      const sinceDate = parseSinceDate(options.since);
      if (options.since && !sinceDate) {
        return;
      }

      const dbPath = resolveDbPath(options.db);
      const db = openDatabase(dbPath);

      if (target.type === "repo") {
        const result = await loadRepoAlerts(db, target.repo, options.refresh ?? false);
        if (!result) {
          return;
        }

        const filteredResult = applySinceFilter(result, sinceDate);

        if (options.json) {
          process.stdout.write(`${JSON.stringify(filteredResult, null, 2)}\n`);
          return;
        }

        renderRepoOutput(filteredResult);
        return;
      }

      const repoList = await loadTargetRepos(target, options.includeForks ?? false);
      if (!repoList) {
        return;
      }

      const results: RepoAlertsResult[] = [];
      for (const repo of repoList) {
        const result = await loadRepoAlerts(db, repo, options.refresh ?? false);
        if (result) {
          results.push(applySinceFilter(result, sinceDate));
        }
      }

      if (options.json) {
        const payload =
          target.type === "user"
            ? { user: target.username, repos: results }
            : { org: target.org, repos: results };
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        return;
      }

      if (target.type === "user") {
        renderUserOutput(target.username, results);
      } else {
        renderOrgOutput(target.org, results);
      }
    });
}

async function loadRepoAlerts(
  db: ReturnType<typeof openDatabase>,
  repo: RepoRef,
  refresh: boolean
): Promise<RepoAlertsResult | null> {
  const cached = getCachedAlerts(db, repo.fullName);
  let alerts = cached.alerts;
  let lastSync = cached.lastSync;
  let usedCache = !refresh && cached.hasCache;

  if (refresh || !cached.hasCache) {
    const fetchedAlerts = await fetchDependabotAlerts(repo);
    if (fetchedAlerts) {
      alerts = normalizeAlerts(repo.fullName, fetchedAlerts);
      lastSync = new Date().toISOString();
      saveAlerts(db, repo.fullName, alerts, lastSync);
      usedCache = false;
    } else if (!cached.hasCache) {
      return null;
    } else {
      usedCache = true;
      console.warn(
        chalk.yellow(`Using cached alerts for ${repo.fullName} due to fetch error.`)
      );
    }
  }

  return {
    repo,
    alerts,
    lastSync,
    usedCache,
  };
}

function resolveTarget(
  options: DependabotOptions
):
  | { type: "repo"; repo: RepoRef }
  | { type: "user"; username: string }
  | { type: "org"; org: string }
  | null {
  const hasRepo = Boolean(options.repo);
  const hasUser = Boolean(options.user);
  const hasOrg = Boolean(options.org);
  const targetCount = [hasRepo, hasUser, hasOrg].filter(Boolean).length;

  if (targetCount !== 1) {
    console.error(
      chalk.red("Specify exactly one of --repo, --user, or --org for dependabot.")
    );
    process.exitCode = 1;
    return null;
  }

  if (options.repo) {
    return { type: "repo", repo: parseRepo(options.repo) };
  }

  if (options.org) {
    return { type: "org", org: options.org };
  }

  return { type: "user", username: options.user ?? "" };
}

function parseRepo(repoInput: string): RepoRef {
  const repoValue = repoSchema.parse(repoInput);
  const [owner, name] = repoValue.split("/");
  return {
    owner,
    name,
    fullName: repoValue,
  };
}

async function loadTargetRepos(
  target: { type: "user"; username: string } | { type: "org"; org: string },
  includeForks: boolean
): Promise<RepoRef[] | null> {
  if (target.type === "user") {
    return listUserRepos(target.username, includeForks);
  }
  return listOrgRepos(target.org, includeForks);
}

function parseSinceDate(since?: string): Date | null {
  if (!since) {
    return null;
  }

  const parsed = new Date(since);
  if (Number.isNaN(parsed.valueOf())) {
    console.error(chalk.red("Invalid --since date. Use ISO format (YYYY-MM-DD)."));
    process.exitCode = 1;
    return null;
  }

  return parsed;
}

function applySinceFilter(
  result: RepoAlertsResult,
  since: Date | null
): RepoAlertsResult {
  if (!since) {
    return result;
  }

  return {
    ...result,
    alerts: filterAlertsBySince(result.alerts, since),
  };
}
