import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.spec.ts"],
    passWithNoTests: false,
    restoreMocks: true,
    bail: 1
  }
});
