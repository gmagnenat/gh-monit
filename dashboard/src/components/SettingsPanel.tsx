import { useEffect, useState } from 'react';
import { postReset } from '../api/client';

type SettingsPanelProps = {
  onReset: () => void;
};

export function SettingsPanel({ onReset }: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (resetting) return;
    setOpen(false);
    setConfirming(false);
    setError(null);
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    if (open) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, resetting]);

  const handleReset = async () => {
    setResetting(true);
    setError(null);
    try {
      await postReset();
      close();
      onReset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
      setResetting(false);
    }
  };

  return (
    <>
      {/* Gear button */}
      <button
        onClick={() => setOpen(true)}
        title="Settings"
        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={close}
          />

          {/* Dialog */}
          <div className="relative mt-auto z-10 w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Settings
              </h2>
              <button
                onClick={close}
                disabled={resetting}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              {/* Danger Zone */}
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/10">
                <h3 className="mb-1 text-sm font-semibold text-red-700 dark:text-red-400">
                  Danger Zone
                </h3>
                <p className="mb-4 text-sm text-red-600 dark:text-red-400">
                  Clear all alerts, history, and repository data from the local
                  database. This returns you to the setup wizard.
                </p>

                {!confirming ? (
                  <button
                    onClick={() => setConfirming(true)}
                    className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-700 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    Clear database…
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-white p-3 dark:border-red-700 dark:bg-slate-900">
                      <svg
                        className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                        />
                      </svg>
                      <p className="text-xs text-red-700 dark:text-red-300">
                        <strong>All data will be permanently deleted.</strong>{' '}
                        This includes every tracked alert, historical snapshot,
                        and sync record. This action cannot be undone.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setConfirming(false); setError(null); }}
                        disabled={resetting}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleReset}
                        disabled={resetting}
                        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                      >
                        {resetting && (
                          <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        )}
                        {resetting ? 'Clearing…' : 'Yes, delete everything'}
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
