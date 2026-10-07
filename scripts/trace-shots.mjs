// Review helper (not shipped): screenshots of the Engineering Trace states.
import { chromium } from '@playwright/test';
const out = process.argv[2];
const b = await chromium.launch();
async function shoot(name, w, h, steps, opts = {}) {
  const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 700 ? 2 : 1 });
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:4321/work/ride-pooling-lifecycle/', { waitUntil: 'networkidle' });
  const inst = p.locator('.trace-instrument');
  await inst.scrollIntoViewIfNeeded();
  if (opts.unguarded) await p.getByLabel('Without the guard').check({ force: true });
  if (opts.compare) await p.getByLabel('Compare both versions').check({ force: true });
  for (let i = 0; i < steps; i++) await p.getByRole('button', { name: 'Next step' }).click();
  await p.waitForTimeout(900);
  await inst.screenshot({ path: `${out}/${name}.png` });
  await c.close();
}
await shoot('trace2-guarded-final', 1440, 900, 3);
await shoot('trace2-unguarded-final', 1440, 900, 3, { unguarded: true });
await shoot('trace2-compare-final', 1440, 900, 3, { compare: true });
await shoot('trace2-guarded-mobile', 375, 740, 3);
await shoot('trace2-compare-mobile', 375, 740, 3, { compare: true });
await b.close();
