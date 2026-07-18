import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROWS = 100_000;
const GENERATOR = fileURLToPath(new URL('../fixtures/generate-large.mjs', import.meta.url));
const FIXTURE = fileURLToPath(
  new URL(`../fixtures/generated/large-${ROWS}.csv`, import.meta.url),
);

test.beforeAll(() => {
  if (!existsSync(FIXTURE)) {
    execFileSync(process.execPath, [GENERATOR, String(ROWS)], { stdio: 'inherit' });
  }
});

test('handles a 100k-row file: loads, indexes, and searches without freezing', async ({
  page,
}) => {
  test.slow();
  await page.goto('/');
  await page.locator('[data-file-input]').setInputFiles(FIXTURE);

  // Row count reported correctly (Western digits with grouping).
  await expect(page.locator('[data-file-meta]')).toContainText('100,000', { timeout: 60_000 });

  // Indexing completes and the seeded needle is findable, order-independent.
  const search = page.locator('[data-search]');
  await search.fill('dahi mahfoud saleh');
  await expect(page.locator('tbody td').filter({ hasText: '999999' })).toBeVisible({
    timeout: 30_000,
  });

  // The render cap holds while the true total is reported.
  await search.fill('محمد');
  await expect(page.locator('[data-status]')).toContainText('1,000', { timeout: 30_000 });
  const rendered = await page.locator('[data-table-wrap] tbody tr').count();
  expect(rendered).toBeLessThanOrEqual(1_000);

  // The page stays responsive: a trivial main-thread roundtrip is quick.
  const t0 = Date.now();
  await page.evaluate(() => 1 + 1);
  expect(Date.now() - t0).toBeLessThan(1_000);
});
