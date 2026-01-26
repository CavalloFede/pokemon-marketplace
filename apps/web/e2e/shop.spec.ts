import { test, expect } from '@playwright/test';

test.describe('Shop Page', () => {
  test.beforeEach(async ({ page }) => {
    // Skip if requires authentication
    await page.goto('/shop');
  });

  test('should display shop items', async ({ page }) => {
    // Check for shop section
    await expect(page.getByRole('heading', { name: /shop/i })).toBeVisible();
  });

  test('should show Pokemon eggs section', async ({ page }) => {
    await expect(page.getByText(/egg/i)).toBeVisible();
  });

  test('should display prices for items', async ({ page }) => {
    // Check that prices are displayed (coins symbol or number)
    const priceElements = page.locator('[data-testid="item-price"], .price');
    await expect(priceElements.first()).toBeVisible();
  });
});
