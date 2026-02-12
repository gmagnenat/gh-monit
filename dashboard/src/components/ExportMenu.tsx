import { useState, useRef, useEffect } from 'react';
import type { Alert, RepoSummary } from '../api/client';
import { downloadCsv, downloadJson } from '../utils/export';

type ExportMenuProps = {
  repos: RepoSummary[];
  alerts: Alert[] | null;
  selectedRepo: string | null;
};

type ExportOption = {
  id: string;
  label: string;
  action: () => void;
  disabled?: boolean;
};

/** Dropdown menu for exporting repos and alerts as JSON or CSV. */
export function ExportMenu({ repos, alerts, selectedRepo }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  const timestamp = new Date().toISOString().slice(0, 10);

  const exportReposJson = () => {
    downloadJson(repos, `gh-monit-repos-${timestamp}.json`);
    setOpen(false);
  };

  const exportReposCsv = () => {
    const rows = repos.map((r) => ({
      repo: r.repo,
      lastSync: r.lastSync,
      totalAlerts: r.totalAlerts,
      critical: r.severityCounts.critical ?? 0,
      high: r.severityCounts.high ?? 0,
      medium: r.severityCounts.medium ?? 0,
      low: r.severityCounts.low ?? 0,
    }));
    downloadCsv(rows, `gh-monit-repos-${timestamp}.csv`);
    setOpen(false);
  };

  const exportAlertsJson = () => {
    if (!alerts || !selectedRepo) return;
    const safeName = selectedRepo.replace('/', '-');
    downloadJson(alerts, `gh-monit-alerts-${safeName}-${timestamp}.json`);
    setOpen(false);
  };

  const exportAlertsCsv = () => {
    if (!alerts || !selectedRepo) return;
    const safeName = selectedRepo.replace('/', '-');
    const rows = alerts.map((a) => ({
      repo: a.repo,
      alertNumber: a.alertNumber,
      severity: a.severity,
      state: a.state,
      packageName: a.packageName ?? '',
      ecosystem: a.ecosystem ?? '',
      createdAt: a.createdAt ?? '',
      htmlUrl: a.htmlUrl ?? '',
    }));
    downloadCsv(rows, `gh-monit-alerts-${safeName}-${timestamp}.csv`);
    setOpen(false);
  };

  const options: ExportOption[] = [
    { id: 'repos-json', label: 'Repos (JSON)', action: exportReposJson },
    { id: 'repos-csv', label: 'Repos (CSV)', action: exportReposCsv },
    {
      id: 'alerts-json',
      label: 'Alerts (JSON)',
      action: exportAlertsJson,
      disabled: !selectedRepo || !alerts,
    },
    {
      id: 'alerts-csv',
      label: 'Alerts (CSV)',
      action: exportAlertsCsv,
      disabled: !selectedRepo || !alerts,
    },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        Export
        <svg
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-44 origin-top-right rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={opt.action}
              disabled={opt.disabled}
              className={`block w-full px-4 py-2 text-left text-sm transition-colors ${
                opt.disabled
                  ? 'cursor-not-allowed text-slate-300 dark:text-slate-600'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
          {!selectedRepo && (
            <p className="px-4 py-2 text-xs text-slate-400 dark:text-slate-500">
              Select a repo to export alerts
            </p>
          )}
        </div>
      )}
    </div>
  );
}
