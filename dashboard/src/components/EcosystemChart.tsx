import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { EcosystemBreakdown } from '../api/client';

const ECOSYSTEM_PALETTE: Record<string, string> = {
  npm: '#ef4444',
  pip: '#3b82f6',
  maven: '#f97316',
  nuget: '#8b5cf6',
  rubygems: '#e11d48',
  go: '#06b6d4',
  cargo: '#f59e0b',
  composer: '#6366f1',
};

const FALLBACK_COLORS = [
  '#64748b',
  '#0ea5e9',
  '#14b8a6',
  '#a3e635',
  '#fb923c',
  '#f472b6',
];

/** Returns a stable color for a given ecosystem. */
function getColor(ecosystem: string, index: number): string {
  return (
    ECOSYSTEM_PALETTE[ecosystem.toLowerCase()] ??
    FALLBACK_COLORS[index % FALLBACK_COLORS.length]
  );
}

type EcosystemChartProps = {
  data: EcosystemBreakdown[];
};

/**
 * Bar chart + donut chart showing alert distribution by ecosystem.
 * The bar chart shows total alerts per ecosystem.
 * The donut chart shows proportion of alerts across ecosystems.
 */
export function EcosystemChart({ data }: EcosystemChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Ecosystem Breakdown
        </h3>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          No ecosystem data available yet. Sync repos to start tracking.
        </p>
      </div>
    );
  }

  const chartData = data.map((d, i) => ({
    ...d,
    fill: getColor(d.ecosystem, i),
  }));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
        Ecosystem Breakdown
      </h3>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Bar chart */}
        <div>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Alerts by Ecosystem
          </p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-slate-200 dark:stroke-slate-700"
                horizontal={false}
              />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 11 }}
                className="text-slate-500 dark:text-slate-400"
              />
              <YAxis
                type="category"
                dataKey="ecosystem"
                width={80}
                tick={{ fontSize: 11 }}
                className="text-slate-500 dark:text-slate-400"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-slate-900, #0f172a)',
                  border: '1px solid var(--color-slate-700, #334155)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#e2e8f0',
                }}
              />
              <Bar dataKey="totalAlerts" radius={[0, 4, 4, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.ecosystem} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut chart */}
        <div>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Alert Distribution
          </p>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="totalAlerts"
                nameKey="ecosystem"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                label={({ name, percent }) =>
                  `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.ecosystem} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-slate-900, #0f172a)',
                  border: '1px solid var(--color-slate-700, #334155)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#e2e8f0',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px' }}
                formatter={(value: string) => (
                  <span className="text-slate-600 dark:text-slate-400">
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {chartData.slice(0, 4).map((eco) => (
          <div
            key={eco.ecosystem}
            className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
          >
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: eco.fill }}
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {eco.ecosystem}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {eco.totalAlerts}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                alerts · {eco.uniquePackages} pkg
                {eco.uniquePackages !== 1 ? 's' : ''} · {eco.affectedRepos}{' '}
                repo{eco.affectedRepos !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
