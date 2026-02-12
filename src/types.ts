// Re-export shared types used by both backend and frontend
export type {
  AlertTimelineEntry,
  DependencyGroup,
  EcosystemBreakdown,
  MttrMetric,
  RepoSummary,
  SeverityCounts,
  SlaViolation,
  TrendPoint,
  VulnerabilityGroup,
} from '../shared/types.js';

// Backend-only types

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
