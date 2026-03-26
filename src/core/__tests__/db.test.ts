import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import {
  openDatabase,
  saveAlerts,
  getCachedAlerts,
  getGlobalSummary,
  getAllRepoSummaries,
  getRepoAlerts,
  getTrendData,
  getMttrMetrics,
  getSlaViolations,
  getVulnerabilityGroups,
  getDependencyLandscape,
  getEcosystemBreakdown,
  getAlertTimeline,
  getActionPlan,
  saveDependencyChains,
  clearDatabase,
  removeRepo,
} from "../db.js";
import type { NormalizedAlert } from "../../types.js";
import type { DependencyChain } from "../lockfile.js";

// --- Helpers ---

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
    ghsaId: "GHSA-1234-5678",
    cveId: "CVE-2024-0001",
    advisorySummary: "Prototype pollution in lodash",
    cvssScore: 7.5,
    patchedVersion: "4.17.21",
    rawJson: JSON.stringify({ number: 1 }),
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

// --- saveAlerts & getCachedAlerts ---

describe("saveAlerts", () => {
  it("saves and retrieves alerts", () => {
    const alerts = [
      makeAlert({ alertNumber: 1 }),
      makeAlert({ alertNumber: 2, severity: "critical" }),
    ];
    saveAlerts(db, "owner/repo", alerts, "2024-03-01T00:00:00Z");

    const cached = getCachedAlerts(db, "owner/repo");
    expect(cached.hasCache).toBe(true);
    expect(cached.lastSync).toBe("2024-03-01T00:00:00Z");
    expect(cached.alerts).toHaveLength(2);
  });

  it("returns no cache for unknown repos", () => {
    const cached = getCachedAlerts(db, "unknown/repo");
    expect(cached.hasCache).toBe(false);
    expect(cached.alerts).toHaveLength(0);
    expect(cached.lastSync).toBeNull();
  });

  it("upserts alerts on re-save", () => {
    const alert = makeAlert({ state: "open" });
    saveAlerts(db, "owner/repo", [alert], "2024-03-01T00:00:00Z");

    const updated = makeAlert({ state: "fixed" });
    saveAlerts(db, "owner/repo", [updated], "2024-03-02T00:00:00Z");

    const cached = getCachedAlerts(db, "owner/repo");
    expect(cached.alerts).toHaveLength(1);
    expect(cached.alerts[0].state).toBe("fixed");
    expect(cached.lastSync).toBe("2024-03-02T00:00:00Z");
  });

  it("records history only on state changes", () => {
    const alert = makeAlert({ state: "open" });
    saveAlerts(db, "owner/repo", [alert], "2024-03-01T00:00:00Z");

    // Save again with same state — no new history
    saveAlerts(db, "owner/repo", [alert], "2024-03-02T00:00:00Z");

    const historyCount = (
      db
        .prepare("SELECT COUNT(*) AS cnt FROM alert_history WHERE repo = ?")
        .get("owner/repo") as { cnt: number }
    ).cnt;

    // First save always creates a history entry (new alert), second save should not
    expect(historyCount).toBe(1);
  });

  it("records history when state changes", () => {
    saveAlerts(
      db,
      "owner/repo",
      [makeAlert({ state: "open" })],
      "2024-03-01T00:00:00Z"
    );
    saveAlerts(
      db,
      "owner/repo",
      [makeAlert({ state: "fixed" })],
      "2024-03-02T00:00:00Z"
    );

    const historyCount = (
      db
        .prepare("SELECT COUNT(*) AS cnt FROM alert_history WHERE repo = ?")
        .get("owner/repo") as { cnt: number }
    ).cnt;
    expect(historyCount).toBe(2); // open + fixed
  });

  it("records history when severity changes", () => {
    saveAlerts(
      db,
      "owner/repo",
      [makeAlert({ severity: "high" })],
      "2024-03-01T00:00:00Z"
    );
    saveAlerts(
      db,
      "owner/repo",
      [makeAlert({ severity: "critical" })],
      "2024-03-02T00:00:00Z"
    );

    const historyCount = (
      db
        .prepare("SELECT COUNT(*) AS cnt FROM alert_history WHERE repo = ?")
        .get("owner/repo") as { cnt: number }
    ).cnt;
    expect(historyCount).toBe(2);
  });
});

