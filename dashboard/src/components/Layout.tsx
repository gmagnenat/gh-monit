import type { ReactNode } from 'react';
import { ThemeToggle } from './ThemeToggle';

type LayoutProps = {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  children: ReactNode;
};

/** Top navigation bar with title and theme toggle. Wraps page content. */
export function Layout({ theme, onToggleTheme, children }: LayoutProps) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-slate-700 dark:text-slate-300"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              gh-monit
            </h1>
          </div>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
