import { SEVERITY_BADGE } from '../utils/severity';

const DEFAULT_STYLE =
  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';

type SeverityBadgeProps = {
  severity: string;
};

/** Small color-coded pill for alert severity. */
export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const label = severity.toLowerCase();
  const style = SEVERITY_BADGE[label as keyof typeof SEVERITY_BADGE] ?? DEFAULT_STYLE;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {label}
    </span>
  );
}
