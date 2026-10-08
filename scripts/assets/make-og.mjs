// Regenerates public/og.png (1200x630 share image) and public/apple-touch-icon.png from the HTML sources beside this file.
// Usage: node scripts/assets/make-og.mjs   (run from the repo root; needs `npx playwright install chromium` once)
import { chromium } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const pub = fileURLToPath(new URL('../../public/', import.meta.url));
const shots = [
  { html: 'og.html', out: `${pub}og.png`, viewport: { width: 1200, height: 630 }, wait: 800 },
  { html: 'icon.html', out: `${pub}apple-touch-icon.png`, viewport: { width: 180, height: 180 }, wait: 300 },
];
const browser = await chromium.launch();
for (const s of shots) {
  const page = await (await browser.newContext({ viewport: s.viewport })).newPage();
  await page.goto(pathToFileURL(`${here}${s.html}`).href);
  await page.waitForTimeout(s.wait);
  await page.screenshot({ path: s.out });
  console.log('wrote', s.out);
}
await browser.close();
