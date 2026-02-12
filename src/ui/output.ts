import chalk from "chalk";
import { SEVERITY_ORDER, sortAlerts, summarizeAlerts } from "../core/alerts.js";
import type { RepoAlertsResult, SeverityCounts } from "../types.js";

export function renderRepoOutput(result: RepoAlertsResult): void {
  console.log(chalk.bold(`Dependabot alerts for ${result.repo.fullName}`));
  if (result.lastSync) {
    console.log(
      `Last sync: ${result.lastSync}${result.usedCache ? " (cached)" : ""}`
    );
  }

  if (result.alerts.length === 0) {
    console.log(chalk.green("No Dependabot alerts found."));
    return;
  }

  const severityCounts = summarizeAlerts(result.alerts);
  const countsLine = formatCountsLine(severityCounts);
  console.log(countsLine);

  const sortedAlerts = sortAlerts(result.alerts);
  const rows = sortedAlerts.map((alert) => [
    String(alert.alertNumber),
    alert.severity,
    alert.state,
    alert.packageName ?? "-",
    alert.manifestPath ?? "-",
  ]);

  renderTable(["#", "Severity", "State", "Package", "Manifest"], rows);
}

export function renderUserOutput(
  username: string,
  results: RepoAlertsResult[]
): void {
  renderCollectionOutput(`Dependabot alerts for ${username}`, results);
}

export function renderOrgOutput(
  org: string,
  results: RepoAlertsResult[]
): void {
  renderCollectionOutput(`Dependabot alerts for org ${org}`, results);
}

function buildRepoSummaryRow(result: RepoAlertsResult): string[] {
  const counts = summarizeAlerts(result.alerts);
  const total = result.alerts.length;
  return [
    result.repo.fullName,
    String(total),
    String(counts.critical ?? 0),
    String(counts.high ?? 0),
    String(counts.medium ?? 0),
    String(counts.low ?? 0),
    String(counts.unknown ?? 0),
  ];
}

function formatCountsLine(counts: SeverityCounts): string {
  return SEVERITY_ORDER.map(
    (severity) => `${severity}: ${counts[severity] ?? 0}`
  ).join(" | ");
}

function renderCollectionOutput(
  title: string,
  results: RepoAlertsResult[]
): void {
  console.log(chalk.bold(title));

  if (results.length === 0) {
    console.log(chalk.yellow("No repositories found."));
    return;
  }

  const allAlerts = results.flatMap((result) => result.alerts);
  if (allAlerts.length === 0) {
    console.log(chalk.green("No Dependabot alerts found."));
  } else {
    console.log(formatCountsLine(summarizeAlerts(allAlerts)));
  }

  const rows = results
    .map((result) => buildRepoSummaryRow(result))
    .sort((a, b) => Number(b[1]) - Number(a[1]));

  renderTable(
    ["Repo", "Total", "Critical", "High", "Medium", "Low", "Unknown"],
    rows
  );
}

export function renderTable(headers: string[], rows: string[][]): void {
  const maxWidths = headers.map((header, index) => {
    const values = rows.map((row) => row[index] ?? "");
    const longest = Math.max(header.length, ...values.map((value) => value.length));
    return Math.min(longest, 36);
  });

  const formatRow = (row: string[]) =>
    row
      .map((cell, index) => {
        const width = maxWidths[index] ?? 10;
        return padCell(truncateCell(cell, width), width);
      })
      .join("  ");

  console.log(formatRow(headers));
  console.log(maxWidths.map((width) => "-".repeat(width)).join("  "));

  for (const row of rows) {
    console.log(formatRow(row));
  }
}

function truncateCell(value: string, maxWidth: number): string {
  if (value.length <= maxWidth) {
    return value;
  }
  if (maxWidth <= 3) {
    return value.slice(0, maxWidth);
  }
  return `${value.slice(0, maxWidth - 3)}...`;
}

function padCell(value: string, width: number): string {
  if (value.length >= width) {
    return value;
  }
  return value + " ".repeat(width - value.length);
}
