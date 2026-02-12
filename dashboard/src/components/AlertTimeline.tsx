import { useMemo } from 'react';
import type { AlertTimelineEntry } from '../api/client';
import { formatDateTime } from '../utils/date';
import { SEVERITY_BADGE } from '../utils/severity';
import { Card } from './Card';
import { EmptyState } from './EmptyState';

const STATE_STYLES: Record<string, { dot: string; label: string }> = {
  open: {
    dot: 'bg-yellow-500',
    label: 'text-yellow-700 dark:text-yellow-400',
  },
  fixed: {
    dot: 'bg-green-500',
    label: 'text-green-700 dark:text-green-400',
  },
  dismissed: {
    dot: 'bg-slate-400',
    label: 'text-slate-600 dark:text-slate-400',
  },
};

type AlertTimelineProps = {
  entries: AlertTimelineEntry[];
  loading: boolean;
};

/** Vertical timeline of state transitions per alert, grouped by alert number. */
export function AlertTimeline({ entries, loading }: AlertTimelineProps) {
  // Group entries by alert number
  const grouped = useMemo(() => {
    const map = new Map<number, AlertTimelineEntry[]>();
    for (const entry of entries) {
      let list = map.get(entry.alertNumber);
      if (!list) {
        list = [];
        map.set(entry.alertNumber, list);
      }
      list.push(entry);
    }
    // Sort by alert number ascending
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [entries]);

  if (loading) {
    return (
      <Card className="mt-4 p-6 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Loading timeline...
        </p>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState title="Alert Timeline" message="No history entries yet." />
    );
  }

  return (
    <Card className="mt-4 p-6">
      <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
        Alert Timeline
        <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
          ({entries.length} events across {grouped.length} alerts)
        </span>
      </h3>
      <div className="max-h-96 space-y-4 overflow-y-auto pr-2">
        {grouped.map(([alertNumber, events]) => (
          <div key={alertNumber} className="flex gap-3">
            {/* Alert number badge */}
            <div className="flex w-14 shrink-0 items-start justify-center pt-0.5">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-mono font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                #{alertNumber}
              </span>
            </div>

            {/* Timeline line with events */}
            <div className="relative flex-1 border-l-2 border-slate-200 pl-4 dark:border-slate-700">
              {events.map((event, i) => {
                const stateStyle = STATE_STYLES[event.state] ?? STATE_STYLES.open;
                const sevBadge = SEVERITY_BADGE[event.severity as keyof typeof SEVERITY_BADGE] ?? SEVERITY_BADGE.low;

                return (
                  <div key={i} className="relative mb-3 last:mb-0">
                    {/* Dot on the timeline */}
                    <div
                      className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${stateStyle.dot}`}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs font-medium capitalize ${stateStyle.label}`}
                      >
                        {event.state}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${sevBadge}`}
                      >
                        {event.severity}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        {formatDateTime(event.recordedAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
