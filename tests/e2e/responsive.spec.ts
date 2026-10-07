import { expect, test } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

const sizes: [number, number][] = [
  [280, 653],
  [320, 568],
  [390, 844],
  [540, 720],
  [768, 1024],
  [1000, 640],
  [1100, 700],
  [1280, 600],
  [1366, 768],
  [1920, 1080],
  [2560, 1440],
];
const pages = ['/', '/resume/', '/work/', '/work/ride-pooling-lifecycle/', '/about/'];

for (const [width, height] of sizes) {
  test(`nothing runs past the screen edge at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const path of pages) {
      await page.goto(path);
      await page.waitForTimeout(250);
      const wide = await page.evaluate(() => {
        const W = document.documentElement.clientWidth;
        const found: string[] = [];
        for (const el of document.querySelectorAll('body *')) {
          if (el.closest('.note, .notes-layer, .visually-hidden, .speech-scroll, pre')) continue;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          const r = el.getBoundingClientRect();
          if (r.width && r.height && r.right > W + 1) {
            found.push(
              el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] + ' ' + Math.round(r.right),
            );
          }
        }
        return { over: document.documentElement.scrollWidth - W, found: [...new Set(found)].slice(0, 5) };
      });
      expect(wide.over, path).toBeLessThanOrEqual(0);
      expect(wide.found, path).toEqual([]);
    }
  });
}

test('the pinned stage never needs an inner scroll at common desktop sizes', async ({ page }) => {
  for (const [width, height] of [
    [1000, 700],
    [1180, 820],
    [1280, 720],
    [1366, 768],
    [1920, 1080],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    for (const channel of ['pool', 'email', 'rag', 'speech']) {
      await page.evaluate((c) => {
        const radio = document.getElementById('ch-' + c) as HTMLInputElement;
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }, channel);
      await page.waitForTimeout(150);
      const over = await page.evaluate(() => {
        const col = document.querySelector('.stagecol')!.getBoundingClientRect();
        let worst = 0;
        for (const el of document.querySelectorAll('.stagecol *')) {
          if (el.closest('.note, .notes-layer, .speech-scroll, [hidden]')) continue;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          const r = el.getBoundingClientRect();
          if (r.width && r.height) worst = Math.max(worst, r.right - col.right);
        }
        return worst;
      });
      expect(over, `${channel} at ${width}x${height}`).toBeLessThanOrEqual(1);
    }
  }
});
