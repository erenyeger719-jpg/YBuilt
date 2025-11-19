// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    hookTimeout: 20_000,
    testTimeout: 20_000,

    include: [
      "tests/**/*.spec.ts",          // your existing tests
      "server/code/brain.test.ts",   // T0 core brain tests
      "server/routes/code.test.ts",  // T0 routes tests
    ],

    // avoid recursive symlink + junk dirs
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "sup-algo/**",
      ".cache/**",
    ],

    pool: "forks",
    reporters: ["default"],
    coverage: { enabled: false },
  },
});
