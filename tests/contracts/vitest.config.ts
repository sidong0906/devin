import { defineConfig } from "vitest/config";

// The acceptance suite needs live services; it only runs when RUN_ACCEPTANCE=1 (see `pnpm test:acceptance`).
export default defineConfig({
  test: { include: process.env.RUN_ACCEPTANCE === "1" ? ["src/**/*.test.ts"] : [], passWithNoTests: true, testTimeout: 40000, hookTimeout: 40000, fileParallelism: false },
});
