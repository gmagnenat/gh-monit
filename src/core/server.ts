import { Hono } from 'hono';
import type Database from 'better-sqlite3';
import type { Octokit } from '@octokit/rest';
import fs from 'node:fs';
import path from 'node:path';
import {
  clearDatabase,
  getAlertTimeline,
  getAllRepoSummaries,
  removeRepo,
  getDependencyLandscape,
  getEcosystemBreakdown,
  getMttrMetrics,
  getRepoAlerts,
  getSlaViolations,
  getTrendData,
  getVulnerabilityGroups,
  saveAlerts,
} from './db.js';
import { normalizeAlerts } from './alerts.js';
import { fetchDependabotAlerts, listOrgRepos, listUserRepos } from './github.js';
import { getSchedulerStatus, refreshAllRepos } from './scheduler.js';
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
 * API calls to the Octokit client.
 */
export function createServer(
  db: Database.Database,
  octokit: Octokit,
  dashboardDir: string
): Hono {
  const app = new Hono();

  // --- API routes ---

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

  app.get('/api/repos', (c) => {
    const repos = getAllRepoSummaries(db);
    return c.json(repos);
  });

  app.get('/api/repos/:owner/:name/alerts', (c) => {
    const owner = c.req.param('owner');
    const name = c.req.param('name');
    const fullName = `${owner}/${name}`;
    const result = getRepoAlerts(db, fullName);
    return c.json(result);
  });

  app.delete('/api/repos/:owner/:name', (c) => {
    const owner = c.req.param('owner');
    const name = c.req.param('name');
    const fullName = `${owner}/${name}`;
    removeRepo(db, fullName);
    return c.json({ ok: true });
  });

  app.post('/api/repos/:owner/:name/refresh', async (c) => {
    const owner = c.req.param('owner');
    const name = c.req.param('name');
    const fullName = `${owner}/${name}`;

    const raw = await fetchDependabotAlerts(octokit, { owner, name, fullName });
    if (!raw) {
      return c.json({ error: 'GitHub API request failed' }, 500);
    }

    const alerts = normalizeAlerts(fullName, raw);
    const lastSync = new Date().toISOString();
    saveAlerts(db, fullName, alerts, lastSync);

    const updated = getRepoAlerts(db, fullName);
    return c.json(updated);
  });

  app.post('/api/repos/refresh-all', async (c) => {
    const result = await refreshAllRepos(db, octokit);
    return c.json(result);
  });

  app.get('/api/scheduler', (c) => {
    return c.json(getSchedulerStatus());
  });

  // --- History analytics routes ---

  app.get('/api/history/trends', (c) => {
    const repo = c.req.query('repo') || null;
    const data = getTrendData(db, repo);
    return c.json(data);
  });

  app.get('/api/history/mttr', (c) => {
    const repo = c.req.query('repo') || null;
    const data = getMttrMetrics(db, repo);
    return c.json(data);
  });

  app.get('/api/repos/:owner/:name/history', (c) => {
    const owner = c.req.param('owner');
    const name = c.req.param('name');
    const fullName = `${owner}/${name}`;
    const data = getAlertTimeline(db, fullName);
    return c.json(data);
  });

  app.get('/api/history/sla', (c) => {
    const data = getSlaViolations(db);
    return c.json(data);
  });

  // --- Cross-repo analytics routes ---

  app.get('/api/analytics/vulnerabilities', (c) => {
    const data = getVulnerabilityGroups(db);
    return c.json(data);
  });

  app.get('/api/analytics/dependencies', (c) => {
    const data = getDependencyLandscape(db);
    return c.json(data);
  });

  app.get('/api/analytics/ecosystems', (c) => {
    const data = getEcosystemBreakdown(db);
    return c.json(data);
  });

  // --- Setup wizard routes ---

  app.get('/api/setup/status', (c) => {
    const repos = getAllRepoSummaries(db);
    const isEmpty = repos.length === 0;
    const hasTargets = !!(process.env.GH_MONIT_USER || process.env.GH_MONIT_ORG);
    return c.json({ isEmpty, hasTargets });
  });

  app.get('/api/setup/repos', async (c) => {
    const user = process.env.GH_MONIT_USER;
    const org = process.env.GH_MONIT_ORG;
    if (!user && !org) return c.json([]);

    const targets = [
      ...(user ? user.split(',').map((u) => ({ type: 'user' as const, value: u.trim() })) : []),
      ...(org  ? org.split(',').map((o) => ({ type: 'org'  as const, value: o.trim() })) : []),
    ];

    const all: { owner: string; name: string; fullName: string }[] = [];
    for (const target of targets) {
      const list = target.type === 'user'
        ? await listUserRepos(octokit, target.value, false)
        : await listOrgRepos(octokit, target.value, false);
      if (list) all.push(...list);
    }
    return c.json(all);
  });

  app.post('/api/setup/reset', (c) => {
    clearDatabase(db);
    return c.json({ ok: true });
  });

  app.post('/api/setup/initialize', async (c) => {
    const body = await c.req.json<{ repos: { owner: string; name: string; fullName: string }[] }>();
    const selected = body.repos ?? [];
    if (selected.length === 0) return c.json({ seeded: 0, total: 0, results: [] });

    const results: { repo: string; success: boolean }[] = [];
    for (const repo of selected) {
      const raw = await fetchDependabotAlerts(octokit, repo);
      if (raw) {
        const alerts = normalizeAlerts(repo.fullName, raw);
        saveAlerts(db, repo.fullName, alerts, new Date().toISOString());
        results.push({ repo: repo.fullName, success: true });
      } else {
        results.push({ repo: repo.fullName, success: false });
      }
    }
    const seeded = results.filter((r) => r.success).length;
    return c.json({ seeded, total: selected.length, results });
  });

  // --- Static file serving with SPA fallback ---

  app.get('*', (c) => {
    const reqPath = c.req.path;
    const filePath = path.join(
      dashboardDir,
      reqPath === '/' ? 'index.html' : reqPath
    );
    const normalizedPath = path.normalize(filePath);

    if (!normalizedPath.startsWith(dashboardDir)) {
      return c.text('Forbidden', 403);
    }

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

    const indexPath = path.join(dashboardDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf-8');
      return c.html(content);
    }

    return c.text('Not Found', 404);
  });

  return app;
}
