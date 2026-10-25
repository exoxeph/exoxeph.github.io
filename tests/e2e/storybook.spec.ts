import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { stops } from '../../src/lib/guide/lines';

test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });

const files = {
  pool: 'ride-pooling-lifecycle',
  email: 'llm-email-pipeline',
  rag: 'retrieval-orchestration',
  speech: 'speech-document-extraction',
} as const;
type Channel = keyof typeof files;
const channels = Object.keys(files) as Channel[];

// The plain-words chapter copy, read straight from each project's content file so the test follows the source.
const chapterCopy = (channel: Channel) => {
  const text = readFileSync(`src/content/projects/${files[channel]}.mdx`, 'utf8');
  const field = (key: string) => {
    const m = text.match(new RegExp(`^  ${key}: (".*")$`, 'm'));
    if (!m) throw new Error(`${channel}: no chapter.${key}`);
    return JSON.parse(m[1]!) as string;
  };
  return ['wrong', 'does', 'decisionPlain', 'evidenceHuman', 'limitationPlain'].map(field);
};

test('each project is told in four pages', async ({ page }) => {
  await page.goto('/');
  for (const channel of channels) {
    const chapter = page.locator(`.chapter[data-chapter="${channel}"]`);
    const blocks = chapter.locator('.cblock');
    expect(await blocks.evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.beat))).toEqual([
      '0',
      '1',
      '3',
      '4',
    ]);
    const heads = await blocks.evaluateAll((els) =>
      els.map((el) => el.querySelector('h4')?.textContent?.trim() ?? ''),
    );
    ['It fails', 'How it catches it', 'It survives', 'The idea holds'].forEach((name, i) =>
      expect(heads[i], `${channel} block ${i}`).toMatch(new RegExp('^' + name)),
    );
    const lines = await chapter
      .locator('.cblock .beat-line')
      .evaluateAll((els) => els.map((el) => el.textContent!.trim()));
    expect(lines, `${channel} beat lines`).toHaveLength(4);
    for (const line of lines) expect(line.split(/\s+/).length, `"${line}"`).toBeLessThanOrEqual(20);
    await expect(page.locator(`.df[data-ch="${channel}"][data-b]`)).toHaveCount(5);
    for (const part of chapterCopy(channel)) await expect(chapter).toContainText(part);
  }
});

test('home turns pages, other pages scroll freely', async ({ page }) => {
  await page.goto('/');
  // The page-turn script takes over from the CSS snapping (which stays the no-script fallback).
  await expect(page.locator('html')).toHaveAttribute('data-pager', '');
  await page.goto('/work/');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType)).toBe('none');
  await expect(page.locator('html')).not.toHaveAttribute('data-pager', /.*/);
});

// Where the page comes to rest after a gesture.
const rest = async (page: import('@playwright/test').Page) => {
  let last = -1;
  await expect
    .poll(
      async () => {
        const y = await page.evaluate(() => Math.round(window.scrollY));
        const still = y === last;
        last = y;
        return still;
      },
      { intervals: [250] },
    )
    .toBe(true);
  return last;
};
const pageTop = (page: import('@playwright/test').Page, selector: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s)!;
    const pad =
      (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) +
      (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
    return Math.round(el.getBoundingClientRect().top + scrollY - pad);
  }, selector);

