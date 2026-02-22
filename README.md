# gh-monit

CLI and dashboard to fetch and monitor Dependabot alerts for GitHub repositories, users, or organizations.

## Features

- Fetch Dependabot alerts for a single repository, a user, or an organization.
- Cache results in a local SQLite database for offline access and history tracking.
- Filter alerts by date (`--since`).
- Output results in readable text format or JSON for integration with other tools.
- Support for including forked repositories.
- Web dashboard with trend charts, MTTR metrics, SLA tracking, and cross-repo analytics.
- Automatic daily refresh of all tracked repos via built-in cron scheduler.
- Docker-ready for server deployment.

## Authentication

gh-monit uses the GitHub REST API directly via [Octokit](https://github.com/octokit/rest.js). Authentication is resolved in this order:

1. **`GITHUB_TOKEN` environment variable** (recommended for servers and Docker)
2. **`gh auth token` fallback** — if the [GitHub CLI](https://cli.github.com/) is installed and authenticated, the token is read automatically (convenient for local development)

### Token permissions

- **Classic PAT:** `repo` + `security_events` scopes
- **Fine-grained PAT:** Repository access with **Dependabot alerts** (read) and **Metadata** (read) permissions

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

### CLI

```bash
# Development
npm run dev -- dependabot [options]

# Production (after build)
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

#### `dashboard`

Start the web dashboard to browse alerts visually.

**Options:**

- `--port <number>`: Port to listen on (default: `3847`).
- `--no-open`: Skip opening the browser automatically.
- `--db <path>`: Path to the SQLite database file.

### Examples

```bash
# Monitor a specific repository
npm run dev -- dependabot --repo owner/repo --refresh

# Monitor all repositories for a user
npm run dev -- dependabot --user your-username

# Monitor an organization and include forks
npm run dev -- dependabot --org my-org --include-forks

# Get alerts updated since a specific date in JSON format
npm run dev -- dependabot --user your-username --since 2023-10-01 --json

# Start the dashboard
npm run dev -- dashboard
```

## Docker

### Using Docker Compose (recommended)

```bash
# Set your GitHub token in a .env file (see .env.example)
echo "GITHUB_TOKEN=ghp_your_token_here" > .env

# Build and start
docker compose up -d

# View logs
docker compose logs -f
```

The dashboard will be available at `http://localhost:3847`.

Data is persisted in a Docker volume (`gh-monit-data`), so it survives container restarts.

### Auto-seeding on first startup

Set `GH_MONIT_USER` and/or `GH_MONIT_ORG` in your `.env` file. On first startup, if the database is empty, the dashboard will automatically fetch all repos and their alerts in the background:

```
GITHUB_TOKEN=ghp_your_token_here
GH_MONIT_USER=your-username
GH_MONIT_ORG=your-org
```

Both variables support comma-separated values for multiple users/orgs (e.g., `GH_MONIT_ORG=org1,org2`).

### Manual data loading

You can also populate data manually using `docker exec`:

```bash
# Fetch all repos for a GitHub user
docker exec gh-monit-server-1 node dist/index.js dependabot --user your-username --db /data/gh-monit.db --refresh

# Fetch all repos for an organization
docker exec gh-monit-server-1 node dist/index.js dependabot --org my-org --db /data/gh-monit.db --refresh

# Fetch a single repo
docker exec gh-monit-server-1 node dist/index.js dependabot --repo owner/repo --db /data/gh-monit.db --refresh
```

Once populated, you can refresh individual repos from the dashboard UI or via the API:

```bash
# Refresh a single repo
curl -X POST http://localhost:3847/api/repos/owner/repo/refresh

# Refresh all tracked repos
curl -X POST http://localhost:3847/api/repos/refresh-all
```

### Using Docker directly

```bash
docker build -t gh-monit .

docker run -d \
  --name gh-monit \
  -p 3847:3847 \
  -e GITHUB_TOKEN=ghp_your_token_here \
  -v gh-monit-data:/data \
  gh-monit
```

### Environment variables

| Variable | Description | Default |
|---|---|---|
| `GITHUB_TOKEN` | GitHub personal access token (required) | — |
| `GH_MONIT_USER` | GitHub username(s) to auto-seed on first startup (comma-separated) | — |
| `GH_MONIT_ORG` | GitHub org(s) to auto-seed on first startup (comma-separated) | — |
| `GH_MONIT_DB_PATH` | Path to the SQLite database file | `/data/gh-monit.db` (Docker) or `~/.gh-monit/gh-monit.db` (local) |
| `GH_MONIT_REFRESH_SCHEDULE` | Cron expression for auto-refresh schedule | `0 6 * * *` (daily at 6:00 AM) |

### Auto-refresh scheduler

The dashboard includes a built-in cron scheduler that automatically refreshes all tracked repos on a configurable schedule. By default, it runs daily at 6:00 AM.

Configure the schedule via the `GH_MONIT_REFRESH_SCHEDULE` environment variable using standard cron syntax:

```bash
# Every 6 hours
GH_MONIT_REFRESH_SCHEDULE="0 */6 * * *"

# Twice daily at 8am and 8pm
GH_MONIT_REFRESH_SCHEDULE="0 8,20 * * *"

# Every Monday at midnight
GH_MONIT_REFRESH_SCHEDULE="0 0 * * 1"
```

The scheduler staggers API calls with a 2-second delay between repos to stay within GitHub rate limits. If a refresh cycle is still running when the next one is scheduled, it will be skipped.

Check the scheduler status via the API:

```bash
curl http://localhost:3847/api/scheduler
```

## How it Works

The CLI interacts with the GitHub REST API to retrieve Dependabot alerts. To avoid hitting API rate limits excessively and to provide faster subsequent access, it stores the alerts in a local SQLite database.

- **First Run:** The CLI fetches all alerts from GitHub and stores them in the database.
- **Subsequent Runs:** It can use the cached data. Use the `--refresh` flag to force an update from GitHub.
- **Database:** The database tracks the sync state and history of alerts.

## Development

- `npm run dev`: Run the CLI in development mode using `tsx`.
- `npm run build`: Build both the dashboard and CLI for production.
- `npm run build:cli`: Build only the CLI backend.
- `npm run build:dashboard`: Build only the dashboard frontend.
- `npm run lint`: Type-check the codebase.

## Requirements

- Node.js 22+
- A GitHub token (via `GITHUB_TOKEN` env var or `gh auth login`)
