import type { SummaryResponse } from '../api/client';

type SummaryCardsProps = {
  summary: SummaryResponse | null;
};

type CardDef = {
  label: string;
  getValue: (s: SummaryResponse) => number;
  accent: string;
};

const CARDS: CardDef[] = [
  {
    label: 'Total Repos',
    getValue: (s) => s.totalRepos,
    accent: 'border-slate-300 dark:border-slate-700',
  },
  {
    label: 'Total Alerts',
    getValue: (s) => s.totalAlerts,
    accent: 'border-slate-300 dark:border-slate-700',
  },
  {
    label: 'Critical',
    getValue: (s) => s.severityCounts.critical ?? 0,
    accent: 'border-red-400 dark:border-red-500',
  },
  {
    label: 'High',
    getValue: (s) => s.severityCounts.high ?? 0,
    accent: 'border-orange-400 dark:border-orange-500',
  },
];

/** Four stat cards showing global counts with severity-colored accents. */
export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {CARDS.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl border-l-4 bg-white p-4 shadow-sm dark:bg-slate-900 ${card.accent}`}
        >
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {card.label}
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {summary ? card.getValue(summary) : '—'}
          </p>
        </div>
      ))}
    </div>
  );
}
