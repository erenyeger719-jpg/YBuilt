import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5001';

/**
 * Playwright E2E Test Configuration for YBUILT
 * 
 * Smoke tests covering:
 * - Health check endpoint
 * - Basic upload flow
 * - Modal layering and UI rendering
 */
export default defineConfig({
  testDir: './specs',
  
  // Timeouts
  timeout: 30000,
  expect: {
    timeout: 5000,
  },

  // Retries and parallelization
  fullyParallel: false, // Deterministic for canary checks
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined, // Single worker in CI for determinism

  // Reporter
  reporter: [
    ['html', { outputFolder: 'artifacts/playwright-report' }],
    ['json', { outputFile: 'artifacts/test-results.json' }],
    ['list']
  ],

  // Global setup
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Browser options
    headless: true,
    viewport: { width: 1280, height: 720 },
    
    // Network options
    ignoreHTTPSErrors: true,
    
    // Timeouts
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },

  // Test projects (browsers)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Web server configuration (for local testing)
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: BASE_URL,
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
  },

  // Output directories
  outputDir: 'artifacts/test-artifacts',
});
