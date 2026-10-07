import { expect, test } from '@playwright/test';

// Phase 21: on very short landscape screens the sticky bar left too little room, so it scrolls away there.
test.describe('header on short landscape screens', () => {
  test.use({ viewport: { width: 667, height: 375 } });

  test('the bar is not sticky and never covers the case-study flow controls', async ({ page }) => {
    await page.goto('/work/retrieval-orchestration/#flow');
    await page.waitForSelector('.cf.is-live');
    const position = await page.locator('header.top').evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe('static');
    const step = page.getByRole('button', { name: 'Step', exact: true });
    await step.focus();
    const box = await step.boundingBox();
    const bar = await page.locator('header.top').boundingBox();
    expect(box).not.toBeNull();
    expect(bar!.y + bar!.height <= box!.y || bar!.y >= box!.y + box!.height).toBe(true);
  });
});

test.describe('header on a normal phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the bar stays sticky', async ({ page }) => {
    await page.goto('/work/retrieval-orchestration/');
    const position = await page.locator('header.top').evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe('sticky');
  });
});
