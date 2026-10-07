import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ reducedMotion: 'reduce' });

const visibleCase = (page: import('@playwright/test').Page) =>
  page.locator('.flow-case').filter({ visible: true });

test('the opening shows name, role, one line, actions and the flow, with the Bench starting below', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const h1 = page.getByRole('heading', { level: 1 });
  await expect(h1).toContainText('Imtiaz Mashrafee');
  await expect(h1).toContainText('AI Engineer');
  await expect(page.locator('.hero .lede')).toHaveText(
    'I build AI systems and test what they do when inputs go wrong.',
  );
  for (const name of ['Selected work', 'Résumé']) {
    await expect(page.locator('.hero .actions').getByRole('link', { name })).toBeVisible();
  }
  const hero = await page.locator('.hero').boundingBox();
  expect(hero!.height).toBeGreaterThan(900 * 0.6);
  expect(hero!.height).toBeLessThan(900 * 0.9);
  const bench = await page.locator('.bench').boundingBox();
  expect(bench!.y).toBeGreaterThan(600);
  expect(bench!.y).toBeLessThan(900);
});

test('the first frame reads as input, check, control, outcome, with no script needed', async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.goto('/');
  const shown = visibleCase(page);
  await expect(shown).toHaveCount(1);
  for (const label of ['Input', 'Check', 'Control', 'Outcome']) {
    await expect(shown.locator('.fs-label', { hasText: label })).toBeVisible();
  }
  await expect(shown.locator('.fs-flag')).toHaveText('caught');
  await expect(shown).toContainText('Too vague to write from');
  await expect(shown).toContainText('Ask a question first');
  await context.close();
});

test('choosing a case shows that input being caught, or passing, with the matching control', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const expectations: [string, string, string, string][] = [
    ['Unclear', 'caught', 'Ask a question first', 'No email is written'],
    ['Bad reading', 'caught', 'Leave the row out', 'Not guessed, not kept'],
    ['Low score', 'caught', 'One repair attempt', 'Checked again'],
    ['Passes', 'passes', 'No intervention needed', 'Accepted'],
    ['Over capacity', 'caught', 'Refuse the request', 'Nothing changes'],
  ];
  for (const [tab, flag, control, outcome] of expectations) {
    await page.locator('.flow-tabs label', { hasText: tab }).click();
    const shown = visibleCase(page);
    await expect(shown).toHaveCount(1);
    await expect(shown.locator('.fs-flag')).toHaveText(flag);
    await expect(shown.locator('.fs-control')).toContainText(control);
    await expect(shown.locator('.fs-out')).toContainText(outcome);
  }
});

test('the cases are a keyboard radio group with names', async ({ page }) => {
  await page.goto('/');
  const first = page.getByRole('radio', { name: 'Unclear' });
  await first.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: 'Over capacity' })).toBeChecked();
  await expect(visibleCase(page)).toContainText('Refuse the request');
});

test('mobile opening: identity, actions, then the flow, with no overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const flow = (await page.locator('.flow').boundingBox())!;
  const actions = (await page.locator('.hero .actions').boundingBox())!;
  const h1 = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
  expect(h1.y).toBeLessThan(flow.y);
  // On a phone the actions come straight after the identity, with the signature check under them.
  expect(actions.y).toBeLessThan(flow.y);
  await expect(visibleCase(page)).toHaveCount(1);
});

test('phone: both actions are on the first screen, in portrait and on its side', async ({ page }) => {
  const sizes: [number, number][] = [
    [375, 667],
    [320, 640],
    [430, 932],
    [667, 375],
  ];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const links = page.locator('.hero .actions a');
    for (const i of [0, 1]) {
      const box = (await links.nth(i).boundingBox())!;
      expect(box.y + box.height, `${width}x${height} action ${i}`).toBeLessThanOrEqual(height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('Phase 19: the default case is an AI one, and the opening names the current role', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('radio', { name: 'Unclear' })).toBeChecked();
  await expect(visibleCase(page)).toContainText('AI email writer');
  await expect(page.locator('.hero .who')).toContainText('AI Engineer at Data Solution-360');
});

test('Phase 19: every chapter opens with a plain sentence, then the technical one, then my part', async ({
  page,
}) => {
  await page.goto('/');
  const jargon = /\b(RAG|OCR|BM25|Pydantic|transition table|race condition|provenance|threshold|parser)\b/i;
  const chapters = page.locator('.chapter');
  await expect(chapters).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    const chapter = chapters.nth(i);
    const plain = (await chapter.locator('.csub').textContent())!.trim();
    expect(plain.length, `chapter ${i} plain sentence`).toBeGreaterThan(60);
    expect(plain, `chapter ${i} plain sentence has no specialist term`).not.toMatch(jargon);
    await expect(chapter.locator('.cterms')).toContainText('In engineering terms');
    await expect(chapter.locator('.cwho')).toContainText('My part');
  }
});

test('Phase 19R: each chapter leads with what goes wrong, why it matters, what it does and my part', async ({
  page,
}) => {
  await page.goto('/');
  const specialist =
    /\b(RAG|OCR|BM25|rerank|prune|threshold|parser|parsing|transition table|race condition|provenance|409|pool|pools|state machine)\b/i;
  const chapters = page.locator('.chapter[data-chapter]:not(#chapter-research)');
  await expect(chapters).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    const chapter = chapters.nth(i);
    const first = chapter.locator('[data-beat="0"]');
    const text = await first.evaluate((el) => {
      const pick = (sel: string) => el.querySelector(sel)?.textContent?.trim() ?? '';
      return {
        question: pick('.cq'),
        plain: pick('.csub'),
        who: pick('.cwho'),
        terms: [...el.querySelectorAll('.cstory dt')].map((d) => d.textContent?.trim()),
        body: [...el.querySelectorAll('.cstory dd')].map((d) => d.textContent?.trim() ?? ''),
        order: [...el.children].map((c) => c.className || c.tagName.toLowerCase()),
      };
    });
    expect(text.terms, `chapter ${i} story terms`).toEqual(['Goes wrong', 'Why it matters', 'What it does']);
    for (const part of [text.question, text.plain, ...text.body])
      expect(part, `chapter ${i}: "${part}"`).not.toMatch(specialist);
    expect(text.who, `chapter ${i} my part`).toMatch(/^My part:/);
    // My part comes before the story and before any heading, so it is read early.
    expect(text.order.indexOf('cwho')).toBeLessThan(text.order.indexOf('cstory'));
    expect(text.order.indexOf('cwho')).toBeLessThan(text.order.indexOf('h4'));
  }
});

