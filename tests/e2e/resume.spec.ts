import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ reducedMotion: 'reduce' });

test('the Résumé word in the nav opens the résumé page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const link = page.locator('header.top nav.desktop').getByRole('link', { name: 'Résumé' });
  await expect(link).toHaveAttribute('href', '/resume/');
  await link.click();
  await expect(page).toHaveURL(/\/resume\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Imtiaz Mashrafee Samin');
  await expect(page.locator('header.top nav.desktop').getByRole('link', { name: 'Résumé' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('the résumé page carries the CV sections, links and certifications', async ({ page }) => {
  await page.goto('/resume/');
  for (const heading of ['Work experience', 'Projects', 'Core skills', 'Education', 'Certifications']) {
    await expect(page.getByRole('heading', { level: 2, name: new RegExp(heading) })).toBeVisible();
  }
  await expect(page.getByRole('heading', { level: 3, name: /AI Engineer/ })).toContainText(
    'Data Solution-360',
  );
  await expect(page.locator('.rgrid')).toContainText('Data-Free Backdoor Removal');
  await expect(page.locator('.rgrid')).toContainText('CGPA 3.65');
  await expect(
    page.getByRole('list', { name: 'Contact' }).getByRole('link', { name: 'imtiazmashrafee@gmail.com' }),
  ).toHaveAttribute('href', 'mailto:imtiazmashrafee@gmail.com');
  await expect(
    page.getByRole('list', { name: 'Contact' }).getByRole('link', { name: 'LinkedIn' }),
  ).toHaveAttribute('href', 'https://www.linkedin.com/in/imtiazmashrafee');
  await expect(page.getByRole('link', { name: /View credential/ })).toHaveAttribute('href', /credly\.com/);
  await expect(page.getByRole('link', { name: /Read the case study on this site/ })).toHaveAttribute(
    'href',
    '/work/retrieval-orchestration/',
  );
  // The certification is named as the CV lists it, and the phone number is not published.
  await expect(page.locator('.rside')).toContainText('AWS Certified AI Practitioner');
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/\+?880\d{6,}/);
  expect(text).not.toMatch(/[–—]/);
});

test('the résumé page is readable on mobile and passes axe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/resume/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
