import { chromium } from '@playwright/test';

const baseURL = process.env.DRAN_TEST_URL;
const email = process.env.DRAN_TEST_EMAIL;
const password = process.env.DRAN_TEST_PASSWORD;
if (!baseURL || !email || !password) {
  throw new Error('DRAN_TEST_URL, DRAN_TEST_EMAIL and DRAN_TEST_PASSWORD are required.');
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const title = `Browser-Test ${Date.now()}`;
const editedTitle = `${title} bearbeitet`;
const offlineTitle = `Offline-Test ${Date.now()}`;

try {
  await page.goto(baseURL);
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort').fill(password);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.getByRole('button', { name: 'Karte hinzufügen' }).click();
  await page.getByLabel('Titel der neuen Karte').fill(title);
  await page.getByLabel('Titel der neuen Karte').press('Enter');
  await page.getByText(title, { exact: true }).click();
  await page.getByRole('textbox', { name: 'Titel', exact: true }).fill(editedTitle);
  await page.getByPlaceholder('Nur wenn es etwas zu sagen gibt.').fill('Vom Browser-Smoke-Test.');
  await page.locator('input[type="date"]').fill('2026-09-06');
  await page.getByRole('button', { name: 'Dran', exact: true }).click();
  await page.locator('.sheet-foot').getByRole('button', { name: 'Fertig', exact: true }).click();
  await page.reload();
  await page.getByRole('tab', { name: /Dran/ }).click();
  await page.getByText(editedTitle, { exact: true }).click();
  await page.getByRole('button', { name: 'Karte löschen' }).click();
  await page.getByRole('tab', { name: /Dran/ }).click();
  await page.getByText(editedTitle, { exact: true }).waitFor({ state: 'detached' });

  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.getByRole('tab', { name: /Offen/ }).click();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Karte hinzufügen' }).click();
  await page.getByLabel('Titel der neuen Karte').fill(offlineTitle);
  await page.getByLabel('Titel der neuen Karte').press('Enter');
  await page.getByText(offlineTitle, { exact: true }).waitFor();
  await page.reload();
  await page.getByText(offlineTitle, { exact: true }).waitFor();
  await context.setOffline(false);
  await page.waitForFunction(() => navigator.onLine);
  await page.getByText(offlineTitle, { exact: true }).click();
  await page.getByRole('button', { name: 'Karte löschen' }).click();
  console.log('Authenticated browser integration smoke test passed.');
} catch (error) {
  console.error(await page.locator('body').innerText());
  console.error(await page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('dran');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const read = (name) => new Promise((resolve, reject) => {
      const request = database.transaction(name).objectStore(name).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return JSON.stringify({ cards: await read('cards'), operations: await read('operations') });
  }));
  await page.screenshot({ path: '/private/tmp/dran-browser-smoke-failure.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
}
