import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });

const visibleNotes = (page: import('@playwright/test').Page) =>
  page.locator('.note').filter({ visible: true });

test('hand-drawn notes explain the hero flow, the active stage and the deck frame', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.hero .note').first()).toBeVisible();
  await expect(page.locator('.hero .note', { hasText: 'the rule that catches it' })).toBeVisible();
  await expect(page.locator('.channel.pool .note', { hasText: 'drag to change the seats' })).toBeAttached();
  await expect(page.locator('.df[data-ch="pool"][data-b="0"] .note')).toBeAttached();
  // Notes never take pointer events or screen reader attention.
  await expect(page.locator('.note').first()).toHaveAttribute('aria-hidden', 'true');
  expect(
    await page
      .locator('.note')
      .first()
      .evaluate((el) => getComputedStyle(el).pointerEvents),
  ).toBe('none');
});

test('every stage and deck frame has notes, and the font is the comic face', async ({ page }) => {
  await page.goto('/');
  for (const channel of ['pool', 'email', 'rag', 'speech']) {
    expect(await page.locator(`.channel.${channel} .note`).count(), channel).toBeGreaterThanOrEqual(4);
    for (let beat = 0; beat < 5; beat++) {
      expect(await page.locator(`.df[data-ch="${channel}"][data-b="${beat}"] .note`).count()).toBe(1);
    }
  }
  const family = await page
    .locator('.note-t')
    .first()
    .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family.toLowerCase()).toMatch(/comic/);
});

test('the toggle hides every note and the choice is remembered', async ({ page }) => {
  await page.goto('/');
  const toggle = page.getByRole('button', { name: /Hand notes/ });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await visibleNotes(page).count()).toBeGreaterThan(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(await visibleNotes(page).count()).toBe(0);
  await page.reload();
  await expect(page.getByRole('button', { name: /Hand notes/ })).toHaveAttribute('aria-pressed', 'false');
  expect(await visibleNotes(page).count()).toBe(0);
});

test('notes far below the viewport wait, then are placed before they scroll into view', async ({ page }) => {
  await page.goto('/');
  const state = () =>
    page.evaluate(() => {
      const placed = (n: Element) => (n as HTMLElement).style.left !== '';
      const rows = [...document.querySelectorAll('.notes-layer')].map((layer) => {
        const r = layer.getBoundingClientRect();
        return { top: r.top, h: r.height, any: [...layer.querySelectorAll('.note')].some(placed) };
      });
      return rows.filter((r) => r.h > 0);
    });
  const before = await state();
  const far = before.find((r) => r.top > 900 + 310);
  expect(far, 'a sized layer just outside the 300px look-ahead margin').toBeDefined();
  expect(far!.any, 'it is not placed while far away').toBe(false);
  await page.evaluate(() => {
    const bench = document.querySelector('.bench')!;
    window.scrollTo(0, bench.getBoundingClientRect().top + window.scrollY - 20);
  });
  await expect
    .poll(async () => (await state()).filter((r) => r.top > 0 && r.top < 900).every((r) => r.any))
    .toBe(true);
});

test('with notes switched off, scrolling does no placement work', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Hand notes/ }).click();
  const writes = await page.evaluate(async () => {
    let count = 0;
    new MutationObserver((records) => (count += records.length)).observe(document.querySelector('main')!, {
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'd'],
    });
    for (let y = 0; y < 6000; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    return count;
  });
  expect(writes).toBe(0);
});

test('case-study diagrams carry notes too', async ({ page }) => {
  await page.goto('/work/ride-pooling-lifecycle/');
  await expect(page.locator('figure.mech .note', { hasText: 'the capacity line' })).toBeAttached();
  await expect(page.locator('.trace-notes .note')).toHaveCount(5);
});

test('mobile hides the notes and the toggle, with no overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await visibleNotes(page).count()).toBe(0);
  await expect(page.getByRole('button', { name: /Hand notes/ })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('home passes axe with notes on', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('notes sit on clear space: no note box covers diagram text, at several chapter beats', async ({
  page,
}) => {
  await page.goto('/');
  const overlaps = () =>
    page.evaluate(() => {
      const found: string[] = [];
      for (const layer of document.querySelectorAll<HTMLElement>(
        '.stagecol .notes-layer, .hero .notes-layer',
      )) {
        if (!layer.getClientRects().length) continue;
        const scope = layer.parentElement!;
        const notes = [...layer.querySelectorAll<HTMLElement>('.note')].filter(
          (n) => n.style.visibility === 'visible',
        );
        const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const parent = node.parentElement!;
          if (
            !node.nodeValue?.trim() ||
            parent.closest('.notes-layer') ||
            parent.closest('[hidden]') ||
            parent.closest('.visually-hidden')
          )
            continue;
          if (getComputedStyle(parent).display === 'none' || getComputedStyle(parent).visibility === 'hidden')
            continue;
          range.selectNodeContents(node);
          for (const r of range.getClientRects()) {
            if (r.width < 2 || r.height < 2) continue;
            for (const n of notes) {
              const b = n.getBoundingClientRect();
              const w = Math.min(b.right, r.right) - Math.max(b.left, r.left);
              const h = Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top);
              if (w > 3 && h > 3)
                found.push((n.textContent ?? '') + ' over ' + (node.nodeValue ?? '').trim().slice(0, 24));
            }
          }
        }
      }
      return found;
    });
  for (const channel of ['pool', 'email', 'rag', 'speech']) {
    for (const beat of [0, 2, 4]) {
      await page.evaluate(
        ([c, b]) => {
          const el = document.querySelector('.chapter[data-chapter="' + c + '"] [data-beat="' + b + '"]')!;
          window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 150);
        },
        [channel, beat],
      );
      await page.waitForTimeout(450);
      expect(await overlaps(), channel + ' beat ' + beat).toEqual([]);
    }
  }
});
