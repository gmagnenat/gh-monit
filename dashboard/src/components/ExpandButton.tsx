type ExpandButtonProps = {
  count: number;
  label?: string;
  expanded: boolean;
  onClick: () => void;
};

/** Toggle button showing a count and expand/collapse chevron. */
export function ExpandButton({
  count,
  label = 'repo',
  expanded,
  onClick,
}: ExpandButtonProps) {
  return (
    <button
      onClick={onClick}
      className="text-xs font-medium text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
    >
      {count} {label}
      {count !== 1 ? 's' : ''}
      <span className="ml-1 text-[10px] text-slate-400">
        {expanded ? '▲' : '▼'}
      </span>
    </button>
  );
}
