import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ reducedMotion: 'reduce' });
const open = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await page.locator('label[for="ch-speech"]:visible').click();
  await expect(page.locator('.speech-stage')).toBeVisible();
  await expect(page.locator('.bench[data-ready-speech]')).toBeAttached();
};

test('default, presets, typing, limit and persisted log', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-speech-number]')).toHaveText('4 of 5');
  await expect(page.getByRole('textbox', { name: 'OCR line' })).toHaveValue(/10\^3\/µL/);
  await expect(page.locator('.speech-tr.omitted')).toHaveCount(1);
  await expect(page.locator('.speech-bracket.invalid')).toContainText('value: no match');
  await expect(page.locator('.speech [data-provenance="replay"]')).toBeVisible();
  await page.locator('[data-speech-preset="clean"]').click();
  await expect(page.locator('[data-speech-number]')).toHaveText('5 of 5');
  await expect(page.locator('.speech [data-provenance="executed"]')).toBeVisible();
  await page.locator('[data-speech-preset="1.2 x 1043 misread"]').click();
  const input = page.getByRole('textbox', { name: 'OCR line' });
  await input.fill('Cell Count            1.2 x 10^3      10^3/µL       1.0 - 2.0            N/A');
  await expect(page.locator('.speech-brackets')).toContainText('scientific');
  await expect(page.locator('[data-speech-number]')).toHaveText('5 of 5');
  await input.fill('Test Ratio            -1 - 2          mmol/L        N/A                  N/A');
  await expect(page.locator('[data-speech-number]')).toHaveText('4 of 5');
  await page.locator('[data-speech-preset="<8.5 misread"]').click();
  await expect(page.locator('.speech-brackets')).toContainText('limit found');
  await expect(page.locator('.visitor-entries')).toContainText('Misread value kept');
  await page.reload();
  await expect(page.locator('.visitor-entries')).toContainText('Misread value kept');
});

test('preset labels stay separate at desktop and mobile widths', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    if (width === 1440) {
      const boxes = await page
        .locator('.speech-presets button')
        .evaluateAll((items) => items.map((item) => item.getBoundingClientRect().top));
      expect(new Set(boxes)).toHaveProperty('size', 1);
    }
    for (const name of [
      'clean',
      'qualified',
      '<8.5 misread',
      '1.2 x 1043 misread',
      'thousands',
      'unit alias',
    ]) {
      await page.locator('[data-speech-preset]').filter({ hasText: name }).click();
      const labels = await page.locator('.speech-bracket > span, .speech-limit').evaluateAll((items) =>
        items.map((item) => {
          const r = item.getBoundingClientRect();
          return { text: item.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        }),
      );
      for (let i = 0; i < labels.length; i++)
        for (let j = i + 1; j < labels.length; j++) {
          const a = labels[i]!,
            b = labels[j]!;
          expect(
            a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top,
            `${width} ${name}: ${a.text} / ${b.text}`,
          ).toBe(true);
        }
    }
  }
});

test('inspector opens by pointer and keyboard, switches tabs and loads misread', async ({ page }) => {
  await open(page);
  const bracket = page.getByRole('button', { name: 'Inspect the value parser' });
  await bracket.click();
  await expect(page.locator('.speech-inspector')).toBeVisible();
  await page.locator('[data-speech-tab="row-omission"]').click();
  await expect(page.locator('[data-speech-tab="row-omission"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-speech-tab="value-normalizer"]').click();
  await page.locator('[data-load-misread]').click();
  await expect(page.getByRole('textbox', { name: 'OCR line' })).toHaveValue(/<8\.5/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.speech-inspector')).toBeHidden();
  await bracket.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.speech-inspector')).toBeVisible();
});

test('keyboard selects speech channel from the native radio group', async ({ page }) => {
  await page.goto('/');
  await page.locator('#ch-pool').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#ch-speech')).toBeChecked();
  await expect(page.locator('.speech-stage')).toBeVisible();
});

test('mobile scroller, touch targets and axe', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    ).toBeLessThanOrEqual(0);
    if (width === 390) {
      const scroller = page.locator('.speech-scroll');
      expect(await scroller.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
      expect(
        (await page.getByRole('button', { name: 'Inspect the value parser' }).boundingBox())!.height,
      ).toBeGreaterThanOrEqual(44);
    }
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: 'Inspect the value parser' }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
