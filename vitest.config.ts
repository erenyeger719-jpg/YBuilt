import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    hookTimeout: 20000,
    testTimeout: 20000,
    include: ["tests/**/*.spec.ts", "server/**/*.test.ts"],
    pool: "forks",
    reporters: ["default"],
    coverage: { enabled: false },
  },
});