test.describe('page turns', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('a short scroll turns to the next page and back, gliding there', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pager', '');
    const p0 = '.chapter[data-chapter="pool"] .cblock[data-beat="0"]';
    const p1 = '.chapter[data-chapter="pool"] .cblock[data-beat="1"]';
    await page.evaluate((s) => {
      const el = document.querySelector(s)!;
      const pad =
        (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) +
        (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
      scrollTo({ top: el.getBoundingClientRect().top + scrollY - pad, behavior: 'instant' });
    }, p0);
    await rest(page);
    await page.waitForTimeout(1300);
    await page.mouse.move(1100, 500);
    // A nudge of 120px turns the whole page, and the glide passes through the space between.
    await page.mouse.wheel(0, 120);
    const seen = new Set<number>();
    for (let i = 0; i < 6; i++) {
      seen.add(await page.evaluate(() => Math.round(scrollY)));
      await page.waitForTimeout(60);
    }
    expect(Math.abs((await rest(page)) - (await pageTop(page, p1)))).toBeLessThanOrEqual(2);
    expect(seen.size).toBeGreaterThan(2);
    await page.waitForTimeout(1300);
    await page.mouse.wheel(0, -120);
    expect(Math.abs((await rest(page)) - (await pageTop(page, p0)))).toBeLessThanOrEqual(2);
  });

  test('one gesture turns exactly one page, however hard it is, and the page is locked while it turns', async ({
    page,
  }) => {
    await page.goto('/');
    const tops = ['0', '1', '3', '4'].map((b) => `.chapter[data-chapter="pool"] .cblock[data-beat="${b}"]`);
    await page.evaluate((s) => {
      const el = document.querySelector(s)!;
      const pad =
        (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) +
        (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
      scrollTo({ top: el.getBoundingClientRect().top + scrollY - pad, behavior: 'instant' });
    }, tops[0]!);
    await rest(page);
    await page.waitForTimeout(1300);
    await page.mouse.move(1100, 500);
    const [y0, y1, y2] = await Promise.all(tops.slice(0, 3).map((s) => pageTop(page, s)));
    // A hard flick plus the long tail of a trackpad's inertia is still one turn.
    await page.mouse.wheel(0, 4000);
    for (const d of [900, 600, 400, 250, 150, 90, 60, 40, 20, 10]) {
      await page.waitForTimeout(40);
      await page.mouse.wheel(0, d);
    }
    // Nothing scrolls past the next page at any moment: the position stays between the two pages.
    for (let i = 0; i < 8; i++) {
      const y = await page.evaluate(() => scrollY);
      expect(y).toBeGreaterThanOrEqual(y0! - 2);
      expect(y).toBeLessThanOrEqual(y1! + 2);
      await page.waitForTimeout(120);
    }
    expect(Math.abs((await rest(page)) - y1!)).toBeLessThanOrEqual(2);
    // A new gesture after the pause turns the next one.
    await page.waitForTimeout(500);
    await page.mouse.wheel(0, 100);
    expect(Math.abs((await rest(page)) - y2!)).toBeLessThanOrEqual(2);
  });

  test('keys turn a page too', async ({ page }) => {
    await page.goto('/');
    const p1 = '.chapter[data-chapter="email"] .cblock[data-beat="1"]';
    const p3 = '.chapter[data-chapter="email"] .cblock[data-beat="3"]';
    await page.evaluate((s) => {
      const el = document.querySelector(s)!;
      const pad =
        (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) +
        (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
      scrollTo({ top: el.getBoundingClientRect().top + scrollY - pad, behavior: 'instant' });
    }, p1);
    await rest(page);
    await page.waitForTimeout(1300);
    await page.keyboard.press('PageDown');
    expect(Math.abs((await rest(page)) - (await pageTop(page, p3)))).toBeLessThanOrEqual(2);
    await page.waitForTimeout(1300);
    await page.keyboard.press('PageUp');
    expect(Math.abs((await rest(page)) - (await pageTop(page, p1)))).toBeLessThanOrEqual(2);
  });

  test('a tiny accidental scroll stays on the page', async ({ page }) => {
    await page.goto('/');
    const p1 = '.chapter[data-chapter="email"] .cblock[data-beat="1"]';
    await page.evaluate((s) => {
      const el = document.querySelector(s)!;
      const pad =
        (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) +
        (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
      scrollTo({ top: el.getBoundingClientRect().top + scrollY - pad, behavior: 'instant' });
    }, p1);
    const y0 = await rest(page);
    await page.waitForTimeout(1300);
    await page.mouse.move(1100, 500);
    await page.mouse.wheel(0, 6);
    await page.waitForTimeout(600);
    // A brush of the wheel moves nothing: the page does not creep, and it does not turn.
    expect(Math.abs((await rest(page)) - y0)).toBeLessThanOrEqual(2);
  });

  test('résumé: a short scroll glides the next point onto the reading line', async ({ page }) => {
    await page.goto('/resume/');
    await expect(page.locator('html')).toHaveAttribute('data-pager', '');
    const centre = (i: number) =>
      page.evaluate((k) => {
        const r = document.querySelectorAll('[data-step]')[k]!.getBoundingClientRect();
        return Math.round(r.top + r.height / 2);
      }, i);
    await page.evaluate(() =>
      document.querySelectorAll('[data-step]')[1]!.scrollIntoView({ block: 'center', behavior: 'instant' }),
    );
    await rest(page);
    await page.waitForTimeout(1300);
    await page.mouse.move(1200, 450);
    await page.mouse.wheel(0, 100);
    await rest(page);
    // The reading line: the middle of the screen under the scroll padding, where scrollIntoView centres.
    const line = await page.evaluate(() => {
      const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      return pad + (innerHeight - pad) / 2;
    });
    expect(Math.abs((await centre(2)) - line)).toBeLessThanOrEqual(3);
    await expect(page.locator('[data-step="2"]')).toHaveClass(/is-active/, { timeout: 8000 });
  });

  test('résumé: the first point is two turns from the top, and every page turns back up', async ({
    page,
  }) => {
    // Sixteen turns, each with its glide and the lock that follows it.
    test.setTimeout(90_000);
    await page.goto('/resume/');
    await page.waitForTimeout(800);
    await page.mouse.move(1200, 450);
    const turn = async (dy: number) => {
      await page.waitForTimeout(1300);
      await page.mouse.wheel(0, dy);
      return rest(page);
    };
    const y0 = await rest(page);
    const y1 = await turn(120);
    const y2 = await turn(120);
    expect(y1).toBeGreaterThan(y0);
    expect(y2).toBeGreaterThan(y1);
    // Two turns from the top: the first point is on the reading line.
    await expect(page.locator('[data-step="0"]')).toHaveClass(/is-active/, { timeout: 6000 });
    // All the way down, then back up through every page: each upward turn moves, and none is a dead end.
    await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    let y = await rest(page);
    for (let i = 0; i < 14; i++) {
      const up = await turn(-120);
      expect(up, `upward turn ${i} from ${y}`).toBeLessThan(y);
      y = up;
    }
  });

  test('home: scrolling up from the very bottom moves, page after page', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(800);
    await page.mouse.move(1100, 500);
    await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    let y = await rest(page);
    for (let i = 0; i < 4; i++) {
      await page.waitForTimeout(1300);
      await page.mouse.wheel(0, -120);
      const up = await rest(page);
      expect(up, `upward turn ${i} from ${y}`).toBeLessThan(y);
      y = up;
    }
  });
});

test('pages-fit-viewport: every page fits one screen with its disclosures closed', async ({ page }) => {
  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.waitForTimeout(300);
    // Each page must fit the room it lands in: the screen below the sticky identity (scroll padding), less its own
    // margin (negative for full-screen pages, which land at the very top).
    const pages = await page.locator('.story-page').evaluateAll((els) => {
      const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      return els.map((el) => {
        const r = el.getBoundingClientRect();
        const offset = pad + (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
        const top = r.top + scrollY;
        return {
          id: (el.closest('[id]')?.id ?? '') + ' ' + ((el as HTMLElement).dataset.beat ?? el.className),
          height: Math.round(r.height),
          // A page that lands at the very top of the document (the opening) has the screen below its own top.
          room: Math.round(top - offset <= 0 ? innerHeight - top : innerHeight - offset),
          open: el.querySelectorAll('details[open]').length,
        };
      });
    });
    expect(pages.length).toBeGreaterThanOrEqual(16);
    for (const p of pages) {
      expect(p.open, `${p.id} at ${width}x${height}`).toBe(0);
      expect(p.height, `${p.id} at ${width}x${height}`).toBeLessThanOrEqual(Math.min(p.room, height) + 1);
    }
  }
});

test('disclosure-does-not-trap: an opened disclosure can be read through and left', async ({ page }) => {
  await page.goto('/');
  const block = page.locator('.chapter[data-chapter="pool"] .cblock[data-beat="0"]');
  await block.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await block.locator('details > summary').first().click();
  const bottom = await block.evaluate((el) => el.getBoundingClientRect().bottom + window.scrollY);
  let last = -1;
  for (let i = 0; i < 40; i++) {
    const y = await page.evaluate(() => window.scrollY);
    if (y === last) break;
    last = y;
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(250);
  }
  expect(last).toBeGreaterThan(bottom);
});

test('keyboard-focus-visible: a control keeps its place while it is operated', async ({ page }) => {
  await page.goto('/');
  const slider = page.getByRole('slider', { name: /request/i }).first();
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  const box = await slider.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(900);
});

test('deep-links-land on their page, and try it brings the stage into view', async ({ page }) => {
  for (const hash of ['#chapter-email', '#work']) {
    await page.goto('/' + hash);
    await page.waitForTimeout(600);
    const top = await page.evaluate((h) => document.querySelector(h)!.getBoundingClientRect().top, hash);
    expect(top, hash).toBeGreaterThanOrEqual(0);
    expect(top, hash).toBeLessThanOrEqual(100);
  }
  // The try it button is the phone's way to the stage (wide screens keep the stage pinned beside the text).
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.chapter[data-chapter="rag"] [data-operate]').click();
  await page.waitForTimeout(600);
  await expect(page.locator('#ch-rag')).toBeChecked();
  const stage = await page.locator('.stagecol').boundingBox();
  expect(stage!.y).toBeLessThan(844);
  expect(stage!.y + stage!.height).toBeGreaterThan(0);
});

test('opening page: who, the one idea and its picture, nothing to operate', async ({ page }) => {
  await page.goto('/');
  const open = page.locator('#story-open');
  await expect(open).toHaveClass(/story-page/);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(open.locator('h1')).toContainText('Imtiaz Mashrafee');
  await expect(open).toContainText('AI Engineer');
  await expect(open).toContainText('I build AI systems and test what they do when inputs go wrong.');
  await expect(open.locator('[role="tab"], input, select')).toHaveCount(0);
  const picture = open.locator('svg[role="img"]');
  await expect(picture).toHaveCount(1);
  expect((await picture.getAttribute('aria-label'))?.length).toBeGreaterThan(20);
});

test('the story ends with the last project page: no extra closing page, the footer follows', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#story-end')).toHaveCount(0);
  await expect(page.locator('[data-end-empty], .bench-end')).toHaveCount(0);
  const after = await page.evaluate(() => {
    const last = document.querySelector('.chapter[data-chapter="speech"] .cblock[data-beat="4"]')!;
    const footer = document.getElementById('site-footer')!;
    return !!(last.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(after).toBe(true);
  // The footer still carries the way on: résumé and contact.
  await expect(page.locator('footer.site .pop-tab')).toHaveCount(2);
});

test('phone beats stack: each picture is a page just before its line, and every page fits', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (const channel of channels) {
    const seen = await page
      .locator(`.chapter[data-chapter="${channel}"]`)
      .evaluate((chapter) =>
        [...chapter.children]
          .filter((el) => el.matches('.df[data-inline], .cblock'))
          .map((el) =>
            el.matches('.df') ? 'f' + (el as HTMLElement).dataset.b : 'b' + (el as HTMLElement).dataset.beat,
          ),
      );
    // Picture then line: beat 1 has both mechanism pictures before it.
    expect(seen, channel).toEqual(['f0', 'b0', 'f1', 'f2', 'b1', 'f3', 'b3', 'f4', 'b4']);
    const tall = await page
      .locator(`.chapter[data-chapter="${channel}"] > .story-page`)
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
    for (const h of tall) expect(h, channel).toBeLessThanOrEqual(845);
  }
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('nojs-reads: every page line and the opening are on the page', async ({ page }) => {
    await page.goto('/');
    const lines = page.locator('.cblock .beat-line');
    await expect(lines).toHaveCount(16);
    for (const line of await lines.all()) await expect(line).toBeVisible();
    await expect(page.locator('#story-open .lede')).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType)).toContain(
      'mandatory',
    );
  });
});