test('Phase 19R: engineering depth is still one click away', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const html = await page.content();
  // Technical terms moved deeper, not deleted: the frames' collapsed sections and the chapter's engineering terms.
  for (const needle of [
    'transition table',
    'List should have at least 1 item after validation, not 0',
    'bm25 0.5 to 0.7',
    'capacity guard',
    'HTTP 409',
    'rerank',
    'contextualize',
  ])
    expect(html, needle).toContain(needle);
  await expect(page.locator('.chapter[data-chapter="rag"] .cterms').first()).toContainText(
    'In engineering terms',
  );
  expect(await page.locator('.df .d-deep').count()).toBeGreaterThanOrEqual(3);
});

test('Phase 19R: the retrieval stage says what the number means before the route names', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.evaluate(() => document.querySelector('.bench')!.scrollIntoView());
  await page.locator('label[for="ch-rag"]:visible').first().click();
  const art = page.locator('.rag-art:visible .rag-svg');
  const text = ((await art.first().textContent()) ?? '').toLowerCase();
  expect(text).toContain('required quality');
  expect(text).toContain('find sources');
  expect(text).not.toMatch(/rerank|contextualize|bm25|threshold \d/);
});

test('Phase 19R-B: each project opens with its own plain story diagram, and the engineering stays beneath it', async ({
  page,
}) => {
  await page.goto('/');
  const expected = {
    pool: {
      head: 'Blocks requests over capacity, except two at once.',
      structure: '.story-ledger',
      tech: /transition table/,
    },
    email: {
      head: 'Checks the request before the AI writes.',
      structure: '.story-gate',
      tech: /input checker/,
    },
    rag: { head: 'Checks the first answer before returning it.', structure: '.story-ladder', tech: /rerank/ },
    speech: { head: 'Turns messy readings into structured fields.', structure: '.story-align', tech: /OCR/ },
  } as const;
  const specialist =
    /\b(RAG|OCR|BM25|rerank|prune|threshold|parser|parsing|transition table|race|provenance|Pydantic)\b/i;
  const structures = new Set<string>();
  for (const [channel, want] of Object.entries(expected)) {
    const story = page.locator(`.df[data-ch="${channel}"][data-b="0"] .story`);
    await expect(story).toHaveCount(1);
    await expect(story.locator('.story-head')).toContainText(want.head);
    await expect(story.locator(want.structure)).toHaveCount(1);
    structures.add(want.structure);
    const shown = await story.evaluate((el) => {
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('details').forEach((d) => d.remove());
      return clone.textContent ?? '';
    });
    expect(shown, `${channel} first layer`).not.toMatch(specialist);
    const deep = (await story.locator('details.d-deep').textContent()) ?? '';
    expect(deep, `${channel} engineering layer`).toMatch(want.tech);
  }
  // Four projects, four different structures.
  expect(structures.size).toBe(4);
});

test('Phase 19R-B: the retrieval score is described as the rule-based quality check it is', async ({
  page,
}) => {
  await page.goto('/');
  const html = await page.content();
  expect(html).toContain('rule-based');
  expect(html).not.toMatch(/against the sources|checks its own draft against/i);
  expect(html).toContain('It does not compare the answer with the retrieved passages');
});

test('Phase 19: provenance labels use plain wording', async ({ page }) => {
  await page.goto('/');
  const text = await page.locator('.bench').innerText();
  expect(text).toMatch(/recorded project run/i);
  expect(text).not.toMatch(/recorded replay|executed here|implementation-derived/i);
});

test('the opening passes axe', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).include('.hero').analyze();
  expect(results.violations).toEqual([]);
});
