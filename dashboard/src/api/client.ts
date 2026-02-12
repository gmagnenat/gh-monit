// --- API response types (mirrors backend shapes) ---

export type SeverityCounts = Record<string, number>;

export type RepoSummary = {
  repo: string;
  lastSync: string;
  severityCounts: SeverityCounts;
  totalAlerts: number;
};

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
