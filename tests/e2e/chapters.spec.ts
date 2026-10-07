import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });

const copy = {
  email: {
    problem:
      'A single prompt writes a confident email even when the request is unclear, contradictory, padded with irrelevant facts or contains instruction-like text.',
    decision:
      'Validate in code first, then let a model decide whether to ask a question before any email is written.',
    limitation:
      'Ten scenarios and one run. The checker is a model: in one recorded scenario it did not ask when it should have.',
  },
  rag: {
    problem:
      'Answering questions over research papers, including tables, with answers that are checked rather than trusted.',
    decision:
      'Score each draft with the rule-based verifier, accept at a threshold, and make one bounded repair attempt below it.',
    limitation:
      'The committed runs use a mock generator, so scores describe harness behavior and not answer quality. Repair is not a guarantee.',
  },
  speech: {
    problem: 'Turning messy audio and photographed documents into structured data without making values up.',
    decision:
      'Reject a value that does not match a known form, omit that row, and keep the raw line on rows that parse.',
    limitation: 'A misread that is still a valid number parses as valid. There is no confidence measure.',
  },
  pool: {
    problem:
      'Pooling riders into shared trips under constraints while several actors change state at once, with an auditable history.',
    decision: "Guard the vehicle's total seats across pools, not each pool, inside the accept transaction.",
    limitation:
      'Concurrent accepts across pools are not covered by the guard. Observed under an in-memory mock; PostgreSQL was not run.',
  },
} as const;
const order = ['pool', 'email', 'rag', 'speech'] as const;
const scrollTo = async (page: import('@playwright/test').Page, selector: string) => {
  await page.evaluate((s) => document.querySelector(s)!.scrollIntoView({ block: 'start' }), selector);
  await page.waitForTimeout(250);
};

test('chapters render in order with the exact copy and the old rows are gone', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.chapter')).toHaveCount(4);
  expect(
    await page.locator('.chapter').evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.chapter)),
  ).toEqual([...order]);
  for (const channel of order) {
    const chapter = page.locator(`.chapter[data-chapter="${channel}"]`);
    await expect(chapter).toContainText(copy[channel].problem);
    await expect(chapter).toContainText(copy[channel].decision);
    await expect(chapter).toContainText(copy[channel].limitation);
    await expect(chapter.getByRole('link', { name: /Case study/ })).toHaveAttribute(
      'href',
      /\/work\/[a-z-]+\/$/,
    );
  }
  await expect(page.locator('article.row')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'How I build' })).toHaveCount(0);
  await expect(page.locator('#work')).toHaveAttribute('data-chapter', 'pool');
  await expect(page.locator('.chapter').getByRole('link', { name: /Watch it run/ })).toHaveCount(4);
});

test('the stage stays pinned while chapters scroll, and scrolling selects the matching channel', async ({
  page,
}) => {
  await page.goto('/');
  await scrollTo(page, '#chapter-speech');
  await expect(page.locator('#ch-speech')).toBeChecked();
  const top = await page.locator('.stagecol').evaluate((el) => el.getBoundingClientRect().top);
  expect(top).toBeGreaterThanOrEqual(0);
  expect(top).toBeLessThan(120);
  await scrollTo(page, '#work');
  await expect(page.locator('#ch-pool')).toBeChecked();
  await scrollTo(page, '#chapter-rag');
  await expect(page.locator('#ch-rag')).toBeChecked();
});

test('a manual channel choice wins until the next chapter becomes active', async ({ page }) => {
  await page.goto('/');
  await scrollTo(page, '#chapter-rag');
  await expect(page.locator('#ch-rag')).toBeChecked();
  await page.locator('label[for="ch-email"]:visible').first().click();
  await expect(page.locator('#ch-email')).toBeChecked();
  await page.evaluate(() => window.scrollBy(0, 120));
  await page.waitForTimeout(250);
  await expect(page.locator('#ch-email')).toBeChecked();
  await scrollTo(page, '#chapter-speech');
  await expect(page.locator('#ch-speech')).toBeChecked();
});

test('route map nodes expand one at a time and reveal level two', async ({ page }) => {
  await page.goto('/');
  const chapter = page.locator('.chapter[data-chapter="pool"]');
  await chapter.scrollIntoViewIfNeeded();
  const nodes = chapter.locator('.routemap > li > details');
  await expect(nodes).toHaveCount(6);
  await nodes.nth(1).locator('> summary').click();
  await expect(nodes.nth(1)).toHaveAttribute('open', '');
  await nodes.nth(1).locator('.rm-more > summary').click();
  await expect(nodes.nth(1)).toContainText('So no route can skip a state.');
  await nodes.nth(2).locator('> summary').click();
  await expect(nodes.nth(2)).toHaveAttribute('open', '');
  await expect(nodes.nth(1)).not.toHaveAttribute('open', '');
});

