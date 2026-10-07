import { expect, test } from '@playwright/test';

const cases = [
  [
    'email',
    'Ambiguous request',
    'The check passes and the generator writes the email.',
    'The check returns a clarification question; nothing is generated.',
  ],
  [
    'rag',
    'Low verify score',
    'The verify score is at or above the threshold, so repair is skipped and the answer is returned as accepted.',
    'A score below the threshold triggers one repair attempt, then the result is re-verified. The answer is returned either way: marked not accepted if it is still below the threshold.',
  ],
  [
    'speech',
    'Unparseable value',
    'The value parses, so the row is kept with its raw line.',
    'The value cannot be parsed, so the row is omitted rather than guessed.',
  ],
  [
    'pool',
    'Request would overbook',
    'The request fits, so it is accepted into free seats.',
    'The request would exceed the capacity, so it is refused with HTTP 409.',
  ],
] as const;

const slugs = {
  email: 'llm-email-pipeline',
  rag: 'retrieval-orchestration',
  speech: 'speech-document-extraction',
  pool: 'ride-pooling-lifecycle',
} as const;

for (const [name, label, a, b] of cases) {
  test(`${name} switches between both inspectable states`, async ({ page }) => {
    await page.goto(`/work/${slugs[name]}/`);
    const mechanism = page.locator(`.mech[data-mech="${name}"]`);
    const control = mechanism.getByRole('switch', { name: label });
    await expect(control).not.toBeChecked();
    await expect(mechanism.getByText(a)).toBeVisible();
    await expect(mechanism.getByText(b)).toBeHidden();
    const box = await mechanism.locator('.mech-switch').boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await mechanism.locator('.mech-switch').click();
    await expect(control).toBeChecked();
    await expect(mechanism.getByText(b)).toBeVisible();
    await expect(mechanism.getByText(a)).toBeHidden();
    await control.focus();
    await page.keyboard.press('Space');
    await expect(control).not.toBeChecked();
    await expect(mechanism.getByText(a)).toBeVisible();
  });
}

test('switches work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const [name, label, , b] of cases) {
    await page.goto(`/work/${slugs[name]}/`);
    const mechanism = page.locator(`.mech[data-mech="${name}"]`);
    await mechanism.locator('.mech-switch').click();
    await expect(mechanism.getByRole('switch', { name: label })).toBeChecked();
    await expect(mechanism.getByText(b)).toBeVisible();
  }
  await context.close();
});

test('reduced motion removes transitions', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  for (const name of cases.map((item) => item[0])) {
    await page.goto(`/work/${slugs[name]}/`);
    const mechanism = page.locator(`.mech[data-mech="${name}"]`);
    await mechanism.locator('.mech-switch').click();
    const duration = await mechanism
      .locator('.mech-thumb')
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(duration).toBe('0s');
  }
  await context.close();
});

test('mobile mechanisms on the case studies fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  for (const [name] of cases) {
    await page.goto(`/work/${slugs[name]}/`);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    ).toBeLessThanOrEqual(0);
    await expect(page.locator(`.mech[data-mech="${name}"] .mech-switch`)).toBeVisible();
  }
});

test('speech state B labels do not intersect at mechanism widths', async ({ page }) => {
  await page.goto(`/work/${slugs.speech}/`);
  const mechanism = page.locator('.mech[data-mech="speech"]');
  const raw = mechanism.locator('svg text', { hasText: 'raw line kept' });
  const uncertain = mechanism.locator('svg text', { hasText: 'unparseable row omitted' });
  await expect(raw).toBeHidden();
  await expect(uncertain).toBeHidden();
  await mechanism.locator('.mech-switch').click();
  await expect(raw).toBeVisible();
  await expect(uncertain).toBeVisible();
  for (const width of [280, 335, 460]) {
    await mechanism.evaluate((element, value) => {
      (element as HTMLElement).style.width = `${value}px`;
    }, width);
    const rawBox = await raw.boundingBox();
    const uncertainBox = await uncertain.boundingBox();
    expect(rawBox).not.toBeNull();
    expect(uncertainBox).not.toBeNull();
    expect(
      rawBox!.x + rawBox!.width <= uncertainBox!.x ||
        uncertainBox!.x + uncertainBox!.width <= rawBox!.x ||
        rawBox!.y + rawBox!.height <= uncertainBox!.y ||
        uncertainBox!.y + uncertainBox!.height <= rawBox!.y,
    ).toBe(true);
  }
});

test('pool request text stays inside its rectangle in the refused state', async ({ page }) => {
  await page.goto(`/work/${slugs.pool}/`);
  const mechanism = page.locator('.mech[data-mech="pool"]');
  const request = mechanism.locator('.pool-request');
  const rect = request.locator('rect');
  const label = request.locator('text');
  for (const width of [280, 335]) {
    await mechanism.evaluate((element, value) => {
      (element as HTMLElement).style.width = `${value}px`;
    }, width);
    // The dashed request box exists only in the refused (switched on) state; when the request fits it becomes the filled seats.
    {
      await mechanism.locator('.mech-switch').click();
      await expect(label).toBeVisible();
      const rectBox = await rect.boundingBox();
      const labelBox = await label.boundingBox();
      expect(rectBox).not.toBeNull();
      expect(labelBox).not.toBeNull();
      expect(labelBox!.x).toBeGreaterThanOrEqual(rectBox!.x);
      expect(labelBox!.y).toBeGreaterThanOrEqual(rectBox!.y);
      expect(labelBox!.x + labelBox!.width).toBeLessThanOrEqual(rectBox!.x + rectBox!.width);
      expect(labelBox!.y + labelBox!.height).toBeLessThanOrEqual(rectBox!.y + rectBox!.height);
    }
    await mechanism.locator('.mech-switch').click();
  }
});

test('case study Architecture contains a working mechanism', async ({ page }) => {
  await page.goto('/work/llm-email-pipeline/');
  const mechanism = page.locator('#architecture .mech');
  await expect(mechanism).toHaveCount(1);
  await mechanism.locator('.mech-switch').click();
  await expect(mechanism.getByRole('switch')).toBeChecked();
  await expect(mechanism.getByText(cases[0][3])).toBeVisible();
});

test.describe('pool mechanism has no overlapping labels in either state', () => {
  test('default state: the request box is hidden and seat labels do not collide', async ({ page }) => {
    await page.goto(`/work/${slugs.pool}/`);
    const mech = page.locator('.mech[data-mech="pool"]');
    await mech.scrollIntoViewIfNeeded();
    await expect(mech.locator('.pool-request')).toHaveCSS('visibility', 'hidden');
    const boxes = await mech.locator('svg text:visible').evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { t: e.textContent?.trim() ?? '', l: r.left, r: r.right, tp: r.top, b: r.bottom };
      }),
    );
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const overlap = a.l < b.r && b.l < a.r && a.tp < b.b && b.tp < a.b;
        expect(overlap, `${a.t} overlaps ${b.t}`).toBe(false);
      }
    }
  });
});
