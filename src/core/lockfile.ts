import type { Octokit } from '@octokit/rest';

export type DependencyChain = {
  repo: string;
  vulnerablePackage: string;
  directDependency: string;
  directVersion: string | null;
  chainDepth: number;
};

type PackageLockV2 = {
  packages?: Record<string, { version?: string; dependencies?: Record<string, string> }>;
  dependencies?: Record<string, { version?: string; requires?: Record<string, string> }>;
};

/**
 * Fetches package-lock.json from a GitHub repo via the API.
 * Uses raw media type to avoid the 1MB content API limit.
 * Returns null if the file doesn't exist or can't be fetched.
 */
export async function fetchLockFile(
  octokit: Octokit,
  owner: string,
  name: string
): Promise<PackageLockV2 | null> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo: name,
      path: 'package-lock.json',
      mediaType: { format: 'raw' },
    });

    // With raw format, data is the file content as a string
    const content = typeof data === 'string' ? data : String(data);
    return JSON.parse(content) as PackageLockV2;
  } catch {
    return null;
  }
}

/**
 * Resolves which direct (top-level) dependency pulls in a vulnerable transitive package.
 *
 * For package-lock.json v2/v3: walks the `packages` map.
 * Top-level deps are at `node_modules/<name>`, nested deps at deeper paths.
 * We trace upward from the vulnerable package to find which top-level dep requires it.
 */
export function resolveDirectDependency(
  lockFile: PackageLockV2,
  vulnerablePackage: string
): { directDependency: string; directVersion: string | null; chainDepth: number } | null {
  const packages = lockFile.packages;

  if (packages) {
    return resolveFromPackagesMap(packages, vulnerablePackage);
  }

  // v1 fallback: use dependencies tree
  if (lockFile.dependencies) {
    return resolveFromDependenciesTree(lockFile.dependencies, vulnerablePackage);
  }

  return null;
}

function resolveFromPackagesMap(
  packages: Record<string, { version?: string; dependencies?: Record<string, string> }>,
  vulnerablePackage: string
): { directDependency: string; directVersion: string | null; chainDepth: number } | null {
  // Check if vulnerable package is itself a direct dependency
  const directKey = `node_modules/${vulnerablePackage}`;
  const rootPkg = packages[''] ?? packages['.'];

  if (rootPkg?.dependencies?.[vulnerablePackage]) {
    return {
      directDependency: vulnerablePackage,
      directVersion: packages[directKey]?.version ?? null,
      chainDepth: 0,
    };
  }

  // Find all paths where this package appears
  const vulnPaths: string[] = [];
  for (const key of Object.keys(packages)) {
    const segments = key.split('node_modules/');
    const pkgName = segments[segments.length - 1];
    if (pkgName === vulnerablePackage) {
      vulnPaths.push(key);
    }
  }

  if (vulnPaths.length === 0) return null;

  // For each path, walk upward to find the top-level dependency
  for (const vulnPath of vulnPaths) {
    const segments = vulnPath.split('node_modules/').filter(Boolean);

    if (segments.length <= 1) {
      // It's a direct dependency
      return {
        directDependency: vulnerablePackage,
        directVersion: packages[vulnPath]?.version ?? null,
        chainDepth: 0,
      };
    }

    // The first segment is the top-level package
    const topLevel = segments[0].replace(/\/$/, '');
    const topLevelKey = `node_modules/${topLevel}`;

    return {
      directDependency: topLevel,
      directVersion: packages[topLevelKey]?.version ?? null,
      chainDepth: segments.length - 1,
    };
  }

  return null;
}

function resolveFromDependenciesTree(
  dependencies: Record<string, { version?: string; requires?: Record<string, string> }>,
  vulnerablePackage: string
): { directDependency: string; directVersion: string | null; chainDepth: number } | null {
  // Check if it's a direct dependency
  if (dependencies[vulnerablePackage]) {
    return {
      directDependency: vulnerablePackage,
      directVersion: dependencies[vulnerablePackage].version ?? null,
      chainDepth: 0,
    };
  }

  // Search which direct dependency requires the vulnerable package (transitively)
  for (const [depName, depInfo] of Object.entries(dependencies)) {
    if (depInfo.requires && vulnerablePackage in depInfo.requires) {
      return {
        directDependency: depName,
        directVersion: depInfo.version ?? null,
        chainDepth: 1,
      };
    }
  }

  return null;
}

/**
 * For a given repo and its lock file, resolves all vulnerable packages to their direct parents.
 */
export function resolveAllChains(
  repo: string,
  lockFile: PackageLockV2,
  vulnerablePackages: string[]
): DependencyChain[] {
  const chains: DependencyChain[] = [];
  const seen = new Set<string>();

  for (const pkg of vulnerablePackages) {
    if (seen.has(pkg)) continue;
    seen.add(pkg);

    const result = resolveDirectDependency(lockFile, pkg);
    if (result) {
      chains.push({
        repo,
        vulnerablePackage: pkg,
        directDependency: result.directDependency,
        directVersion: result.directVersion,
        chainDepth: result.chainDepth,
      });
    }
  }

  return chains;
}
