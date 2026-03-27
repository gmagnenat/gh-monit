import { describe, it, expect } from "vitest";
import {
  resolveDirectDependency,
  resolveAllChains,
} from "../lockfile.js";

// --- package-lock.json v2/v3 format (packages map) ---

describe("resolveDirectDependency (v2/v3 packages map)", () => {
  const lockFile = {
    packages: {
      "": {
        dependencies: {
          "react-scripts": "^5.0.0",
          axios: "^1.0.0",
        },
        devDependencies: {
          jest: "^29.0.0",
        },
      },
      "node_modules/react-scripts": {
        version: "5.0.1",
        dependencies: { "css-loader": "^6.0.0" },
      },
      "node_modules/react-scripts/node_modules/css-loader": {
        version: "6.7.0",
        dependencies: { "loader-utils": "^1.4.0" },
      },
      "node_modules/react-scripts/node_modules/loader-utils": { version: "1.4.0" },
      "node_modules/react-scripts/node_modules/loader-utils/node_modules/json5": { version: "1.0.1" },
      "node_modules/axios": { version: "1.6.0" },
      // minimist is hoisted but NOT in root package.json — it's a transitive dep of something
      "node_modules/minimist": { version: "1.2.5" },
      "node_modules/jest": {
        version: "29.7.0",
        dependencies: { minimist: "^1.2.0" },
      },
    },
  };

  it("resolves a deeply nested transitive dep to the root package.json dependency", () => {
    const result = resolveDirectDependency(lockFile, "loader-utils");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("react-scripts");
    expect(result!.directVersion).toBe("5.0.1");
    expect(result!.chainDepth).toBeGreaterThan(0);
  });

  it("resolves a 3-level deep dep to the root dependency", () => {
    const result = resolveDirectDependency(lockFile, "json5");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("react-scripts");
  });

  it("resolves a mid-level dep (css-loader) to the root dependency", () => {
    const result = resolveDirectDependency(lockFile, "css-loader");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("react-scripts");
  });

  it("identifies a direct dependency (chainDepth 0)", () => {
    const result = resolveDirectDependency(lockFile, "axios");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("axios");
    expect(result!.directVersion).toBe("1.6.0");
    expect(result!.chainDepth).toBe(0);
  });

  it("identifies devDependencies as direct", () => {
    const result = resolveDirectDependency(lockFile, "jest");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("jest");
    expect(result!.chainDepth).toBe(0);
  });

  it("resolves a hoisted transitive dep to its root parent via fallback", () => {
    // minimist is hoisted to top-level node_modules but NOT in root package.json
    // It's a transitive dep of jest
    const result = resolveDirectDependency(lockFile, "minimist");
    expect(result).not.toBeNull();
    // Should resolve to jest (which has minimist in its dependencies), not to minimist itself
    expect(result!.directDependency).toBe("jest");
    expect(result!.chainDepth).not.toBe(0);
  });

  it("returns null for unknown packages", () => {
    const result = resolveDirectDependency(lockFile, "nonexistent-pkg");
    expect(result).toBeNull();
  });
});

// --- package-lock.json v1 format (dependencies tree) ---

describe("resolveDirectDependency (v1 dependencies tree)", () => {
  const lockFile = {
    dependencies: {
      "react-scripts": {
        version: "4.0.3",
        requires: { "css-loader": "^3.0.0" },
        dependencies: {
          "css-loader": {
            version: "3.6.0",
            requires: { "loader-utils": "^1.4.0" },
          },
        },
      },
      lodash: {
        version: "4.17.21",
      },
    },
  };

  it("resolves a transitive dep via requires", () => {
    const result = resolveDirectDependency(lockFile, "loader-utils");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("react-scripts");
    expect(result!.directVersion).toBe("4.0.3");
  });

  it("resolves a nested transitive dep", () => {
    const result = resolveDirectDependency(lockFile, "css-loader");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("react-scripts");
  });

  it("identifies a direct dependency", () => {
    const result = resolveDirectDependency(lockFile, "lodash");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("lodash");
    expect(result!.chainDepth).toBe(0);
  });

  it("returns null for unknown packages", () => {
    const result = resolveDirectDependency(lockFile, "nonexistent-pkg");
    expect(result).toBeNull();
  });
});

// --- resolveAllChains ---

describe("resolveAllChains", () => {
  const lockFile = {
    packages: {
      "": {
        dependencies: { "react-scripts": "^5.0.0" },
      },
      "node_modules/react-scripts": {
        version: "5.0.1",
        dependencies: { "loader-utils": "^1.4.0", minimist: "^1.2.0" },
      },
      "node_modules/react-scripts/node_modules/loader-utils": { version: "1.4.0" },
      "node_modules/react-scripts/node_modules/minimist": { version: "1.2.5" },
    },
  };

  it("resolves multiple vulnerable packages to the same root dep", () => {
    const chains = resolveAllChains("owner/repo", lockFile, [
      "loader-utils",
      "minimist",
    ]);
    expect(chains).toHaveLength(2);
    expect(chains.every((c) => c.directDependency === "react-scripts")).toBe(true);
    expect(chains.every((c) => c.repo === "owner/repo")).toBe(true);
  });

  it("deduplicates packages", () => {
    const chains = resolveAllChains("owner/repo", lockFile, [
      "loader-utils",
      "loader-utils",
    ]);
    expect(chains).toHaveLength(1);
  });

  it("skips packages not found in lock file", () => {
    const chains = resolveAllChains("owner/repo", lockFile, [
      "loader-utils",
      "nonexistent",
    ]);
    expect(chains).toHaveLength(1);
    expect(chains[0].vulnerablePackage).toBe("loader-utils");
  });

  it("returns empty for empty input", () => {
    expect(resolveAllChains("owner/repo", lockFile, [])).toHaveLength(0);
  });
});
