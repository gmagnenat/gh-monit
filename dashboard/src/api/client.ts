// Re-export shared types from the single source of truth
export type {
  AlertTimelineEntry,
  DependencyGroup,
  EcosystemBreakdown,
  MttrMetric,
  RepoOption,
  RepoSummary,
  SeverityCounts,
  SlaViolation,
  TrendPoint,
  VulnerabilityGroup,
} from '../../../shared/types';

import type { RepoSummary, SeverityCounts } from '../../../shared/types';

// --- Sorting types and helpers ---

export type RepoSortOption = 'name' | 'critical' | 'total';

/**
 * Sort repos by the given option.
 * - 'name': alphabetical by repo name (A-Z)
 * - 'critical': most critical first, then high, then total alerts
 * - 'total': most alerts first, then critical as tiebreaker
 */
export function sortRepos(
  repos: RepoSummary[],
  option: RepoSortOption
): RepoSummary[] {
  const sorted = [...repos];

  switch (option) {
    case 'name':
      sorted.sort((a, b) => a.repo.localeCompare(b.repo));
      break;

    case 'critical':
      sorted.sort((a, b) => {
        const aCrit = a.severityCounts.critical ?? 0;
        const bCrit = b.severityCounts.critical ?? 0;
        if (bCrit !== aCrit) return bCrit - aCrit;

        const aHigh = a.severityCounts.high ?? 0;
        const bHigh = b.severityCounts.high ?? 0;
        if (bHigh !== aHigh) return bHigh - aHigh;

        return b.totalAlerts - a.totalAlerts;
      });
      break;

    case 'total':
      sorted.sort((a, b) => {
        if (b.totalAlerts !== a.totalAlerts) {
          return b.totalAlerts - a.totalAlerts;
        }
        const aCrit = a.severityCounts.critical ?? 0;
        const bCrit = b.severityCounts.critical ?? 0;
        return bCrit - aCrit;
      });
      break;
  }

  return sorted;
}

// --- Filtering types and helpers ---

/** Filter repos by name (case-insensitive substring match). */
export function filterReposByName(
  repos: RepoSummary[],
  query: string
): RepoSummary[] {
  if (!query.trim()) return repos;
  const lower = query.toLowerCase();
  return repos.filter((r) => r.repo.toLowerCase().includes(lower));
}

export type SeverityFilter = {
  critical: boolean;
  high: boolean;
  medium: boolean;
  low: boolean;
};

/** Filter repos to only those with alerts matching enabled severity levels. */
export function filterReposBySeverity(
  repos: RepoSummary[],
  filter: SeverityFilter
): RepoSummary[] {
  const anyActive = Object.values(filter).some(Boolean);
  if (!anyActive) return repos; // no filter = show all

  return repos.filter((r) => {
    if (filter.critical && (r.severityCounts.critical ?? 0) > 0) return true;
    if (filter.high && (r.severityCounts.high ?? 0) > 0) return true;
    if (filter.medium && (r.severityCounts.medium ?? 0) > 0) return true;
    if (filter.low && (r.severityCounts.low ?? 0) > 0) return true;
    return false;
  });
}

// --- Frontend-only types ---

export type SummaryResponse = {
  totalRepos: number;
  totalAlerts: number;
  severityCounts: SeverityCounts;
};

export type Alert = {
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
};

export type RepoAlertsResponse = {
  alerts: Alert[];
  lastSync: string | null;
};

// --- API client ---

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text().catch(() => 'Unknown error');
    throw new ApiError(response.status, body);
  }
  return response.json() as Promise<T>;
}

/** Global summary: total repos, total alerts, severity breakdown. */
export function fetchSummary(): Promise<SummaryResponse> {
  return request<SummaryResponse>('/api/summary');
}

/** All tracked repos with severity counts and last sync time. */
export function fetchRepos(): Promise<RepoSummary[]> {
  return request<RepoSummary[]>('/api/repos');
}

/** Sorted alert list for one repo. */
export function fetchRepoAlerts(
  owner: string,
  name: string
): Promise<RepoAlertsResponse> {
  return request<RepoAlertsResponse>(
    `/api/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/alerts`
  );
}

