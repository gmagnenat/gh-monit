type ErrorBannerProps = {
  message: string;
};

/** Theme-aware error banner with red styling. */
export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
      {message}
    </div>
  );
}