// --- getRepoAlerts ---

describe("getRepoAlerts", () => {
  it("returns sorted alerts", () => {
    const alerts = [
      makeAlert({ alertNumber: 1, severity: "low" }),
      makeAlert({ alertNumber: 2, severity: "critical" }),
      makeAlert({ alertNumber: 3, severity: "high" }),
    ];
    saveAlerts(db, "owner/repo", alerts, "2024-03-01T00:00:00Z");

    const { alerts: sorted } = getRepoAlerts(db, "owner/repo");
    expect(sorted.map((a) => a.severity)).toEqual(["critical", "high", "low"]);
  });
});

// --- getGlobalSummary ---

describe("getGlobalSummary", () => {
  it("returns totals across all repos", () => {
    saveAlerts(
      db,
      "owner/repo-a",
      [
        makeAlert({ repo: "owner/repo-a", alertNumber: 1, severity: "critical" }),
        makeAlert({ repo: "owner/repo-a", alertNumber: 2, severity: "high" }),
      ],
      "2024-03-01T00:00:00Z"
    );
    saveAlerts(
      db,
      "owner/repo-b",
      [makeAlert({ repo: "owner/repo-b", alertNumber: 1, severity: "high" })],
      "2024-03-01T00:00:00Z"
    );

    const summary = getGlobalSummary(db);
    expect(summary.totalRepos).toBe(2);
    expect(summary.totalAlerts).toBe(3);
    expect(summary.severityCounts.critical).toBe(1);
    expect(summary.severityCounts.high).toBe(2);
  });

  it("handles empty database", () => {
    const summary = getGlobalSummary(db);
    expect(summary.totalRepos).toBe(0);
    expect(summary.totalAlerts).toBe(0);
    expect(summary.severityCounts).toEqual({});
  });
});

// --- getAllRepoSummaries ---

describe("getAllRepoSummaries", () => {
  it("returns per-repo breakdowns", () => {
    saveAlerts(
      db,
      "owner/repo-a",
      [
        makeAlert({ repo: "owner/repo-a", alertNumber: 1, severity: "critical" }),
        makeAlert({ repo: "owner/repo-a", alertNumber: 2, severity: "high" }),
      ],
      "2024-03-01T00:00:00Z"
    );
    saveAlerts(
      db,
      "owner/repo-b",
      [makeAlert({ repo: "owner/repo-b", alertNumber: 1, severity: "medium" })],
      "2024-03-01T00:00:00Z"
    );

    const summaries = getAllRepoSummaries(db);
    expect(summaries).toHaveLength(2);

    const repoA = summaries.find((s) => s.repo === "owner/repo-a");
    expect(repoA?.totalAlerts).toBe(2);
    expect(repoA?.severityCounts.critical).toBe(1);

    const repoB = summaries.find((s) => s.repo === "owner/repo-b");
    expect(repoB?.totalAlerts).toBe(1);
    expect(repoB?.severityCounts.medium).toBe(1);
  });

  it("includes repos with no open alerts", () => {
    saveAlerts(
      db,
      "owner/clean-repo",
      [makeAlert({ repo: "owner/clean-repo", alertNumber: 1, state: "fixed" })],
      "2024-03-01T00:00:00Z"
    );

    const summaries = getAllRepoSummaries(db);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].totalAlerts).toBe(0);
  });
});

// --- getTrendData ---

