import { expect, test } from '@playwright/test';
import { ROUTES } from './routes.ts';

for (const width of [375, 820]) {
  test.describe(`viewport ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const path of ROUTES) {
      test(`${path} has no horizontal overflow`, async ({ page }) => {
        await page.goto(path);
        const over = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(over).toBeLessThanOrEqual(0);
      });
    }
  });
}

test.describe('375px specifics', () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test('hero, primary action and menu are reachable without hover', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Selected work' })).toBeVisible();
    await expect(page.locator('details.menu summary')).toBeVisible();
    await page.locator('details.menu summary').click();
    await expect(page.locator('details.menu').getByRole('link', { name: 'Work' })).toBeVisible();
  });

  test('trace controls are visible, large enough to tap, and nothing is hover-only', async ({ page }) => {
    await page.goto('/work/ride-pooling-lifecycle/');
    for (const name of ['Previous', 'Next step', 'Reset']) {
      const box = await page.locator('.trace').getByRole('button', { name }).boundingBox();
      expect(box, name).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    // narrow screens show only the active stage(s) in the rail
    const visible = await page
      .locator('.rail li')
      .evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== 'none').length);
    expect(visible).toBeLessThanOrEqual(2);
  });
});
