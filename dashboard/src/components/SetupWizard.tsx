import type { WizardState } from '../hooks/useSetupWizard';

type SetupWizardProps = {
  state: WizardState;
  onToggle: (fullName: string) => void;
  onToggleAll: () => void;
  onConfirm: () => void;
  onSkip: () => void;
  onRetry: () => void;
  onSearchChange: (value: string) => void;
};

function Spinner() {
  return (
    <svg
      className="h-8 w-8 animate-spin text-blue-500"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function SetupWizard({
  state,
  onToggle,
  onToggleAll,
  onConfirm,
  onSkip,
  onRetry,
  onSearchChange,
}: SetupWizardProps) {
  const { step, repos, selected, search, errorMessage } = state;

  // --- Loading states ---
  if (step === 'checking' || step === 'loading-repos' || step === 'initializing') {
    const text =
      step === 'checking'
        ? 'Checking setup status…'
        : step === 'loading-repos'
          ? 'Fetching your repositories…'
          : `Saving alerts for ${selected.size} repo${selected.size === 1 ? '' : 's'}…`;

    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-slate-600 dark:text-slate-400">
        <Spinner />
        <p className="text-sm">{text}</p>
      </div>
    );
  }

  // --- Error state ---
  if (step === 'error') {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-900/20">
        <p className="mb-4 text-sm text-red-700 dark:text-red-400">
          {errorMessage ?? 'An unexpected error occurred.'}
        </p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  // --- No targets state ---
  if (step === 'no-targets') {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
          No GitHub targets configured
        </h2>
        <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
          Set one or both environment variables before starting the dashboard:
        </p>
        <pre className="mb-6 rounded-lg bg-slate-100 p-3 text-left text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-200">
          {`GH_MONIT_USER=your-github-username\nGH_MONIT_ORG=your-github-org`}
        </pre>
        <button
          onClick={onSkip}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Skip — open empty dashboard
        </button>
      </div>
    );
  }

  // --- Selecting state ---
  const filtered = repos.filter((r) =>
    r.fullName.toLowerCase().includes(search.toLowerCase())
  );
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((r) => selected.has(r.fullName));

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
        Choose repositories to monitor
      </h2>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        Select which repositories to fetch Dependabot alerts for.
      </p>

      {/* Search */}
      <div className="relative mb-3">
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
          placeholder="Filter repositories…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
        />
        {search && (
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

      {/* Select / Deselect all */}
      <div className="mb-2 flex items-center gap-2">
        <button
          onClick={onToggleAll}
          className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {allVisibleSelected ? 'Deselect all' : 'Select all'}
        </button>
        <span className="text-xs text-slate-400">
          ({filtered.length} visible)
        </span>
      </div>

      {/* Repo list */}
      <div className="mb-6 max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No repositories match your search.
          </p>
        ) : (
          filtered.map((repo) => (
            <label
              key={repo.fullName}
              className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
            >
              <input
                type="checkbox"
                checked={selected.has(repo.fullName)}
                onChange={() => onToggle(repo.fullName)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
              />
              <span className="text-sm text-slate-800 dark:text-slate-200">
                {repo.fullName}
              </span>
            </label>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {selected.size} of {repos.length} selected
        </span>
        <button
          onClick={onConfirm}
          disabled={selected.size === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          Start Monitoring
        </button>
      </div>
    </div>
  );
}
