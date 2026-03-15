import { useCallback, useEffect, useRef, useState } from 'react';
import { FixedSizeList } from 'react-window';
import type { ListChildComponentProps } from 'react-window';
import type { RepoSummary } from '../api/client';
import { RepoCard } from './RepoCard';

type RepoGridProps = {
  repos: RepoSummary[];
  selectedRepo: string | null;
  isRefreshing: (repo: string) => boolean;
  onSelectRepo: (repoFullName: string) => void;
  onRefreshRepo: (owner: string, name: string) => void;
  onRemoveRepo: (owner: string, name: string) => Promise<void>;
};

const VIRTUALIZE_THRESHOLD = 50;
const CARD_HEIGHT = 160;
const GAP = 16;
const ROW_HEIGHT = CARD_HEIGHT + GAP;
const LIST_HEIGHT = 600;

function useColumns(containerRef: React.RefObject<HTMLDivElement | null>): number {
  const [cols, setCols] = useState(3);

  useEffect(() => {
    function update() {
      const width = containerRef.current?.offsetWidth ?? window.innerWidth;
      if (width < 640) setCols(1);
      else if (width < 1024) setCols(2);
      else setCols(3);
    }
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [containerRef]);

  return cols;
}

type RowData = {
  rows: RepoSummary[][];
  cols: number;
  selectedRepo: string | null;
  isRefreshing: (repo: string) => boolean;
  onSelectRepo: (repo: string) => void;
  onRefreshRepo: (owner: string, name: string) => void;
  onRemoveRepo: (owner: string, name: string) => Promise<void>;
};

function VirtualRow({ index, style, data }: ListChildComponentProps<RowData>) {
  const { rows, selectedRepo, isRefreshing, onSelectRepo, onRefreshRepo, onRemoveRepo } = data;
  const row = rows[index];

  return (
    <div style={{ ...style, paddingBottom: GAP }}>
      <div
        style={{ display: 'grid', gridTemplateColumns: `repeat(${data.cols}, minmax(0, 1fr))`, gap: GAP }}
      >
        {row.map((repo: RepoSummary) => (
          <RepoCard
            key={repo.repo}
            repo={repo}
            isSelected={selectedRepo === repo.repo}
            isRefreshing={isRefreshing(repo.repo)}
            onSelect={onSelectRepo}
            onRefresh={onRefreshRepo}
            onRemove={onRemoveRepo}
          />
        ))}
      </div>
    </div>
  );
}

/** Responsive grid of repo cards. Virtualizes when repo count exceeds threshold. */
export function RepoGrid({
  repos,
  selectedRepo,
  isRefreshing,
  onSelectRepo,
  onRefreshRepo,
  onRemoveRepo,
}: RepoGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cols = useColumns(containerRef);

  const rows: RepoSummary[][] = [];
  for (let i = 0; i < repos.length; i += cols) {
    rows.push(repos.slice(i, i + cols));
  }

  const itemData: RowData = {
    rows,
    cols,
    selectedRepo,
    isRefreshing,
    onSelectRepo,
    onRefreshRepo,
    onRemoveRepo,
  };

  const getItemKey = useCallback(
    (index: number) => rows[index].map((r) => r.repo).join(','),
    [rows]
  );

  if (repos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No repositories tracked yet.
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Run{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">
            gh-monit dependabot --repo owner/name
          </code>{' '}
          to start tracking.
        </p>
      </div>
    );
  }

  if (repos.length <= VIRTUALIZE_THRESHOLD) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {repos.map((repo) => (
          <RepoCard
            key={repo.repo}
            repo={repo}
            isSelected={selectedRepo === repo.repo}
            isRefreshing={isRefreshing(repo.repo)}
            onSelect={onSelectRepo}
            onRefresh={onRefreshRepo}
            onRemove={onRemoveRepo}
          />
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <FixedSizeList
        height={LIST_HEIGHT}
        itemCount={rows.length}
        itemSize={ROW_HEIGHT}
        itemData={itemData}
        itemKey={getItemKey}
        width="100%"
        style={{ overflowX: 'hidden' }}
      >
        {VirtualRow}
      </FixedSizeList>
    </div>
  );
}
