import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

const nav = (page: import('@playwright/test').Page) => page.locator('html');
// The home page snaps to whole pages: a wheel turn ends when the page has settled, not when the event is sent.
const wheel = async (page: import('@playwright/test').Page, dy: number) => {
  await page.mouse.wheel(0, dy);
  // The glide starts on the next frame: do not mistake the page before it has begun for a page at rest.
  await page.waitForTimeout(200);
  let last = -1;
  await expect
    .poll(async () => {
      const y = await page.evaluate(() => Math.round(window.scrollY));
      const settled = y === last;
      last = y;
      return settled;
    })
    .toBe(true);
};

test('the navbar stays through the opening, dissolves on the way down and returns on the first scroll up', async ({
  page,
}) => {
  await page.goto('/');
  // A tiny nudge stays on the opening page, and the bar stays.
  await wheel(page, 6);
  await expect(nav(page)).not.toHaveAttribute('data-nav', 'hidden');
  await expect(page.locator('header.top')).toBeInViewport();

  await wheel(page, 1800);
  await expect(nav(page)).toHaveAttribute('data-nav', 'hidden');
  await expect(page.locator('header.top')).not.toBeInViewport();

  // A scroll up turns back one page, and the bar returns.
  await wheel(page, -600);
  await expect(nav(page)).not.toHaveAttribute('data-nav', 'hidden');
  await expect(page.locator('header.top')).toBeInViewport();

  await wheel(page, 400);
  await expect(nav(page)).toHaveAttribute('data-nav', 'hidden');
});

test('focusing a link in the bar brings it back', async ({ page }) => {
  await page.goto('/');
  // Two pages down: well past the opening, not on the borderline where the bar starts to hide.
  await wheel(page, 2200);
  await page.waitForTimeout(1300);
  await wheel(page, 2200);
  await expect(nav(page)).toHaveAttribute('data-nav', 'hidden');
  await page.locator('header.top a.mark').focus();
  await expect(nav(page)).not.toHaveAttribute('data-nav', 'hidden');
});

test('the floating notes switch shows only while the navbar is away', async ({ page }) => {
  await page.goto('/');
  await wheel(page, 2200);
  await page.waitForTimeout(1300);
  await wheel(page, 2200);
  await expect(page.locator('.notes-toggle.float')).toHaveCSS('opacity', '1');
  await wheel(page, -600);
  await expect(page.locator('.notes-toggle.float')).toHaveCSS('opacity', '0');
});
