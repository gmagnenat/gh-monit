import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendPoint } from '../api/client';
import { SEVERITY_HEX } from '../utils/severity';
import { Card } from './Card';
import { EmptyState } from './EmptyState';

type TrendChartProps = {
  data: TrendPoint[];
};

/** Stacked area chart showing daily open alert counts by severity. */
export function TrendChart({ data }: TrendChartProps) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="Alert Trends"
        message="No trend data available yet. Sync repos to start tracking history."
      />
    );
  }

  return (
    <Card className="p-6">
      <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
        Alert Trends
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <defs>
            {Object.entries(SEVERITY_HEX).map(([key, color]) => (
              <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-slate-200 dark:stroke-slate-700"
          />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11 }}
            className="text-slate-500 dark:text-slate-400"
          />
          <YAxis
            allowDecimals={false}
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
          <Legend
            wrapperStyle={{ fontSize: '12px' }}
          />
          <Area
            type="monotone"
            dataKey="critical"
            stackId="1"
            stroke={SEVERITY_HEX.critical}
            fill="url(#grad-critical)"
            name="Critical"
          />
          <Area
            type="monotone"
            dataKey="high"
            stackId="1"
            stroke={SEVERITY_HEX.high}
            fill="url(#grad-high)"
            name="High"
          />
          <Area
            type="monotone"
            dataKey="medium"
            stackId="1"
            stroke={SEVERITY_HEX.medium}
            fill="url(#grad-medium)"
            name="Medium"
          />
          <Area
            type="monotone"
            dataKey="low"
            stackId="1"
            stroke={SEVERITY_HEX.low}
            fill="url(#grad-low)"
            name="Low"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
