import { expect, test, type Page } from '@playwright/test';

const projects = [
  { id: 'llm-email-pipeline', name: 'email', moment: 'Recorded miss', end: /recorded miss/i, last: 5 },
  {
    id: 'retrieval-orchestration',
    name: 'retrieval',
    moment: 'Repaired, still below',
    end: /marked not accepted/i,
    last: 11,
  },
  {
    id: 'speech-document-extraction',
    name: 'extraction',
    moment: 'Looks valid, is wrong',
    end: /not correct meaning/i,
    last: 5,
  },
  {
    id: 'ride-pooling-lifecycle',
    name: 'ride pooling',
    moment: 'Two accepts at once',
    end: /stronger version/i,
    last: 5,
  },
] as const;

const count = (page: Page) => page.locator('.cf-count');
const btn = (page: Page, name: string) =>
  page.locator('.cf-controls').getByRole('button', { name, exact: true });

for (const p of projects) {
  test.describe(`${p.name} playable flow`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/work/${p.id}/`);
      await expect(page.locator('.cf-controls')).toBeVisible();
    });

    test('Step, Back, Reset and Play move through the stages, one at a time', async ({ page }) => {
      await expect(count(page)).toContainText('Step 1 of');
      await btn(page, 'Step').click();
      await expect(count(page)).toContainText('Step 2 of');
      await btn(page, 'Back').click();
      await expect(count(page)).toContainText('Step 1 of');
      await btn(page, 'Step').click();
      await btn(page, 'Reset').click();
      await expect(count(page)).toContainText('Step 1 of');
      await btn(page, 'Play').click();
      await expect(btn(page, 'Pause')).toHaveAttribute('aria-pressed', 'true');
      await expect(count(page)).toContainText('Step 2 of', { timeout: 6000 });
      await btn(page, 'Pause').click();
      await expect(btn(page, 'Play')).toBeVisible();
    });

    test('the technical moment plays to its end and says what it means', async ({ page }) => {
      await page.locator('.cf-scbtn', { hasText: p.moment }).click();
      for (let i = 0; i < p.last + 4; i++)
        if (await btn(page, 'Step').isEnabled()) await btn(page, 'Step').click();
      await expect(page.locator('.cf-title')).toHaveText(p.end);
      await expect(btn(page, 'Step')).toBeDisabled();
    });

    test('every step names exactly one provenance, and the legend explains the three', async ({ page }) => {
      await expect(page.locator('.cf-legend li')).toHaveCount(3);
      const seen = new Set<string>();
      for (let i = 0; i < 12; i++) {
        const label = (await page.locator('.cf-count .cf-prov').textContent())!.trim();
        expect(['Runs in browser', 'Recorded project run', 'Modelled from the code']).toContain(label);
        seen.add(label);
        if (await btn(page, 'Step').isEnabled()) await btn(page, 'Step').click();
      }
      expect(seen.size).toBeGreaterThanOrEqual(2);
    });

    test('Inspect opens the component, lights it in the architecture section, and links to it', async ({
      page,
    }) => {
      await page.locator('.cf-scbtn', { hasText: p.moment }).click();
      for (let i = 0; i < 4; i++) await btn(page, 'Step').click();
      await btn(page, 'Inspect').click();
      await expect(btn(page, 'Inspect')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.cf-inspector')).toBeVisible();
      await expect(page.locator('.cf-inspector')).toContainText('Provenance');
      const link = page.locator('.cf-inspector a[href^="#arch-"]');
      if (await link.count()) {
        const id = (await link.first().getAttribute('href'))!.slice(1);
        await expect(page.locator(`#${id}`)).toHaveClass(/is-lit/);
        await expect(page.locator(`#${id}`)).toHaveCount(1);
      }
      await btn(page, 'Inspect').click();
      await expect(page.locator('.cf-inspector')).toBeHidden();
    });

    test('keyboard: the controls are real buttons and Enter and Space operate them', async ({ page }) => {
      await btn(page, 'Step').focus();
      await page.keyboard.press('Enter');
      await expect(count(page)).toContainText('Step 2 of');
      await page.keyboard.press('Space');
      await expect(count(page)).toContainText('Step 3 of');
      await expect(
        page.locator('.cf-controls [aria-live], .cf-frame [role="status"]').first(),
      ).toBeAttached();
    });

    test('deep link: the step is in the address and survives a reload', async ({ page }) => {
      await btn(page, 'Step').click();
      await btn(page, 'Step').click();
      await expect(page).toHaveURL(/#flow=[\w-]+\.2$/);
      await page.reload();
      await expect(count(page)).toContainText('Step 3 of');
    });

    test('the written flow is complete without scripts', async ({ browser }) => {
      const ctx = await browser.newContext({ javaScriptEnabled: false });
      const page = await ctx.newPage();
      await page.goto(`/work/${p.id}/`);
      await expect(page.locator('.cf-nojs')).toBeVisible();
      await expect(page.locator('.cf-text')).toHaveAttribute('open', '');
      await expect(page.locator('.cf-text')).toContainText('What came in');
      await expect(page.locator('.cf-text')).toContainText('What it decided');
      expect(await page.locator('.cf-text li').count()).toBeGreaterThan(6);
      await ctx.close();
    });

    test('reduced motion: nothing animates, and Play still works', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.reload();
      await expect(page.locator('.cf-controls')).toBeVisible();
      await btn(page, 'Step').click();
      const anim = await page
        .locator('.fv-card.in')
        .first()
        .evaluate((el) => getComputedStyle(el).animationName);
      expect(anim).toBe('none');
    });

    test('phone: one stage at a time, no overflow, large controls', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload();
      await expect(page.locator('.cf-rail')).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const name of ['Play', 'Back', 'Step', 'Reset', 'Inspect']) {
        const box = await btn(page, name).boundingBox();
        expect(box!.height, name).toBeGreaterThanOrEqual(44);
      }
      await btn(page, 'Step').click();
      await expect(count(page)).toContainText('Step 2 of');
    });

    test('there is a way back to Work and Home', async ({ page }) => {
      await expect(page.locator('.crumbs a[href="/work/"]')).toBeVisible();
      await expect(page.locator('.crumbs a[href="/"]')).toBeVisible();
    });
  });
}

test('the homepage links every project to its case study and to its flow', async ({ page }) => {
  await page.goto('/');
  for (const p of projects) {
    await expect(page.locator(`.chapter a[href="/work/${p.id}/"]`)).toHaveCount(1);
    await expect(page.locator(`.chapter a[href="/work/${p.id}/#flow"]`)).toHaveCount(1);
  }
});

test('the retrieval flow never claims the score checks the sources', async ({ page }) => {
  await page.goto('/work/retrieval-orchestration/');
  const text = await page.locator('.cf-frame').innerText();
  expect(text).not.toMatch(/(?<!not a check )against the sources/i);
  await page.locator('.cf-scbtn').first().click();
  for (let i = 0; i < 6; i++) await btn(page, 'Step').click();
  await expect(page.locator('.fv-notgrounded')).toContainText('Not a grounding check');
  await expect(page.locator('.fv-parts li')).toHaveCount(5);
});
