import { describe, it, expect } from "vitest";
import {
  normalizeAlerts,
  summarizeAlerts,
  sortAlerts,
  filterAlertsBySince,
  SEVERITY_ORDER,
} from "../alerts.js";
import type { NormalizedAlert } from "../../types.js";

// --- Fixtures ---

function makeGitHubAlert(overrides: Record<string, unknown> = {}) {
  return {
    number: 1,
    state: "open",
    dependency: {
      package: { name: "lodash", ecosystem: "npm" },
      manifest_path: "package-lock.json",
    },
    security_advisory: {
      severity: "high",
      ghsa_id: "GHSA-1234-5678",
      cve_id: "CVE-2024-0001",
      summary: "Prototype pollution in lodash",
      cvss: { score: 7.5 },
    },
    security_vulnerability: {
      severity: "high",
      first_patched_version: { identifier: "4.17.21" },
    },
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-02-01T12:00:00Z",
    dismissed_at: null,
    fixed_at: null,
    html_url: "https://github.com/owner/repo/security/dependabot/1",
    ...overrides,
  };
}

function makeNormalizedAlert(
  overrides: Partial<NormalizedAlert> = {}
): NormalizedAlert {
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
    rawJson: "{}",
    ...overrides,
  };
}

// --- normalizeAlerts ---

describe("normalizeAlerts", () => {
  it("normalizes a standard GitHub alert", () => {
    const raw = makeGitHubAlert();
    const [result] = normalizeAlerts("owner/repo", [raw]);

    expect(result.repo).toBe("owner/repo");
    expect(result.alertNumber).toBe(1);
    expect(result.state).toBe("open");
    expect(result.severity).toBe("high");
    expect(result.packageName).toBe("lodash");
    expect(result.ecosystem).toBe("npm");
    expect(result.ghsaId).toBe("GHSA-1234-5678");
    expect(result.cveId).toBe("CVE-2024-0001");
    expect(result.cvssScore).toBe(7.5);
    expect(result.patchedVersion).toBe("4.17.21");
    expect(result.advisorySummary).toBe("Prototype pollution in lodash");
  });

  it("falls back to security_vulnerability severity when advisory is missing", () => {
    const raw = makeGitHubAlert({
      security_advisory: undefined,
    });
    const [result] = normalizeAlerts("owner/repo", [raw]);
    expect(result.severity).toBe("high");
  });

  it("defaults severity to 'unknown' when both sources are missing", () => {
    const raw = makeGitHubAlert({
      security_advisory: undefined,
      security_vulnerability: undefined,
    });
    const [result] = normalizeAlerts("owner/repo", [raw]);
    expect(result.severity).toBe("unknown");
  });

  it("handles null/undefined fields gracefully", () => {
    const [result] = normalizeAlerts("owner/repo", [{}]);
    expect(result.alertNumber).toBe(0);
    expect(result.state).toBe("unknown");
    expect(result.severity).toBe("unknown");
    expect(result.packageName).toBeNull();
    expect(result.ecosystem).toBeNull();
    expect(result.cvssScore).toBeNull();
  });

  it("handles non-numeric cvss score", () => {
    const raw = makeGitHubAlert({
      security_advisory: {
        severity: "high",
        cvss: { score: "not-a-number" },
      },
    });
    const [result] = normalizeAlerts("owner/repo", [raw]);
    expect(result.cvssScore).toBeNull();
  });

  it("normalizes multiple alerts", () => {
    const alerts = [
      makeGitHubAlert({ number: 1 }),
      makeGitHubAlert({ number: 2 }),
      makeGitHubAlert({ number: 3 }),
    ];
    const results = normalizeAlerts("owner/repo", alerts);
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.alertNumber)).toEqual([1, 2, 3]);
  });

  it("stores raw JSON", () => {
    const raw = makeGitHubAlert();
    const [result] = normalizeAlerts("owner/repo", [raw]);
    const parsed = JSON.parse(result.rawJson);
    expect(parsed.number).toBe(1);
  });
});

// --- summarizeAlerts ---

