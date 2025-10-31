import { defineConfig } from "vitest/config";
export default defineConfig({
test: {
  environment: "node",
  include: ["tests/**/*.spec.ts"],
  passWithNoTests: false,
  restoreMocks: true,
  bail: 1,
  coverage: {
    reporter: ["text","lcov"],
    statements: 80, branches: 75, functions: 80, lines: 80,
    exclude: ["**/scripts/**","**/*.d.ts"]
  }
}

});
