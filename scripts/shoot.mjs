// Usage: node scripts/shoot.mjs <url> <selector|-> <out.png> [width] [height]  (review helper, not shipped)
import { chromium } from '@playwright/test';
const [, , url, sel, out, w = '1440', h = '900'] = process.argv;
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: +w, height: +h } });
const p = await c.newPage();
await p.goto(url, { waitUntil: 'networkidle' });
if (sel !== '-') await p.locator(sel).first().scrollIntoViewIfNeeded();
await p.screenshot({ path: out });
await b.close();
