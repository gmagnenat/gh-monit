import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  clean: false,
  sourcemap: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
