import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

import type {
  AlertTimelineEntry,
  DependencyGroup,
  EcosystemBreakdown,
  FixAction,
  FixAdvisorResponse,
  MttrMetric,
  NormalizedAlert,
  RepoSummary,
  SlaViolation,
  TrendPoint,
  VulnerabilityGroup,
} from "../types.js";
import { sortAlerts } from "./alerts.js";
import {
  buildInsert,
  buildUpsert,
  queryAll,
  queryGet,
  runMigrations,
  type Migration,
} from "./db-helpers.js";

// --- Constants ---

export const DEFAULT_DB_PATH =
  process.env.GH_MONIT_DB_PATH ??
  path.join(os.homedir(), '.gh-monit', 'gh-monit.db');

// --- Row schemas (validate camelCase-mapped DB rows via Zod) ---

const alertSchema = z.object({
  repo: z.string(),
  alertNumber: z.number(),
  state: z.string(),
  severity: z.string(),
  packageName: z.string().nullable(),
  manifestPath: z.string().nullable(),
  ecosystem: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  dismissedAt: z.string().nullable(),
  fixedAt: z.string().nullable(),
  htmlUrl: z.string().nullable(),
  ghsaId: z.string().nullable(),
  cveId: z.string().nullable(),
  advisorySummary: z.string().nullable(),
  cvssScore: z.number().nullable(),
  patchedVersion: z.string().nullable(),
  rawJson: z.string(),
});

const syncRowSchema = z.object({
  lastSync: z.string(),
});

const summaryRowSchema = z.object({
  repo: z.string(),
  lastSync: z.string(),
  severity: z.string().nullable(),
  count: z.number(),
});

const trendRowSchema = z.object({
  day: z.string(),
  severity: z.string(),
  count: z.number(),
});

const mttrRowSchema = z.object({
  repo: z.string(),
  severity: z.string().transform((s) => s.toLowerCase()),
  avgDays: z.number().transform((v) => Math.round(v * 10) / 10),
  resolvedCount: z.number(),
});

const timelineRowSchema = z.object({
  alertNumber: z.number(),
  state: z.string(),
  severity: z.string().transform((s) => s.toLowerCase()),
  recordedAt: z.string(),
});

const slaRowSchema = z.object({
  repo: z.string(),
  alertNumber: z.number(),
  severity: z.string(),
  packageName: z.string().nullable(),
  htmlUrl: z.string().nullable(),
  firstSeen: z.string(),
  openDays: z.number(),
});

const vulnRowSchema = z.object({
  ghsaId: z.string(),
  cveId: z.string().nullable(),
  severity: z.string().transform((s) => s.toLowerCase()),
  summary: z.string().nullable(),
  cvssScore: z.number().nullable(),
  patchedVersion: z.string().nullable(),
  affectedRepos: z.number(),
  totalAlerts: z.number(),
  repos: z
    .string()
    .nullable()
    .transform((s) => (s ? s.split(",") : [])),
});

const depRowSchema = z.object({
  packageName: z.string(),
  ecosystem: z.string().nullable(),
  totalAlerts: z.number(),
  affectedRepos: z.number(),
  criticalCount: z.number(),
  highCount: z.number(),
  repos: z
    .string()
    .nullable()
    .transform((s) => (s ? s.split(",") : [])),
});

const ecoRowSchema = z.object({
  ecosystem: z.string(),
  totalAlerts: z.number(),
  affectedRepos: z.number(),
  uniquePackages: z.number(),
});

const existingAlertSchema = z.object({
  alertNumber: z.number(),
  state: z.string(),
  severity: z.string(),
});

// --- Field lists for INSERT helpers ---

const ALERT_FIELDS = [
  "repo",
  "alertNumber",
  "state",
  "severity",
  "packageName",
  "manifestPath",
  "ecosystem",
  "createdAt",
  "updatedAt",
  "dismissedAt",
  "fixedAt",
  "htmlUrl",
  "ghsaId",
  "cveId",
  "advisorySummary",
  "cvssScore",
  "patchedVersion",
  "rawJson",
];

const HISTORY_FIELDS = [
  "repo",
  "alertNumber",
  "state",
  "severity",
  "recordedAt",
  "rawJson",
];

// --- Migrations ---

