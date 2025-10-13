import { test, expect } from '@playwright/test';

test.describe('YBUILT Smoke Tests', () => {
  
  test('health check endpoint responds', async ({ request }) => {
    const response = await request.get('/api/status');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('ok', true);
    expect(data).toHaveProperty('summary');
  });

  test('homepage loads and displays logo', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check for YBUILT branding (adjust selector based on your actual UI)
    const heading = page.locator('h1, [data-testid="logo"]').first();
    await expect(heading).toBeVisible();
  });

  test('file upload flow works', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to workspace or upload area
    // This is a placeholder - adjust based on your actual UI flow
    const uploadButton = page.locator('[data-testid*="upload"], [data-testid*="file"]').first();
    
    if (await uploadButton.isVisible()) {
      await uploadButton.click();
      
      // Check that upload modal/dialog appears
      const modal = page.locator('[role="dialog"], .modal, [data-testid*="modal"]').first();
      await expect(modal).toBeVisible({ timeout: 3000 });
    }
  });

  test('modal layering works correctly', async ({ page }) => {
    await page.goto('/');
    
    // Open settings or any modal
    const settingsButton = page.locator('[data-testid*="settings"], [data-testid*="menu"]').first();
    
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      
      // Check modal appears with correct z-index
      const modal = page.locator('[role="dialog"]').first();
      if (await modal.isVisible({ timeout: 2000 })) {
        const zIndex = await modal.evaluate((el) => 
          window.getComputedStyle(el).zIndex
        );
        
        // Should have high z-index (from CSS variable --modal-z: 99999)
        expect(parseInt(zIndex)).toBeGreaterThan(1000);
      }
    }
  });

  test('API endpoints are accessible', async ({ request }) => {
    const endpoints = [
      '/api/me',
      '/api/settings',
      '/api/razorpay_key',
      '/api/metrics',
    ];

    for (const endpoint of endpoints) {
      const response = await request.get(endpoint);
      // Accept 200 OK or 304 Not Modified
      expect([200, 304]).toContain(response.status());
    }
  });

  test('metrics endpoint returns valid data', async ({ request }) => {
    const response = await request.get('/api/metrics');
    expect(response.ok()).toBeTruthy();
    
    const text = await response.text();
    
    // Check for Prometheus format metrics
    expect(text).toContain('http_requests_total');
    expect(text).toContain('job_queue_depth');
  });
});
