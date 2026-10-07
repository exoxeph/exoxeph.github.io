import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });

const routes = [
  '/',
  '/work/',
  '/work/ride-pooling-lifecycle/',
  '/work/llm-email-pipeline/',
  '/work/retrieval-orchestration/',
  '/work/speech-document-extraction/',
  '/about/',
  '/contact/',
  '/resume/',
];
const channels = ['pool', 'email', 'rag', 'speech'] as const;
const channelNames = ['Ride pooling', 'Email', 'Retrieval', 'Extraction'];

async function selectChannel(page: Page, id: string) {
  await page.locator(`#ch-${id}`).evaluate((node) => {
    (node as HTMLInputElement).checked = true;
    node.dispatchEvent(new Event('change', { bubbles: true }));
  });
  if (id !== 'pool') await expect(page.locator(`.bench[data-ready-${id}]`)).toBeAttached();
}

async function openInspector(page: Page, id: string) {
  await selectChannel(page, id);
  const opener = page.locator(`[data-inspect-channel="${id}"]`);
  await expect(opener).toBeVisible();
  await opener.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.inspector')).not.toHaveAttribute('hidden');
  await expect(page.locator('.inspector')).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('.inspector'))).toBe(true);
}

async function retrievalLimit(page: Page) {
  await selectChannel(page, 'rag');
  await page.locator('[data-rag-chip]').nth(1).click();
  const slider = page.locator('.rag-art:visible [data-rag-slider="threshold"]');
  await slider.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  // The log debounces edits by 800ms; observe the requested settled window.
  await page.waitForTimeout(1200);
  await expect(page.locator('[data-log-live]')).toHaveText(/^Limit found\./);
  await expect(page.locator('[data-bench-live]')).not.toHaveText(/^Limit found/);
}

test.describe('Phase 17 skip links', () => {
  test('homepage skip links lead the tab order, remain uncovered and skip to the footer', async ({
    page,
  }) => {
    await page.goto('/');
    for (const name of ['Skip to content', 'Skip the Bench, to résumé and contact']) {
      await page.keyboard.press('Tab');
      const link = page.getByRole('link', { name, exact: true });
      await expect(link).toBeFocused();
      await expect
        .poll(() =>
          link.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el;
          }),
        )
        .toBe(true);
    }
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#site-footer$/);
    await page.keyboard.press('Tab');
    await expect(page.locator('footer.site a:focus')).toHaveCount(1);
  });

  test('work has one skip link', async ({ page }) => {
    await page.goto('/work/');
    await expect(page.locator('a.skip')).toHaveCount(1);
    await expect(page.locator('a.skip')).toHaveText('Skip to content');
  });
});

test.describe('Phase 17 heading structure', () => {
  for (const route of routes) {
    test(`${route} has one h1 and no skipped heading level`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('h1')).toHaveCount(1);
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll((nodes) =>
        nodes
          .filter((node) => {
            if (node.closest('[hidden]')) return false;
            for (let el: Element | null = node; el; el = el.parentElement) {
              const style = getComputedStyle(el);
              if (style.display === 'none' || style.visibility === 'hidden') return false;
            }
            return node.getClientRects().length > 0;
          })
          .map((node) => ({ level: Number(node.tagName.slice(1)), text: node.textContent?.trim() })),
      );
      expect(headings.length).toBeGreaterThan(0);
      for (let i = 1; i < headings.length; i++) {
        expect(
          headings[i]!.level,
          `${route}: ${headings[i - 1]!.text} → ${headings[i]!.text}`,
        ).toBeLessThanOrEqual(headings[i - 1]!.level + 1);
      }
    });
  }

  test('homepage log and chapter headings have the correct levels and unique suffixes', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Test log', exact: true })).toHaveJSProperty(
      'tagName',
      'H3',
    );
    const chapters = page.locator('.chapter');
    await expect(chapters).toHaveCount(4);
    const suffixes: string[] = [];
    for (const chapter of await chapters.all()) {
      const headings = chapter.locator('.cblock h4');
      await expect(headings).toHaveCount(5);
      const texts = await headings.allTextContents();
      const parts = texts.map((text) => text.replace(/\s+/g, ' ').trim().split(': ').slice(1).join(': '));
      expect(parts[0]).not.toBe('');
      expect(
        parts.every((suffix) => suffix === parts[0]),
        texts.join('\n'),
      ).toBe(true);
      suffixes.push(parts[0]!);
    }
    expect(new Set(suffixes).size).toBe(4);
  });
});

