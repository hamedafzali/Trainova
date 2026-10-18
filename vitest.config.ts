import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // In-process Postgres (PGlite) tests can exceed the 5 s default when the whole suite runs in parallel.
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
