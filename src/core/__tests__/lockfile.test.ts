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
      },
      "node_modules/react-scripts": { version: "5.0.1" },
      "node_modules/react-scripts/node_modules/loader-utils": { version: "1.4.0" },
      "node_modules/react-scripts/node_modules/loader-utils/node_modules/json5": { version: "1.0.1" },
      "node_modules/axios": { version: "1.6.0" },
      "node_modules/minimist": { version: "1.2.5" },
    },
  };

  it("resolves a deeply nested transitive dep to the direct parent", () => {
    const result = resolveDirectDependency(lockFile, "loader-utils");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("react-scripts");
    expect(result!.directVersion).toBe("5.0.1");
    expect(result!.chainDepth).toBe(1);
  });

  it("resolves a deeply nested dep (3 levels)", () => {
    const result = resolveDirectDependency(lockFile, "json5");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("react-scripts");
    expect(result!.chainDepth).toBe(2);
  });

  it("identifies a direct dependency (chainDepth 0)", () => {
    const result = resolveDirectDependency(lockFile, "axios");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("axios");
    expect(result!.directVersion).toBe("1.6.0");
    expect(result!.chainDepth).toBe(0);
  });

  it("identifies a hoisted package not in root dependencies as direct (top-level node_modules)", () => {
    // minimist is in node_modules/ but not in root dependencies — treated as direct
    const result = resolveDirectDependency(lockFile, "minimist");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("minimist");
    expect(result!.chainDepth).toBe(0);
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
        requires: { "loader-utils": "^1.4.0", minimist: "^1.2.5" },
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
    expect(result!.chainDepth).toBe(1);
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
      "node_modules/react-scripts": { version: "5.0.1" },
      "node_modules/react-scripts/node_modules/loader-utils": { version: "1.4.0" },
      "node_modules/react-scripts/node_modules/minimist": { version: "1.2.5" },
    },
  };

  it("resolves multiple vulnerable packages", () => {
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
