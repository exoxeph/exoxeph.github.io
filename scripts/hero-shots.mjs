// Review helper (not shipped): screenshots of the hero instrument in each condition.
import { chromium } from '@playwright/test';
const out = process.argv[2];
const b = await chromium.launch();
async function run(name, w, h, motion) {
  const c = await b.newContext({
    viewport: { width: w, height: h },
    reducedMotion: motion ?? 'no-preference',
    deviceScaleFactor: w < 700 ? 2 : 1,
  });
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:4321/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(3200);
  await p.screenshot({ path: `${out}/${name}-email.png` });
  for (const id of ['rag', 'speech', 'pool']) {
    await p.locator(`label[for="inst-${id}"]`).click();
    await p.waitForTimeout(3200);
    await p.screenshot({ path: `${out}/${name}-${id}.png` });
  }
  await c.close();
}
await run('hero-desktop', 1440, 900);
await run('hero-mobile', 375, 740);
await b.close();