const migrations: Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(
        [
          "CREATE TABLE IF NOT EXISTS alerts (",
          "  repo TEXT NOT NULL,",
          "  alert_number INTEGER NOT NULL,",
          "  state TEXT NOT NULL,",
          "  severity TEXT NOT NULL,",
          "  package_name TEXT,",
          "  manifest_path TEXT,",
          "  ecosystem TEXT,",
          "  created_at TEXT,",
          "  updated_at TEXT,",
          "  dismissed_at TEXT,",
          "  fixed_at TEXT,",
          "  html_url TEXT,",
          "  raw_json TEXT NOT NULL,",
          "  PRIMARY KEY (repo, alert_number)",
          ");",
          "CREATE TABLE IF NOT EXISTS repo_sync (",
          "  repo TEXT PRIMARY KEY,",
          "  last_sync TEXT NOT NULL",
          ");",
          "CREATE TABLE IF NOT EXISTS alert_history (",
          "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
          "  repo TEXT NOT NULL,",
          "  alert_number INTEGER NOT NULL,",
          "  state TEXT NOT NULL,",
          "  severity TEXT NOT NULL,",
          "  recorded_at TEXT NOT NULL,",
          "  raw_json TEXT NOT NULL",
          ");",
        ].join("\n")
      );
    },
  },
  {
    version: 2,
    up: (db) => {
      const columns = [
        "ghsa_id TEXT",
        "cve_id TEXT",
        "advisory_summary TEXT",
        "cvss_score REAL",
        "patched_version TEXT",
      ];
      for (const col of columns) {
        try {
          db.exec(`ALTER TABLE alerts ADD COLUMN ${col}`);
        } catch {
          // Column already exists — safe to ignore
        }
      }

      db.exec(
        [
          "UPDATE alerts SET",
          "  ghsa_id = json_extract(raw_json, '$.security_advisory.ghsa_id'),",
          "  cve_id = json_extract(raw_json, '$.security_advisory.cve_id'),",
          "  advisory_summary = json_extract(raw_json, '$.security_advisory.summary'),",
          "  cvss_score = json_extract(raw_json, '$.security_advisory.cvss.score'),",
          "  patched_version = json_extract(raw_json, '$.security_vulnerability.first_patched_version.identifier')",
          "WHERE ghsa_id IS NULL AND raw_json IS NOT NULL",
        ].join(" ")
      );
    },
  },
  {
    version: 3,
    up: (db) => {
      db.exec(
        [
          "CREATE INDEX IF NOT EXISTS idx_alerts_repo_state ON alerts(repo, state);",
          "CREATE INDEX IF NOT EXISTS idx_history_repo_alert ON alert_history(repo, alert_number, state);",
        ].join("\n")
      );
    },
  },
  {
    version: 4,
    up: (db) => {
      db.exec(
        [
          "CREATE TABLE IF NOT EXISTS dependency_chain (",
          "  repo TEXT NOT NULL,",
          "  vulnerable_package TEXT NOT NULL,",
          "  direct_dependency TEXT NOT NULL,",
          "  direct_version TEXT,",
          "  chain_depth INTEGER NOT NULL DEFAULT 0,",
          "  updated_at TEXT NOT NULL,",
          "  PRIMARY KEY (repo, vulnerable_package)",
          ");",
          "CREATE INDEX IF NOT EXISTS idx_chain_direct ON dependency_chain(direct_dependency);",
        ].join("\n")
      );
    },
  },
];

// --- Database setup ---

export function resolveDbPath(dbPath: string): string {
  if (dbPath === DEFAULT_DB_PATH) {
    const dir = path.dirname(dbPath);
    fs.mkdirSync(dir, { recursive: true });
  } else {
    const dir = path.dirname(path.resolve(dbPath));
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.resolve(dbPath);
}

export function openDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  runMigrations(db, migrations);
  return db;
}

// --- Database management ---

/** Deletes all alert and sync data, leaving the schema intact. */
export function clearDatabase(db: Database.Database): void {
  db.exec('DELETE FROM alert_history; DELETE FROM alerts; DELETE FROM repo_sync; DELETE FROM dependency_chain;');
}

/** Removes all data for a single tracked repository. */
export function removeRepo(db: Database.Database, fullName: string): void {
  db.transaction(() => {
    db.prepare('DELETE FROM alert_history WHERE repo = ?').run(fullName);
    db.prepare('DELETE FROM alerts WHERE repo = ?').run(fullName);
    db.prepare('DELETE FROM repo_sync WHERE repo = ?').run(fullName);
    db.prepare('DELETE FROM dependency_chain WHERE repo = ?').run(fullName);
  })();
}

