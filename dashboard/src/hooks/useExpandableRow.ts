import { useState } from 'react';

/**
 * Manages a single expandable row in a table.
 * At most one row can be expanded at a time — toggling a new row collapses the previous.
 */
export function useExpandableRow() {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggle = (key: string) =>
    setExpandedRow((prev) => (prev === key ? null : key));

  const isExpanded = (key: string) => expandedRow === key;

  return { isExpanded, toggle };
}