describe("summarizeAlerts", () => {
  it("counts alerts by severity", () => {
    const alerts = [
      makeNormalizedAlert({ severity: "critical" }),
      makeNormalizedAlert({ severity: "high" }),
      makeNormalizedAlert({ severity: "high" }),
      makeNormalizedAlert({ severity: "medium" }),
    ];
    const counts = summarizeAlerts(alerts);
    expect(counts).toEqual({ critical: 1, high: 2, medium: 1 });
  });

  it("returns empty object for no alerts", () => {
    expect(summarizeAlerts([])).toEqual({});
  });

  it("lowercases severity keys", () => {
    const alerts = [makeNormalizedAlert({ severity: "HIGH" })];
    const counts = summarizeAlerts(alerts);
    expect(counts).toHaveProperty("high", 1);
  });
});

// --- sortAlerts ---

describe("sortAlerts", () => {
  it("sorts by severity order (critical first)", () => {
    const alerts = [
      makeNormalizedAlert({ severity: "low" }),
      makeNormalizedAlert({ severity: "critical" }),
      makeNormalizedAlert({ severity: "medium" }),
      makeNormalizedAlert({ severity: "high" }),
    ];
    const sorted = sortAlerts(alerts);
    expect(sorted.map((a) => a.severity)).toEqual([
      "critical",
      "high",
      "medium",
      "low",
    ]);
  });

  it("sorts by createdAt descending within same severity", () => {
    const alerts = [
      makeNormalizedAlert({
        severity: "high",
        createdAt: "2024-01-01T00:00:00Z",
      }),
      makeNormalizedAlert({
        severity: "high",
        createdAt: "2024-03-01T00:00:00Z",
      }),
      makeNormalizedAlert({
        severity: "high",
        createdAt: "2024-02-01T00:00:00Z",
      }),
    ];
    const sorted = sortAlerts(alerts);
    expect(sorted.map((a) => a.createdAt)).toEqual([
      "2024-03-01T00:00:00Z",
      "2024-02-01T00:00:00Z",
      "2024-01-01T00:00:00Z",
    ]);
  });

  it("does not mutate the input array", () => {
    const alerts = [
      makeNormalizedAlert({ severity: "low" }),
      makeNormalizedAlert({ severity: "critical" }),
    ];
    const original = [...alerts];
    sortAlerts(alerts);
    expect(alerts[0].severity).toBe(original[0].severity);
  });

  it("puts unknown severity last", () => {
    const alerts = [
      makeNormalizedAlert({ severity: "unknown" }),
      makeNormalizedAlert({ severity: "low" }),
    ];
    const sorted = sortAlerts(alerts);
    expect(sorted.map((a) => a.severity)).toEqual(["low", "unknown"]);
  });
});

// --- filterAlertsBySince ---

describe("filterAlertsBySince", () => {
  it("returns all alerts when since is null", () => {
    const alerts = [makeNormalizedAlert(), makeNormalizedAlert()];
    expect(filterAlertsBySince(alerts, null)).toHaveLength(2);
  });

  it("filters alerts before the since date", () => {
    const alerts = [
      makeNormalizedAlert({ updatedAt: "2024-01-01T00:00:00Z" }),
      makeNormalizedAlert({ updatedAt: "2024-06-01T00:00:00Z" }),
    ];
    const since = new Date("2024-03-01");
    const filtered = filterAlertsBySince(alerts, since);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].updatedAt).toBe("2024-06-01T00:00:00Z");
  });

  it("uses createdAt as fallback when updatedAt is null", () => {
    const alerts = [
      makeNormalizedAlert({
        updatedAt: null,
        createdAt: "2024-06-01T00:00:00Z",
      }),
    ];
    const since = new Date("2024-03-01");
    expect(filterAlertsBySince(alerts, since)).toHaveLength(1);
  });

  it("excludes alerts with no timestamp", () => {
    const alerts = [
      makeNormalizedAlert({ updatedAt: null, createdAt: null }),
    ];
    const since = new Date("2024-01-01");
    expect(filterAlertsBySince(alerts, since)).toHaveLength(0);
  });

  it("excludes alerts with invalid date strings", () => {
    const alerts = [
      makeNormalizedAlert({ updatedAt: "not-a-date", createdAt: null }),
    ];
    const since = new Date("2024-01-01");
    expect(filterAlertsBySince(alerts, since)).toHaveLength(0);
  });
});

// --- SEVERITY_ORDER ---

describe("SEVERITY_ORDER", () => {
  it("lists severities from most to least critical", () => {
    expect(SEVERITY_ORDER).toEqual([
      "critical",
      "high",
      "medium",
      "low",
      "unknown",
    ]);
  });
});
