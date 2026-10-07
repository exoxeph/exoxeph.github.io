import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ROUTES } from './routes.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
// Let running transitions (the navbar fade, the stage hand-over) finish first: axe reads colors mid-fade otherwise.
const scan = async (page: import('@playwright/test').Page) => {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime ?? Infinity))
        .map((a) => a.finished.catch(() => null)),
    ),
  );
  return (await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations;
};
const fmt = (v: Awaited<ReturnType<typeof scan>>) =>
  v
    .map(
      (x) =>
        `${x.id}: ${x.nodes
          .slice(0, 3)
          .map((n) => n.target.join(' '))
          .join(' | ')}`,
    )
    .join('\n');

test.describe('axe baseline', () => {
  for (const path of ROUTES) {
    test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
      await page.goto(path);
      const v = await scan(page);
      expect(v, fmt(v)).toEqual([]);
    });
  }

  test('404 page', async ({ page }) => {
    await page.goto('/nope/');
    const v = await scan(page);
    expect(v, fmt(v)).toEqual([]);
  });

  test('all homepage mechanisms switched on', async ({ page }) => {
    await page.goto('/');
    for (const control of await page.getByRole('switch').all()) await control.check({ force: true });
    const v = await scan(page);
    expect(v, fmt(v)).toEqual([]);
  });

  for (const width of [1440, 390]) {
    for (const id of ['pool', 'email', 'rag', 'speech']) {
      test(`home hero ${id} has no axe violations at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/');
        if (id !== 'pool') await page.locator(`label[for="ch-${id}"]:visible`).click();
        const v = await scan(page);
        expect(v, fmt(v)).toEqual([]);
      });
    }
  }

  for (const width of [1440, 390]) {
    test(`open bench inspector has no axe violations at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await page.locator(`.${width === 390 ? 'mobile' : 'desktop'} [data-guard]`).click();
      const v = await scan(page);
      expect(v, fmt(v)).toEqual([]);
    });
  }

  test('trace in the invalid and rejected end states, and with the mobile menu open', async ({ page }) => {
    await page.goto('/work/ride-pooling-lifecycle/');
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next step' }).click();
    let v = await scan(page);
    expect(v, fmt(v)).toEqual([]);
    await page.getByLabel('Without the guard').check({ force: true });
    v = await scan(page);
    expect(v, fmt(v)).toEqual([]);
    await page.getByRole('switch', { name: 'Compare both versions' }).check();
    v = await scan(page);
    expect(v, fmt(v)).toEqual([]);
    await page.setViewportSize({ width: 375, height: 740 });
    await page.locator('details.menu summary').click();
    v = await scan(page);
    expect(v, fmt(v)).toEqual([]);
  });

  test('skip link is the first focusable element and lands on main', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const first = page.locator(':focus');
    await expect(first).toHaveText('Skip to content');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });
});
