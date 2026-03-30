import { describe, it, expect } from "vitest";
import {
  resolveDirectDependency,
  resolveAllChains,
} from "../lockfile.js";

// --- v2/v3 format: package.json + lock file ---

describe("resolveDirectDependency (v2/v3)", () => {
  const packageJson = {
    dependencies: {
      "@babel/core": "^7.19.0",
      "@babel/preset-env": "^7.19.0",
      "@babel/preset-react": "^7.18.0",
      next: "^14.0.0",
      axios: "^1.0.0",
    },
    devDependencies: {
      jest: "^29.0.0",
    },
  };

  const lockFile = {
    packages: {
      "node_modules/@babel/core": {
        version: "7.19.3",
        dependencies: { "@babel/traverse": "^7.19.0" },
      },
      "node_modules/@babel/traverse": {
        version: "7.19.1",
      },
      "node_modules/@babel/preset-env": {
        version: "7.19.4",
        dependencies: { "@babel/core": "^7.19.0" },
      },
      "node_modules/@babel/preset-react": {
        version: "7.18.6",
      },
      "node_modules/next": {
        version: "14.2.5",
        dependencies: { "styled-jsx": "^5.0.0" },
      },
      "node_modules/styled-jsx": {
        version: "5.1.1",
        dependencies: { "loader-utils": "^1.4.0" },
      },
      "node_modules/loader-utils": {
        version: "1.4.0",
      },
      "node_modules/axios": { version: "1.6.0" },
      "node_modules/jest": {
        version: "29.7.0",
        dependencies: { "babel-jest": "^29.0.0" },
      },
      "node_modules/babel-jest": {
        version: "29.7.0",
        dependencies: { "@babel/core": "^7.0.0" },
      },
      // babel-loader is NOT in package.json — it's transitive
      "node_modules/babel-loader": {
        version: "8.2.3",
        dependencies: { "loader-utils": "^1.4.0" },
      },
      "node_modules/minimist": { version: "1.2.5" },
    },
  };

  it("resolves @babel/traverse to @babel/core (actual package.json dep)", () => {
    const result = resolveDirectDependency(packageJson, lockFile, "@babel/traverse");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("@babel/core");
    expect(result!.chainDepth).toBe(1);
  });

  it("resolves loader-utils to next (through styled-jsx)", () => {
    const result = resolveDirectDependency(packageJson, lockFile, "loader-utils");
    expect(result).not.toBeNull();
    // Should be next (via styled-jsx), NOT babel-loader (which is not in package.json)
    expect(result!.directDependency).toBe("next");
    expect(result!.chainDepth).toBe(2);
  });

  it("resolves styled-jsx to next", () => {
    const result = resolveDirectDependency(packageJson, lockFile, "styled-jsx");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("next");
    expect(result!.chainDepth).toBe(1);
  });

  it("identifies a direct dependency (chainDepth 0)", () => {
    const result = resolveDirectDependency(packageJson, lockFile, "axios");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("axios");
    expect(result!.directVersion).toBe("1.6.0");
    expect(result!.chainDepth).toBe(0);
  });

  it("identifies devDependencies as direct", () => {
    const result = resolveDirectDependency(packageJson, lockFile, "jest");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("jest");
    expect(result!.chainDepth).toBe(0);
  });

  it("resolves babel-jest to jest (devDep)", () => {
    const result = resolveDirectDependency(packageJson, lockFile, "babel-jest");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("jest");
    expect(result!.chainDepth).toBe(1);
  });

  it("returns null for packages unreachable from any direct dep", () => {
    const result = resolveDirectDependency(packageJson, lockFile, "minimist");
    // minimist is in node_modules but no direct dep depends on it
    expect(result).toBeNull();
  });

  it("returns null for unknown packages", () => {
    const result = resolveDirectDependency(packageJson, lockFile, "nonexistent");
    expect(result).toBeNull();
  });
});

// --- v1 format ---

describe("resolveDirectDependency (v1)", () => {
  const packageJson = {
    dependencies: {
      "react-scripts": "^4.0.0",
      lodash: "^4.17.0",
    },
  };

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

  it("resolves loader-utils to react-scripts (2 levels deep)", () => {
    const result = resolveDirectDependency(packageJson, lockFile, "loader-utils");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("react-scripts");
  });

  it("resolves css-loader to react-scripts", () => {
    const result = resolveDirectDependency(packageJson, lockFile, "css-loader");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("react-scripts");
  });

  it("identifies a direct dependency", () => {
    const result = resolveDirectDependency(packageJson, lockFile, "lodash");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("lodash");
    expect(result!.chainDepth).toBe(0);
  });

  it("returns null for unknown packages", () => {
    expect(resolveDirectDependency(packageJson, lockFile, "nonexistent")).toBeNull();
  });
});