/** Remove a tracked repo and all its alerts/history from the database. */
export function deleteRepo(owner: string, name: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(
    `/api/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
    { method: 'DELETE' }
  );
}

/** Fetch fresh alerts from GitHub for a repo, save, and return updated data. */
export function refreshRepo(
  owner: string,
  name: string
): Promise<RepoAlertsResponse> {
  return request<RepoAlertsResponse>(
    `/api/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/refresh`,
    { method: 'POST' }
  );
}

// --- Bulk refresh ---

export type BulkRefreshResponse = {
  refreshed: number;
  total: number;
  results: { repo: string; success: boolean }[];
};

/** Refresh all tracked repos from GitHub in a single request. */
export function refreshAllRepos(): Promise<BulkRefreshResponse> {
  return request<BulkRefreshResponse>('/api/repos/refresh-all', {
    method: 'POST',
  });
}

// --- History analytics fetchers ---

import type { AlertTimelineEntry, MttrMetric, SlaViolation, TrendPoint } from '../../../shared/types';

/** Daily trend data: open alert counts grouped by severity. */
export function fetchTrends(repo?: string | null): Promise<TrendPoint[]> {
  const params = repo ? `?repo=${encodeURIComponent(repo)}` : '';
  return request<TrendPoint[]>(`/api/history/trends${params}`);
}

/** MTTR metrics: average remediation time per repo and severity. */
export function fetchMttr(repo?: string | null): Promise<MttrMetric[]> {
  const params = repo ? `?repo=${encodeURIComponent(repo)}` : '';
  return request<MttrMetric[]>(`/api/history/mttr${params}`);
}

/** Per-alert state transitions for a given repo. */
export function fetchAlertHistory(
  owner: string,
  name: string
): Promise<AlertTimelineEntry[]> {
  return request<AlertTimelineEntry[]>(
    `/api/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/history`
  );
}

/** SLA violations: open alerts exceeding time thresholds. */
export function fetchSlaViolations(): Promise<SlaViolation[]> {
  return request<SlaViolation[]>('/api/history/sla');
}

// --- Cross-repo analytics fetchers ---

import type { DependencyGroup, EcosystemBreakdown, VulnerabilityGroup } from '../../../shared/types';

/** Vulnerability groups: advisories grouped by GHSA ID across all repos. */
export function fetchVulnerabilities(): Promise<VulnerabilityGroup[]> {
  return request<VulnerabilityGroup[]>('/api/analytics/vulnerabilities');
}

/** Dependency landscape: packages ranked by risk across all repos. */
export function fetchDependencies(): Promise<DependencyGroup[]> {
  return request<DependencyGroup[]>('/api/analytics/dependencies');
}

/** Ecosystem breakdown: alert distribution by ecosystem. */
export function fetchEcosystems(): Promise<EcosystemBreakdown[]> {
  return request<EcosystemBreakdown[]>('/api/analytics/ecosystems');
}

// --- Setup wizard API ---

import type { RepoOption } from '../../../shared/types';

export type SetupStatus = { isEmpty: boolean; hasTargets: boolean };
export type InitializeResult = {
  seeded: number;
  total: number;
  results: { repo: string; success: boolean }[];
};

/** Check whether the DB is empty and env targets are configured. */
export function fetchSetupStatus(): Promise<SetupStatus> {
  return request<SetupStatus>('/api/setup/status');
}

/** List all repos available from GH_MONIT_USER / GH_MONIT_ORG (no alerts). */
export function fetchAvailableRepos(): Promise<RepoOption[]> {
  return request<RepoOption[]>('/api/setup/repos');
}

/** Seed alerts for the selected repos and return a result summary. */
export function postInitialize(repos: RepoOption[]): Promise<InitializeResult> {
  return request<InitializeResult>('/api/setup/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repos }),
  });
}

/** Delete all data from the database (alerts, history, sync records). */
export function postReset(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/setup/reset', { method: 'POST' });
}
