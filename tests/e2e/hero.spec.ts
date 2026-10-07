import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';

test.use({ reducedMotion: 'reduce' });

test('recorded default and static channels', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#ch-pool')).toBeChecked();
  await expect(page.locator('.pool .tesla-svg.desktop .code')).toHaveText('409');
  await expect(page.locator('.pool .provenance')).toContainText('Recorded project run');
  await expect(page.locator('.recorded-entries li')).toHaveCount(3);
  await expect(page.locator('.visitor-entries li')).toHaveCount(0);
  await expect(page.locator('.recorded-entries + [data-empty]')).toHaveText('Your tests appear here.');
  for (const id of ['email']) {
    await page.locator(`label[for="ch-${id}"]`).last().click();
    await expect(page.locator(`#ch-${id}`)).toBeChecked();
    await expect(page.locator(`.channel.${id}`)).toBeVisible();
    await expect(page.locator(`.channel.${id} [data-provenance="replay"]`)).toContainText(
      'Recorded project run',
    );
  }
  await page.locator('.tr-rag').click();
  await expect(page.locator('.rag [data-provenance="replay"]')).toContainText('Recorded project run');
  await page.locator('.tr-speech').click();
  await expect(page.locator('.channel.speech [data-provenance="replay"]')).toContainText(
    'Recorded project run',
  );
});

test('keyboard resize, refusal, completion, acceptance and cancellation', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tesla-svg.desktop [data-handle]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.tesla-svg.desktop [data-handle]')).toHaveAttribute('aria-valuenow', '3');
  await expect(page.locator('.tesla-svg.desktop [data-handle]')).toHaveAttribute(
    'aria-valuetext',
    '3 seats, would be refused',
  );
  await expect(page.locator('.pool .provenance')).toContainText('Runs in browser');
  await page.keyboard.press('Enter');
  await expect(page.locator('.visitor-entries li')).toHaveCount(1);
  await expect(page.locator('.visitor-entries .entry-index').first()).toHaveText('04');
  await expect(page.locator('.visitor-entries')).toContainText('refused, 3 of 3');
  await page.locator('.tesla-svg.desktop [data-pool="B"]').click();
  await page.locator('.tesla-svg.desktop [data-complete="B"]').click();
  await expect(page.locator('.tesla-svg.desktop .committed')).toHaveText('committed 1 of 3');
  await expect(page.locator('.visitor-entries .entry-index').first()).toHaveText('05');
  await page.locator('.tesla-svg.desktop [data-handle]').focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(page.locator('.tesla-svg.desktop .code')).toHaveText('200');
  await expect(page.locator('.visitor-entries')).toContainText('accepted, 2 of 3');
  await expect(page.locator('.visitor-entries .entry-index').first()).toHaveText('06');
  await page.locator('.tesla-svg.desktop [data-pool="A"]').click();
  await page.locator('.tesla-svg.desktop [data-cancel="A"]').click();
  await expect(page.locator('.tesla-svg.desktop .committed')).toHaveText('committed 2 of 3');
  await expect(page.locator('.visitor-entries')).toContainText('seats not released, 2 of 3');
  await expect(page.locator('.visitor-entries')).toContainText('limit found');
});

test('guard inspector, simultaneous replay and persistent limit', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tesla-svg.desktop [data-guard]').click();
  await expect(page.locator('.inspector:not(.speech-inspector)')).toBeVisible();
  await expect(page.locator('.inspector:not(.speech-inspector)')).toContainText(
    'Concurrent accepts across pools are not covered by this guard.',
  );
  await page.locator('[data-replay]').click();
  await expect(page.locator('.tesla-svg.desktop .committed')).toHaveText('committed 5 of 3');
  for (const size of ['desktop', 'mobile']) {
    const svg = page.locator(`.tesla-svg.${size}`);
    await expect(svg.locator('.code')).toHaveText('5 of 3');
    await expect(svg.locator('.code')).toHaveClass(/tin/);
    await expect(svg.locator('.word')).toHaveText('over capacity');
    await expect(svg.locator('.equation')).toHaveText('both read 1 of 3');
    await expect(svg.locator('.surf.over')).toHaveCount(1);
    await expect(svg.locator('text.tin').filter({ hasText: /^3$|^4$|^5$|^6$/ })).toHaveCount(4);
  }
  for (const [width, size] of [
    [1440, 'desktop'],
    [390, 'mobile'],
  ] as const) {
    await page.setViewportSize({ width, height: 844 });
    const svg = page.locator(`.tesla-svg.${size}`);
    const code = await svg.locator('.code').boundingBox();
    const word = await svg.locator('.word').boundingBox();
    const ruler = await svg.locator('.committed').boundingBox();
    expect(code!.x + code!.width).toBeLessThanOrEqual(word!.x);
    if (size === 'mobile') expect(code!.y).toBeGreaterThan(ruler!.y);
  }
  await expect(page.locator('.tesla-svg.desktop .limit-found')).toHaveText('limit found');
  await expect(page.locator('.visitor-entries')).toContainText('both accepted, 5 of 3');
  // On a phone the open inspector is a sheet over the page: close it before reaching back to the stage.
  await page.keyboard.press('Escape');
  await expect(page.locator('.inspector')).toBeHidden();
  await page.locator('[data-reset]').click();
  await expect(page.locator('.tesla-svg.desktop .committed')).toHaveText('committed 3 of 3');
  await expect(page.locator('.tesla-svg.desktop .limit-found')).toHaveText('limit found');
});

