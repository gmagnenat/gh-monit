import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { swaggerUI } from '@hono/swagger-ui';
import type Database from 'better-sqlite3';
import type { Octokit } from '@octokit/rest';
import fs from 'node:fs';
import path from 'node:path';
import { openapiSpec } from './openapi.js';
import {
  clearDatabase,
  getAlertTimeline,
  getAllRepoSummaries,
  getActionPlan,
  getFixAdvisor,
  getGlobalSummary,
  saveDependencyChains,
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
import { fetchLockFile, resolveAllChains } from './lockfile.js';
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

const TTL_MS = 30_000;

type CacheEntry<T> = { data: T; expiresAt: number };

function makeCache<T>() {
  let entry: CacheEntry<T> | null = null;
  return {
    get(): T | null {
      if (entry && Date.now() < entry.expiresAt) return entry.data;
      return null;
    },
    set(data: T) {
      entry = { data, expiresAt: Date.now() + TTL_MS };
    },
    invalidate() {
      entry = null;
    },
  };
}

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

  const summaryCache = makeCache<ReturnType<typeof getGlobalSummary>>();
  const reposCache = makeCache<ReturnType<typeof getAllRepoSummaries>>();

  function invalidateDashboardCache() {
    summaryCache.invalidate();
    reposCache.invalidate();
  }

  // --- API documentation ---

  app.get('/api/openapi.json', (c) => c.json(openapiSpec));
  app.get('/docs', swaggerUI({ url: '/api/openapi.json' }));

  // --- API routes ---

  app.get('/api/summary', (c) => {
    let result = summaryCache.get();
    if (!result) {
      result = getGlobalSummary(db);
      summaryCache.set(result);
    }
    return c.json(result);
  });

  app.get('/api/repos', (c) => {
    let repos = reposCache.get();
    if (!repos) {
      repos = getAllRepoSummaries(db);
      reposCache.set(repos);
    }
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
    invalidateDashboardCache();
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

    // Resolve dependency chains
    const openPackages = alerts
      .filter((a) => a.state === 'open' && a.packageName)
      .map((a) => a.packageName!);
    if (openPackages.length > 0) {
      try {
        const lockFile = await fetchLockFile(octokit, owner, name);
        if (lockFile) {
          const chains = resolveAllChains(fullName, lockFile, openPackages);
          saveDependencyChains(db, chains);
        }
      } catch {
        // best-effort
      }
    }

    invalidateDashboardCache();

    const updated = getRepoAlerts(db, fullName);
    return c.json(updated);
  });

  app.post('/api/repos/refresh-all', (c) => {
    return streamSSE(c, async (stream) => {
      const repos = getAllRepoSummaries(db);
      await stream.writeSSE({ event: 'start', data: JSON.stringify({ total: repos.length }) });

      const result = await refreshAllRepos(db, octokit, async (progress) => {
        await stream.writeSSE({ event: 'progress', data: JSON.stringify(progress) });
      });

      invalidateDashboardCache();

      await stream.writeSSE({
        event: 'done',
        data: JSON.stringify({ refreshed: result.refreshed, failed: result.failed, total: result.total }),
      });
    });
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

  // --- Fix advisor routes ---

  app.get('/api/repos/:owner/:name/fix-advisor', (c) => {
    const owner = c.req.param('owner');
    const name = c.req.param('name');
    const fullName = `${owner}/${name}`;
    const data = getFixAdvisor(db, fullName);
    return c.json(data);
  });

  app.get('/api/fix-advisor', (c) => {
    const data = getFixAdvisor(db);
    return c.json(data);
  });

  // --- Action plan (dependency chain analysis) ---

  app.get('/api/analytics/action-plan', (c) => {
    const plan = getActionPlan(db);
    return c.json(plan);
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
    invalidateDashboardCache();
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
        invalidateDashboardCache();
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
