# AGENTS.md

## MANDATORY: Use td for Task Management

You must run td usage --new-session at conversation start (or after /clear) to see current work.
Use td usage -q for subsequent reads.

## Project Overview

**gh-monit** is a Node.js CLI tool that fetches and monitors GitHub Dependabot security alerts for repositories, users, or organizations. It wraps the GitHub CLI (`gh`) to interact with the GitHub API and caches results in a local SQLite database for offline access and history tracking.

## Tech Stack

- **Language:** TypeScript (strict mode, ES2022 target)
- **Runtime:** Node.js with ESM (`"type": "module"`)
- **Build:** tsup (bundles to `dist/index.js` with shebang)
- **Dev runner:** tsx
- **CLI framework:** Commander.js
- **Validation:** Zod
- **Database:** better-sqlite3 (SQLite with WAL mode)
- **Process execution:** execa (wraps `gh` CLI)
- **Terminal styling:** chalk

## Architecture

The codebase follows a three-layer architecture:

```
src/
├── index.ts            # Entry point — registers commands with Commander.js
├── types.ts            # Shared TypeScript type definitions
├── cli/                # CLI layer — command registration, option parsing, orchestration
│   └── dependabot.ts
├── core/               # Business logic — data normalization, caching, API calls
│   ├── alerts.ts       # Alert normalization, filtering, sorting, summarization
│   ├── db.ts           # SQLite database schema, read/write operations
│   └── github.ts       # GitHub API interactions via `gh` CLI
└── ui/                 # Presentation — terminal output formatting
    └── output.ts       # Table rendering, severity coloring, summary display
```

### Layer responsibilities

- **`cli/`** — Parses CLI options, validates inputs, orchestrates calls to `core/` and `ui/`. This is the only layer that reads user options or controls program flow.
- **`core/`** — Pure business logic with no terminal output (except error/warning messages). Functions here are reusable and testable in isolation.
- **`ui/`** — Formats and prints results to stdout. Depends on `core/alerts.ts` for sorting/summarization but never calls the database or API directly.

### Data flow

1. User runs `gh-monit dependabot --repo owner/name`
2. `cli/dependabot.ts` parses options, validates the target, opens the database
3. Checks cache in SQLite; if stale or `--refresh`, fetches from GitHub API via `core/github.ts`
4. Raw API responses are normalized into `NormalizedAlert` objects via `core/alerts.ts`
5. Alerts are persisted to SQLite with change history tracking via `core/db.ts`
6. Results are rendered to the terminal via `ui/output.ts`, or output as JSON

## Code Conventions

### TypeScript

- Strict mode is enabled; do not use `any` unless wrapping untyped external data (e.g., GitHub API responses).
- Use explicit `.js` extensions in all relative imports (required for ESM with `NodeNext` module resolution).
- Define shared types in `src/types.ts`. Use `type` imports (`import type { ... }`) when importing only types.
- Prefer `type` aliases over `interface` for data shapes.

### Style

- Use camelCase for functions and variables, PascalCase for types.
- Use kebab-case for filenames (e.g., `dependabot.ts`).
- Prefer named exports. The only default export is the tsup config.
- Keep functions pure where possible — avoid side effects in `core/` functions.
- Use `null` (not `undefined`) for absent values in data structures.

### Error handling

- Return `null` from functions to signal failure (e.g., API errors, invalid input) rather than throwing.
- Set `process.exitCode = 1` on errors instead of calling `process.exit()`.
- Print errors with `chalk.red()`, warnings with `chalk.yellow()`, and debug info with `chalk.gray()`.
- Always provide actionable guidance in error messages (e.g., "Check `gh auth status`").

### Database patterns

- Use prepared statements for all queries.
- Wrap multi-step writes in transactions (`db.transaction()`).
- Use `ON CONFLICT ... DO UPDATE` (upsert) for idempotent inserts.
- Track alert state changes in the `alert_history` table for audit purposes.

### GitHub API patterns

- All GitHub API calls go through the `ghApiJson()` helper in `core/github.ts`.
- Use `gh api` via `execa` — do not use `fetch` or HTTP clients directly.
- Support pagination with the `--paginate` flag.

## Database Schema

Three tables in SQLite (`~/.gh-monit/gh-monit.db` by default):

- **`alerts`** — Current state of all Dependabot alerts. Primary key: `(repo, alert_number)`.
- **`repo_sync`** — Tracks when each repo was last synced. Primary key: `repo`.
- **`alert_history`** — Append-only log of alert state changes for historical tracking.

## Scripts

| Script        | Command            | Purpose                              |
| ------------- | ------------------ | ------------------------------------ |
| `npm run dev` | `tsx src/index.ts`  | Run CLI in development (no build)    |
| `npm run build` | `tsup`           | Bundle to `dist/` for production     |
| `npm run lint` | `tsc --noEmit`    | Type-check without emitting files    |
| `npm run test` | *(not configured)* | Placeholder — tests not yet written |

## Adding a New Command

1. Create a new file in `src/cli/` (e.g., `src/cli/mycommand.ts`).
2. Export a `registerMyCommand(program: Command): void` function that calls `program.command(...)`.
3. Register it in `src/index.ts` alongside `registerDependabotCommand`.
4. Add any new core logic to `src/core/` and any new output formatting to `src/ui/`.
5. Add corresponding types to `src/types.ts` if needed.

## Adding New Core Logic

- Place data-processing functions in `src/core/alerts.ts` or a new file in `src/core/`.
- Keep functions pure: accept data as arguments, return results, avoid side effects.
- Validate external inputs with Zod schemas where applicable.

## External Dependencies

- **GitHub CLI (`gh`)** must be installed and authenticated (`gh auth login`). The tool does not handle authentication itself.
- **SQLite** is bundled via `better-sqlite3` — no external database server required.

## Testing Guidance

Tests are not yet configured. When adding tests:

- Use **Vitest** as the test runner (preferred for ESM + TypeScript projects).
- Place test files alongside source files using the `*.test.ts` naming convention.
- Focus initial test coverage on `src/core/` functions (pure logic, easy to test).
- Mock `execa` calls when testing `src/core/github.ts`.
- Use an in-memory SQLite database (`:memory:`) when testing `src/core/db.ts`.
