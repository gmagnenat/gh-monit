/** Severity counts keyed by severity level. */
export type SeverityCounts = Record<string, number>;

/** Summary for a tracked repo. */
export type RepoSummary = {
  repo: string;
  lastSync: string;
  severityCounts: SeverityCounts;
  totalAlerts: number;
};

/** Daily trend data point with open alert counts per severity. */
export type TrendPoint = {
  day: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
};

/** Mean Time to Remediate metric for a repo/severity pair. */
export type MttrMetric = {
  repo: string;
  severity: string;
  avgDays: number;
  resolvedCount: number;
};

/** Single alert state transition event. */
export type AlertTimelineEntry = {
  alertNumber: number;
  state: string;
  severity: string;
  recordedAt: string;
};

/** SLA violation for an open alert exceeding its time threshold. */
export type SlaViolation = {
  repo: string;
  alertNumber: number;
  severity: string;
  packageName: string | null;
  htmlUrl: string | null;
  firstSeen: string;
  openDays: number;
  slaLimitDays: number;
  overdue: boolean;
};

/** Cross-repo vulnerability group (advisories grouped by GHSA ID). */
export type VulnerabilityGroup = {
  ghsaId: string;
  cveId: string | null;
  severity: string;
  summary: string | null;
  cvssScore: number | null;
  patchedVersion: string | null;
  affectedRepos: number;
  totalAlerts: number;
  repos: string[];
};

/** Package-centric dependency risk group. */
export type DependencyGroup = {
  packageName: string;
  ecosystem: string | null;
  totalAlerts: number;
  affectedRepos: number;
  criticalCount: number;
  highCount: number;
  repos: string[];
};

/** Ecosystem-level alert distribution. */
export type EcosystemBreakdown = {
  ecosystem: string;
  totalAlerts: number;
  affectedRepos: number;
  uniquePackages: number;
};