// --- CRUD operations ---

export function getCachedAlerts(
  db: Database.Database,
  repo: string
): { alerts: NormalizedAlert[]; lastSync: string | null; hasCache: boolean } {
  const sync = queryGet(
    db,
    "SELECT last_sync FROM repo_sync WHERE repo = ?",
    syncRowSchema,
    repo
  );

  if (!sync) {
    return { alerts: [], lastSync: null, hasCache: false };
  }

  const alerts = queryAll(
    db,
    [
      "SELECT repo, alert_number, state, severity, package_name, manifest_path,",
      "  ecosystem, created_at, updated_at, dismissed_at, fixed_at, html_url,",
      "  ghsa_id, cve_id, advisory_summary, cvss_score, patched_version, raw_json",
      "FROM alerts WHERE repo = ?",
    ].join(" "),
    alertSchema,
    repo
  );

  return { alerts, lastSync: sync.lastSync, hasCache: true };
}

export function saveAlerts(
  db: Database.Database,
  repo: string,
  alerts: NormalizedAlert[],
  lastSync: string
): void {
  const existingRows = queryAll(
    db,
    "SELECT alert_number, state, severity FROM alerts WHERE repo = ?",
    existingAlertSchema,
    repo
  );
  const existingMap = new Map<number, { state: string; severity: string }>();
  for (const row of existingRows) {
    existingMap.set(row.alertNumber, {
      state: row.state,
      severity: row.severity,
    });
  }

  const insert = db.prepare(
    buildUpsert("alerts", ALERT_FIELDS, ["repo", "alertNumber"])
  );
  const insertHistory = db.prepare(buildInsert("alert_history", HISTORY_FIELDS));
  const updateSync = db.prepare(
    buildUpsert("repo_sync", ["repo", "lastSync"], ["repo"])
  );

  const transaction = db.transaction(() => {
    for (const alert of alerts) {
      const existing = existingMap.get(alert.alertNumber);
      const hasChanged =
        !existing ||
        existing.state !== alert.state ||
        existing.severity !== alert.severity;

      if (hasChanged) {
        insertHistory.run({
          repo,
          alertNumber: alert.alertNumber,
          state: alert.state,
          severity: alert.severity,
          recordedAt: lastSync,
          rawJson: alert.rawJson,
        });
      }

      insert.run(alert);
    }
    updateSync.run({ repo, lastSync });
  });

  transaction();
}

// --- Read queries ---

const globalSummaryRowSchema = z.object({
  totalRepos: z.number(),
  totalAlerts: z.number(),
  severity: z.string().nullable(),
  count: z.number(),
});

/**
 * Returns global summary totals (total repos, total alerts, per-severity counts)
 * without fetching per-repo breakdowns — cheaper than getAllRepoSummaries().
 */
export function getGlobalSummary(
  db: Database.Database
): { totalRepos: number; totalAlerts: number; severityCounts: Record<string, number> } {
  const rows = queryAll(
    db,
    [
      "SELECT",
      "  (SELECT COUNT(*) FROM repo_sync) AS total_repos,",
      "  COUNT(a.alert_number) AS total_alerts,",
      "  a.severity,",
      "  COUNT(a.alert_number) AS count",
      "FROM alerts a",
      "WHERE a.state = 'open'",
      "GROUP BY a.severity",
    ].join(" "),
    globalSummaryRowSchema
  );

  const severityCounts: Record<string, number> = {};
  let totalAlerts = 0;
  let totalRepos = 0;

  for (const row of rows) {
    totalRepos = row.totalRepos;
    if (row.severity) {
      const key = row.severity.toLowerCase();
      severityCounts[key] = row.count;
      totalAlerts += row.count;
    }
  }

  // Handle case with no open alerts (rows will be empty)
  if (rows.length === 0) {
    const countRow = queryGet(
      db,
      "SELECT COUNT(*) AS total_repos FROM repo_sync",
      z.object({ totalRepos: z.number() })
    );
    totalRepos = countRow?.totalRepos ?? 0;
  }

  return { totalRepos, totalAlerts, severityCounts };
}

/**
 * Returns all tracked repos with their severity counts and last sync time.
 * Pivots grouped rows into RepoSummary objects in code.
 */
