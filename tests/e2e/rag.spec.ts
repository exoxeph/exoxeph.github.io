import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ reducedMotion: 'reduce' });
const open = async (page: import('@playwright/test').Page, js = true) => {
  await page.goto('/');
  await page.locator('label[for="ch-rag"]:visible').first().click();
  await expect(page.locator('.rag-stage')).toBeVisible();
  if (js) await expect(page.locator('.bench[data-ready-rag]')).toBeAttached();
};
const art = (page: import('@playwright/test').Page) => page.locator('.rag-art:visible');

test('recorded replay, chips, log and server rendered frame', async ({ page }) => {
  await open(page);
  await expect(art(page).locator('.rag-score')).toHaveText('0.67');
  await expect(art(page).locator('.rag-word')).toHaveText('still below the requirement');
  await expect(art(page).locator('.rag-query')).toContainText('Compare CNNs and Transformers');
  await expect(page.locator('.rag [data-provenance="replay"]')).toBeVisible();
  await expect(page.locator('.recorded-entries')).toBeVisible();
  await expect(page.locator('.visitor-ref')).toBeVisible();
  await page.locator('[data-rag-chip="q1"]').click();
  await expect(art(page).locator('.rag-score')).toHaveText('0.82');
  await expect(art(page).locator('.rag-word')).toHaveText('good enough');
  await page.locator('[data-rag-chip="q5"]').click();
  await expect(art(page).locator('.rag-equation')).toContainText('0.72 ≥ 0.72');
  await page.locator('[data-rag-chip="q4"]').click();
  await expect(art(page).locator('.rag-query')).toContainText('How do I fine-tune a pretrained model?');
  await expect(art(page).locator('.rag-limit')).toContainText('limit found');
  await expect(page.locator('.visitor-entries')).toContainText('Repair is not a guarantee');
  await page.reload();
  await expect(page.locator('#ch-rag')).toBeChecked();
  await expect(art(page).locator('.rag-limit')).toContainText('limit found');
});

test('keyboard score, threshold, after repair and inspector example', async ({ page }) => {
  await open(page);
  const draft = art(page).locator('[data-rag-slider="draft"]');
  await draft.focus();
  await page.keyboard.press('End');
  await expect(art(page).locator('.rag-word')).toHaveText('good enough');
  await expect(art(page).locator('[data-rag-slider="after"]')).toHaveCount(0);
  await expect(page.locator('.rag [data-provenance="executed"]')).toBeVisible();
  await art(page).locator('[data-rag-slider="draft"]').focus();
  await page.keyboard.press('Home');
  await expect(art(page).locator('[data-rag-slider="after"]')).toHaveCount(1);
  await expect(art(page).locator('.rag-repair-copy')).toHaveCount(2);
  await art(page).locator('[data-rag-slider="after"]').focus();
  await page.keyboard.press('End');
  await expect(art(page).locator('.rag-word')).toHaveText('good enough after a retry');
  await art(page).locator('[data-rag-slider="threshold"]').focus();
  await page.keyboard.press('Home');
  await expect(art(page).locator('[data-rag-slider="threshold"]')).toHaveAttribute('aria-valuenow', '0.05');
  await page.locator('[data-inspect-channel="rag"]').click();
  await expect(page.locator('.rag-inspector')).toBeVisible();
  await page.locator('[data-rag-tab="repair-step"]').click();
  await expect(page.locator('[data-rag-tab="repair-step"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-rag-limit-example]').click();
  await expect(art(page).locator('.rag-equation')).toContainText('0.60, then 0.66 < 0.72');
  await expect(art(page).locator('.rag-limit')).toContainText('limit found');
  await art(page).locator('[data-rag-slider="threshold"]').click();
  await expect(page.locator('.rag-inspector')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.rag-inspector')).toBeHidden();
});

test('dragging, mobile targets, no overflow and axe', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    ).toBeLessThanOrEqual(0);
    const slider = art(page).locator('[data-rag-slider="draft"]');
    const box = (await slider.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 70, box.y + 20, { steps: 5 });
    await page.mouse.up();
    await expect(page.locator('.rag [data-provenance="executed"]')).toBeVisible();
    for (const kind of ['draft', 'threshold']) {
      const hit = await art(page).locator(`[data-rag-slider="${kind}"] .rag-hit`).boundingBox();
      expect(hit!.width).toBeGreaterThanOrEqual(44);
      expect(hit!.height).toBeGreaterThanOrEqual(44);
    }
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.locator('[data-inspect-channel="rag"]').click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});

test('no JavaScript has the recorded retrieval frame', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await open(page, false);
  await expect(art(page).locator('.rag-score')).toHaveText('0.67');
  await context.close();
});