test.describe('Phase 17 accessible names', () => {
  test('homepage controls have descriptive labels and shared hints', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-inspect-channel]')).toHaveCount(4);
    await expect(page.locator('input.channel-radio')).toHaveCount(4);
    for (const [index, id] of channels.entries()) {
      await expect(page.locator(`[data-inspect-channel="${id}"]`)).toHaveAttribute(
        'aria-label',
        `Inspect ${channelNames[index]}`,
      );
      const radio = page.locator(`#ch-${id}`);
      const label = await radio.getAttribute('aria-label');
      expect(label?.startsWith(`${channelNames[index]}, `)).toBe(true);
      await expect(radio).toHaveAttribute('aria-describedby', 'bench-channel-hint');
    }
    await expect(page.locator('[data-reset]')).toHaveAttribute('aria-label', 'Reset the ride pooling test');
    await expect(page.locator('#bench-channel-hint')).toHaveCount(1);
    await expect(page.locator('#bench-channel-hint')).toHaveText(/\S/);
    await expect(page.locator('input.flow-radio')).toHaveCount(5);
    for (const radio of await page.locator('input.flow-radio').all()) {
      await expect(radio).toHaveAttribute('aria-describedby', 'hero-case-hint');
    }
    await expect(page.locator('#hero-case-hint')).toHaveCount(1);
    await expect(page.locator('#hero-case-hint')).toHaveText(/\S/);
    const summary = page.locator('.routemap summary').first();
    expect(
      await summary.evaluate((el) => {
        const label = el.querySelector('.rm-label')!.textContent!.trim();
        const role = el.querySelector('.rm-role')!.textContent!.trim();
        const text = el.textContent!;
        const end = text.indexOf(label) + label.length;
        const start = text.indexOf(role, end);
        return label.length > 0 && role.length > 0 && start >= end && /^\s+$/.test(text.slice(end, start));
      }),
    ).toBe(true);
  });

  for (const route of ['/', '/work/', '/contact/', '/resume/']) {
    test(`${route} names every interactive accessibility-tree node`, async ({ page }) => {
      await page.goto(route);
      const cdp = await page.context().newCDPSession(page);
      const roles = new Set([
        'button',
        'link',
        'radio',
        'checkbox',
        'textbox',
        'combobox',
        'slider',
        'switch',
      ]);
      try {
        await expect
          .poll(async () => {
            const { nodes } = await cdp.send('Accessibility.getFullAXTree');
            return nodes
              .filter(
                (node) =>
                  !node.ignored &&
                  roles.has(String(node.role?.value)) &&
                  !String(node.name?.value ?? '').trim(),
              )
              .map((node) => ({ role: node.role?.value, nodeId: node.nodeId }));
          })
          .toEqual([]);
      } finally {
        await cdp.detach();
      }
    });
  }
});

test.describe('Phase 17 decorative images', () => {
  for (const [route, selector] of [
    ['/', '.portrait img'],
    ['/resume/', '.portrait img'],
    ['/work/', '.avatar img'],
  ]) {
    test(`${route} uses an empty alt for its decorative image`, async ({ page }) => {
      await page.goto(route!);
      await expect(page.locator(selector!)).toHaveCount(1);
      await expect(page.locator(selector!)).toHaveAttribute('alt', '');
    });
  }
});

