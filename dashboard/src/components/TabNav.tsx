type TabNavProps<T extends string> = {
  tabs: { id: T; label: string }[];
  activeTab: T;
  onTabChange: (tab: T) => void;
};

/** Generic segmented tab navigation bar. */
export function TabNav<T extends string>({
  tabs,
  activeTab,
  onTabChange,
}: TabNavProps<T>) {
  return (
    <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
