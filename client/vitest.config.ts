import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Only run our project tests (adjust globs if you add more)
    include: [
      'server/**/*.test.{ts,tsx,js}',
      'client/**/*.test.{ts,tsx,js}',
      'scripts/**/*.test.{ts,tsx,js}',
      
    ],
    // Nuke heavy/foreign suites and e2e fixtures
    exclude: [
      'node_modules/**',
      'public/previews/**',
      'public/**',
      'test/**',          // external e2e suites that call process.exit
      '**/*.e2e.*',
      '**/e2e/**',
      '**/__tests__/fixtures/**',
    ],
    passWithNoTests: true,
  },
})
