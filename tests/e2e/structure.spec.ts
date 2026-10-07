import { expect, test } from '@playwright/test';

// Guards against formatter damage: lists in case studies must render as real lists, not merged paragraphs.
test.describe('case study structure renders', () => {
  test('the home bench contains four channels and a log', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.bench .channel')).toHaveCount(4);
    await expect(page.locator('.bench .email-stage')).toHaveCount(1);
    await expect(page.locator('.bench .rag-stage')).toHaveCount(1);
    await expect(page.locator('.bench .speech-stage')).toHaveCount(1);
    await expect(page.locator('.bench .tape')).toHaveCount(1);
  });
  for (const [slug, minItems] of [
    ['llm-email-pipeline', 5],
    ['retrieval-orchestration', 6],
    ['speech-document-extraction', 5],
    ['ride-pooling-lifecycle', 6],
  ] as const) {
    test(`${slug}: decisions are a list of at least ${minItems} items and no bullet text is inline`, async ({
      page,
    }) => {
      await page.goto(`/work/${slug}/`);
      await expect(page.locator('#decisions ul > li')).toHaveCount(minItems);
      const text = (await page.locator('#decisions').innerText()).replace(/\s+/g, ' ');
      expect(text).not.toMatch(/ - \*\*|\. - /);
    });
    test(`${slug}: architecture has a numbered stage list and the section order matches the template`, async ({
      page,
    }) => {
      await page.goto(`/work/${slug}/`);
      expect(await page.locator('#architecture ol > li').count()).toBeGreaterThanOrEqual(4);
      const ids = await page.locator('main section.s').evaluateAll((els) => els.map((e) => e.id));
      const want = [
        'problem',
        'built',
        'contribution',
        'architecture',
        'decisions',
        'evaluation',
        'results',
        'limitations',
      ];
      expect(ids.slice(0, want.length)).toEqual(want);
    });
  }
});