export function getAllRepoSummaries(db: Database.Database): RepoSummary[] {
  const rows = queryAll(
    db,
    [
      "SELECT rs.repo, rs.last_sync, a.severity, COUNT(*) AS count",
      "FROM repo_sync rs",
      "LEFT JOIN alerts a ON a.repo = rs.repo AND a.state = 'open'",
      "GROUP BY rs.repo, a.severity",
      "ORDER BY rs.repo",
    ].join(" "),
    summaryRowSchema
  );

  const repoMap = new Map<string, RepoSummary>();

  for (const row of rows) {
    let summary = repoMap.get(row.repo);
    if (!summary) {
      summary = {
        repo: row.repo,
        lastSync: row.lastSync,
        severityCounts: {},
        totalAlerts: 0,
      };
      repoMap.set(row.repo, summary);
    }

    if (row.severity) {
      const key = row.severity.toLowerCase();
      summary.severityCounts[key] = row.count;
      summary.totalAlerts += row.count;
    }
  }

  return [...repoMap.values()];
}

/**
 * Returns sorted alerts for a given repo from the cache.
 */
export function getRepoAlerts(
  db: Database.Database,
  repo: string
): { alerts: NormalizedAlert[]; lastSync: string | null } {
  const cached = getCachedAlerts(db, repo);
  return {
    alerts: sortAlerts(cached.alerts),
    lastSync: cached.lastSync,
  };
}

// --- History analytics queries ---

const DEFAULT_SLA_LIMITS: Record<string, number> = {
  critical: 2,
  high: 7,
  medium: 30,
  low: 90,
};

/**
 * Returns daily counts of open alerts grouped by severity.
 * Reconstructs daily snapshots from the alert_history table.
 */
export function getTrendData(
  db: Database.Database,
  repo?: string | null
): TrendPoint[] {
  const rows = queryAll(
    db,
    [
      "SELECT date(recorded_at) AS day, severity, COUNT(DISTINCT alert_number) AS count",
      "FROM alert_history",
      "WHERE state = 'open'",
      "  AND (repo = @repo OR @repo IS NULL)",
      "GROUP BY day, severity",
      "ORDER BY day",
    ].join(" "),
    trendRowSchema,
    { repo: repo ?? null }
  );

  const dayMap = new Map<string, TrendPoint>();

  for (const row of rows) {
    let point = dayMap.get(row.day);
    if (!point) {
      point = { day: row.day, critical: 0, high: 0, medium: 0, low: 0 };
      dayMap.set(row.day, point);
    }
    const key = row.severity.toLowerCase() as keyof Omit<TrendPoint, "day">;
    if (key in point) {
      point[key] = row.count;
    }
  }

  return [...dayMap.values()];
}

/**
 * Computes mean time to remediate per repo and severity.
 */
export function getMttrMetrics(
  db: Database.Database,
  repo?: string | null
): MttrMetric[] {
  return queryAll(
    db,
    [
      "WITH first_events AS (",
      "  SELECT repo, alert_number, state, severity,",
      "         MIN(id) AS first_id, MIN(recorded_at) AS first_at",
      "  FROM alert_history",
      "  GROUP BY repo, alert_number, state",
      ")",
      "SELECT open_ev.repo, open_ev.severity,",
      "  AVG(julianday(res_ev.first_at) - julianday(open_ev.first_at)) AS avg_days,",
      "  COUNT(*) AS resolved_count",
      "FROM first_events open_ev",
      "JOIN first_events res_ev",
      "  ON open_ev.repo = res_ev.repo AND open_ev.alert_number = res_ev.alert_number",
      "WHERE open_ev.state = 'open'",
      "  AND res_ev.state IN ('fixed', 'dismissed')",
      "  AND (open_ev.repo = @repo OR @repo IS NULL)",
      "GROUP BY open_ev.repo, open_ev.severity",
    ].join(" "),
    mttrRowSchema,
    { repo: repo ?? null }
  );
}

/**
 * Returns all history entries for a given repo.
 */
export function getAlertTimeline(
  db: Database.Database,
  repo: string
): AlertTimelineEntry[] {
  return queryAll(
    db,
    [
      "SELECT alert_number, state, severity, recorded_at",
      "FROM alert_history",
      "WHERE repo = ?",
      "ORDER BY alert_number, recorded_at",
    ].join(" "),
    timelineRowSchema,
    repo
  );
}

/**
 * Checks currently open alerts against SLA thresholds.
 */
