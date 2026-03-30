import type { Octokit } from '@octokit/rest';

export type DependencyChain = {
  repo: string;
  vulnerablePackage: string;
  directDependency: string;
  directVersion: string | null;
  chainDepth: number;
};

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type LockFileData = {
  /** v2/v3 packages map */
  packages?: Record<string, { version?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>;
  /** v1 dependencies tree */
  dependencies?: Record<string, { version?: string; requires?: Record<string, string>; dependencies?: Record<string, unknown> }>;
};

/**
 * Fetches a file from a GitHub repo via the API (raw format for large files).
 */
async function fetchRepoFile(
  octokit: Octokit,
  owner: string,
  name: string,
  path: string
): Promise<string | null> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo: name,
      path,
      mediaType: { format: 'raw' },
    });
    return typeof data === 'string' ? data : String(data);
  } catch {
    return null;
  }
}

/**
 * Fetches package.json to get actual direct dependencies.
 */
export async function fetchPackageJson(
  octokit: Octokit,
  owner: string,
  name: string
): Promise<PackageJson | null> {
  const content = await fetchRepoFile(octokit, owner, name, 'package.json');
  if (!content) return null;
  try {
    return JSON.parse(content) as PackageJson;
  } catch {
    return null;
  }
}

/**
 * Fetches package-lock.json for dependency graph data.
 */
export async function fetchLockFile(
  octokit: Octokit,
  owner: string,
  name: string
): Promise<LockFileData | null> {
  const content = await fetchRepoFile(octokit, owner, name, 'package-lock.json');
  if (!content) return null;
  try {
    return JSON.parse(content) as LockFileData;
  } catch {
    return null;
  }
}

/**
 * Builds a dependency graph from the lock file.
 * Returns a map: packageName -> set of packages it directly depends on.
 */
function buildDependencyGraph(
  lockFile: LockFileData
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  if (lockFile.packages) {
    // v2/v3: scan all entries for their dependencies
    for (const [key, entry] of Object.entries(lockFile.packages)) {
      if (key === '' || key === '.') continue;
      // Extract package name from the path
      const segments = key.split('node_modules/');
      const pkgName = segments[segments.length - 1];

      if (!graph.has(pkgName)) {
        graph.set(pkgName, new Set());
      }
      const deps = graph.get(pkgName)!;

      if (entry.dependencies) {
        for (const dep of Object.keys(entry.dependencies)) deps.add(dep);
      }
      if (entry.devDependencies) {
        for (const dep of Object.keys(entry.devDependencies)) deps.add(dep);
      }
    }
  } else if (lockFile.dependencies) {
    // v1: recurse the dependency tree
    buildGraphFromV1(lockFile.dependencies, graph);
  }

  return graph;
}

function buildGraphFromV1(
  deps: Record<string, { version?: string; requires?: Record<string, string>; dependencies?: Record<string, unknown> }>,
  graph: Map<string, Set<string>>
): void {
  for (const [name, info] of Object.entries(deps)) {
    if (!graph.has(name)) {
      graph.set(name, new Set());
    }
    const set = graph.get(name)!;

    if (info.requires) {
      for (const req of Object.keys(info.requires)) set.add(req);
    }
    if (info.dependencies) {
      // Recurse nested dependencies
      buildGraphFromV1(
        info.dependencies as typeof deps,
        graph
      );
    }
  }
}

/**
 * Check if `source` transitively depends on `target` using BFS.
 * Returns the depth if found, or -1 if not.
 */
function findTransitiveDepth(
  graph: Map<string, Set<string>>,
  source: string,
  target: string
): number {
  if (source === target) return 0;

  const visited = new Set<string>();
  let queue: string[] = [source];
  let depth = 1;

  while (queue.length > 0) {
    const next: string[] = [];
    for (const pkg of queue) {
      const deps = graph.get(pkg);
      if (!deps) continue;

      for (const dep of deps) {
        if (dep === target) return depth;
        if (!visited.has(dep)) {
          visited.add(dep);
          next.push(dep);
        }
      }
    }
    queue = next;
    depth++;

    // Safety: don't traverse forever
    if (depth > 20) break;
  }

  return -1;
}

/**
 * Resolves which direct dependency (from package.json) pulls in a vulnerable package.
 *
 * Strategy: for each vulnerable package, BFS from every direct dep to see
 * which one reaches it. Pick the shortest path.
 */
export function resolveDirectDependency(
  packageJson: PackageJson,
  lockFile: LockFileData,
  vulnerablePackage: string
): { directDependency: string; directVersion: string | null; chainDepth: number } | null {
  // Get actual direct dependencies from package.json
  const directDeps = new Set<string>();
  if (packageJson.dependencies) {
    for (const name of Object.keys(packageJson.dependencies)) directDeps.add(name);
  }
  if (packageJson.devDependencies) {
    for (const name of Object.keys(packageJson.devDependencies)) directDeps.add(name);
  }

  // If the vulnerable package is itself a direct dependency
  if (directDeps.has(vulnerablePackage)) {
    const version = getInstalledVersion(lockFile, vulnerablePackage);
    return {
      directDependency: vulnerablePackage,
      directVersion: version,
      chainDepth: 0,
    };
  }

  // Build dependency graph and BFS from each direct dep
  const graph = buildDependencyGraph(lockFile);

  let bestMatch: { dep: string; depth: number } | null = null;

  for (const directDep of directDeps) {
    const depth = findTransitiveDepth(graph, directDep, vulnerablePackage);
    if (depth > 0 && (!bestMatch || depth < bestMatch.depth)) {
      bestMatch = { dep: directDep, depth };
    }
  }

  if (!bestMatch) return null;

  const version = getInstalledVersion(lockFile, bestMatch.dep);
  return {
    directDependency: bestMatch.dep,
    directVersion: version,
    chainDepth: bestMatch.depth,
  };
}

/**
 * Gets the installed version of a package from the lock file.
 */
function getInstalledVersion(lockFile: LockFileData, packageName: string): string | null {
  if (lockFile.packages) {
    const entry = lockFile.packages[`node_modules/${packageName}`];
    return entry?.version ?? null;
  }
  if (lockFile.dependencies) {
    return lockFile.dependencies[packageName]?.version ?? null;
  }
  return null;
}

/**
 * For a given repo, resolves all vulnerable packages to their direct parents.
 */
export function resolveAllChains(
  repo: string,
  packageJson: PackageJson,
  lockFile: LockFileData,
  vulnerablePackages: string[]
): DependencyChain[] {
  const chains: DependencyChain[] = [];
  const seen = new Set<string>();

  for (const pkg of vulnerablePackages) {
    if (seen.has(pkg)) continue;
    seen.add(pkg);

    const result = resolveDirectDependency(packageJson, lockFile, pkg);
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
