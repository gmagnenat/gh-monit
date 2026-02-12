import { useState } from 'react';
import type { HistoryState, VulnDepState } from '../hooks/useHistory';
import { DependencyTable } from './DependencyTable';
import { EcosystemChart } from './EcosystemChart';
import { ErrorBanner } from './ErrorBanner';
import { MttrCards } from './MttrCards';
import { SlaPanel } from './SlaPanel';
import { TabNav } from './TabNav';
import { TrendChart } from './TrendChart';
import { VulnerabilityTable } from './VulnerabilityTable';

type AnalyticsSubTab = 'trends' | 'vulnerabilities' | 'dependencies';

const SUB_TABS: { id: AnalyticsSubTab; label: string }[] = [
  { id: 'trends', label: 'Trends' },
  { id: 'vulnerabilities', label: 'Vulnerabilities' },
  { id: 'dependencies', label: 'Dependencies' },
];

type AnalyticsTabProps = {
  history: HistoryState & { reload: () => Promise<void> };
  vulnDep: VulnDepState & { reload: () => Promise<void> };
  activeSubTab: AnalyticsSubTab;
  onSubTabChange: (tab: AnalyticsSubTab) => void;
};

/** Analytics tab content: sub-tabs for trends, vulnerabilities, dependencies. */
export function AnalyticsTab({
  history,
  vulnDep,
  activeSubTab,
  onSubTabChange,
}: AnalyticsTabProps) {
  return (
    <>
      <TabNav
        tabs={SUB_TABS}
        activeTab={activeSubTab}
        onTabChange={onSubTabChange}
      />

      {/* Trends sub-tab */}
      {activeSubTab === 'trends' && (
        <>
          {history.loading ? (
            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-48 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
                />
              ))}
            </div>
          ) : history.error ? (
            <ErrorBanner message={history.error} />
          ) : (
            <div className="space-y-6">
              <TrendChart data={history.trends} />
              <MttrCards data={history.mttr} />
              <SlaPanel data={history.sla} />
            </div>
          )}
        </>
      )}

      {/* Vulnerabilities sub-tab */}
      {activeSubTab === 'vulnerabilities' && (
        <>
          {vulnDep.loading ? (
            <div className="h-48 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
          ) : vulnDep.error ? (
            <ErrorBanner message={vulnDep.error} />
          ) : (
            <VulnerabilityTable data={vulnDep.vulnerabilities} />
          )}
        </>
      )}

      {/* Dependencies sub-tab */}
      {activeSubTab === 'dependencies' && (
        <>
          {vulnDep.loading ? (
            <div className="space-y-6">
              <div className="h-48 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
              <div className="h-48 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            </div>
          ) : vulnDep.error ? (
            <ErrorBanner message={vulnDep.error} />
          ) : (
            <div className="space-y-6">
              <EcosystemChart data={vulnDep.ecosystems} />
              <DependencyTable data={vulnDep.dependencies} />
            </div>
          )}
        </>
      )}
    </>
  );
}