test('reduced-motion-reads: pages still snap and nothing keeps moving', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.getElementById('site-footer')!.scrollIntoView());
  await page.waitForTimeout(600);
  // Pages still turn (the script's turns are instant under reduced motion).
  await expect(page.locator('html')).toHaveAttribute('data-pager', '');
  const running = await page.evaluate(() =>
    document
      .getAnimations()
      .filter(
        (a) => a.playState === 'running' && !(a.effect as KeyframeEffect | null)?.target?.closest('.guide'),
      )
      .map((a) => (a as CSSAnimation).animationName ?? 'anim'),
  );
  expect(running).toEqual([]);
});

test.describe('the guide', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('guide follows the four pages and never speaks on the unused beat', async ({ page }) => {
    // Sixteen page turns, each with the guide walking out and back in.
    test.setTimeout(90_000);
    for (const channel of channels) expect(stops[channel]![2]!.say, channel).toBeUndefined();
    await page.goto('/');
    const guide = page.locator('[data-guide]');
    for (const channel of channels) {
      let last = '';
      for (const beat of [0, 1, 3, 4]) {
        await page.evaluate(
          ([c, b]) => {
            const el = document.querySelector(`.chapter[data-chapter="${c}"] [data-beat="${b}"]`)!;
            el.scrollIntoView({ block: 'start' });
          },
          [channel, beat] as const,
        );
        await expect(page.locator('.bench')).toHaveAttribute('data-beat', String(beat));
        // He walks to this page's stop: once settled, he stands somewhere new (or strikes a new pose).
        const where = () =>
          guide.evaluate((el) => {
            const actor = el.firstElementChild as HTMLElement;
            const r = actor.getBoundingClientRect();
            return `${Math.round(r.left / 20)}:${Math.round(r.top / 20)}:${(el as HTMLElement).dataset.pose}`;
          });
        await expect
          .poll(async () => (await guide.getAttribute('data-phase')) === 'on' && (await where()) !== last, {
            message: `${channel} beat ${beat}`,
            timeout: 6000,
          })
          .toBe(true);
        await expect(guide).toBeVisible();
        last = await where();
      }
    }
  });
});
