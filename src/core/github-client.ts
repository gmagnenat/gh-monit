import { execFileSync } from 'node:child_process';
import chalk from 'chalk';
import { Octokit } from '@octokit/rest';

/**
 * Creates an authenticated Octokit instance.
 *
 * Resolution order:
 * 1. GITHUB_TOKEN environment variable (preferred for server/Docker deployments)
 * 2. `gh auth token` CLI fallback (convenient for local development)
 */
export function createGitHubClient(): Octokit | null {
  const token = resolveToken();
  if (!token) {
    console.error(chalk.red('No GitHub token found.'));
    console.error(
      chalk.yellow(
        'Set the GITHUB_TOKEN environment variable, or install the GitHub CLI and run `gh auth login`.'
      )
    );
    process.exitCode = 1;
    return null;
  }

  return new Octokit({ auth: token });
}

function resolveToken(): string | null {
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  try {
    const token = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    if (token) {
      return token;
    }
  } catch {
    // gh CLI not available or not authenticated — fall through
  }

  return null;
}
