// Review helper (not shipped): screenshots of the four project mechanisms in both states.
import { chromium } from '@playwright/test';
const out = process.argv[2];
const b = await chromium.launch();
for (const [name, w, h] of [
  ['mech-desktop', 1440, 900],
  ['mech-mobile', 375, 740],
]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 700 ? 2 : 1 });
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:4321/', { waitUntil: 'networkidle' });
  const sec = p.locator('#work');
  await sec.screenshot({ path: `${out}/${name}-A.png` });
  const sw = p.locator('#work .mech-input');
  const n = await sw.count();
  for (let i = 0; i < n; i++) await sw.nth(i).check({ force: true });
  await p.waitForTimeout(600);
  await sec.screenshot({ path: `${out}/${name}-B.png` });
  await c.close();
}
await b.close();