export function getSlaViolations(
  db: Database.Database,
  slaConfig?: Record<string, number>
): SlaViolation[] {
  const limits = { ...DEFAULT_SLA_LIMITS, ...slaConfig };

  const rows = queryAll(
    db,
    [
      "WITH first_open AS (",
      "  SELECT repo, alert_number, MIN(recorded_at) AS first_at",
      "  FROM alert_history",
      "  GROUP BY repo, alert_number",
      ")",
      "SELECT a.repo, a.alert_number, a.severity, a.package_name, a.html_url,",
      "  fo.first_at AS first_seen,",
      "  julianday('now') - julianday(fo.first_at) AS open_days",
      "FROM alerts a",
      "JOIN first_open fo ON a.repo = fo.repo AND a.alert_number = fo.alert_number",
      "WHERE a.state = 'open'",
    ].join(" "),
    slaRowSchema
  );

  return rows
    .map((row) => {
      const severity = row.severity.toLowerCase();
      const slaLimitDays = limits[severity] ?? 90;
      const openDays = Math.round(row.openDays * 10) / 10;

      return {
        repo: row.repo,
        alertNumber: row.alertNumber,
        severity,
        packageName: row.packageName,
        htmlUrl: row.htmlUrl,
        firstSeen: row.firstSeen,
        openDays,
        slaLimitDays,
        overdue: openDays > slaLimitDays,
      };
    })
    .sort((a, b) => {
      const aDiff = a.openDays - a.slaLimitDays;
      const bDiff = b.openDays - b.slaLimitDays;
      return bDiff - aDiff;
    });
}

// --- Cross-repo vulnerability & dependency queries ---

/**
 * Groups open alerts by GHSA advisory across all repos.
 */
export function getVulnerabilityGroups(
  db: Database.Database
): VulnerabilityGroup[] {
  return queryAll(
    db,
    [
      "SELECT ghsa_id, cve_id, severity, advisory_summary AS summary, cvss_score, patched_version,",
      "  COUNT(DISTINCT repo) AS affected_repos,",
      "  COUNT(*) AS total_alerts,",
      "  GROUP_CONCAT(DISTINCT repo) AS repos",
      "FROM alerts",
      "WHERE state = 'open' AND ghsa_id IS NOT NULL",
      "GROUP BY ghsa_id",
      "ORDER BY affected_repos DESC, cvss_score DESC",
    ].join(" "),
    vulnRowSchema
  );
}

/**
 * Groups open alerts by package across all repos.
 */
export function getDependencyLandscape(
  db: Database.Database
): DependencyGroup[] {
  return queryAll(
    db,
    [
      "SELECT package_name, ecosystem,",
      "  COUNT(*) AS total_alerts,",
      "  COUNT(DISTINCT repo) AS affected_repos,",
      "  SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) AS critical_count,",
      "  SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) AS high_count,",
      "  GROUP_CONCAT(DISTINCT repo) AS repos",
      "FROM alerts",
      "WHERE state = 'open' AND package_name IS NOT NULL",
      "GROUP BY package_name, ecosystem",
      "ORDER BY critical_count DESC, total_alerts DESC",
    ].join(" "),
    depRowSchema
  );
}

// --- Fix Advisor ---

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  unknown: 4,
};

function severityRank(s: string): number {
  return SEVERITY_RANK[s.toLowerCase()] ?? 4;
}

const fixAdvisorGroupSchema = z.object({
  packageName: z.string(),
  ecosystem: z.string().nullable(),
  manifestPaths: z
    .string()
    .nullable()
    .transform((s) => (s ? [...new Set(s.split(","))] : [])),
  ghsaIds: z
    .string()
    .nullable()
    .transform((s) => (s ? [...new Set(s.split(","))] : [])),
  cveIds: z
    .string()
    .nullable()
    .transform((s) => (s ? [...new Set(s.split(","))] : [])),
  maxCvssScore: z.number().nullable(),
  alertCount: z.number(),
  affectedRepos: z.number(),
  repos: z
    .string()
    .nullable()
    .transform((s) => (s ? [...new Set(s.split(","))] : [])),
  patchedVersion: z.string().nullable(),
});

const fixAdvisorAlertSchema = z.object({
  repo: z.string(),
  alertNumber: z.number(),
  severity: z.string().transform((s) => s.toLowerCase()),
  advisorySummary: z.string().nullable(),
  rawJson: z.string(),
  packageName: z.string(),
  ecosystem: z.string().nullable(),
});

