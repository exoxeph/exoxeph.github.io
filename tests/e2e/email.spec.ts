import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ reducedMotion: 'reduce' });
const open = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await page.locator('label[for="ch-email"]:visible').first().click();
  await expect(page.locator('.email-stage')).toBeVisible();
  await expect(page.locator('.bench[data-ready-email]')).toBeAttached();
};

test('default frame is the recorded scenario 3 with a valid request', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-email-scenario]')).toHaveValue('3');
  await expect(page.locator('[data-email-number]')).toHaveText('basics ok');
  await expect(page.locator('[data-email-word]')).toHaveText('then a model checks');
  await expect(page.locator('[data-email-checker]')).toContainText('recorded: asks first');
  await expect(page.locator('[data-email-checker]')).toContainText('expected: asks first');
  await expect(page.locator('.email [data-provenance="replay"]')).toBeVisible();
  await expect(page.locator('.email-checker-label')).toContainText('not run in this page');
});

test('scenario 4 shows the recorded miss, writes the limit entry and mark, and persists', async ({
  page,
}) => {
  await open(page);
  await page.locator('[data-email-scenario]').selectOption('4');
  await expect(page.locator('[data-email-checker] .miss .main')).toHaveText('recorded: writes the email');
  await expect(page.locator('[data-email-checker]')).toContainText('expected: asks first');
  await expect(page.locator('[data-email-limit]')).toBeVisible();
  await expect(page.locator('.visitor-entries')).toContainText('Scenario 4');
  await expect(page.locator('.visitor-entries')).toContainText(
    'recorded: wrote an email, expected a question',
  );
  await page.reload();
  await expect(page.locator('#ch-email')).toBeChecked();
  await expect(page.locator('[data-email-limit]')).toBeVisible();
});

test('removing every fact and blanking the intent give the exact messages and retire the recording', async ({
  page,
}) => {
  await open(page);
  await page.locator('[data-email-remove]').first().click();
  await expect(page.locator('[data-email-number]')).toHaveText('stopped');
  await expect(page.locator('[data-email-word]')).toHaveText('before the AI is asked to write');
  await expect(page.locator('[data-email-explain]')).toHaveText(
    'List should have at least 1 item after validation, not 0',
  );
  await expect(page.locator('[data-email-checker]')).toContainText('not reached');
  await expect(page.locator('.email [data-provenance="executed"]')).toBeVisible();
  await page.locator('[data-email-add]').click();
  await expect(page.locator('[data-email-explain]')).toContainText(
    'key_facts must contain at least one non-empty fact',
  );
  await page.locator('[data-email-facts] input').first().fill('A real fact');
  await page.locator('[data-email-intent]').fill('   ');
  await expect(page.locator('[data-email-explain]')).toHaveText('Value error, intent must not be empty');
  await page.locator('[data-email-intent]').fill('Ask about the assessment');
  await expect(page.locator('[data-email-number]')).toHaveText('basics ok');
  await expect(page.locator('[data-email-checker]')).toContainText('no recorded outcome for this input');
  await expect(page.locator('[data-email-scenario]')).toHaveValue('own');
  await expect(page.locator('.visitor-entries')).toContainText('Request checked');
});

test('inspector opens from the checker and the gate, tabs switch, the miss button works', async ({
  page,
}) => {
  await open(page);
  await page.locator('[data-inspect-checker]').click();
  const inspector = page.locator('.inspector');
  await expect(inspector).toBeVisible();
  await expect(inspector.locator('#email-inspector-title')).toHaveText('Input checker');
  await inspector.locator('[data-email-tab="code-validation"]').click();
  await expect(inspector.locator('#email-inspector-title')).toHaveText('Request validation');
  await page.keyboard.press('Escape');
  await expect(inspector).toBeHidden();
  await page.locator('[data-inspect-gate]').click();
  await expect(inspector.locator('[data-email-panel="code-validation"]')).toBeVisible();
  await inspector.locator('[data-email-tab="input-checker"]').click();
  await inspector.locator('[data-email-miss]').click();
  await expect(page.locator('[data-email-scenario]')).toHaveValue('4');
  await expect(page.locator('[data-email-limit]')).toBeVisible();
});

test('mobile has no overflow, large targets and passes axe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const selector of [
    '[data-email-scenario]',
    '[data-email-remove]',
    '[data-email-add]',
    '[data-email-tone]',
  ]) {
    const box = await page.locator(selector).first().boundingBox();
    expect(box!.height, selector).toBeGreaterThanOrEqual(44);
  }
  const results = await new AxeBuilder({ page }).include('.bench').analyze();
  expect(results.violations).toEqual([]);
});

test('desktop passes axe with the inspector open', async ({ page }) => {
  await open(page);
  await page.locator('[data-inspect-checker]').click();
  const results = await new AxeBuilder({ page }).include('.bench').analyze();
  expect(results.violations).toEqual([]);
});
