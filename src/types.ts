export type NormalizedAlert = {
  repo: string;
  alertNumber: number;
  state: string;
  severity: string;
  packageName: string | null;
  manifestPath: string | null;
  ecosystem: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  dismissedAt: string | null;
  fixedAt: string | null;
  htmlUrl: string | null;
  ghsaId: string | null;
  cveId: string | null;
  advisorySummary: string | null;
  cvssScore: number | null;
  patchedVersion: string | null;
  rawJson: string;
};

export type RepoRef = {
  owner: string;
  name: string;
  fullName: string;
};

export type RepoAlertsResult = {
  repo: RepoRef;
  alerts: NormalizedAlert[];
  lastSync: string | null;
  usedCache: boolean;
};

export type SeverityCounts = Record<string, number>;

export type RepoSummary = {
  repo: string;
  lastSync: string;
  severityCounts: SeverityCounts;
  totalAlerts: number;
};

export type TrendPoint = {
  day: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
};

export type MttrMetric = {
  repo: string;
  severity: string;
  avgDays: number;
  resolvedCount: number;
};

export type AlertTimelineEntry = {
  alertNumber: number;
  state: string;
  severity: string;
  recordedAt: string;
};

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

export type DependencyGroup = {
  packageName: string;
  ecosystem: string | null;
  totalAlerts: number;
  affectedRepos: number;
  criticalCount: number;
  highCount: number;
  repos: string[];
};

export type EcosystemBreakdown = {
  ecosystem: string;
  totalAlerts: number;
  affectedRepos: number;
  uniquePackages: number;
};
