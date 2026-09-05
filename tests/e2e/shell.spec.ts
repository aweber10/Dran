import { expect, test } from '@playwright/test';

test('shows the family login without exposing registration', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dran' })).toBeVisible();
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible();
  await expect(page.getByText(/registrier/i)).toHaveCount(0);
});

test('clears a stale browser session after the server rejects it', async ({ page }) => {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    collectionId: 'dranusers000001',
    exp: Math.floor(Date.now() / 1000) + 3600,
    id: 'staleuser000001',
    type: 'auth'
  })}.invalid`;

  await page.addInitScript(({ staleToken }) => {
    localStorage.setItem('pocketbase_auth', JSON.stringify({
      token: staleToken,
      record: { id: 'staleuser000001', collectionName: 'users' }
    }));
  }, { staleToken: token });
  await page.route('**/api/**', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ status: 401, message: 'The request requires valid authentication.' })
  }));

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pocketbase_auth'))).toBeNull();
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
