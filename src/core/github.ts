import chalk from "chalk";
import { execa } from "execa";
import type { RepoRef } from "../types.js";

type GitHubRepo = {
  name: string;
  full_name: string;
  owner: { login: string };
  fork: boolean;
};

type GitHubUser = {
  login: string;
};

export async function fetchDependabotAlerts(
  repo: RepoRef
): Promise<unknown[] | null> {
  return ghApiJson<unknown[]>([
    "--paginate",
    `repos/${repo.owner}/${repo.name}/dependabot/alerts`,
  ]);
}

export async function getAuthenticatedUser(): Promise<string | null> {
  const user = await ghApiJson<GitHubUser>(["user"]);
  return user?.login ?? null;
}

export async function listUserRepos(
  username: string,
  includeForks: boolean
): Promise<RepoRef[] | null> {
  const authenticated = await getAuthenticatedUser();
  const isSelf = authenticated?.toLowerCase() === username.toLowerCase();
  const endpoint = isSelf
    ? "user/repos?visibility=all&affiliation=owner"
    : `users/${username}/repos`;

  const repos = await ghApiJson<GitHubRepo[]>(["--paginate", endpoint]);
  if (!repos) {
    return null;
  }

  return repos
    .filter(
      (repo) =>
        repo.owner.login.toLowerCase() === username.toLowerCase() &&
        (includeForks || !repo.fork)
    )
    .map((repo) => ({
      owner: repo.owner.login,
      name: repo.name,
      fullName: repo.full_name,
    }));
}

export async function listOrgRepos(
  org: string,
  includeForks: boolean
): Promise<RepoRef[] | null> {
  const repos = await ghApiJson<GitHubRepo[]>([
    "--paginate",
    `orgs/${org}/repos?type=all`,
  ]);
  if (!repos) {
    return null;
  }

  return repos
    .filter((repo) => includeForks || !repo.fork)
    .map((repo) => ({
      owner: repo.owner.login,
      name: repo.name,
      fullName: repo.full_name,
    }));
}

async function ghApiJson<T>(args: string[]): Promise<T | null> {
  try {
    const response = await execa("gh", ["api", ...args]);
    return JSON.parse(response.stdout) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red("GitHub API request failed."));
    console.error(
      chalk.yellow(
        "Check `gh auth status` and ensure the target repo/user exists."
      )
    );
    console.error(chalk.gray(message));
    process.exitCode = 1;
    return null;
  }
}