/**
 * Groups open alerts by (package_name, ecosystem) into fix actions.
 * When repo is provided, scopes to that repo; otherwise aggregates cross-repo.
 */
export function getFixAdvisor(
  db: Database.Database,
  repo?: string | null
): FixAdvisorResponse {
  const isPerRepo = !!repo;

  const groups = queryAll(
    db,
    [
      "SELECT package_name, ecosystem,",
      "  GROUP_CONCAT(DISTINCT manifest_path) AS manifest_paths,",
      "  GROUP_CONCAT(DISTINCT ghsa_id) AS ghsa_ids,",
      "  GROUP_CONCAT(DISTINCT cve_id) AS cve_ids,",
      "  MAX(cvss_score) AS max_cvss_score,",
      "  COUNT(*) AS alert_count,",
      "  COUNT(DISTINCT repo) AS affected_repos,",
      "  GROUP_CONCAT(DISTINCT repo) AS repos,",
      "  MAX(patched_version) AS patched_version",
      "FROM alerts",
      "WHERE state = 'open' AND package_name IS NOT NULL",
      isPerRepo ? "  AND repo = @repo" : "",
      "GROUP BY package_name, ecosystem",
    ].join(" "),
    fixAdvisorGroupSchema,
    isPerRepo ? { repo } : undefined
  );

  // Fetch individual alerts to build per-group alert lists and severity breakdowns
  const alertDetails = queryAll(
    db,
    [
      "SELECT repo, alert_number, severity, advisory_summary, raw_json,",
      "  package_name, ecosystem",
      "FROM alerts",
      "WHERE state = 'open' AND package_name IS NOT NULL",
      isPerRepo ? "  AND repo = @repo" : "",
      "ORDER BY",
      "  CASE LOWER(severity)",
      "    WHEN 'critical' THEN 0 WHEN 'high' THEN 1",
      "    WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4",
      "  END,",
      "  alert_number",
    ].join(" "),
    fixAdvisorAlertSchema,
    isPerRepo ? { repo } : undefined
  );

  // Build lookup: "packageName|ecosystem" -> alert details
  const alertsByKey = new Map<string, typeof alertDetails>();
  for (const alert of alertDetails) {
    const key = `${alert.packageName}|${alert.ecosystem ?? ""}`;
    let list = alertsByKey.get(key);
    if (!list) {
      list = [];
      alertsByKey.set(key, list);
    }
    list.push(alert);
  }

  // Build fix actions
  const actions: FixAction[] = [];
  const noFixAvailable: FixAction[] = [];

  for (const group of groups) {
    const key = `${group.packageName}|${group.ecosystem ?? ""}`;
    const groupAlerts = alertsByKey.get(key) ?? [];

    // Compute severity breakdown
    const severityBreakdown: Record<string, number> = {};
    let bestSeverity = "unknown";
    let bestRank = 4;

    for (const alert of groupAlerts) {
      const sev = alert.severity;
      severityBreakdown[sev] = (severityBreakdown[sev] ?? 0) + 1;
      const rank = severityRank(sev);
      if (rank < bestRank) {
        bestRank = rank;
        bestSeverity = sev;
      }
    }

    // Extract scope from first alert's raw JSON
    let scope: string | null = null;
    if (groupAlerts.length > 0) {
      try {
        const raw = JSON.parse(groupAlerts[0].rawJson);
        scope = raw?.dependency?.scope ?? null;
      } catch {
        // ignore malformed JSON
      }
    }

    const hasFix = group.patchedVersion !== null;
    const action: FixAction = {
      packageName: group.packageName,
      ecosystem: group.ecosystem,
      manifestPaths: group.manifestPaths,
      scope,
      groupSeverity: bestSeverity,
      alertCount: group.alertCount,
      severityBreakdown,
      ghsaIds: group.ghsaIds,
      cveIds: group.cveIds,
      maxCvssScore: group.maxCvssScore,
      patchedVersion: group.patchedVersion,
      hasFix,
      alerts: groupAlerts.map((a) => ({
        ...(isPerRepo ? {} : { repo: a.repo }),
        alertNumber: a.alertNumber,
        severity: a.severity,
        summary: a.advisorySummary,
      })),
    };

    if (!isPerRepo) {
      action.affectedRepos = group.affectedRepos;
      action.repos = group.repos;
    }

    if (hasFix) {
      actions.push(action);
    } else {
      noFixAvailable.push(action);
    }
  }

  // Sort: severity desc, then alert count desc within tier
  const sortActions = (a: FixAction, b: FixAction) => {
    const sevDiff = severityRank(a.groupSeverity) - severityRank(b.groupSeverity);
    if (sevDiff !== 0) return sevDiff;
    return b.alertCount - a.alertCount;
  };
  actions.sort(sortActions);
  noFixAvailable.sort(sortActions);

  const totalAlerts = actions.reduce((s, a) => s + a.alertCount, 0)
    + noFixAvailable.reduce((s, a) => s + a.alertCount, 0);

  return {
    repo: repo ?? "all",
    totalActions: actions.length,
    totalAlerts,
    actions,
    noFixAvailable,
  };
}