describe("getTrendData", () => {
  it("returns daily severity counts from history", () => {
    saveAlerts(
      db,
      "owner/repo",
      [
        makeAlert({ alertNumber: 1, severity: "critical" }),
        makeAlert({ alertNumber: 2, severity: "high" }),
      ],
      "2024-03-01T00:00:00Z"
    );

    const trends = getTrendData(db);
    expect(trends.length).toBeGreaterThanOrEqual(1);
    expect(trends[0]).toHaveProperty("day");
    expect(trends[0]).toHaveProperty("critical");
    expect(trends[0]).toHaveProperty("high");
  });

  it("filters by repo when specified", () => {
    saveAlerts(
      db,
      "owner/repo-a",
      [makeAlert({ repo: "owner/repo-a", alertNumber: 1, severity: "critical" })],
      "2024-03-01T00:00:00Z"
    );
    saveAlerts(
      db,
      "owner/repo-b",
      [makeAlert({ repo: "owner/repo-b", alertNumber: 1, severity: "high" })],
      "2024-03-01T00:00:00Z"
    );

    const trends = getTrendData(db, "owner/repo-a");
    // Should only have critical (from repo-a), not high (from repo-b)
    for (const point of trends) {
      expect(point.high).toBe(0);
    }
  });
});

// --- getMttrMetrics ---

describe("getMttrMetrics", () => {
  it("computes MTTR for resolved alerts", () => {
    // Create open alert
    saveAlerts(
      db,
      "owner/repo",
      [makeAlert({ alertNumber: 1, state: "open", severity: "high" })],
      "2024-01-01T00:00:00Z"
    );
    // Resolve it 10 days later
    saveAlerts(
      db,
      "owner/repo",
      [makeAlert({ alertNumber: 1, state: "fixed", severity: "high" })],
      "2024-01-11T00:00:00Z"
    );

    const metrics = getMttrMetrics(db);
    expect(metrics).toHaveLength(1);
    expect(metrics[0].repo).toBe("owner/repo");
    expect(metrics[0].severity).toBe("high");
    expect(metrics[0].avgDays).toBe(10);
    expect(metrics[0].resolvedCount).toBe(1);
  });

  it("returns empty for no resolved alerts", () => {
    saveAlerts(
      db,
      "owner/repo",
      [makeAlert({ alertNumber: 1, state: "open" })],
      "2024-01-01T00:00:00Z"
    );

    const metrics = getMttrMetrics(db);
    expect(metrics).toHaveLength(0);
  });
});

// --- getSlaViolations ---

describe("getSlaViolations", () => {
  it("flags overdue alerts based on SLA thresholds", () => {
    // Insert an alert opened long ago
    saveAlerts(
      db,
      "owner/repo",
      [makeAlert({ alertNumber: 1, severity: "critical" })],
      "2023-01-01T00:00:00Z"
    );

    const violations = getSlaViolations(db);
    expect(violations.length).toBeGreaterThanOrEqual(1);

    const v = violations[0];
    expect(v.severity).toBe("critical");
    expect(v.slaLimitDays).toBe(2); // critical default
    expect(v.overdue).toBe(true);
    expect(v.openDays).toBeGreaterThan(2);
  });

  it("respects custom SLA config", () => {
    saveAlerts(
      db,
      "owner/repo",
      [makeAlert({ alertNumber: 1, severity: "low" })],
      "2024-12-01T00:00:00Z"
    );

    // With a very generous SLA, should not be overdue
    const violations = getSlaViolations(db, { low: 99999 });
    const v = violations.find((x) => x.alertNumber === 1);
    expect(v?.overdue).toBe(false);
  });

  it("returns empty when no open alerts exist", () => {
    const violations = getSlaViolations(db);
    expect(violations).toHaveLength(0);
  });

  it("sorts most overdue first", () => {
    saveAlerts(
      db,
      "owner/repo",
      [
        makeAlert({ alertNumber: 1, severity: "low" }), // 90-day SLA
        makeAlert({ alertNumber: 2, severity: "critical" }), // 2-day SLA
      ],
      "2023-06-01T00:00:00Z"
    );

    const violations = getSlaViolations(db);
    // Critical with 2-day SLA should be more overdue than low with 90-day SLA
    expect(violations[0].severity).toBe("critical");
  });
});

// --- getAlertTimeline ---

