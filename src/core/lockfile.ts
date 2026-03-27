import type { Octokit } from '@octokit/rest';

export type DependencyChain = {
  repo: string;
  vulnerablePackage: string;
  directDependency: string;
  directVersion: string | null;
  chainDepth: number;
};

type PackageLockEntry = {
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type PackageLockV2 = {
  packages?: Record<string, PackageLockEntry>;
  dependencies?: Record<string, { version?: string; requires?: Record<string, string>; dependencies?: Record<string, unknown> }>;
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
 * Gets the set of direct dependency names from the root package entry.
 * These are packages the developer actually controls in their package.json.
 */
function getRootDependencies(
  packages: Record<string, PackageLockEntry>
): Set<string> {
  const rootPkg = packages[''] ?? packages['.'];
  const names = new Set<string>();
  if (rootPkg?.dependencies) {
    for (const name of Object.keys(rootPkg.dependencies)) names.add(name);
  }
  if (rootPkg?.devDependencies) {
    for (const name of Object.keys(rootPkg.devDependencies)) names.add(name);
  }
  return names;
}

/**
 * Resolves which direct (top-level) dependency pulls in a vulnerable transitive package.
 *
 * "Direct" means listed in the root package.json dependencies or devDependencies.
 * For hoisted packages that aren't in package.json, we walk the dependency tree
 * to find which root-level package transitively requires it.
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
  packages: Record<string, PackageLockEntry>,
  vulnerablePackage: string
): { directDependency: string; directVersion: string | null; chainDepth: number } | null {
  const rootDeps = getRootDependencies(packages);

  // If the vulnerable package is itself a direct dependency
  if (rootDeps.has(vulnerablePackage)) {
    const directKey = `node_modules/${vulnerablePackage}`;
    return {
      directDependency: vulnerablePackage,
      directVersion: packages[directKey]?.version ?? null,
      chainDepth: 0,
    };
  }

  // Find all paths where this package appears in the lock file
  const vulnPaths: string[] = [];
  for (const key of Object.keys(packages)) {
    if (key === '' || key === '.') continue;
    const segments = key.split('node_modules/');
    const pkgName = segments[segments.length - 1];
    if (pkgName === vulnerablePackage) {
      vulnPaths.push(key);
    }
  }

  if (vulnPaths.length === 0) return null;

  // For each path, walk upward through the node_modules segments
  // to find the first ancestor that IS a root dependency
  for (const vulnPath of vulnPaths) {
    const segments = vulnPath.split('node_modules/').filter(Boolean);

    // Walk from the outermost ancestor toward the vulnerable package
    for (let i = 0; i < segments.length - 1; i++) {
      const candidate = segments[i].replace(/\/$/, '');
      if (rootDeps.has(candidate)) {
        const candidateKey = `node_modules/${candidate}`;
        return {
          directDependency: candidate,
          directVersion: packages[candidateKey]?.version ?? null,
          chainDepth: segments.length - 1 - i,
        };
      }
    }
  }

  // Fallback: if no root dep found in the path, try reverse lookup.
  // Check which root deps transitively depend on the vulnerable package
  // by scanning all packages for dependency references.
  for (const rootDep of rootDeps) {
    if (dependsOn(packages, rootDep, vulnerablePackage, new Set())) {
      const rootKey = `node_modules/${rootDep}`;
      return {
        directDependency: rootDep,
        directVersion: packages[rootKey]?.version ?? null,
        chainDepth: -1, // unknown depth
      };
    }
  }

  return null;
}

/**
 * Checks if `parent` transitively depends on `target` by walking the packages map.
 * Uses a visited set to avoid cycles.
 */
function dependsOn(
  packages: Record<string, PackageLockEntry>,
  parent: string,
  target: string,
  visited: Set<string>
): boolean {
  if (visited.has(parent)) return false;
  visited.add(parent);

  // Check nested path first (parent's own node_modules)
  const nestedKey = `node_modules/${parent}/node_modules/${target}`;
  if (nestedKey in packages) return true;

  // Check parent's dependencies and recurse
  const parentKey = `node_modules/${parent}`;
  const parentPkg = packages[parentKey];
  if (parentPkg?.dependencies) {
    for (const dep of Object.keys(parentPkg.dependencies)) {
      if (dep === target) return true;
      if (dependsOn(packages, dep, target, visited)) return true;
    }
  }

  return false;
}

function resolveFromDependenciesTree(
  dependencies: Record<string, { version?: string; requires?: Record<string, string>; dependencies?: Record<string, unknown> }>,
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
    if (requiresTransitively(depInfo, vulnerablePackage, new Set())) {
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
 * Recursively checks if a v1 dependency entry requires the target package.
 */
function requiresTransitively(
  depInfo: { requires?: Record<string, string>; dependencies?: Record<string, unknown> },
  target: string,
  visited: Set<string>
): boolean {
  if (depInfo.requires && target in depInfo.requires) return true;

  if (depInfo.dependencies) {
    for (const [name, nested] of Object.entries(depInfo.dependencies)) {
      if (name === target) return true;
      if (visited.has(name)) continue;
      visited.add(name);
      if (typeof nested === 'object' && nested !== null) {
        if (requiresTransitively(nested as typeof depInfo, target, visited)) return true;
      }
    }
  }

  return false;
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