// --- Dependency chain ---

import type { DependencyChain } from './lockfile.js';

const CHAIN_FIELDS = [
  "repo",
  "vulnerablePackage",
  "directDependency",
  "directVersion",
  "chainDepth",
  "updatedAt",
];

/**
 * Saves dependency chain mappings for a repo.
 * Upserts so re-syncs update existing rows.
 */
export function saveDependencyChains(
  db: Database.Database,
  repo: string,
  chains: DependencyChain[]
): void {
  const stmt = db.prepare(
    buildUpsert("dependency_chain", CHAIN_FIELDS, ["repo", "vulnerablePackage"])
  );

  const now = new Date().toISOString();
  const transaction = db.transaction(() => {
    // Clear old chains for this repo before saving new ones
    db.prepare("DELETE FROM dependency_chain WHERE repo = ?").run(repo);

    for (const chain of chains) {
      stmt.run({ ...chain, updatedAt: now });
    }
  });

  transaction();
}

const actionPlanRowSchema = z.object({
  directDependency: z.string(),
  directVersion: z.string().nullable(),
  criticalAlerts: z.number(),
  highAlerts: z.number(),
  totalAlerts: z.number(),
  affectedRepos: z.number(),
  repos: z
    .string()
    .nullable()
    .transform((s) => (s ? [...new Set(s.split(","))] : [])),
  vulnerablePackages: z
    .string()
    .nullable()
    .transform((s) => (s ? [...new Set(s.split(","))] : [])),
});

export type ActionPlanEntry = {
  directDependency: string;
  directVersion: string | null;
  criticalAlerts: number;
  highAlerts: number;
  totalAlerts: number;
  affectedRepos: number;
  repos: string[];
  vulnerablePackages: string[];
};

/**
 * Returns an action plan: direct dependencies to update, ranked by
 * how many critical+high alerts they would eliminate.
 */
export function getActionPlan(db: Database.Database): ActionPlanEntry[] {
  return queryAll(
    db,
    [
      "SELECT dc.direct_dependency, dc.direct_version,",
      "  SUM(CASE WHEN LOWER(a.severity) = 'critical' THEN 1 ELSE 0 END) AS critical_alerts,",
      "  SUM(CASE WHEN LOWER(a.severity) = 'high' THEN 1 ELSE 0 END) AS high_alerts,",
      "  COUNT(*) AS total_alerts,",
      "  COUNT(DISTINCT a.repo) AS affected_repos,",
      "  GROUP_CONCAT(DISTINCT a.repo) AS repos,",
      "  GROUP_CONCAT(DISTINCT a.package_name) AS vulnerable_packages",
      "FROM dependency_chain dc",
      "JOIN alerts a ON a.repo = dc.repo AND a.package_name = dc.vulnerable_package AND a.state = 'open'",
      "GROUP BY dc.direct_dependency",
      "ORDER BY critical_alerts DESC, high_alerts DESC, total_alerts DESC",
    ].join(" "),
    actionPlanRowSchema
  );
}

/**
 * Returns alert distribution by ecosystem.
 */
export function getEcosystemBreakdown(
  db: Database.Database
): EcosystemBreakdown[] {
  return queryAll(
    db,
    [
      "SELECT ecosystem,",
      "  COUNT(*) AS total_alerts,",
      "  COUNT(DISTINCT repo) AS affected_repos,",
      "  COUNT(DISTINCT package_name) AS unique_packages",
      "FROM alerts",
      "WHERE state = 'open' AND ecosystem IS NOT NULL",
      "GROUP BY ecosystem",
      "ORDER BY total_alerts DESC",
    ].join(" "),
    ecoRowSchema
  );
}
