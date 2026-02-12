import { Card } from './Card';

type EmptyStateProps = {
  title?: string;
  message: string;
  variant?: 'neutral' | 'positive';
};

/** Reusable empty state card with optional title and positive/neutral styling. */
export function EmptyState({ title, message, variant = 'neutral' }: EmptyStateProps) {
  return (
    <Card className="p-6">
      {title && (
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h3>
      )}
      <p
        className={`text-center text-sm ${
          variant === 'positive'
            ? 'text-green-600 dark:text-green-400'
            : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {message}
      </p>
    </Card>
  );
}
