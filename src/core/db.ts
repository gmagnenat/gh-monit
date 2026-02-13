import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

import type {
  AlertTimelineEntry,
  DependencyGroup,
  EcosystemBreakdown,
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

export const DEFAULT_DB_PATH = path.join(
  os.homedir(),
  ".gh-monit",
  "gh-monit.db"
);

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
      "SELECT h1.repo, h1.severity,",
      "  AVG(julianday(h2.recorded_at) - julianday(h1.recorded_at)) AS avg_days,",
      "  COUNT(*) AS resolved_count",
      "FROM alert_history h1",
      "JOIN alert_history h2",
      "  ON h1.repo = h2.repo AND h1.alert_number = h2.alert_number",
      "WHERE h1.state = 'open' AND h2.state IN ('fixed', 'dismissed')",
      "  AND h1.id = (SELECT MIN(id) FROM alert_history",
      "               WHERE repo = h1.repo AND alert_number = h1.alert_number AND state = 'open')",
      "  AND h2.id = (SELECT MIN(id) FROM alert_history",
      "               WHERE repo = h1.repo AND alert_number = h1.alert_number AND state IN ('fixed', 'dismissed'))",
      "  AND (h1.repo = @repo OR @repo IS NULL)",
      "GROUP BY h1.repo, h1.severity",
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
      "SELECT a.repo, a.alert_number, a.severity, a.package_name, a.html_url,",
      "  h.recorded_at AS first_seen,",
      "  julianday('now') - julianday(h.recorded_at) AS open_days",
      "FROM alerts a",
      "JOIN alert_history h ON a.repo = h.repo AND a.alert_number = h.alert_number",
      "WHERE a.state = 'open'",
      "  AND h.id = (SELECT MIN(id) FROM alert_history",
      "              WHERE repo = a.repo AND alert_number = a.alert_number)",
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
