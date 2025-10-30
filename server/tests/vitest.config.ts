// server/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["server/tests/**/*.spec.ts"],
    hookTimeout: 15000,
    testTimeout: 20000,
    reporters: ["default"],
    coverage: {
      reporter: ["text", "lcov"],
      all: false,
      include: ["server/ai/**/*.ts", "server/design/**/*.ts"],
    },
  },
});
