import type { ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  className?: string;
};

/** Shared card wrapper with rounded border and theme-aware background. */
export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {children}
    </div>
  );
}
