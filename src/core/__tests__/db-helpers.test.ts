import { describe, it, expect } from "vitest";
import {
  snakeToCamel,
  camelToSnake,
  mapRow,
  buildUpsert,
  buildInsert,
  runMigrations,
  type Migration,
} from "../db-helpers.js";
import Database from "better-sqlite3";

// --- Case conversion ---

describe("snakeToCamel", () => {
  it("converts snake_case to camelCase", () => {
    expect(snakeToCamel("alert_number")).toBe("alertNumber");
    expect(snakeToCamel("created_at")).toBe("createdAt");
    expect(snakeToCamel("html_url")).toBe("htmlUrl");
  });

  it("handles multiple underscores", () => {
    expect(snakeToCamel("first_patched_version")).toBe("firstPatchedVersion");
  });

  it("handles strings with no underscores", () => {
    expect(snakeToCamel("repo")).toBe("repo");
  });

  it("handles numeric segments", () => {
    expect(snakeToCamel("version_2_name")).toBe("version2Name");
  });
});

describe("camelToSnake", () => {
  it("converts camelCase to snake_case", () => {
    expect(camelToSnake("alertNumber")).toBe("alert_number");
    expect(camelToSnake("createdAt")).toBe("created_at");
    expect(camelToSnake("htmlUrl")).toBe("html_url");
  });

  it("handles strings with no uppercase", () => {
    expect(camelToSnake("repo")).toBe("repo");
  });
});

describe("mapRow", () => {
  it("maps snake_case keys to camelCase", () => {
    const row = { alert_number: 1, created_at: "2024-01-01", repo: "foo/bar" };
    expect(mapRow(row)).toEqual({
      alertNumber: 1,
      createdAt: "2024-01-01",
      repo: "foo/bar",
    });
  });
});

// --- SQL generation ---

describe("buildUpsert", () => {
  it("generates correct upsert SQL", () => {
    const sql = buildUpsert(
      "alerts",
      ["repo", "alertNumber", "state"],
      ["repo", "alertNumber"]
    );
    expect(sql).toContain("INSERT INTO alerts");
    expect(sql).toContain("repo, alert_number, state");
    expect(sql).toContain("@repo, @alertNumber, @state");
    expect(sql).toContain("ON CONFLICT(repo, alert_number)");
    expect(sql).toContain("state = excluded.state");
    // Conflict keys should not appear in the UPDATE SET clause
    expect(sql).not.toContain("repo = excluded.repo");
  });
});

describe("buildInsert", () => {
  it("generates correct insert SQL", () => {
    const sql = buildInsert("alert_history", ["repo", "alertNumber", "state"]);
    expect(sql).toContain("INSERT INTO alert_history");
    expect(sql).toContain("repo, alert_number, state");
    expect(sql).toContain("@repo, @alertNumber, @state");
  });
});

// --- Migration runner ---

describe("runMigrations", () => {
  it("runs pending migrations in version order", () => {
    const db = new Database(":memory:");
    const order: number[] = [];

    const migrations: Migration[] = [
      { version: 3, up: () => order.push(3) },
      { version: 1, up: () => order.push(1) },
      { version: 2, up: () => order.push(2) },
    ];

    runMigrations(db, migrations);
    expect(order).toEqual([1, 2, 3]);

    db.close();
  });

  it("skips already-applied migrations", () => {
    const db = new Database(":memory:");
    const order: number[] = [];

    const migrations: Migration[] = [
      { version: 1, up: () => order.push(1) },
      { version: 2, up: () => order.push(2) },
    ];

    runMigrations(db, migrations);
    expect(order).toEqual([1, 2]);

    // Run again — nothing should execute
    order.length = 0;
    runMigrations(db, migrations);
    expect(order).toEqual([]);

    db.close();
  });

  it("only runs new migrations after existing version", () => {
    const db = new Database(":memory:");
    const order: number[] = [];

    runMigrations(db, [{ version: 1, up: () => order.push(1) }]);
    expect(order).toEqual([1]);

    order.length = 0;
    runMigrations(db, [
      { version: 1, up: () => order.push(1) },
      { version: 2, up: () => order.push(2) },
      { version: 3, up: () => order.push(3) },
    ]);
    expect(order).toEqual([2, 3]);

    db.close();
  });

  it("tracks schema version in _meta table", () => {
    const db = new Database(":memory:");

    runMigrations(db, [
      { version: 1, up: () => {} },
      { version: 2, up: () => {} },
    ]);

    const row = db
      .prepare("SELECT value FROM _meta WHERE key = 'schema_version'")
      .get() as { value: string };
    expect(row.value).toBe("2");

    db.close();
  });
});
