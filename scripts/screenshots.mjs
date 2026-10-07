// Capture review screenshots of the local production preview (not part of the public site).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'screenshots';
mkdirSync(out, { recursive: true });
const base = 'http://127.0.0.1:4321';
const browser = await chromium.launch();

async function shot(name, path, { width, height, full = true, before } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: width < 700 ? 2 : 1,
  });
  const page = await ctx.newPage();
  await page.goto(base + path, { waitUntil: 'networkidle' });
  if (before) await before(page);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: full });
  await ctx.close();
  console.log('saved', name);
}

await shot('home-desktop', '/', { width: 1440, height: 900 });
await shot('home-mobile', '/', { width: 375, height: 740 });
await shot('home-tablet', '/', { width: 820, height: 1000 });
await shot('case-study-desktop', '/work/retrieval-orchestration/', { width: 1440, height: 900 });
await shot('case-study-mobile', '/work/retrieval-orchestration/', { width: 375, height: 740 });
const trace = async (page) => {
  await page.locator('#trace').scrollIntoViewIfNeeded();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next step' }).click();
};
await shot('trace-guard-desktop', '/work/ride-pooling-lifecycle/', {
  width: 1440,
  height: 900,
  full: false,
  before: async (p) => {
    await trace(p);
    await p.locator('#trace').scrollIntoViewIfNeeded();
  },
});
await shot('trace-guard-mobile', '/work/ride-pooling-lifecycle/', {
  width: 375,
  height: 740,
  full: false,
  before: async (p) => {
    await trace(p);
    await p.locator('.trace-instrument').scrollIntoViewIfNeeded();
  },
});
await shot('trace-unguarded-desktop', '/work/ride-pooling-lifecycle/', {
  width: 1440,
  height: 900,
  full: false,
  before: async (p) => {
    await p.getByLabel('Without the guard').check({ force: true });
    for (let i = 0; i < 3; i++) await p.getByRole('button', { name: 'Next step' }).click();
    await p.locator('.trace-instrument').scrollIntoViewIfNeeded();
  },
});
await shot('not-found', '/definitely-missing/', { width: 1440, height: 900, full: false });
await browser.close();
