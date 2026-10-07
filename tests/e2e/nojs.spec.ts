import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test.describe('without JavaScript', () => {
  test('home keeps navigation, hero, chapters and the résumé and contact footer', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('AI Engineer');
    await expect(page.getByRole('link', { name: 'Work' }).first()).toBeVisible();
    await expect(page.locator('.chapter')).toHaveCount(4);
    await expect(page.locator('#approach')).toHaveCount(0);
    await expect(page.locator('#about')).toHaveCount(0);
    await expect(page.locator('footer.site').getByRole('link', { name: /Contact/ })).toHaveAttribute(
      'href',
      '/contact/',
    );
    await expect(page.locator('footer.site').getByRole('link', { name: /Résumé/ })).toBeVisible();
    await expect(page.locator('#work')).toContainText('Pooling riders into shared trips');
  });

  test('bench radios switch cases with the final state visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#ch-pool')).toBeChecked();
    await expect(page.locator('.tesla-svg.desktop .code')).toHaveText('409');
    for (const id of ['email', 'rag', 'speech', 'pool']) {
      // A forced click can land on a label that is still moving (fonts, or the previous smooth scroll): retry it.
      await expect(async () => {
        await page.locator(`.tr-${id}`).click({ force: true });
        await expect(page.locator(`.channel.${id}`)).toBeVisible({ timeout: 1500 });
      }).toPass({ timeout: 10000 });
      await expect(page.locator('.channel:visible')).toHaveCount(1);
    }
  });

  test('mobile bench chips switch channels without JavaScript', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('.tesla-svg.mobile .code')).toHaveText('409');
    for (const id of ['email', 'rag', 'speech', 'pool']) {
      await page.locator(`.chips label[for="ch-${id}"]`).click();
      await expect(page.locator(`#ch-${id}`)).toBeChecked();
      await expect(page.locator(`.channel.${id}`)).toBeVisible();
    }
  });

  test('speech default frame is server rendered', async ({ page }) => {
    await page.goto('/');
    await page.locator('.tr-speech').click();
    await expect(page.locator('[data-speech-number]')).toHaveText('4 of 5');
    await expect(page.locator('.speech-tr.omitted')).toHaveCount(1);
    await expect(page.locator('.speech-brackets')).toContainText('value: no match');
    await expect(page.getByRole('textbox', { name: 'OCR line' })).toHaveValue(/10\^3\/µL/);
    await expect(page.locator('.speech [data-provenance="replay"]')).toBeVisible();
  });

  test('the mobile menu works as a native disclosure', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await page.goto('/');
    await page.locator('details.menu summary').click();
    await expect(page.locator('details.menu a', { hasText: 'About' })).toBeVisible();
  });

  test('every case study is complete', async ({ page }) => {
    for (const slug of [
      'llm-email-pipeline',
      'retrieval-orchestration',
      'speech-document-extraction',
      'ride-pooling-lifecycle',
    ]) {
      await page.goto(`/work/${slug}/`);
      for (const id of [
        'problem',
        'built',
        'contribution',
        'architecture',
        'decisions',
        'evaluation',
        'results',
        'limitations',
        'repository',
      ]) {
        await expect(page.locator(`#${id}`), `${slug} #${id}`).toHaveCount(1);
      }
    }
  });

  test('Tesla Pool trace is fully readable as text, and the stepper stays hidden', async ({ page }) => {
    await page.goto('/work/ride-pooling-lifecycle/');
    await expect(page.locator('.trace-instrument')).toBeHidden();
    const text = page.locator('.trace-text');
    await expect(text).toContainText('Capability.');
    await expect(text).toContainText('Request C meets the guard');
    await expect(text).toContainText('HTTP 409');
    await expect(text).toContainText('Request C is accepted');
    await expect(text).toContainText('5 of 3');
    await expect(text).toContainText('Limitation.');
    await expect(page.locator('.trace-also')).toContainText('Two accepts at the same moment');
    await expect(page.locator('#trace').getByText('Partially verified').first()).toBeVisible();
  });

  test('about page lists technologies as text', async ({ page }) => {
    await page.goto('/about/');
    await expect(page.locator('dl')).toContainText('FastAPI');
  });
});