describe("getAlertTimeline", () => {
  it("returns ordered history entries", () => {
    saveAlerts(
      db,
      "owner/repo",
      [makeAlert({ alertNumber: 1, state: "open" })],
      "2024-01-01T00:00:00Z"
    );
    saveAlerts(
      db,
      "owner/repo",
      [makeAlert({ alertNumber: 1, state: "fixed" })],
      "2024-01-10T00:00:00Z"
    );

    const timeline = getAlertTimeline(db, "owner/repo");
    expect(timeline).toHaveLength(2);
    expect(timeline[0].state).toBe("open");
    expect(timeline[1].state).toBe("fixed");
  });
});

// --- getVulnerabilityGroups ---

describe("getVulnerabilityGroups", () => {
  it("groups alerts by GHSA ID", () => {
    saveAlerts(
      db,
      "owner/repo-a",
      [makeAlert({ repo: "owner/repo-a", alertNumber: 1, ghsaId: "GHSA-0001" })],
      "2024-03-01T00:00:00Z"
    );
    saveAlerts(
      db,
      "owner/repo-b",
      [makeAlert({ repo: "owner/repo-b", alertNumber: 1, ghsaId: "GHSA-0001" })],
      "2024-03-01T00:00:00Z"
    );

    const groups = getVulnerabilityGroups(db);
    expect(groups).toHaveLength(1);
    expect(groups[0].ghsaId).toBe("GHSA-0001");
    expect(groups[0].affectedRepos).toBe(2);
    expect(groups[0].totalAlerts).toBe(2);
    expect(groups[0].repos).toContain("owner/repo-a");
    expect(groups[0].repos).toContain("owner/repo-b");
  });
});

// --- getDependencyLandscape ---

describe("getDependencyLandscape", () => {
  it("groups alerts by package name", () => {
    saveAlerts(
      db,
      "owner/repo-a",
      [
        makeAlert({
          repo: "owner/repo-a",
          alertNumber: 1,
          packageName: "lodash",
          severity: "critical",
        }),
      ],
      "2024-03-01T00:00:00Z"
    );
    saveAlerts(
      db,
      "owner/repo-b",
      [
        makeAlert({
          repo: "owner/repo-b",
          alertNumber: 1,
          packageName: "lodash",
          severity: "high",
        }),
      ],
      "2024-03-01T00:00:00Z"
    );

    const deps = getDependencyLandscape(db);
    expect(deps).toHaveLength(1);
    expect(deps[0].packageName).toBe("lodash");
    expect(deps[0].affectedRepos).toBe(2);
    expect(deps[0].criticalCount).toBe(1);
    expect(deps[0].highCount).toBe(1);
  });
});

// --- getEcosystemBreakdown ---

describe("getEcosystemBreakdown", () => {
  it("counts by ecosystem", () => {
    saveAlerts(
      db,
      "owner/repo",
      [
        makeAlert({ alertNumber: 1, ecosystem: "npm" }),
        makeAlert({ alertNumber: 2, ecosystem: "npm" }),
        makeAlert({ alertNumber: 3, ecosystem: "pip" }),
      ],
      "2024-03-01T00:00:00Z"
    );

    const eco = getEcosystemBreakdown(db);
    expect(eco).toHaveLength(2);

    const npm = eco.find((e) => e.ecosystem === "npm");
    expect(npm?.totalAlerts).toBe(2);

    const pip = eco.find((e) => e.ecosystem === "pip");
    expect(pip?.totalAlerts).toBe(1);
  });
});

// --- clearDatabase ---

describe("clearDatabase", () => {
  it("removes all data but keeps schema", () => {
    saveAlerts(
      db,
      "owner/repo",
      [makeAlert()],
      "2024-03-01T00:00:00Z"
    );
    clearDatabase(db);

    const cached = getCachedAlerts(db, "owner/repo");
    expect(cached.hasCache).toBe(false);
    expect(cached.alerts).toHaveLength(0);

    // Schema still works — can save again
    saveAlerts(db, "owner/repo", [makeAlert()], "2024-03-02T00:00:00Z");
    expect(getCachedAlerts(db, "owner/repo").hasCache).toBe(true);
  });
});

// --- removeRepo ---