test.describe('Phase 17 inspector focus', () => {
  for (const id of channels) {
    test(`${id} inspector receives keyboard focus and restores it on Escape`, async ({ page }) => {
      await page.goto('/');
      await openInspector(page, id);
      await page.keyboard.press('Escape');
      await expect(page.locator('.inspector')).toHaveAttribute('hidden');
      await expect
        .poll(() =>
          page.evaluate(() => {
            const el = document.activeElement;
            return el !== document.body && !!el?.closest('.bench');
          }),
        )
        .toBe(true);
      await expect(page.locator(':focus')).toBeVisible();
    });
  }

  test('clicking the drawer close button leaves focus off the body', async ({ page }) => {
    await page.goto('/');
    await openInspector(page, 'pool');
    const close = page.locator('.inspector button').first();
    await expect(close).toHaveAttribute('aria-label', /^Close/);
    await close.click();
    await expect(page.locator('.inspector')).toHaveAttribute('hidden');
    await expect.poll(() => page.evaluate(() => document.activeElement !== document.body)).toBe(true);
    await expect(page.locator(':focus')).toBeVisible();
  });
});

test.describe('Phase 17 live regions', () => {
  test('hero keyboard changes announce the case, input and outcome', async ({ page }) => {
    await page.goto('/');
    await page.locator('#hc-unclear').focus();
    await page.keyboard.press('ArrowRight');
    const live = page.locator('[data-flow-live]');
    await expect(live).toHaveText(/^Over capacity\./);
    await expect(live).toContainText('Input:');
    await expect(live).toContainText('Outcome:');
  });

  test('retrieval limits are announced by the log alone', async ({ page }) => {
    await page.goto('/');
    await retrievalLimit(page);
  });

  test('stored retrieval entries are not re-announced after reload', async ({ page }) => {
    await page.goto('/');
    await retrievalLimit(page);
    await expect(page.locator('.visitor-entries li')).not.toHaveCount(0);
    await page.reload();
    await expect(page.locator('.visitor-entries li')).not.toHaveCount(0);
    await page.waitForTimeout(1500);
    await expect(page.locator('[data-log-live]')).toHaveText('');
  });

  test('Tesla simultaneous replay announces 5 of 3 without a duplicate bench limit', async ({ page }) => {
    await page.goto('/');
    await openInspector(page, 'pool');
    await page
      .getByRole('button', { name: 'Replay two requests at the same moment', exact: true })
      .press('Enter');
    await expect(page.locator('[data-log-live]')).toContainText('5 of 3');
    await expect(page.locator('[data-bench-live]')).not.toContainText('Limit found');
  });
});

