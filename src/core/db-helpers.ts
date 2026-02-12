import type Database from "better-sqlite3";

/**
 * Minimal schema interface compatible with Zod's `.parse()`.
 * Keeps helpers framework-agnostic — no Zod import needed here.
 */
export type Schema<T> = { parse: (data: unknown) => T };

// --- Case conversion ---

/** Converts a snake_case string to camelCase. */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** Converts a camelCase string to snake_case. */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

// --- Row mapping ---

/** Maps a snake_case DB row object to camelCase keys. */
export function mapRow(row: Record<string, unknown>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    mapped[snakeToCamel(key)] = value;
  }
  return mapped;
}

// --- Typed query helpers ---

/**
 * Runs a SQL query and returns all rows, auto-mapped from snake_case to
 * camelCase and validated by the provided schema.
 *
 * @param params - A single positional value, a named-params object, or omitted.
 */
export function queryAll<T>(
  db: Database.Database,
  sql: string,
  schema: Schema<T>,
  params?: unknown
): T[] {
  const stmt = db.prepare(sql);
  const raw =
    params !== undefined
      ? (stmt.all(params as never) as Record<string, unknown>[])
      : (stmt.all() as Record<string, unknown>[]);
  return raw.map((row) => schema.parse(mapRow(row)));
}

/**
 * Runs a SQL query and returns the first row, auto-mapped and validated.
 * Returns undefined when no rows match.
 */
export function queryGet<T>(
  db: Database.Database,
  sql: string,
  schema: Schema<T>,
  params?: unknown
): T | undefined {
  const stmt = db.prepare(sql);
  const raw =
    params !== undefined
      ? (stmt.get(params as never) as Record<string, unknown> | undefined)
      : (stmt.get() as Record<string, unknown> | undefined);
  if (!raw) return undefined;
  return schema.parse(mapRow(raw));
}

// --- SQL generation helpers ---

/**
 * Generates an `INSERT ... ON CONFLICT ... DO UPDATE SET` SQL statement.
 *
 * @param table      - Table name
 * @param fields     - camelCase property names (used for @param bindings)
 * @param conflictKeys - camelCase property names for the ON CONFLICT clause
 */
export function buildUpsert(
  table: string,
  fields: string[],
  conflictKeys: string[]
): string {
  const cols = fields.map(camelToSnake);
  const vals = fields.map((f) => `@${f}`);
  const conflict = conflictKeys.map(camelToSnake);
  const updates = fields
    .filter((f) => !conflictKeys.includes(f))
    .map((f) => {
      const col = camelToSnake(f);
      return `${col} = excluded.${col}`;
    });

  return [
    `INSERT INTO ${table} (${cols.join(", ")})`,
    `VALUES (${vals.join(", ")})`,
    `ON CONFLICT(${conflict.join(", ")}) DO UPDATE SET`,
    updates.join(", "),
  ].join(" ");
}

/**
 * Generates a simple `INSERT INTO` SQL statement.
 *
 * @param table  - Table name
 * @param fields - camelCase property names (used for @param bindings)
 */
export function buildInsert(table: string, fields: string[]): string {
  const cols = fields.map(camelToSnake);
  const vals = fields.map((f) => `@${f}`);
  return `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${vals.join(", ")})`;
}

// --- Migration runner ---

/** A single schema migration step. */
export type Migration = {
  version: number;
  up: (db: Database.Database) => void;
};

/**
 * Runs pending migrations in order.
 * Tracks the current schema version in a `_meta` table.
 * Safe to call on every startup — already-applied migrations are skipped.
 */
export function runMigrations(
  db: Database.Database,
  migrations: Migration[]
): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
  );

  const row = db
    .prepare("SELECT value FROM _meta WHERE key = 'schema_version'")
    .get() as { value: string } | undefined;
  const currentVersion = row ? Number(row.value) : 0;

  const pending = migrations
    .filter((m) => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  if (pending.length === 0) return;

  const updateVersion = db.prepare(
    "INSERT INTO _meta (key, value) VALUES ('schema_version', @version) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );

  const migrate = db.transaction(() => {
    for (const migration of pending) {
      migration.up(db);
      updateVersion.run({ version: String(migration.version) });
    }
  });

  migrate();
}
