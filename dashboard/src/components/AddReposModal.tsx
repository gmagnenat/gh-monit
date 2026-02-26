import { useEffect, useState } from 'react';
import type { RepoOption } from '../api/client';
import { fetchAvailableRepos, postInitialize } from '../api/client';

type AddReposModalProps = {
  monitoredRepoNames: Set<string>;
  onAdded: () => void;
};

type ModalStep = 'loading' | 'selecting' | 'adding' | 'error';

export function AddReposModal({ monitoredRepoNames, onAdded }: AddReposModalProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ModalStep>('loading');
  const [repos, setRepos] = useState<RepoOption[]>([]);
  const [selected, setSelected] = useState(new Set<string>());
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadRepos = async () => {
    setStep('loading');
    setError(null);
    try {
      const all = await fetchAvailableRepos();
      setRepos(all.filter((r) => !monitoredRepoNames.has(r.fullName)));
      setStep('selecting');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load repositories');
      setStep('error');
    }
  };

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setSearch('');
      loadRepos();
    }
  }, [open]);

  const close = () => {
    if (step === 'adding') return;
    setOpen(false);
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    if (open) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, step]);

  const toggle = (fullName: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fullName)) next.delete(fullName);
      else next.add(fullName);
      return next;
    });
  };

  const toggleAll = () => {
    const visible = repos.filter((r) =>
      r.fullName.toLowerCase().includes(search.toLowerCase())
    );
    const allSelected = visible.every((r) => selected.has(r.fullName));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const r of visible) next.delete(r.fullName);
      } else {
        for (const r of visible) next.add(r.fullName);
      }
      return next;
    });
  };

  const handleAdd = async () => {
    const selectedRepos = repos.filter((r) => selected.has(r.fullName));
    setStep('adding');
    try {
      await postInitialize(selectedRepos);
      setOpen(false);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add repositories');
      setStep('error');
    }
  };

  const filtered = repos.filter((r) =>
    r.fullName.toLowerCase().includes(search.toLowerCase())
  );
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((r) => selected.has(r.fullName));

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add repos
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={close}
          />
          <div className="relative z-10 flex w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Add repositories
              </h2>
              <button
                onClick={close}
                disabled={step === 'adding'}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4">
              {/* Loading */}
              {(step === 'loading' || step === 'adding') && (
                <div className="flex flex-col items-center gap-3 py-12 text-slate-500 dark:text-slate-400">
                  <svg className="h-6 w-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-sm">
                    {step === 'loading'
                      ? 'Fetching available repositories…'
                      : `Fetching alerts for ${selected.size} repo${selected.size === 1 ? '' : 's'}…`}
                  </p>
                </div>
              )}

              {/* Error */}
              {step === 'error' && (
                <div className="flex flex-col items-center gap-3 py-10">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  <button
                    onClick={loadRepos}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Empty — all repos already monitored */}
              {step === 'selecting' && repos.length === 0 && (
                <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  All available repositories are already being monitored.
                </p>
              )}

              {/* Repo selection */}
              {step === 'selecting' && repos.length > 0 && (
                <>
                  {/* Search */}
                  <div className="relative mb-3">
                    <svg
                      className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Filter repositories…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                    />
                    {search && (
                      <button
                        onClick={() => setSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Select / deselect all */}
                  <div className="mb-2 flex items-center gap-2">
                    <button
                      onClick={toggleAll}
                      className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {allVisibleSelected ? 'Deselect all' : 'Select all'}
                    </button>
                    <span className="text-xs text-slate-400">({filtered.length} visible)</span>
                  </div>

                  {/* List */}
                  <div className="max-h-[40vh] overflow-y-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                    {filtered.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
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
                            onChange={() => toggle(repo.fullName)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                          />
                          <span className="text-sm text-slate-800 dark:text-slate-200">
                            {repo.fullName}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {step === 'selecting' && repos.length > 0 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 dark:border-slate-800">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {selected.size} of {repos.length} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={close}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={selected.size === 0}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    Add{selected.size > 0 ? ` ${selected.size}` : ''} repo{selected.size === 1 ? '' : 's'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