test.describe('Phase 17 focus visibility', () => {
  test('60 keyboard stops have a visible outline', async ({ page }) => {
    await page.goto('/');
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      // After the last page control Chromium tabs through browser chrome before
      // wrapping. No DOM element is focused at that stop (body is only a fallback).
      if ((await focused.count()) === 0) {
        expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
        continue;
      }
      if (await focused.evaluate((el) => el.matches('input.channel-radio, input.flow-radio'))) continue;
      await expect(focused).toBeVisible();
      await expect
        .poll(
          () =>
            focused.evaluate((el) => {
              const style = getComputedStyle(el);
              return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
            }),
          { message: `Tab stop ${i + 1} must have at least a 2px outline` },
        )
        .toBe(true);
    }
  });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`sticky UI does not cover chapter focus at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await page
        .locator('.chapter')
        .first()
        .evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await page.locator('.chapter .cnext a').first().focus();
      let checked = 0;
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press('Shift+Tab');
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
        const focused = page.locator(':focus');
        const eligible = await focused.evaluate(
          (el) => !el.matches('input.channel-radio, input.flow-radio') && !!el.closest('.sidecol'),
        );
        if (!eligible) continue;
        checked++;
        await expect
          .poll(
            () =>
              focused.evaluate((el) => {
                const r = el.getBoundingClientRect();
                const x = Math.max(0, Math.min(innerWidth - 1, r.x + r.width / 2));
                const y = Math.max(0, Math.min(innerHeight - 1, r.y + r.height / 2));
                const hit = document.elementFromPoint(x, y);
                return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
              }),
            { message: `Shift+Tab stop ${i + 1} is covered` },
          )
          .toBe(true);
      }
      expect(checked).toBeGreaterThan(0);
    });
  }
});

test.describe('Phase 17 short and zoomed viewports', () => {
  for (const [width, height, position] of [
    [320, 256, 'static'],
    [390, 844, 'sticky'],
  ] as const) {
    test(`homepage at ${width}x${height} has no overflow and ${position} chips and chapter identities`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
      const elements = page.locator('.chips, .chapter .cid');
      await expect(elements).toHaveCount(5);
      for (const el of await elements.all()) await expect(el).toHaveCSS('position', position);
    });
  }

  for (const route of ['/', '/work/', '/work/ride-pooling-lifecycle/', '/contact/', '/resume/', '/about/']) {
    test(`${route} has no horizontal scroll at 720x450`, async ({ page }) => {
      await page.setViewportSize({ width: 720, height: 450 });
      await page.goto(route);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
    });
  }
});

test.describe('Phase 17 forced colors', () => {
  test.use({ forcedColors: 'active' });

  test('keyboard-focused hero Résumé link has a 3px outline', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('.hero .actions').getByRole('link', { name: 'Résumé', exact: true });
    await expect(link).toBeVisible();
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab');
      if (await link.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS('outline-width', '3px');
  });

  // The state shapes (filled, half, dashed) survive forced colors in the system text color, not the brand green.
  test('verified evidence dot uses its parent text color', async ({ page }) => {
    await page.goto('/work/ride-pooling-lifecycle/');
    const dot = page.locator('.tag.verified i').first();
    await expect(dot).toBeAttached();
    await expect
      .poll(() =>
        dot.evaluate(
          (el) => getComputedStyle(el).backgroundColor === getComputedStyle(el.parentElement!).color,
        ),
      )
      .toBe(true);
  });
});

test.describe('Phase 17 dimmed state contrast', () => {
  test('stale bench readout opacity stays at least 0.75', () => {
    const css = readFileSync(`${process.cwd()}/src/styles/bench.css`, 'utf8');
    const rule = css.match(/\.bench\s+svg\s+\.readout\.stale\s*\{([^}]*)\}/);
    expect(rule, 'stale readout rule exists').not.toBeNull();
    const opacity = rule![1]!.replace(/\/\*[\s\S]*?\*\//g, '').match(/\bopacity\s*:\s*([\d.]+)\s*;/);
    expect(opacity, 'stale readout declares opacity').not.toBeNull();
    expect(Number(opacity![1])).toBeGreaterThanOrEqual(0.75);
  });
});

test.describe('Phase 17 keyboard-only channel switching', () => {
  test('arrow keys on the system radios switch the stage, the chapter and the checked state together', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('#ch-pool').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#ch-email')).toBeChecked();
    await expect(page.locator('.channel.email')).toBeVisible();
    await expect(page.locator('.chapter[data-chapter="email"]')).toHaveClass(/is-active/);
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#ch-pool')).toBeChecked();
    await expect(page.locator('.channel.pool')).toBeVisible();
  });
});

test.describe('Phase 17 screen-reader-only text does not disturb the hand notes', () => {
  test('hero notes stay on screen, in order, after the hidden hint and status were added', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForTimeout(600);
    const boxes = await page.locator('.flow .note').evaluateAll((notes) =>
      notes.map((n) => {
        const r = n.getBoundingClientRect();
        return { text: n.textContent?.trim(), left: r.left, right: r.right, top: r.top };
      }),
    );
    expect(boxes.length).toBe(5);
    for (const b of boxes) expect(b.right, b.text).toBeLessThanOrEqual(1440);
    const tops = boxes.map((b) => b.top);
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
  });
});
