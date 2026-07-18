import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * THE privacy test: no network request — to any host — may ever contain the
 * CSV contents, the filename, or the search query. This is the product
 * promise and a merge-blocking guarantee (CLAUDE.md).
 */

const SENTINEL_CELL = 'ZXQSENTINELNAME';
const SENTINEL_AR = 'زكسقسنتينل';
const SENTINEL_FILE = 'zxqsentinelfile.csv';
const SENTINEL_QUERY = 'zxqsentinelquery';

test('no telemetry or network request ever contains file data or queries', async ({ page }) => {
  const requests: { url: string; body: string | null }[] = [];
  await page.route('**/*', async (route) => {
    const req = route.request();
    requests.push({ url: req.url(), body: req.postData() });
    // Let same-origin requests through; block third parties (there should be
    // none, and blocking proves the app works fully offline).
    if (new URL(req.url()).hostname === 'localhost') {
      await route.continue();
    } else {
      await route.abort();
    }
  });

  await page.goto('/');

  const fixture = fileURLToPath(new URL(`../fixtures/generated/${SENTINEL_FILE}`, import.meta.url));
  mkdirSync(dirname(fixture), { recursive: true });
  writeFileSync(
    fixture,
    `full_name,city\n${SENTINEL_CELL} Person,Riyadh\n${SENTINEL_AR},جدة\n`,
  );
  await page.locator('[data-file-input]').setInputFiles(fixture);
  await expect(page.locator('[data-table-wrap] tbody tr')).toHaveCount(2);

  await page.locator('[data-search]').fill(SENTINEL_QUERY);
  await expect(page.locator('[data-table-wrap] tbody tr')).toHaveCount(0);
  await page.locator('[data-search]').fill(SENTINEL_CELL.toLowerCase());
  await expect(page.locator('[data-table-wrap] tbody tr')).toHaveCount(1);

  // Give any stray beacon a moment to fire before auditing.
  await page.waitForTimeout(500);

  const sentinels = [
    SENTINEL_CELL,
    SENTINEL_CELL.toLowerCase(),
    SENTINEL_AR,
    SENTINEL_FILE,
    SENTINEL_QUERY,
    encodeURIComponent(SENTINEL_AR),
  ];
  for (const { url, body } of requests) {
    for (const s of sentinels) {
      expect(url, `request URL leaked data: ${url}`).not.toContain(s);
      if (body) expect(body, `request body leaked data to ${url}`).not.toContain(s);
    }
  }

  // And the whole app must have functioned with zero third-party requests.
  const thirdParty = requests.filter((r) => new URL(r.url).hostname !== 'localhost');
  expect(thirdParty).toEqual([]);
});
