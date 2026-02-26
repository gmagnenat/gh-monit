import type { ReactNode } from 'react';
import type { RepoSortOption, SeverityFilter } from '../api/client';
import { SEVERITY_OPTIONS } from '../utils/severity';

type RepoToolbarProps = {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOption: RepoSortOption;
  onSortChange: (option: RepoSortOption) => void;
  severityFilter: SeverityFilter;
  onSeverityFilterChange: (filter: SeverityFilter) => void;
  onRefreshAll: () => void;
  bulkRefreshing: boolean;
  repoCount: number;
  filteredCount: number;
  extraActions?: ReactNode;
};

const SORT_OPTIONS: { id: RepoSortOption; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'critical', label: 'Critical' },
  { id: 'total', label: 'Total' },
];

/** Toolbar with search, sort, severity filter, and bulk refresh. */
export function RepoToolbar({
  searchQuery,
  onSearchChange,
  sortOption,
  onSortChange,
  severityFilter,
  onSeverityFilterChange,
  onRefreshAll,
  bulkRefreshing,
  repoCount,
  filteredCount,
  extraActions,
}: RepoToolbarProps) {
  const toggleSeverity = (key: keyof SeverityFilter) => {
    onSeverityFilterChange({
      ...severityFilter,
      [key]: !severityFilter[key],
    });
  };

  const hasActiveFilter =
    searchQuery.trim() !== '' || Object.values(severityFilter).some(Boolean);

  return (
    <div className="space-y-3">
      {/* Row 1: Search + Refresh All */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search repos..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {extraActions}

        {/* Refresh All button */}
        <button
          onClick={onRefreshAll}
          disabled={bulkRefreshing}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          <svg
            className={`h-4 w-4 ${bulkRefreshing ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {bulkRefreshing ? 'Refreshing...' : 'Refresh All'}
        </button>
      </div>

      {/* Row 2: Sort + Severity Filter + Count */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Sort controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Sort
          </span>
          <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {SORT_OPTIONS.map((opt) => {
              const isActive = sortOption === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => onSortChange(opt.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Severity filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Filter
          </span>
          <div className="inline-flex gap-1">
            {SEVERITY_OPTIONS.map((opt) => {
              const isActive = severityFilter[opt.key];
              return (
                <button
                  key={opt.key}
                  onClick={() => toggleSeverity(opt.key)}
                  title={`Filter by ${opt.key}`}
                  className={`relative flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold transition-all ${
                    isActive
                      ? `${opt.color} text-white shadow-sm`
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Repo count */}
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          {hasActiveFilter ? (
            <>
              Showing {filteredCount} of {repoCount} repos
            </>
          ) : (
            <>{repoCount} repos</>
          )}
        </span>
      </div>
    </div>
  );
}
