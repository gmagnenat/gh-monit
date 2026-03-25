/**
 * OpenAPI 3.0 specification for the gh-monit REST API.
 * Served at /api/openapi.json and rendered via Swagger UI at /docs.
 */

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'gh-monit API',
    version: '1.0.0',
    description:
      'REST API for gh-monit — a GitHub Dependabot alert monitor. ' +
      'Provides endpoints for repository management, alert data, ' +
      'history analytics, cross-repo analytics, and setup.',
  },
  tags: [
    { name: 'Dashboard', description: 'Global summary and repository list' },
    { name: 'Repos', description: 'Per-repository alert data and actions' },
    { name: 'History', description: 'Trend, MTTR, SLA and timeline analytics' },
    { name: 'Analytics', description: 'Cross-repo vulnerability and dependency insights' },
    { name: 'Setup', description: 'Initial setup wizard and database reset' },
    { name: 'Fix Advisor', description: 'Grouped fix recommendations for Dependabot alerts' },
    { name: 'Scheduler', description: 'Background refresh scheduler status' },
  ],
  paths: {
    '/api/summary': {
      get: {
        tags: ['Dashboard'],
        summary: 'Global summary',
        description: 'Returns aggregated alert counts across all tracked repositories. Result is cached for 30 seconds.',
        operationId: 'getSummary',
        responses: {
          '200': {
            description: 'Global alert summary',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GlobalSummary' },
              },
            },
          },
        },
      },
    },
    '/api/repos': {
      get: {
        tags: ['Dashboard'],
        summary: 'List repositories',
        description: 'Returns all tracked repositories with their last sync time and per-severity alert counts. Result is cached for 30 seconds.',
        operationId: 'listRepos',
        responses: {
          '200': {
            description: 'Array of repository summaries',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/RepoSummary' },
                },
              },
            },
          },
        },
      },
    },
    '/api/repos/{owner}/{name}/alerts': {
      get: {
        tags: ['Repos'],
        summary: 'Get repo alerts',
        description: 'Returns all open Dependabot alerts for a specific repository.',
        operationId: 'getRepoAlerts',
        parameters: [
          { $ref: '#/components/parameters/owner' },
          { $ref: '#/components/parameters/name' },
        ],
        responses: {
          '200': {
            description: 'Alert data for the repository',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RepoAlerts' },
              },
            },
          },
        },
      },
    },
    '/api/repos/{owner}/{name}': {
      delete: {
        tags: ['Repos'],
        summary: 'Remove repository',
        description: 'Removes a repository and all its associated alert data from the database.',
        operationId: 'removeRepo',
        parameters: [
          { $ref: '#/components/parameters/owner' },
          { $ref: '#/components/parameters/name' },
        ],
        responses: {
          '200': {
            description: 'Repository removed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OkResponse' },
              },
            },
          },
        },
      },
    },
    '/api/repos/{owner}/{name}/refresh': {
      post: {
        tags: ['Repos'],
        summary: 'Refresh repo alerts',
        description: 'Fetches the latest Dependabot alerts from GitHub for a single repository and updates the database.',
        operationId: 'refreshRepo',
        parameters: [
          { $ref: '#/components/parameters/owner' },
          { $ref: '#/components/parameters/name' },
        ],
        responses: {
          '200': {
            description: 'Updated alert data',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RepoAlerts' },
              },
            },
          },
          '500': {
            description: 'GitHub API request failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/repos/refresh-all': {
      post: {
        tags: ['Repos'],
        summary: 'Refresh all repositories (SSE)',
        description:
          'Triggers a full refresh of all tracked repositories. ' +
          'Returns a **Server-Sent Events** stream with three event types:\n\n' +
          '- `start` — `{ total: number }` — refresh started\n' +
          '- `progress` — `{ repo, success, index, total }` — per-repo result\n' +
          '- `done` — `{ refreshed, failed, total }` — all done',
        operationId: 'refreshAllRepos',
        responses: {
          '200': {
            description: 'SSE stream (text/event-stream)',
            content: {
              'text/event-stream': {
                schema: { type: 'string' },
              },
            },
          },
        },
      },
    },
    '/api/scheduler': {
      get: {
        tags: ['Scheduler'],
        summary: 'Scheduler status',
        description: 'Returns the current state of the background cron scheduler (enabled, interval, last/next run).',
        operationId: 'getSchedulerStatus',
        responses: {
          '200': {
            description: 'Scheduler status',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SchedulerStatus' },
              },
            },
          },
        },
      },
    },
    '/api/history/trends': {
      get: {
        tags: ['History'],
        summary: 'Alert trends',
        description: 'Returns daily open alert counts per severity over time, optionally filtered to a single repository.',
        operationId: 'getTrends',
        parameters: [
          {
            name: 'repo',
            in: 'query',
            description: 'Filter to a specific repo (e.g. `owner/name`). Omit for all repos.',
            required: false,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Trend data points',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/TrendPoint' },
                },
              },
            },
          },
        },
      },
    },
    '/api/history/mttr': {
      get: {
        tags: ['History'],
        summary: 'MTTR metrics',
        description: 'Returns Mean Time to Remediate metrics per repo and severity level, optionally filtered to a single repository.',
        operationId: 'getMttr',
        parameters: [
          {
            name: 'repo',
            in: 'query',
            description: 'Filter to a specific repo (e.g. `owner/name`). Omit for all repos.',
            required: false,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'MTTR metrics array',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/MttrMetric' },
                },
              },
            },
          },
        },
      },
    },
    '/api/repos/{owner}/{name}/history': {
      get: {
        tags: ['History'],
        summary: 'Repo alert timeline',
        description: 'Returns the full state-change timeline (open/dismissed/fixed) for all alerts in a repository.',
        operationId: 'getRepoHistory',
        parameters: [
          { $ref: '#/components/parameters/owner' },
          { $ref: '#/components/parameters/name' },
        ],
        responses: {
          '200': {
            description: 'Alert timeline entries',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/AlertTimelineEntry' },
                },
              },
            },
          },
        },
      },
    },
    '/api/history/sla': {
      get: {
        tags: ['History'],
        summary: 'SLA violations',
        description: 'Returns open alerts that have exceeded their severity-based SLA thresholds (critical: 7d, high: 30d, medium: 90d, low: 180d).',
        operationId: 'getSlaViolations',
        responses: {
          '200': {
            description: 'SLA violation records',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/SlaViolation' },
                },
              },
            },
          },
        },
      },
    },
    '/api/analytics/vulnerabilities': {
      get: {
        tags: ['Analytics'],
        summary: 'Vulnerability groups',
        description: 'Returns alerts grouped by GHSA advisory ID, showing how many repos and alerts each vulnerability affects.',
        operationId: 'getVulnerabilities',
        responses: {
          '200': {
            description: 'Vulnerability groups',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/VulnerabilityGroup' },
                },
              },
            },
          },
        },
      },
    },
    '/api/analytics/dependencies': {
      get: {
        tags: ['Analytics'],
        summary: 'Dependency landscape',
        description: 'Returns alerts grouped by package name, showing which packages have the most alerts across repos.',
        operationId: 'getDependencies',
        responses: {
          '200': {
            description: 'Dependency groups',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/DependencyGroup' },
                },
              },
            },
          },
        },
      },
    },
    '/api/analytics/ecosystems': {
      get: {
        tags: ['Analytics'],
        summary: 'Ecosystem breakdown',
        description: 'Returns alert distribution grouped by package ecosystem (npm, pip, maven, etc.).',
        operationId: 'getEcosystems',
        responses: {
          '200': {
            description: 'Ecosystem breakdown',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/EcosystemBreakdown' },
                },
              },
            },
          },
        },
      },
    },
    '/api/fix-advisor': {
      get: {
        tags: ['Fix Advisor'],
        summary: 'Cross-repo fix plan',
        description: 'Returns grouped fix recommendations across all tracked repositories. Alerts are grouped by package name and ecosystem, with severity breakdown and patched version info.',
        operationId: 'getFixAdvisor',
        responses: {
          '200': {
            description: 'Fix advisor response',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/FixAdvisorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/repos/{owner}/{name}/fix-advisor': {
      get: {
        tags: ['Fix Advisor'],
        summary: 'Repo fix plan',
        description: 'Returns grouped fix recommendations for a specific repository.',
        operationId: 'getRepoFixAdvisor',
        parameters: [
          { $ref: '#/components/parameters/owner' },
          { $ref: '#/components/parameters/name' },
        ],
        responses: {
          '200': {
            description: 'Fix advisor response for the repository',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/FixAdvisorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/setup/status': {
      get: {
        tags: ['Setup'],
        summary: 'Setup status',
        description: 'Returns whether the database is empty and whether GitHub targets (user/org) are configured via environment variables.',
        operationId: 'getSetupStatus',
        responses: {
          '200': {
            description: 'Setup status',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SetupStatus' },
              },
            },
          },
        },
      },
    },
    '/api/setup/repos': {
      get: {
        tags: ['Setup'],
        summary: 'List available repos',
        description: 'Lists all repositories accessible via the configured `GH_MONIT_USER` / `GH_MONIT_ORG` environment variables. Used by the setup wizard.',
        operationId: 'listSetupRepos',
        responses: {
          '200': {
            description: 'Available repositories',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/RepoOption' },
                },
              },
            },
          },
        },
      },
    },
    '/api/setup/reset': {
      post: {
        tags: ['Setup'],
        summary: 'Reset database',
        description: 'Clears all data from the database, returning the app to its initial empty state.',
        operationId: 'resetDatabase',
        responses: {
          '200': {
            description: 'Database cleared',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OkResponse' },
              },
            },
          },
        },
      },
    },
    '/api/setup/initialize': {
      post: {
        tags: ['Setup'],
        summary: 'Initialize with selected repos',
        description: 'Seeds the database by fetching Dependabot alerts for the selected repositories from GitHub.',
        operationId: 'initializeSetup',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/InitializeRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Initialization result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/InitializeResponse' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    parameters: {
      owner: {
        name: 'owner',
        in: 'path',
        required: true,
        description: 'GitHub repository owner (user or org login)',
        schema: { type: 'string', example: 'octocat' },
      },
      name: {
        name: 'name',
        in: 'path',
        required: true,
        description: 'GitHub repository name',
        schema: { type: 'string', example: 'hello-world' },
      },
    },
    schemas: {
      SeverityCounts: {
        type: 'object',
        description: 'Alert counts keyed by severity level',
        additionalProperties: { type: 'integer' },
        example: { critical: 2, high: 5, medium: 3, low: 1 },
      },
      GlobalSummary: {
        type: 'object',
        properties: {
          totalRepos: { type: 'integer' },
          totalAlerts: { type: 'integer' },
          severityCounts: { $ref: '#/components/schemas/SeverityCounts' },
        },
        required: ['totalRepos', 'totalAlerts', 'severityCounts'],
      },
      RepoSummary: {
        type: 'object',
        properties: {
          repo: { type: 'string', example: 'octocat/hello-world' },
          lastSync: { type: 'string', format: 'date-time' },
          severityCounts: { $ref: '#/components/schemas/SeverityCounts' },
          totalAlerts: { type: 'integer' },
        },
        required: ['repo', 'lastSync', 'severityCounts', 'totalAlerts'],
      },
      Alert: {
        type: 'object',
        properties: {
          alertNumber: { type: 'integer' },
          state: { type: 'string', enum: ['open', 'dismissed', 'fixed'] },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          packageName: { type: 'string', nullable: true },
          ecosystem: { type: 'string', nullable: true },
          ghsaId: { type: 'string', nullable: true },
          cveId: { type: 'string', nullable: true },
          summary: { type: 'string', nullable: true },
          htmlUrl: { type: 'string', format: 'uri', nullable: true },
          cvssScore: { type: 'number', nullable: true },
          patchedVersion: { type: 'string', nullable: true },
          firstSeen: { type: 'string', format: 'date-time' },
          lastSeen: { type: 'string', format: 'date-time' },
        },
      },
      RepoAlerts: {
        type: 'object',
        properties: {
          repo: { type: 'string', example: 'octocat/hello-world' },
          alerts: { type: 'array', items: { $ref: '#/components/schemas/Alert' } },
        },
      },
      TrendPoint: {
        type: 'object',
        properties: {
          day: { type: 'string', format: 'date', example: '2024-01-15' },
          critical: { type: 'integer' },
          high: { type: 'integer' },
          medium: { type: 'integer' },
          low: { type: 'integer' },
        },
        required: ['day', 'critical', 'high', 'medium', 'low'],
      },
      MttrMetric: {
        type: 'object',
        properties: {
          repo: { type: 'string' },
          severity: { type: 'string' },
          avgDays: { type: 'number' },
          resolvedCount: { type: 'integer' },
        },
        required: ['repo', 'severity', 'avgDays', 'resolvedCount'],
      },
      AlertTimelineEntry: {
        type: 'object',
        properties: {
          alertNumber: { type: 'integer' },
          state: { type: 'string' },
          severity: { type: 'string' },
          recordedAt: { type: 'string', format: 'date-time' },
        },
        required: ['alertNumber', 'state', 'severity', 'recordedAt'],
      },
      SlaViolation: {
        type: 'object',
        properties: {
          repo: { type: 'string' },
          alertNumber: { type: 'integer' },
          severity: { type: 'string' },
          packageName: { type: 'string', nullable: true },
          htmlUrl: { type: 'string', format: 'uri', nullable: true },
          firstSeen: { type: 'string', format: 'date-time' },
          openDays: { type: 'integer' },
          slaLimitDays: { type: 'integer' },
          overdue: { type: 'boolean' },
        },
        required: ['repo', 'alertNumber', 'severity', 'firstSeen', 'openDays', 'slaLimitDays', 'overdue'],
      },
      VulnerabilityGroup: {
        type: 'object',
        properties: {
          ghsaId: { type: 'string' },
          cveId: { type: 'string', nullable: true },
          severity: { type: 'string' },
          summary: { type: 'string', nullable: true },
          cvssScore: { type: 'number', nullable: true },
          patchedVersion: { type: 'string', nullable: true },
          affectedRepos: { type: 'integer' },
          totalAlerts: { type: 'integer' },
          repos: { type: 'array', items: { type: 'string' } },
        },
        required: ['ghsaId', 'severity', 'affectedRepos', 'totalAlerts', 'repos'],
      },
      DependencyGroup: {
        type: 'object',
        properties: {
          packageName: { type: 'string' },
          ecosystem: { type: 'string', nullable: true },
          totalAlerts: { type: 'integer' },
          affectedRepos: { type: 'integer' },
          criticalCount: { type: 'integer' },
          highCount: { type: 'integer' },
          repos: { type: 'array', items: { type: 'string' } },
        },
        required: ['packageName', 'totalAlerts', 'affectedRepos', 'criticalCount', 'highCount', 'repos'],
      },
      EcosystemBreakdown: {
        type: 'object',
        properties: {
          ecosystem: { type: 'string' },
          totalAlerts: { type: 'integer' },
          affectedRepos: { type: 'integer' },
          uniquePackages: { type: 'integer' },
        },
        required: ['ecosystem', 'totalAlerts', 'affectedRepos', 'uniquePackages'],
      },
      FixActionAlert: {
        type: 'object',
        properties: {
          repo: { type: 'string', description: 'Only present in cross-repo responses' },
          alertNumber: { type: 'integer' },
          severity: { type: 'string' },
          summary: { type: 'string', nullable: true },
        },
        required: ['alertNumber', 'severity'],
      },
      FixAction: {
        type: 'object',
        description: 'A grouped fix recommendation for a single package',
        properties: {
          packageName: { type: 'string' },
          ecosystem: { type: 'string', nullable: true },
          manifestPaths: { type: 'array', items: { type: 'string' } },
          scope: { type: 'string', nullable: true },
          groupSeverity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'unknown'] },
          alertCount: { type: 'integer' },
          severityBreakdown: { $ref: '#/components/schemas/SeverityCounts' },
          ghsaIds: { type: 'array', items: { type: 'string' } },
          cveIds: { type: 'array', items: { type: 'string' } },
          maxCvssScore: { type: 'number', nullable: true },
          patchedVersion: { type: 'string', nullable: true },
          hasFix: { type: 'boolean' },
          affectedRepos: { type: 'integer', description: 'Only present in cross-repo responses' },
          repos: { type: 'array', items: { type: 'string' }, description: 'Only present in cross-repo responses' },
          alerts: { type: 'array', items: { $ref: '#/components/schemas/FixActionAlert' } },
        },
        required: ['packageName', 'groupSeverity', 'alertCount', 'hasFix', 'alerts'],
      },
      FixAdvisorResponse: {
        type: 'object',
        properties: {
          repo: { type: 'string', description: '"all" for cross-repo, or "owner/name" for single repo' },
          totalActions: { type: 'integer' },
          totalAlerts: { type: 'integer' },
          actions: { type: 'array', items: { $ref: '#/components/schemas/FixAction' }, description: 'Fixable groups sorted by severity' },
          noFixAvailable: { type: 'array', items: { $ref: '#/components/schemas/FixAction' }, description: 'Groups with no patched version available' },
        },
        required: ['repo', 'totalActions', 'totalAlerts', 'actions', 'noFixAvailable'],
      },
      SchedulerStatus: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          intervalHours: { type: 'number', nullable: true },
          lastRun: { type: 'string', format: 'date-time', nullable: true },
          nextRun: { type: 'string', format: 'date-time', nullable: true },
        },
        required: ['enabled'],
      },
      SetupStatus: {
        type: 'object',
        properties: {
          isEmpty: { type: 'boolean', description: 'True when no repositories have been tracked yet' },
          hasTargets: { type: 'boolean', description: 'True when GH_MONIT_USER or GH_MONIT_ORG is set' },
        },
        required: ['isEmpty', 'hasTargets'],
      },
      RepoOption: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          name: { type: 'string' },
          fullName: { type: 'string', example: 'octocat/hello-world' },
        },
        required: ['owner', 'name', 'fullName'],
      },
      InitializeRequest: {
        type: 'object',
        properties: {
          repos: {
            type: 'array',
            items: { $ref: '#/components/schemas/RepoOption' },
            description: 'Repositories to seed with alert data',
          },
        },
        required: ['repos'],
      },
      InitializeResponse: {
        type: 'object',
        properties: {
          seeded: { type: 'integer', description: 'Number of repos successfully seeded' },
          total: { type: 'integer', description: 'Total repos attempted' },
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                repo: { type: 'string' },
                success: { type: 'boolean' },
              },
              required: ['repo', 'success'],
            },
          },
        },
        required: ['seeded', 'total', 'results'],
      },
      OkResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: true },
        },
        required: ['ok'],
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'GitHub API request failed' },
        },
        required: ['error'],
      },
    },
  },
};
