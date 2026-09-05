import { expect, test } from '@playwright/test';

test('shows the family login without exposing registration', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dran' })).toBeVisible();
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible();
  await expect(page.getByText(/registrier/i)).toHaveCount(0);
});

test('ships an installable manifest', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const response = await request.get(href!);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.short_name).toBe('Dran');
  expect(manifest.display).toBe('standalone');
});
