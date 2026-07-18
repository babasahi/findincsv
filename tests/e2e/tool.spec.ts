import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const FIXTURE = fileURLToPath(new URL('../fixtures/names-small.csv', import.meta.url));

async function loadFixture(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.locator('[data-file-input]').setInputFiles(FIXTURE);
  await expect(page.locator('[data-controls]')).toBeVisible();
  await expect(page.locator('[data-table-wrap] table')).toBeVisible();
}

test('Arabic page is RTL and default; English page is LTR', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await page.goto('/en/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('loads a CSV and shows file metadata and all rows', async ({ page }) => {
  await loadFixture(page);
  await expect(page.locator('[data-file-meta]')).toContainText('names-small.csv');
  await expect(page.locator('[data-file-meta]')).toContainText('12');
  await expect(page.locator('[data-table-wrap] tbody tr')).toHaveCount(12);
});

test('order-independent multi-word search with highlights', async ({ page }) => {
  await loadFixture(page);
  const search = page.locator('[data-search]');

  await search.fill('saleh dahi');
  await expect(page.locator('[data-table-wrap] tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody td').first()).toContainText('Saleh Mahfoud Dahi');
  await expect(page.locator('tbody mark').filter({ hasText: 'Saleh' })).toBeVisible();
  await expect(page.locator('tbody mark').filter({ hasText: 'Dahi' })).toBeVisible();

  await search.fill('dahi saleh');
  await expect(page.locator('[data-table-wrap] tbody tr')).toHaveCount(1);
});

test('Arabic normalization: فاطمه finds فاطمة, محمد finds مُحَمَّد', async ({ page }) => {
  await loadFixture(page);
  const search = page.locator('[data-search]');

  await search.fill('فاطمه');
  await expect(page.locator('[data-table-wrap] tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody td').first()).toContainText('فاطمة');

  await search.fill('محمد');
  await expect(page.locator('[data-table-wrap] tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody mark').first()).toContainText('مُحَمَّد');
});

test('fuzzy toggle: soleh finds Saleh only when fuzzy is on', async ({ page }) => {
  await loadFixture(page);
  const search = page.locator('[data-search]');
  const fuzzy = page.locator('[data-fuzzy]');

  await expect(fuzzy).toBeChecked(); // default on
  await search.fill('soleh dahi');
  await expect(page.locator('[data-table-wrap] tbody tr')).toHaveCount(1);

  await fuzzy.uncheck();
  await expect(page.locator('[data-table-wrap] tbody tr')).toHaveCount(0);
  await expect(page.locator('[data-status]')).not.toHaveText('');
});

test('column selector scopes the search', async ({ page }) => {
  await loadFixture(page);
  const search = page.locator('[data-search]');

  // Scope to member_id column: name search must now return nothing.
  await page.locator('[data-column]').selectOption({ label: 'member_id' });
  await search.fill('saleh');
  await expect(page.locator('[data-table-wrap] tbody tr')).toHaveCount(0);

  // Arabic-Indic digits still find ids in scope (fuzzy off: with 1 edit
  // allowed, "1005" would legitimately also match 1001–1010).
  await page.locator('[data-fuzzy]').uncheck();
  await search.fill('١٠٠٥');
  await expect(page.locator('[data-table-wrap] tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody td').last()).toContainText('1005');
});

test('substring semantics: john finds APPLEJOHN', async ({ page }) => {
  await loadFixture(page);
  await page.locator('[data-search]').fill('john');
  await expect(page.locator('[data-table-wrap] tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody mark').first()).toHaveText('JOHN');
});

test('CSV cells are rendered as text, not HTML', async ({ page }) => {
  await page.goto('/');
  const path = fileURLToPath(new URL('../fixtures/generated/xss.csv', import.meta.url));
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const { dirname } = await import('node:path');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, 'name,note\n"<img src=x onerror=window.__xss=1>","<b>bold</b>"\n');
  await page.locator('[data-file-input]').setInputFiles(path);
  await expect(page.locator('[data-table-wrap] tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody td').first()).toContainText('<img');
  expect(await page.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined();
  expect(await page.locator('tbody b').count()).toBe(0);
});