test('show on the bench selects the channel and opens the drawer, which closes with Escape', async ({
  page,
}) => {
  await page.goto('/');
  const chapter = page.locator('.chapter[data-chapter="speech"]');
  await chapter.scrollIntoViewIfNeeded();
  const nodes = chapter.locator('.routemap > li > details');
  await nodes.nth(3).locator('> summary').click();
  await nodes.nth(3).locator('.rm-show').click();
  const drawer = page.locator('.inspector');
  await expect(drawer).toBeVisible();
  await expect(page.locator('#ch-speech')).toBeChecked();
  const box = await drawer.boundingBox();
  expect(box!.x + box!.width).toBeGreaterThan(1400);
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
});

test('what you tested lists earlier tests and copies them as text', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await expect(page.locator('[data-end-empty]')).toBeVisible();
  const handle = page.getByRole('slider', { name: /request/i }).first();
  await handle.focus();
  await page.keyboard.press('Enter');
  await page.locator('label[for="ch-speech"]:visible').first().click();
  await page.locator('button', { hasText: '<8.5' }).first().click();
  await expect(page.locator('[data-end-list] > li')).toHaveCount(2);
  await expect(page.locator('[data-end-summary]')).toHaveText(
    '2 tests across 2 of 4 systems, 1 documented limit found',
  );
  await expect(page.locator('[data-end-controls]')).toContainText(
    'A misread that is still a valid number was accepted.',
  );
  await page.locator('[data-end-copy]').click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text.split('\n')).toHaveLength(2);
  expect(text).toContain('[Runs in browser]');
  expect(text).toContain('limit found');
});

test('axe passes with a chapter in view and with the drawer open', async ({ page }) => {
  await page.goto('/');
  await scrollTo(page, '#chapter-rag');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.locator('[data-inspect-channel="rag"]').click();
  await expect(page.locator('.inspector')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('mobile: no sticky stage, operate button works, no overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const chapter = page.locator('.chapter[data-chapter="rag"]');
  await chapter.scrollIntoViewIfNeeded();
  const operate = chapter.locator('[data-operate]');
  const box = await operate.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await operate.click();
  await expect(page.locator('#ch-rag')).toBeChecked();
  await expect(page.locator('.rag-stage')).toBeVisible();
  const position = await page.locator('.stagecol').evaluate((el) => getComputedStyle(el).position);
  expect(position).not.toBe('sticky');
});

const names = {
  pool: 'Ride-pooling lifecycle with guarded transitions',
  email: 'Two-stage email drafting pipeline',
  rag: 'Retrieval over research papers with verify and repair',
  speech: 'Speech and report extraction that does not invent values',
} as const;
type Page = import('@playwright/test').Page;
const topOf = (page: Page, channel: string) =>
  page.evaluate(
    (c) => document.querySelector('.chapter[data-chapter="' + c + '"]')!.getBoundingClientRect().top,
    channel,
  );
const invariant = async (page: Page, channel: keyof typeof names) => {
  await expect(page.locator('#ch-' + channel)).toBeChecked();
  await expect(page.locator('.channel.' + channel)).toBeVisible();
  // The sticky identity of the chapter at the reading line names the same project.
  const label = await page.evaluate(() => {
    const line = parseFloat(getComputedStyle(document.querySelector('[data-cid]')!).top) + 6;
    const chapters = [...document.querySelectorAll<HTMLElement>('.chapter')];
    const at = chapters.filter((c) => c.getBoundingClientRect().top <= line + 28).pop()!;
    return { channel: at.dataset.chapter, title: at.querySelector('.ctitle')!.textContent };
  });
  expect(label).toEqual({ channel, title: names[channel] });
};

test('initial state: the Bench opens on the first chapter project', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#ch-pool')).toBeChecked();
  await expect(page.locator('.chapter').first()).toHaveAttribute('data-chapter', 'pool');
  await expect(page.locator('.chapter').first().locator('.ctitle')).toHaveText(names.pool);
});

test('scrolling into every chapter keeps channel, identity and stage in agreement', async ({ page }) => {
  await page.goto('/');
  for (const channel of ['email', 'rag', 'speech', 'pool'] as const) {
    await scrollTo(page, '.chapter[data-chapter="' + channel + '"]');
    await invariant(page, channel);
  }
});

test('choosing a channel moves the reading to that chapter, and later scrolling keeps agreement', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('label[for="ch-rag"]:visible').first().click();
  await expect.poll(() => topOf(page, 'rag')).toBeLessThan(110);
  await invariant(page, 'rag');
  await page.evaluate(() => window.scrollBy(0, 200));
  await page.waitForTimeout(250);
  await invariant(page, 'rag');
  await page.locator('label[for="ch-speech"]:visible').first().click();
  await expect.poll(() => topOf(page, 'speech')).toBeLessThan(110);
  await invariant(page, 'speech');
});

