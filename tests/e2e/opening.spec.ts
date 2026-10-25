import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ reducedMotion: 'reduce' });

test('the opening shows name, role, one line and the idea, and the Bench follows', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const h1 = page.getByRole('heading', { level: 1 });
  await expect(h1).toContainText('Imtiaz Mashrafee');
  await expect(h1).toContainText('AI Engineer');
  await expect(page.locator('.hero .lede')).toHaveText(
    'I build AI systems and test what they do when inputs go wrong.',
  );
  await expect(page.locator('.hero .idea-svg')).toBeInViewport();
  // The opening fills the first screen under the bar; the Bench comes next.
  const open = (await page.locator('#story-open').boundingBox())!;
  const bench = (await page.locator('.bench').boundingBox())!;
  expect(open.y + open.height).toBeGreaterThanOrEqual(900 - 1);
  expect(open.y + open.height).toBeLessThanOrEqual(900 + 1);
  expect(bench.y).toBeGreaterThanOrEqual(open.y + open.height - 1);
  // The résumé stays one click away on the first screen, in the bar.
  await expect(page.locator('header.top').getByRole('link', { name: 'Résumé' })).toBeVisible();
});

test('the idea reads with no script', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.goto('/');
  for (const word of ['a request', 'check', 'the system acts', 'ask, refuse, leave out'])
    await expect(page.locator('.idea-svg')).toContainText(word);
  await context.close();
});

test('mobile opening: identity, then the idea, with no overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const idea = (await page.locator('.idea').boundingBox())!;
  const h1 = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
  expect(h1.y).toBeLessThan(idea.y);
});

test('phone: name and the one line are on the first screen, in portrait and on its side', async ({
  page,
}) => {
  const sizes: [number, number][] = [
    [375, 667],
    [320, 640],
    [430, 932],
    [667, 375],
  ];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    for (const sel of ['h1', '.hero .lede']) {
      const box = (await page.locator(sel).boundingBox())!;
      expect(box.y + box.height, `${width}x${height} ${sel}`).toBeLessThanOrEqual(height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('Phase 19: the opening names the current role', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
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
        // What goes wrong, in plain words, sits right after the plain sentence in the disclosure.
        wrong: pick('.cterms .csub + p'),
        // The one line a recruiter reads on each of the four pages.
        lines: [...el.closest('.chapter')!.querySelectorAll('.beat-line')].map(
          (d) => d.textContent?.trim() ?? '',
        ),
        order: [...el.children].map((c) => c.className || c.tagName.toLowerCase()),
      };
    });
    expect(text.lines, `chapter ${i} page lines`).toHaveLength(4);
    expect(text.wrong.length, `chapter ${i} what goes wrong`).toBeGreaterThan(30);
    for (const part of [text.question, text.plain, text.wrong, ...text.lines])
      expect(part, `chapter ${i}: "${part}"`).not.toMatch(specialist);
    expect(text.who, `chapter ${i} my part`).toMatch(/^My part:/);
    // My part comes before the story and before any heading, so it is read early.
    expect(text.order.indexOf('cwho')).toBeLessThan(text.order.indexOf('beat-line'));
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
