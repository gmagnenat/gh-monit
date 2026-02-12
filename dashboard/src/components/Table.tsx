import type { ReactNode } from 'react';

type ChildrenProps = { children: ReactNode };
type ChildrenClassProps = { children: ReactNode; className?: string };
type TableCellProps = ChildrenClassProps & React.TdHTMLAttributes<HTMLTableCellElement>;

export function Table({ children }: ChildrenProps) {
  return <table className="w-full text-left text-sm">{children}</table>;
}

export function TableHead({ children }: ChildrenProps) {
  return (
    <thead>
      <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
        {children}
      </tr>
    </thead>
  );
}

export function TableHeader({ children, className }: ChildrenClassProps) {
  return (
    <th
      className={`px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 ${className ?? ''}`}
    >
      {children}
    </th>
  );
}

export function TableBody({ children }: ChildrenProps) {
  return (
    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
      {children}
    </tbody>
  );
}

export function TableRow({ children, className }: ChildrenClassProps) {
  return (
    <tr
      className={
        className ??
        'transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50'
      }
    >
      {children}
    </tr>
  );
}

export function TableCell({ children, className, ...rest }: TableCellProps) {
  return (
    <td className={`px-4 py-2 ${className ?? ''}`} {...rest}>
      {children}
    </td>
  );
}