// --- v1 format: flat structure (like brewDive) ---

describe("resolveDirectDependency (v1 flat)", () => {
  const packageJson = {
    devDependencies: {
      "@babel/core": "^7.12.0",
      "@babel/preset-env": "^7.12.0",
      "@babel/preset-react": "^7.12.0",
      "parcel-bundler": "^1.12.0",
    },
  };

  // v1 flat: all packages at top level, requires links between them
  const lockFile = {
    dependencies: {
      "@babel/core": {
        version: "7.12.10",
        requires: { "@babel/traverse": "^7.12.10", "@babel/types": "^7.12.10" },
      },
      "@babel/traverse": {
        version: "7.12.10",
        requires: { "@babel/types": "^7.12.10" },
      },
      "@babel/types": {
        version: "7.12.10",
      },
      "@babel/preset-env": {
        version: "7.12.10",
        requires: { "@babel/core": "^7.12.0" },
      },
      "@babel/preset-react": {
        version: "7.12.6",
        requires: { "@babel/core": "^7.12.0" },
      },
      "parcel-bundler": {
        version: "1.12.4",
        requires: { "babel-loader": "^8.0.0" },
      },
      "babel-loader": {
        version: "8.2.3",
        requires: { "loader-utils": "^1.4.0" },
      },
      "loader-utils": {
        version: "1.4.0",
        requires: { json5: "^1.0.0" },
      },
      json5: {
        version: "1.0.1",
      },
      "form-data": {
        version: "2.3.3",
      },
    },
  };

  it("resolves @babel/traverse to @babel/core (devDep)", () => {
    const result = resolveDirectDependency(packageJson, lockFile, "@babel/traverse");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("@babel/core");
    expect(result!.chainDepth).toBe(1);
  });

  it("resolves loader-utils to parcel-bundler (through babel-loader)", () => {
    const result = resolveDirectDependency(packageJson, lockFile, "loader-utils");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("parcel-bundler");
    expect(result!.chainDepth).toBe(2);
  });

  it("resolves json5 to parcel-bundler (3 levels deep)", () => {
    const result = resolveDirectDependency(packageJson, lockFile, "json5");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("parcel-bundler");
    expect(result!.chainDepth).toBe(3);
  });

  it("resolves babel-loader to parcel-bundler", () => {
    const result = resolveDirectDependency(packageJson, lockFile, "babel-loader");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("parcel-bundler");
    expect(result!.chainDepth).toBe(1);
  });

  it("returns null for form-data (no direct dep depends on it)", () => {
    const result = resolveDirectDependency(packageJson, lockFile, "form-data");
    expect(result).toBeNull();
  });

  it("identifies @babel/core as direct (chainDepth 0)", () => {
    const result = resolveDirectDependency(packageJson, lockFile, "@babel/core");
    expect(result).not.toBeNull();
    expect(result!.directDependency).toBe("@babel/core");
    expect(result!.chainDepth).toBe(0);
  });
});

// --- resolveAllChains ---

describe("resolveAllChains", () => {
  const packageJson = {
    dependencies: { "react-scripts": "^5.0.0" },
  };

  const lockFile = {
    packages: {
      "node_modules/react-scripts": {
        version: "5.0.1",
        dependencies: { "loader-utils": "^1.4.0", minimist: "^1.2.0" },
      },
      "node_modules/loader-utils": { version: "1.4.0" },
      "node_modules/minimist": { version: "1.2.5" },
    },
  };

  it("resolves multiple vulnerable packages to the same root dep", () => {
    const chains = resolveAllChains("owner/repo", packageJson, lockFile, [
      "loader-utils",
      "minimist",
    ]);
    expect(chains).toHaveLength(2);
    expect(chains.every((c) => c.directDependency === "react-scripts")).toBe(true);
  });

  it("deduplicates packages", () => {
    const chains = resolveAllChains("owner/repo", packageJson, lockFile, [
      "loader-utils",
      "loader-utils",
    ]);
    expect(chains).toHaveLength(1);
  });

  it("skips packages not found in lock file", () => {
    const chains = resolveAllChains("owner/repo", packageJson, lockFile, [
      "loader-utils",
      "nonexistent",
    ]);
    expect(chains).toHaveLength(1);
  });

  it("returns empty for empty input", () => {
    expect(resolveAllChains("owner/repo", packageJson, lockFile, [])).toHaveLength(0);
  });
});
