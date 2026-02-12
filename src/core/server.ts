import { Hono } from 'hono';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { getAllRepoSummaries, getRepoAlerts, saveAlerts } from './db.js';
import { normalizeAlerts } from './alerts.js';
import { fetchDependabotAlerts } from './github.js';
import type { SeverityCounts } from '../types.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/**
 * Creates a Hono app with API routes and static file serving.
 * The server reads from the SQLite database and delegates GitHub
 * API calls to the existing core/github module.
 */
export function createServer(
  db: Database.Database,
  dashboardDir: string
): Hono {
  const app = new Hono();

  // --- API routes ---

  /** Global summary: total repos, total alerts, breakdown by severity. */
  app.get('/api/summary', (c) => {
    const repos = getAllRepoSummaries(db);
    const totalRepos = repos.length;
    const totalAlerts = repos.reduce((sum, r) => sum + r.totalAlerts, 0);

    const severityCounts: SeverityCounts = {};
    for (const repo of repos) {
      for (const [severity, count] of Object.entries(repo.severityCounts)) {
        severityCounts[severity] = (severityCounts[severity] ?? 0) + count;
      }
    }

    return c.json({ totalRepos, totalAlerts, severityCounts });
  });

  /** List all tracked repos with severity counts and last sync timestamp. */
  app.get('/api/repos', (c) => {
    const repos = getAllRepoSummaries(db);
    return c.json(repos);
  });

  /** Full sorted alert list for one repo. */
  app.get('/api/repos/:owner/:name/alerts', (c) => {
    const owner = c.req.param('owner');
    const name = c.req.param('name');
    const fullName = `${owner}/${name}`;
    const result = getRepoAlerts(db, fullName);
    return c.json(result);
  });

  /** Fetch fresh alerts from GitHub, normalize, save, and return updated data. */
  app.post('/api/repos/:owner/:name/refresh', async (c) => {
    const owner = c.req.param('owner');
    const name = c.req.param('name');
    const fullName = `${owner}/${name}`;

    const raw = await fetchDependabotAlerts({ owner, name, fullName });
    if (!raw) {
      return c.json({ error: 'GitHub API request failed' }, 500);
    }

    const alerts = normalizeAlerts(fullName, raw);
    const lastSync = new Date().toISOString();
    saveAlerts(db, fullName, alerts, lastSync);

    const updated = getRepoAlerts(db, fullName);
    return c.json(updated);
  });

  // --- Static file serving with SPA fallback ---

  app.get('*', (c) => {
    const reqPath = c.req.path;
    const filePath = path.join(
      dashboardDir,
      reqPath === '/' ? 'index.html' : reqPath
    );
    const normalizedPath = path.normalize(filePath);

    // Prevent directory traversal
    if (!normalizedPath.startsWith(dashboardDir)) {
      return c.text('Forbidden', 403);
    }

    // Serve the file directly if it exists
    if (
      fs.existsSync(normalizedPath) &&
      fs.statSync(normalizedPath).isFile()
    ) {
      const ext = path.extname(normalizedPath);
      const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
      const content = fs.readFileSync(normalizedPath);
      return new Response(content, {
        headers: { 'Content-Type': contentType },
      });
    }

    // SPA fallback: serve index.html for non-file paths
    const indexPath = path.join(dashboardDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf-8');
      return c.html(content);
    }

    return c.text('Not Found', 404);
  });

  return app;
}
