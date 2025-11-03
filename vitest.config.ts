import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    hookTimeout: 20000,
    testTimeout: 20000,
    include: ["tests/**/*.spec.ts"],
    pool: "threads",
    reporters: ["default"],
    coverage: { enabled: false },
  },
});
