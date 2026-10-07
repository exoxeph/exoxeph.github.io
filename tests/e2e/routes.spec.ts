import { expect, test } from '@playwright/test';

import { ROUTES } from './routes.ts';

test.describe('routes', () => {
  for (const path of ROUTES) {
    test(`${path} renders with one h1, a title, a description and a canonical URL`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      expect((await page.title()).length).toBeGreaterThan(10);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{40,}/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `https://exoxeph.github.io${path}`,
      );
      await expect(page.locator('main#main')).toHaveCount(1);
      await expect(page.locator('header nav').first()).toBeVisible();
    });
  }

  test('routes that are intentionally not built return 404', async ({ page }) => {
    for (const path of ['/traces/', '/research/']) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(404);
    }
  });

  test('the branded 404 page is served for unknown paths', async ({ page }) => {
    const res = await page.goto('/nope/');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('No page matches');
    const rec = page.getByRole('group', { name: 'Response for this request' });
    await expect(rec).toContainText('HTTP 404');
    await expect(rec).toContainText('State changed');
  });

  test('home shows the four primary projects in the approved order, each with a Case study link and a Watch it run link', async ({
    page,
  }) => {
    await page.goto('/');
    const titles = await page.locator('.chapter .ctitle').allTextContents();
    expect(titles).toEqual([
      'Ride-pooling lifecycle with guarded transitions',
      'Two-stage email drafting pipeline',
      'Retrieval over research papers with verify and repair',
      'Speech and report extraction that does not invent values',
    ]);
    await expect(page.locator('.bench [data-guard]')).toHaveCount(2);
    await expect(page.getByRole('link', { name: /Case study/ })).toHaveCount(4);
    await expect(page.locator('.chapter').getByRole('link', { name: /Watch it run/ })).toHaveCount(4);
  });

  test('sitemap and robots exist', async ({ request }) => {
    expect((await request.get('/robots.txt')).status()).toBe(200);
    const sm = await request.get('/sitemap-0.xml');
    expect(sm.status()).toBe(200);
    const body = await sm.text();
    expect(body).toContain('https://exoxeph.github.io/work/ride-pooling-lifecycle/');
    expect(body).not.toContain('/traces/');
    expect(body).not.toContain('/research/');
  });
});
