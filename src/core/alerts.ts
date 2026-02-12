import type { NormalizedAlert, SeverityCounts } from "../types.js";

export const SEVERITY_ORDER = ["critical", "high", "medium", "low", "unknown"];

export function normalizeAlerts(
  repo: string,
  alerts: unknown[]
): NormalizedAlert[] {
  return alerts.map((alert: any) => {
    const severity =
      alert?.security_advisory?.severity ??
      alert?.security_vulnerability?.severity ??
      "unknown";

    const cvssRaw = alert?.security_advisory?.cvss?.score ?? null;
    const cvssScore = typeof cvssRaw === 'number' ? cvssRaw : null;

    return {
      repo,
      alertNumber: Number(alert?.number ?? 0),
      state: String(alert?.state ?? "unknown"),
      severity: String(severity ?? "unknown"),
      packageName: alert?.dependency?.package?.name ?? null,
      manifestPath: alert?.dependency?.manifest_path ?? null,
      ecosystem: alert?.dependency?.package?.ecosystem ?? null,
      createdAt: alert?.created_at ?? null,
      updatedAt: alert?.updated_at ?? null,
      dismissedAt: alert?.dismissed_at ?? null,
      fixedAt: alert?.fixed_at ?? null,
      htmlUrl: alert?.html_url ?? null,
      ghsaId: alert?.security_advisory?.ghsa_id ?? null,
      cveId: alert?.security_advisory?.cve_id ?? null,
      advisorySummary: alert?.security_advisory?.summary ?? null,
      cvssScore,
      patchedVersion:
        alert?.security_vulnerability?.first_patched_version?.identifier ?? null,
      rawJson: JSON.stringify(alert),
    };
  });
}

export function summarizeAlerts(alerts: NormalizedAlert[]): SeverityCounts {
  return alerts.reduce<SeverityCounts>((acc, alert) => {
    const key = alert.severity.toLowerCase();
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

export function sortAlerts(alerts: NormalizedAlert[]): NormalizedAlert[] {
  return [...alerts].sort((a, b) => {
    const aSeverity = a.severity.toLowerCase();
    const bSeverity = b.severity.toLowerCase();
    const aIndex = SEVERITY_ORDER.indexOf(aSeverity);
    const bIndex = SEVERITY_ORDER.indexOf(bSeverity);
    if (aIndex !== bIndex) {
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    }
    return String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
  });
}

export function filterAlertsBySince(
  alerts: NormalizedAlert[],
  since: Date | null
): NormalizedAlert[] {
  if (!since) {
    return alerts;
  }

  return alerts.filter((alert) => {
    const timestamp = alert.updatedAt ?? alert.createdAt;
    if (!timestamp) {
      return false;
    }
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.valueOf())) {
      return false;
    }
    return parsed >= since;
  });
}