describe("removeRepo", () => {
  it("removes only the specified repo", () => {
    saveAlerts(
      db,
      "owner/repo-a",
      [makeAlert({ repo: "owner/repo-a", alertNumber: 1 })],
      "2024-03-01T00:00:00Z"
    );
    saveAlerts(
      db,
      "owner/repo-b",
      [makeAlert({ repo: "owner/repo-b", alertNumber: 1 })],
      "2024-03-01T00:00:00Z"
    );

    removeRepo(db, "owner/repo-a");

    expect(getCachedAlerts(db, "owner/repo-a").hasCache).toBe(false);
    expect(getCachedAlerts(db, "owner/repo-b").hasCache).toBe(true);
  });
});

// --- saveDependencyChains & getActionPlan ---

describe("saveDependencyChains", () => {
  it("saves and retrieves dependency chains via action plan", () => {
    saveAlerts(
      db,
      "owner/repo",
      [
        makeAlert({ alertNumber: 1, packageName: "loader-utils", severity: "critical" }),
        makeAlert({ alertNumber: 2, packageName: "minimist", severity: "high" }),
      ],
      "2024-03-01T00:00:00Z"
    );

    const chains: DependencyChain[] = [
      {
        repo: "owner/repo",
        vulnerablePackage: "loader-utils",
        directDependency: "react-scripts",
        directVersion: "5.0.1",
        chainDepth: 1,
      },
      {
        repo: "owner/repo",
        vulnerablePackage: "minimist",
        directDependency: "react-scripts",
        directVersion: "5.0.1",
        chainDepth: 1,
      },
    ];

    saveDependencyChains(db, chains);

    const plan = getActionPlan(db);
    expect(plan).toHaveLength(1);
    expect(plan[0].directDependency).toBe("react-scripts");
    expect(plan[0].directVersion).toBe("5.0.1");
    expect(plan[0].criticalAlerts).toBe(1);
    expect(plan[0].highAlerts).toBe(1);
    expect(plan[0].totalAlerts).toBe(2);
    expect(plan[0].affectedRepos).toBe(1);
    expect(plan[0].vulnerablePackages).toContain("loader-utils");
    expect(plan[0].vulnerablePackages).toContain("minimist");
  });

  it("aggregates across repos", () => {
    saveAlerts(
      db,
      "owner/repo-a",
      [makeAlert({ repo: "owner/repo-a", alertNumber: 1, packageName: "loader-utils", severity: "critical" })],
      "2024-03-01T00:00:00Z"
    );
    saveAlerts(
      db,
      "owner/repo-b",
      [makeAlert({ repo: "owner/repo-b", alertNumber: 1, packageName: "loader-utils", severity: "critical" })],
      "2024-03-01T00:00:00Z"
    );

    saveDependencyChains(db, [
      { repo: "owner/repo-a", vulnerablePackage: "loader-utils", directDependency: "react-scripts", directVersion: "5.0.1", chainDepth: 1 },
      { repo: "owner/repo-b", vulnerablePackage: "loader-utils", directDependency: "webpack", directVersion: "4.0.0", chainDepth: 1 },
    ]);

    const plan = getActionPlan(db);
    expect(plan).toHaveLength(2);
    // Both should have 1 critical alert each
    expect(plan.every((p) => p.criticalAlerts === 1)).toBe(true);
  });

  it("returns empty plan when no chains exist", () => {
    const plan = getActionPlan(db);
    expect(plan).toHaveLength(0);
  });

  it("upserts on re-save", () => {
    saveAlerts(
      db,
      "owner/repo",
      [makeAlert({ alertNumber: 1, packageName: "lodash", severity: "high" })],
      "2024-03-01T00:00:00Z"
    );

    saveDependencyChains(db, [
      { repo: "owner/repo", vulnerablePackage: "lodash", directDependency: "old-parent", directVersion: "1.0.0", chainDepth: 1 },
    ]);

    // Update the chain
    saveDependencyChains(db, [
      { repo: "owner/repo", vulnerablePackage: "lodash", directDependency: "new-parent", directVersion: "2.0.0", chainDepth: 1 },
    ]);

    const plan = getActionPlan(db);
    expect(plan).toHaveLength(1);
    expect(plan[0].directDependency).toBe("new-parent");
  });
});