test('log survives reload and clear empties visitor entries', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tesla-svg.desktop [data-send]').click();
  await page.reload();
  await expect(page.locator('.visitor-entries li')).toHaveCount(1);
  await page.locator('[data-clear]').click();
  await expect(page.locator('.visitor-entries li')).toHaveCount(0);
  await expect(page.locator('[data-empty]')).toBeVisible();
  await page.locator('.tesla-svg.desktop [data-send]').click();
  await expect(page.locator('.visitor-entries .entry-index').first()).toHaveText('04');
});

test('the recorded Tesla log stays in place on every channel', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.recorded-entries')).toBeVisible();
  await expect(page.locator('.pool-ref')).toBeVisible();
  for (const id of ['email', 'rag', 'speech']) {
    await page.locator(`label[for="ch-${id}"]:visible`).first().click();
    await expect(page.locator('.recorded-entries')).toBeVisible();
    await expect(page.locator('.visitor-ref')).toBeVisible();
    await expect(page.locator('[data-empty]')).toBeVisible();
  }
  await page.locator('[data-speech-preset="clean"]').click();
  await expect(page.locator('.visitor-entries li')).toHaveCount(1);
  await page.locator('label[for="ch-rag"]:visible').first().click();
  await expect(page.locator('.visitor-entries li')).toHaveCount(1);
  await expect(page.locator('.recorded-entries')).toBeVisible();
});

test('pointer grip snaps to seat units', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tesla-svg.desktop [data-handle]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const box = (await page.locator('.tesla-svg.desktop [data-handle]').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('.tesla-svg.desktop [data-handle]')).toHaveAttribute('aria-valuenow', '3');
});

test('mobile chips, controls and no overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
  ).toBeLessThanOrEqual(0);
  await expect(page.locator('.tesla-svg.mobile')).toBeVisible();
  for (const chip of await page.locator('.chips label').all()) {
    expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    await chip.click();
  }
  await expect(page.locator('#ch-speech')).toBeChecked();
  await page.locator('.chips label[for="ch-pool"]').click();
  for (const selector of ['[data-handle]', '[data-send]', '[data-guard]']) {
    const box = await page.locator(`.tesla-svg.mobile ${selector}`).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

test('one seat pending label fits a narrow mobile block', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.tesla-svg.mobile [data-pool="B"]').click();
  await page.locator('.tesla-svg.mobile [data-complete="B"]').click();
  await page.locator('.tesla-svg.mobile [data-handle]').focus();
  await page.keyboard.press('Home');
  const svg = page.locator('.tesla-svg.mobile');
  await expect(svg.locator('.pending-label')).toHaveText('1');
  await expect(svg.locator('[data-handle]')).toHaveAttribute('aria-valuetext', '1 seat, would be accepted');
  const block = await svg.locator('[data-pending] .pending').boundingBox();
  const label = await svg.locator('.pending-label').boundingBox();
  expect(label!.x).toBeGreaterThanOrEqual(block!.x);
  expect(label!.x + label!.width).toBeLessThanOrEqual(block!.x + block!.width);
});

test('new bench source contains no em or en dash', () => {
  const files = [
    ...readdirSync('src/components/bench').map((name) => `src/components/bench/${name}`),
    ...readdirSync('src/lib/bench', { recursive: true })
      .filter((name) => String(name).endsWith('.ts'))
      .map((name) => `src/lib/bench/${name}`),
  ];
  for (const file of files) expect(readFileSync(file, 'utf8'), file).not.toMatch(/[\u2013\u2014]/);
});
