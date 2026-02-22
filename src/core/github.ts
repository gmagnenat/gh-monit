import chalk from 'chalk';
import type { Octokit } from '@octokit/rest';
import type { RepoRef } from '../types.js';

export async function fetchDependabotAlerts(
  octokit: Octokit,
  repo: RepoRef
): Promise<unknown[] | null> {
  try {
    const alerts = await octokit.paginate(
      octokit.rest.dependabot.listAlertsForRepo,
      { owner: repo.owner, repo: repo.name, per_page: 100 }
    );
    return alerts as unknown[];
  } catch (error) {
    return handleApiError(error);
  }
}

export async function getAuthenticatedUser(
  octokit: Octokit
): Promise<string | null> {
  try {
    const { data } = await octokit.rest.users.getAuthenticated();
    return data.login;
  } catch (error) {
    return handleApiError(error);
  }
}

export async function listUserRepos(
  octokit: Octokit,
  username: string,
  includeForks: boolean
): Promise<RepoRef[] | null> {
  const authenticated = await getAuthenticatedUser(octokit);
  const isSelf = authenticated?.toLowerCase() === username.toLowerCase();

  try {
    const repos = isSelf
      ? await octokit.paginate(
          octokit.rest.repos.listForAuthenticatedUser,
          { visibility: 'all', affiliation: 'owner', per_page: 100 }
        )
      : await octokit.paginate(octokit.rest.repos.listForUser, {
          username,
          per_page: 100,
        });

    return repos
      .filter(
        (repo) =>
          repo.owner?.login.toLowerCase() === username.toLowerCase() &&
          (includeForks || !repo.fork)
      )
      .map((repo) => ({
        owner: repo.owner!.login,
        name: repo.name,
        fullName: repo.full_name,
      }));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function listOrgRepos(
  octokit: Octokit,
  org: string,
  includeForks: boolean
): Promise<RepoRef[] | null> {
  try {
    const repos = await octokit.paginate(octokit.rest.repos.listForOrg, {
      org,
      type: 'all',
      per_page: 100,
    });

    return repos
      .filter((repo) => includeForks || !repo.fork)
      .map((repo) => ({
        owner: repo.owner.login,
        name: repo.name,
        fullName: repo.full_name,
      }));
  } catch (error) {
    return handleApiError(error);
  }
}

function handleApiError(error: unknown): null {
  const message = error instanceof Error ? error.message : String(error);
  console.error(chalk.red('GitHub API request failed.'));
  console.error(
    chalk.yellow(
      'Ensure GITHUB_TOKEN is valid and the target repo/user/org exists.'
    )
  );
  console.error(chalk.gray(message));
  process.exitCode = 1;
  return null;
}
