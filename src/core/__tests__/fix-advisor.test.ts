import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { openDatabase, saveAlerts, getFixAdvisor } from "../db.js";
import type { NormalizedAlert } from "../../types.js";

function makeAlert(overrides: Partial<NormalizedAlert> = {}): NormalizedAlert {
  return {
    repo: "owner/repo",
    alertNumber: 1,
    state: "open",
    severity: "high",
    packageName: "lodash",
    manifestPath: "package-lock.json",
    ecosystem: "npm",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-02-01T12:00:00Z",
    dismissedAt: null,
    fixedAt: null,
    htmlUrl: "https://github.com/owner/repo/security/dependabot/1",
    ghsaId: "GHSA-1111",
    cveId: "CVE-2024-0001",
    advisorySummary: "Prototype pollution in lodash",
    cvssScore: 7.5,
    patchedVersion: "4.17.21",
    rawJson: JSON.stringify({
      number: 1,
      dependency: { scope: "runtime" },
    }),
    ...overrides,
  };
}

let db: Database.Database;

beforeEach(() => {
  db = openDatabase(":memory:");
});

afterEach(() => {
  db.close();
});

describe("getFixAdvisor", () => {
  it("returns empty result when no alerts exist", () => {
    const result = getFixAdvisor(db, "owner/repo");
    expect(result.repo).toBe("owner/repo");
    expect(result.totalActions).toBe(0);
    expect(result.totalAlerts).toBe(0);
    expect(result.actions).toEqual([]);
    expect(result.noFixAvailable).toEqual([]);
  });

  it("groups alerts by package and ecosystem", () => {
    const alerts = [
      makeAlert({
        alertNumber: 1,
        severity: "high",
        ghsaId: "GHSA-1111",
        cvssScore: 7.5,
      }),
      makeAlert({
        alertNumber: 2,
        severity: "critical",
        ghsaId: "GHSA-2222",
        cvssScore: 9.8,
      }),
    ];
    saveAlerts(db, "owner/repo", alerts, "2024-03-01T00:00:00Z");

    const result = getFixAdvisor(db, "owner/repo");
    expect(result.totalActions).toBe(1);
    expect(result.actions).toHaveLength(1);

    const lodashAction = result.actions[0];
    expect(lodashAction.packageName).toBe("lodash");
    expect(lodashAction.ecosystem).toBe("npm");
    expect(lodashAction.alertCount).toBe(2);
    expect(lodashAction.ghsaIds).toContain("GHSA-1111");
    expect(lodashAction.ghsaIds).toContain("GHSA-2222");
    expect(lodashAction.severityBreakdown).toEqual({ high: 1, critical: 1 });
    expect(lodashAction.groupSeverity).toBe("critical");
    expect(lodashAction.maxCvssScore).toBe(9.8);
    expect(lodashAction.hasFix).toBe(true);
    expect(lodashAction.patchedVersion).toBe("4.17.21");
  });

  it("separates fixable from no-fix-available", () => {
    const alerts = [
      makeAlert({ alertNumber: 1, patchedVersion: "4.17.21" }),
      makeAlert({
        alertNumber: 2,
        packageName: "tough-cookie",
        patchedVersion: null,
        ghsaId: "GHSA-3333",
      }),
    ];
    saveAlerts(db, "owner/repo", alerts, "2024-03-01T00:00:00Z");

    const result = getFixAdvisor(db, "owner/repo");
    expect(result.actions).toHaveLength(1);
    expect(result.noFixAvailable).toHaveLength(1);
    expect(result.actions[0].packageName).toBe("lodash");
    expect(result.noFixAvailable[0].packageName).toBe("tough-cookie");
    expect(result.noFixAvailable[0].hasFix).toBe(false);
  });

  it("sorts by severity then alert count", () => {
    const alerts = [
      makeAlert({
        alertNumber: 1,
        packageName: "pkg-a",
        severity: "high",
        ghsaId: "GHSA-A1",
      }),
      makeAlert({
        alertNumber: 2,
        packageName: "pkg-b",
        severity: "critical",
        ghsaId: "GHSA-B1",
      }),
      makeAlert({
        alertNumber: 3,
        packageName: "pkg-c",
        severity: "critical",
        ghsaId: "GHSA-C1",
      }),
      makeAlert({
        alertNumber: 4,
        packageName: "pkg-c",
        severity: "critical",
        ghsaId: "GHSA-C2",
      }),
    ];
    saveAlerts(db, "owner/repo", alerts, "2024-03-01T00:00:00Z");

    const result = getFixAdvisor(db, "owner/repo");
    // pkg-c (critical, 2 alerts) first, then pkg-b (critical, 1), then pkg-a (high, 1)
    expect(result.actions[0].packageName).toBe("pkg-c");
    expect(result.actions[1].packageName).toBe("pkg-b");
    expect(result.actions[2].packageName).toBe("pkg-a");
  });

  it("only includes open alerts", () => {
    const alerts = [
      makeAlert({ alertNumber: 1, state: "open" }),
      makeAlert({ alertNumber: 2, state: "fixed" }),
    ];
    saveAlerts(db, "owner/repo", alerts, "2024-03-01T00:00:00Z");

    const result = getFixAdvisor(db, "owner/repo");
    expect(result.totalAlerts).toBe(1);
    expect(result.actions[0].alertCount).toBe(1);
  });

  it("extracts scope from raw JSON", () => {
    const alerts = [
      makeAlert({
        alertNumber: 1,
        rawJson: JSON.stringify({
          number: 1,
          dependency: { scope: "development" },
        }),
      }),
    ];
    saveAlerts(db, "owner/repo", alerts, "2024-03-01T00:00:00Z");

    const result = getFixAdvisor(db, "owner/repo");
    expect(result.actions[0].scope).toBe("development");
  });

  it("collects distinct manifest paths", () => {
    const alerts = [
      makeAlert({ alertNumber: 1, manifestPath: "package-lock.json" }),
      makeAlert({ alertNumber: 2, manifestPath: "apps/web/package-lock.json" }),
    ];
    saveAlerts(db, "owner/repo", alerts, "2024-03-01T00:00:00Z");

    const result = getFixAdvisor(db, "owner/repo");
    expect(result.actions[0].manifestPaths).toContain("package-lock.json");
    expect(result.actions[0].manifestPaths).toContain(
      "apps/web/package-lock.json"
    );
  });

  it("cross-repo mode aggregates across repos", () => {
    saveAlerts(
      db,
      "owner/repo-a",
      [makeAlert({ alertNumber: 1, repo: "owner/repo-a" })],
      "2024-03-01T00:00:00Z"
    );
    saveAlerts(
      db,
      "owner/repo-b",
      [makeAlert({ alertNumber: 1, repo: "owner/repo-b" })],
      "2024-03-01T00:00:00Z"
    );

    const result = getFixAdvisor(db);
    expect(result.repo).toBe("all");
    expect(result.actions[0].affectedRepos).toBe(2);
    expect(result.actions[0].repos).toContain("owner/repo-a");
    expect(result.actions[0].repos).toContain("owner/repo-b");
    // Cross-repo alerts include repo field
    expect(result.actions[0].alerts[0].repo).toBeDefined();
  });

  it("per-repo mode does not include repo field on alerts", () => {
    saveAlerts(
      db,
      "owner/repo",
      [makeAlert({ alertNumber: 1 })],
      "2024-03-01T00:00:00Z"
    );

    const result = getFixAdvisor(db, "owner/repo");
    expect(result.actions[0].alerts[0].repo).toBeUndefined();
    expect(result.actions[0].affectedRepos).toBeUndefined();
  });

  it("collects both GHSA and CVE IDs", () => {
    const alerts = [
      makeAlert({
        alertNumber: 1,
        ghsaId: "GHSA-1111",
        cveId: "CVE-2024-0001",
      }),
      makeAlert({
        alertNumber: 2,
        ghsaId: "GHSA-2222",
        cveId: "CVE-2024-0002",
      }),
    ];
    saveAlerts(db, "owner/repo", alerts, "2024-03-01T00:00:00Z");

    const result = getFixAdvisor(db, "owner/repo");
    expect(result.actions[0].cveIds).toContain("CVE-2024-0001");
    expect(result.actions[0].cveIds).toContain("CVE-2024-0002");
  });
});
