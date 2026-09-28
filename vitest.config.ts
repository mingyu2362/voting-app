import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    fileParallelism: false, // all tests share one real Postgres DB; avoid cross-test truncation races
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
