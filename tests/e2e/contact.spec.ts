import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('the contact page lists every way to reach me and passes axe', async ({ page }) => {
  await page.goto('/contact/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Contact');
  const list = page.getByRole('list', { name: 'Contact' });
  await expect(list.getByRole('link', { name: 'imtiazmashrafee@gmail.com' })).toHaveAttribute(
    'href',
    'mailto:imtiazmashrafee@gmail.com',
  );
  await expect(list.getByRole('link', { name: /linkedin\.com/ })).toBeVisible();
  await expect(list.getByRole('link', { name: /github\.com\/exoxeph/ })).toBeVisible();
  await expect(list.getByRole('link', { name: /résumé/i })).toHaveAttribute('href', '/resume/');
  await expect(page.getByText('Dhaka, Bangladesh').first()).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('the homepage ends on the résumé and contact tabs, with no About or Contact blocks', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#about')).toHaveCount(0);
  const tabs = page.locator('footer.site .pop-tab');
  await expect(tabs).toHaveCount(2);
  await expect(tabs.nth(0)).toHaveAttribute('href', '/resume/');
  await expect(tabs.nth(1)).toHaveAttribute('href', '/contact/');
  await expect(page.locator('.hero .actions a')).toHaveCount(2);
});
