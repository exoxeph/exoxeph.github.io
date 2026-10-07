import { expect, test } from '@playwright/test';

const URL = '/work/ride-pooling-lifecycle/';
const next = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Next step' });

test.describe('Engineering Trace (enhanced)', () => {
  test('steps through the guarded sequence and ends at the rejected transition', async ({ page }) => {
    await page.goto(URL);
    const inst = page.locator('.trace-instrument');
    await expect(inst).toBeVisible();
    await expect(inst).toContainText('The vehicle has 3 seats');
    await next(page).click();
    await expect(inst).toContainText('Request A is accepted');
    await next(page).click();
    await expect(inst.locator('.sum')).toHaveText('Committed seats: 3 of 3');
    await next(page).click();
    await expect(inst).toContainText('Request C meets the guard');
    await expect(inst).toContainText('Rejected transition');
    await expect(inst.locator('.events .conflict')).toHaveText('CONFLICT');
    await expect(inst.locator('.refusal')).toHaveText('HTTP 409 refused');
    await expect(next(page)).toBeDisabled();
    await expect(inst.locator('.hint')).toContainText('End of the trace');
  });

  test('switching to the unguarded version shows the invalid state, state is also text', async ({ page }) => {
    await page.goto(URL);
    await page.getByLabel('Without the guard').check({ force: true });
    for (let i = 0; i < 3; i++) await next(page).click();
    const inst = page.locator('.trace-instrument');
    await expect(inst).toContainText('Request C is accepted');
    await expect(inst.locator('.sum')).toHaveText('Committed seats: 5 of 3 (over capacity)');
    await expect(inst.locator('.tag.invalid')).toContainText('Invalid state');
    await expect(inst.locator('.slot.over')).toHaveCount(2);
    await expect(inst.locator('.events .success')).toHaveCount(3);
    await expect(inst.locator('.refusal')).toHaveCount(0);
  });

  test('reset returns to step 1', async ({ page }) => {
    await page.goto(URL);
    await next(page).click();
    await next(page).click();
    await page.locator('.trace').getByRole('button', { name: 'Reset' }).click();
    await expect(page.locator('.trace-instrument .step')).toHaveText('Step 1 of 4');
  });

  test('keyboard: arrow keys step, buttons are operable with Enter, focus stays on the control', async ({
    page,
  }) => {
    await page.goto(URL);
    const btn = next(page);
    await btn.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.trace-instrument .step')).toHaveText('Step 2 of 4');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.trace-instrument .step')).toHaveText('Step 3 of 4');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.trace-instrument .step')).toHaveText('Step 2 of 4');
    await expect(btn).toBeFocused();
  });

  test('announces each step in a polite live region', async ({ page }) => {
    await page.goto(URL);
    const live = page.locator('.trace-instrument [role="status"]');
    await expect(live).toHaveAttribute('aria-live', 'polite');
    await next(page).click();
    await expect(live).toContainText('Request A is accepted');
    await expect(live).toContainText('Committed seats 1 of 3');
  });

  test('deep link restores variant and step', async ({ page }) => {
    await page.goto(`${URL}?trace=tesla-capacity&variant=without-guard&step=4`);
    await expect(page.locator('.trace-instrument')).toContainText('Request C is accepted');
    await expect(page.locator('.trace-instrument .step')).toHaveText('Step 4 of 4');
  });

  test('reduced motion removes the cell animation', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(URL);
    await page.getByRole('button', { name: 'Next step' }).click();
    const name = await page
      .locator('.slot.fill')
      .first()
      .evaluate((e) => getComputedStyle(e).animationName);
    expect(name).toBe('none');
    await page.getByRole('button', { name: 'Next step' }).click();
    const ghost = await page
      .locator('.slot.ghost')
      .first()
      .evaluate((e) => getComputedStyle(e).animationName);
    expect(ghost).toBe('none');
    await expect(page.locator('.events')).toContainText('SUCCESS');
    await ctx.close();
  });

  test('compare shows both outcomes and the deep link restores it', async ({ page }) => {
    await page.goto(`${URL}?trace=tesla-capacity&variant=without-guard&step=4&compare=1`);
    const inst = page.locator('.trace-instrument');
    await expect(page.getByRole('switch', { name: 'Compare both versions' })).toBeChecked();
    await expect(inst.locator('.seg')).toBeHidden();
    await expect(inst.locator('.gauge-panel')).toHaveCount(2);
    await expect(inst.locator('.sum')).toHaveText([
      'Committed seats: 3 of 3',
      'Committed seats: 5 of 3 (over capacity)',
    ]);
    await expect(inst.locator('[role="status"]')).toContainText('Compare. With the guard:');
    await expect(inst.locator('.cap h3')).toHaveText('Request C meets the guard');
    await expect(inst.locator('.version-state')).toHaveText([
      'With the guard: Rejected transition',
      'Without the guard: Invalid state',
    ]);
  });

  for (const width of [1440, 375]) {
    test(`refused gauge labels stay separated at ${width}px with Compare on`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${URL}?trace=tesla-capacity&variant=with-guard&step=4&compare=1`);
      const panel = page.locator('.gauge-panel').first();
      await expect(panel.locator('.thresh span')).toHaveText('capacity 3');
      await expect(panel.locator('.refusal')).toHaveText('HTTP 409 refused');
      const boxes = await panel.evaluate((element) => {
        const capacity = element.querySelector('.thresh span')!.getBoundingClientRect();
        const refusal = element.querySelector('.refusal')!.getBoundingClientRect();
        const bar = element.querySelector('.thresh')!.getBoundingClientRect();
        return {
          capacityRight: capacity.right,
          refusalLeft: refusal.left,
          capacityTop: capacity.top,
          refusalTop: refusal.top,
          barLeft: bar.left,
          barRight: bar.right,
        };
      });
      expect(boxes.capacityRight).toBeLessThanOrEqual(boxes.barLeft - 8);
      expect(boxes.refusalLeft).toBeGreaterThanOrEqual(boxes.barRight + 12);
      expect(boxes.capacityRight).toBeLessThan(boxes.refusalLeft);
      expect(boxes.capacityTop).toBe(boxes.refusalTop);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }

  test('play reaches the end and manual stepping pauses', async ({ page }) => {
    await page.clock.install();
    await page.goto(URL);
    const play = page.locator('.trace').getByRole('button', { name: 'Play' });
    await play.click();
    await expect(page.getByRole('button', { name: 'Pause' })).toHaveAttribute('aria-pressed', 'true');
    await page.clock.runFor(1100);
    await expect(page.locator('.trace-instrument .step')).toHaveText('Step 2 of 4');
    await next(page).click();
    await expect(play).toHaveAttribute('aria-pressed', 'false');
    await page.clock.runFor(2200);
    await expect(page.locator('.trace-instrument .step')).toHaveText('Step 3 of 4');
    await play.click();
    await page.clock.runFor(1100);
    await expect(page.locator('.trace-instrument .step')).toHaveText('Step 4 of 4');
    await expect(play).toHaveAttribute('aria-pressed', 'false');
  });

  test('375px controls fit and compare gauges stack', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await page.goto(URL);
    await page.getByRole('switch', { name: 'Compare both versions' }).check();
    const sizes = await page
      .locator('.nav .btn')
      .evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect().height));
    expect(sizes.every((height) => height >= 44)).toBe(true);
    const panels = await page
      .locator('.gauge-panel')
      .evaluateAll((items) => items.map((e) => e.getBoundingClientRect().top));
    expect(panels[1]).toBeGreaterThan(panels[0]!);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });

  test('Compare toggle keeps the page position and limits control movement at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await page.goto(`${URL}?trace=tesla-capacity&variant=with-guard&step=4`);
    const toggle = page.getByRole('switch', { name: 'Compare both versions' });
    const controls = page.locator('.trace-instrument .ctl');
    await toggle.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    const beforeControls = await controls.evaluate((e) => e.getBoundingClientRect().top + window.scrollY);
    await toggle.check();
    const after = await page.evaluate(() => window.scrollY);
    const afterControls = await controls.evaluate((e) => e.getBoundingClientRect().top + window.scrollY);
    const secondGaugeHeight = await page
      .locator('.gauge-panel')
      .last()
      .evaluate((e) => e.getBoundingClientRect().height);
    expect(after).toBe(before);
    expect(Math.abs(afterControls - beforeControls)).toBeLessThanOrEqual(secondGaugeHeight);
  });

  test('the gauge keeps its position and height while stepping at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await page.goto(URL);
    const gauge = page.locator('.trace-instrument .gauge');
    const boxes: { y: number; height: number }[] = [];
    for (let step = 0; step < 4; step++) {
      boxes.push(
        await gauge.evaluate((element) => ({
          y: element.getBoundingClientRect().top + window.scrollY,
          height: element.getBoundingClientRect().height,
        })),
      );
      if (step < 3) await next(page).click();
    }
    expect(
      boxes.every((box) => box.y === boxes[0]?.y && box.height === boxes[0]?.height),
      JSON.stringify(boxes),
    ).toBe(true);
  });
});
