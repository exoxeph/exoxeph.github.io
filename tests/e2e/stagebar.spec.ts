import { expect, test } from '@playwright/test';

// The test browser hides scrollbars by default; real desktop browsers draw them and they take width. Turn them on so
// this measures what a visitor sees.
test.use({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'no-preference',
  launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] },
});

test('the pinned stage never grows a scrollbar while pages turn, so its diagrams keep their size', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.waitForTimeout(1200);
  await page.mouse.move(1100, 500);
  await page.evaluate(() => {
    const w = window as unknown as { widths: Set<number>; stop: boolean };
    w.widths = new Set();
    w.stop = false;
    const tick = () => {
      const s = document.querySelector('.stagecol') as HTMLElement;
      w.widths.add(s.clientWidth);
      if (!w.stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  // Through ride pooling and into the next chapter: every turn animates its pictures in.
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(1500);
  }
  const widths = await page.evaluate(() => {
    (window as unknown as { stop: boolean }).stop = true;
    return [...(window as unknown as { widths: Set<number> }).widths];
  });
  // One width the whole time: a scrollbar coming and going would show as two.
  expect(widths).toHaveLength(1);
  // And a short window still lets the stage scroll (the bar is hidden, the scrolling is not).
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.stagecol')!).overflowY)).toBe(
    'auto',
  );
});
