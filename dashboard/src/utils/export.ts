/**
 * Export utilities for downloading data as JSON or CSV files.
 */

/** Trigger a file download in the browser. */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Escape a value for CSV (wrap in quotes if needed, escape inner quotes). */
function escapeCsv(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Download data as a JSON file. */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  triggerDownload(blob, filename);
}

/** Download an array of objects as a CSV file. */
export function downloadCsv(
  rows: Record<string, unknown>[],
  filename: string
): void {
  if (rows.length === 0) {
    // Empty CSV with no headers
    const blob = new Blob([''], { type: 'text/csv' });
    triggerDownload(blob, filename);
    return;
  }

  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(',')),
  ];
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
  triggerDownload(blob, filename);
}