test('the sticky identity stays visible while a chapter is read', async ({ page }) => {
  await page.goto('/');
  await scrollTo(page, '.chapter[data-chapter="email"]');
  await page.evaluate(() => window.scrollBy(0, 900));
  await page.waitForTimeout(250);
  const box = await page.locator('.chapter[data-chapter="email"] [data-cid]').boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(8);
  expect(box!.y).toBeLessThan(40);
});

test('mobile: scrolling into a chapter activates its channel and the identity sits under the chips', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await scrollTo(page, '.chapter[data-chapter="speech"]');
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(300);
  await expect(page.locator('#ch-speech')).toBeChecked();
  const box = await page.locator('.chapter[data-chapter="speech"] [data-cid]').boundingBox();
  // The chips now sit at the top of the screen and the compact identity right under them.
  expect(box!.y).toBeGreaterThan(40);
  expect(box!.y).toBeLessThan(130);
});

test('Tesla beats drive the stage: the no-guard beat shows 5 of 3 with a breach and one annotation', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => {
    const b = document.querySelector('.chapter[data-chapter="pool"] [data-beat="3"]')!;
    window.scrollTo(0, window.scrollY + b.getBoundingClientRect().top - 140);
  });
  await page.waitForTimeout(500);
  await expect(page.locator('.tesla-svg:visible .wall-breach').first()).toBeAttached();
  await expect(page.locator('.tesla-svg:visible .annotation').first()).toBeAttached();
});

test('the inspection deck follows the project and the beat, and starts on the first project', async ({
  page,
}) => {
  await page.goto('/');
  const frame = () =>
    page.evaluate(() => {
      const shown = [...document.querySelectorAll<HTMLElement>('.df')].filter((f) => f.offsetParent);
      return shown.map((f) => f.dataset.ch + ':' + f.dataset.b);
    });
  expect(await frame()).toEqual(['pool:0']);
  for (const channel of ['pool', 'email', 'rag', 'speech']) {
    for (const beat of [0, 1, 2, 3, 4]) {
      await page.evaluate(
        ([c, b]) => {
          const el = document.querySelector('.chapter[data-chapter="' + c + '"] [data-beat="' + b + '"]')!;
          window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 120);
        },
        [channel, beat],
      );
      await page.waitForTimeout(250);
      await expect.poll(frame).toEqual([channel + ':' + beat]);
      await expect(page.locator('#ch-' + channel)).toBeChecked();
    }
  }
});

test('the pinned stage never overflows its height with the deck, at the common desktop sizes', async ({
  page,
}) => {
  for (const [width, height] of [
    [1440, 900],
    [1536, 864],
    [1920, 1080],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    for (const channel of ['pool', 'email', 'rag', 'speech']) {
      await page.evaluate((c) => {
        const radio = document.getElementById('ch-' + c) as HTMLInputElement;
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }, channel);
      await page.waitForTimeout(150);
      const fit = await page.evaluate(() => {
        const stage = document.querySelector('.stagecol')!;
        return stage.scrollHeight - stage.clientHeight;
      });
      expect(fit, channel + ' at ' + width + 'x' + height).toBeLessThanOrEqual(1);
    }
  }
});

test('jumping straight into a chapter beat shows that beat on the stage too, even before its controller loaded', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => {
    const el = document.querySelector('.chapter[data-chapter="email"] [data-beat="3"]')!;
    window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 120);
  });
  await expect(page.locator('#ch-email')).toBeChecked();
  await expect(page.locator('[data-email-scenario]')).toHaveValue('1');
});

test('each chapter but the last ends with a bridge to the next system, and the header cue follows the reading', async ({
  page,
}) => {
  await page.goto('/');
  const order = ['pool', 'email', 'rag', 'speech'];
  for (let i = 0; i < order.length; i++) {
    const bridge = page.locator('.chapter[data-chapter="' + order[i] + '"] .cnext a');
    if (i === order.length - 1) await expect(bridge).toHaveCount(0);
    else await expect(bridge).toHaveAttribute('href', '#chapter-' + order[i + 1]);
  }
  await scrollTo(page, '.chapter[data-chapter="rag"]');
  await expect(page.locator('.chapter.is-active')).toHaveCount(1);
  await expect(page.locator('.chapter[data-chapter="rag"]')).toHaveClass(/is-active/);
});

test.describe('with motion allowed', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('moving to the next system hands the stage over and leaves no ghost behind', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const el = document.querySelector('.chapter[data-chapter="email"] [data-beat="1"]')!;
      window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 220);
    });
    await expect(page.locator('#ch-email')).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-stage-moved', '1');
    await expect(page.locator('.stagecol .channel.ghost')).toHaveCount(0, { timeout: 3000 });
  });

  test('nothing animates before the reader has moved', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveAttribute('data-stage-moved', /.+/);
  });
});

test('reduced motion: switching systems makes no ghost', async ({ page }) => {
  await page.goto('/');
  await page.locator('label[for="ch-rag"]:visible').first().click();
  await expect(page.locator('#ch-rag')).toBeChecked();
  await expect(page.locator('.stagecol .channel.ghost')).toHaveCount(0);
});
