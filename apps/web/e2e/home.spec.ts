import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Pokemon Marketplace/i);
  });

  test('should show login button for unauthenticated users', async ({ page }) => {
    await page.goto('/');
    const loginButton = page.getByRole('link', { name: /login|sign in/i });
    await expect(loginButton).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /login|sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
