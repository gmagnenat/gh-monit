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
