import { expect, test } from '@playwright/test';

// Research stays unpublished until the owner approves it (status: draft), so the sealed channel,
// its chapter and the research route must not exist in the production build.
test('the sealed research channel and chapter are absent while Research is a draft', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#ch-research')).toHaveCount(0);
  await expect(page.locator('.channel.research')).toHaveCount(0);
  await expect(page.locator('#chapter-research')).toHaveCount(0);
  await expect(page.locator('.tr-research')).toHaveCount(0);
  await expect(page.getByText('Backdoor mitigation')).toHaveCount(0);
  const response = await page.goto('/research/');
  expect(response?.status()).toBe(404);
});
