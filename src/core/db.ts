import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NormalizedAlert } from "../types.js";

export const DEFAULT_DB_PATH = path.join(
  os.homedir(),
  ".gh-monit",
  "gh-monit.db"
);

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
  return db;
}

export function getCachedAlerts(
  db: Database.Database,
  repo: string
): { alerts: NormalizedAlert[]; lastSync: string | null; hasCache: boolean } {
  const sync = db
    .prepare("SELECT last_sync FROM repo_sync WHERE repo = ?")
    .get(repo) as { last_sync: string } | undefined;

  if (!sync) {
    return { alerts: [], lastSync: null, hasCache: false };
  }

  const rows = db
    .prepare(
      "SELECT repo, alert_number, state, severity, package_name, manifest_path, ecosystem, created_at, updated_at, dismissed_at, fixed_at, html_url, raw_json FROM alerts WHERE repo = ?"
    )
    .all(repo) as Array<{
    repo: string;
    alert_number: number;
    state: string;
    severity: string;
    package_name: string | null;
    manifest_path: string | null;
    ecosystem: string | null;
    created_at: string | null;
    updated_at: string | null;
    dismissed_at: string | null;
    fixed_at: string | null;
    html_url: string | null;
    raw_json: string;
  }>;

  const alerts = rows.map((row) => ({
    repo: row.repo,
    alertNumber: row.alert_number,
    state: row.state,
    severity: row.severity,
    packageName: row.package_name,
    manifestPath: row.manifest_path,
    ecosystem: row.ecosystem,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dismissedAt: row.dismissed_at,
    fixedAt: row.fixed_at,
    htmlUrl: row.html_url,
    rawJson: row.raw_json,
  }));

  return {
    alerts,
    lastSync: sync.last_sync,
    hasCache: true,
  };
}

export function saveAlerts(
  db: Database.Database,
  repo: string,
  alerts: NormalizedAlert[],
  lastSync: string
): void {
  const existingRows = db
    .prepare("SELECT alert_number, state, severity FROM alerts WHERE repo = ?")
    .all(repo) as Array<{
    alert_number: number;
    state: string;
    severity: string;
  }>;
  const existingMap = new Map<number, { state: string; severity: string }>();
  for (const row of existingRows) {
    existingMap.set(row.alert_number, {
      state: row.state,
      severity: row.severity,
    });
  }

  const insert = db.prepare(
    [
      "INSERT INTO alerts",
      "(repo, alert_number, state, severity, package_name, manifest_path, ecosystem, created_at, updated_at, dismissed_at, fixed_at, html_url, raw_json)",
      "VALUES",
      "(@repo, @alertNumber, @state, @severity, @packageName, @manifestPath, @ecosystem, @createdAt, @updatedAt, @dismissedAt, @fixedAt, @htmlUrl, @rawJson)",
      "ON CONFLICT(repo, alert_number) DO UPDATE SET",
      "state = excluded.state,",
      "severity = excluded.severity,",
      "package_name = excluded.package_name,",
      "manifest_path = excluded.manifest_path,",
      "ecosystem = excluded.ecosystem,",
      "created_at = excluded.created_at,",
      "updated_at = excluded.updated_at,",
      "dismissed_at = excluded.dismissed_at,",
      "fixed_at = excluded.fixed_at,",
      "html_url = excluded.html_url,",
      "raw_json = excluded.raw_json",
    ].join(" ")
  );
  const insertHistory = db.prepare(
    [
      "INSERT INTO alert_history",
      "(repo, alert_number, state, severity, recorded_at, raw_json)",
      "VALUES",
      "(@repo, @alertNumber, @state, @severity, @recordedAt, @rawJson)",
    ].join(" ")
  );
  const updateSync = db.prepare(
    "INSERT INTO repo_sync (repo, last_sync) VALUES (?, ?) ON CONFLICT(repo) DO UPDATE SET last_sync = excluded.last_sync"
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
    updateSync.run(repo, lastSync);
  });

  transaction();
}
