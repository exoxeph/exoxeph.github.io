import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

const nav = (page: import('@playwright/test').Page) => page.locator('html');

test('the navbar stays through the opening, dissolves on the way down and returns on the first scroll up', async ({
  page,
}) => {
  await page.goto('/');
  await page.mouse.wheel(0, 300);
  await expect(nav(page)).not.toHaveAttribute('data-nav', 'hidden');
  await expect(page.locator('header.top')).toBeInViewport();

  await page.mouse.wheel(0, 1800);
  await expect(nav(page)).toHaveAttribute('data-nav', 'hidden');
  await expect(page.locator('header.top')).not.toBeInViewport();

  await page.mouse.wheel(0, -200);
  await expect(nav(page)).not.toHaveAttribute('data-nav', 'hidden');
  await expect(page.locator('header.top')).toBeInViewport();

  await page.mouse.wheel(0, 400);
  await expect(nav(page)).toHaveAttribute('data-nav', 'hidden');
});

test('focusing a link in the bar brings it back', async ({ page }) => {
  await page.goto('/');
  await page.mouse.wheel(0, 2200);
  await expect(nav(page)).toHaveAttribute('data-nav', 'hidden');
  await page.locator('header.top a.mark').focus();
  await expect(nav(page)).not.toHaveAttribute('data-nav', 'hidden');
});

test('the floating notes switch shows only while the navbar is away', async ({ page }) => {
  await page.goto('/');
  await page.mouse.wheel(0, 2200);
  await expect(page.locator('.notes-toggle.float')).toHaveCSS('opacity', '1');
  await page.mouse.wheel(0, -150);
  await expect(page.locator('.notes-toggle.float')).toHaveCSS('opacity', '0');
});
