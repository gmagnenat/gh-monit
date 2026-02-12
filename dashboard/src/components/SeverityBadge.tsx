const SEVERITY_STYLES: Record<string, string> = {
  critical:
    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high:
    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  medium:
    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

const DEFAULT_STYLE =
  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';

type SeverityBadgeProps = {
  severity: string;
};

/** Small color-coded pill for alert severity. */
export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const label = severity.toLowerCase();
  const style = SEVERITY_STYLES[label] ?? DEFAULT_STYLE;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {label}
    </span>
  );
}
