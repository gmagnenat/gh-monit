# gh-monit

CLI to fetch and monitor Dependabot alerts for GitHub repositories, users, or organizations.

## Features

- Fetch Dependabot alerts for a single repository, a user, or an organization.
- Cache results in a local SQLite database for offline access and history tracking.
- Filter alerts by date (`--since`).
- Output results in readable text format or JSON for integration with other tools.
- Support for including forked repositories.

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd gh-monit
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## Usage

You can run the CLI using `npm run dev` (for development) or by executing the built binary.

### General Syntax

```bash
npm run dev -- dependabot [options]
```

or if you linked the binary:

```bash
gh-monit dependabot [options]
```

### Commands

#### `dependabot`

Fetch Dependabot alerts for a repo, user, or organization.

**Options:**

- `--repo <owner/name>`: Specify a single GitHub repository (e.g., `facebook/react`).
- `--user <username>`: Fetch alerts for all repositories owned by a user.
- `--org <org>`: Fetch alerts for all repositories in an organization.
- `--include-forks`: Include forked repositories when fetching for a user or org (default: `false`).
- `--db <path>`: Path to the SQLite database file (default: `~/.gh-monit/gh-monit.db`).
- `--since <date>`: Filter alerts updated since the specified ISO date (e.g., `2023-01-01`).
- `--json`: Output the results in JSON format.
- `--refresh`: Bypass the cache and force a fresh fetch from the GitHub API.

### Examples

**1. Monitor a specific repository:**

```bash
npm run dev -- dependabot --repo gmagnenat/gh-monit --refresh
```

**2. Monitor all repositories for a user:**

```bash
npm run dev -- dependabot --user gmagnenat
```

**3. Monitor an organization and include forks:**

```bash
npm run dev -- dependabot --org my-org --include-forks
```

**4. Get alerts updated since a specific date in JSON format:**

```bash
npm run dev -- dependabot --user gmagnenat --since 2023-10-01 --json
```

## How it Works

The CLI interacts with the GitHub API to retrieve Dependabot alerts. To avoid hitting API rate limits excessively and to provide faster subsequent access, it stores the alerts in a local SQLite database (`.gh-monit/gh-monit.db` in your home directory by default).

- **First Run:** The CLI fetches all alerts from GitHub and stores them in the database.
- **Subsequent Runs:** It can use the cached data. Use the `--refresh` flag to force an update from GitHub.
- **Database:** The database tracks the sync state and history of alerts.

## Development

- `npm run dev`: Run the CLI in development mode using `tsx`.
- `npm run build`: Build the project using `tsup`.
- `npm run lint`: Lint the codebase.

## Requirements

- Node.js
- GitHub CLI (`gh`) installed and authenticated.
  - Install: <https://cli.github.com/>
  - Authenticate: `gh auth login`
