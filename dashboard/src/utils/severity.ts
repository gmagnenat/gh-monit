export type Severity = 'critical' | 'high' | 'medium' | 'low';

export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];

/** Tailwind badge classes (SlaPanel, AlertTimeline, VulnerabilityTable, SeverityBadge, DependencyTable). */
export const SEVERITY_BADGE: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

/** Card bg/text/bar classes (MttrCards). */
export const SEVERITY_CARD: Record<Severity, { bg: string; text: string; bar: string }> = {
  critical: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-400',
    bar: 'bg-red-500',
  },
  high: {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    text: 'text-orange-700 dark:text-orange-400',
    bar: 'bg-orange-500',
  },
  medium: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    text: 'text-yellow-700 dark:text-yellow-400',
    bar: 'bg-yellow-500',
  },
  low: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-400',
    bar: 'bg-blue-500',
  },
};

/** Hex colors for Recharts (TrendChart). */
export const SEVERITY_HEX: Record<Severity, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
};

/** Bar fill classes (RepoCard). */
export const SEVERITY_BAR: Record<Severity, string> = {
  critical: 'bg-red-500 dark:bg-red-400',
  high: 'bg-orange-500 dark:bg-orange-400',
  medium: 'bg-yellow-500 dark:bg-yellow-400',
  low: 'bg-blue-500 dark:bg-blue-400',
};

/** Sort order (AlertsTable). */
export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Toolbar filter options (RepoToolbar). */
export const SEVERITY_OPTIONS: { key: Severity; label: string; color: string }[] = [
  { key: 'critical', label: 'C', color: 'bg-red-500' },
  { key: 'high', label: 'H', color: 'bg-orange-500' },
  { key: 'medium', label: 'M', color: 'bg-yellow-500' },
  { key: 'low', label: 'L', color: 'bg-blue-500' },
];
