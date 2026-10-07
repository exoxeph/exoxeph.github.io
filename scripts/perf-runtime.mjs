// Runtime profile of the production preview: idle cost, scroll smoothness, interaction cost, and a long session.
//   node scripts/perf-runtime.mjs [--label before] [--base http://127.0.0.1:4321]
// Uses Chromium DevTools metrics (layout and style recalculation counts, script and task time, heap, DOM nodes,
// event listeners) plus in-page frame timing. Results go to design/perf/runtime-<label>.json (outside the repo).
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const label = arg('label', 'run');
const base = arg('base', 'http://127.0.0.1:4321');
const outDir = new URL('../../exoxeph/design/perf/', import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] });
const results = {};

const open = async (profile) => {
  const ctx = await browser.newContext(profile.context);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  if (profile.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
  await page.addInitScript(() => {
    window.__long = [];
    window.__cls = 0;
    window.__frames = [];
    try {
      new PerformanceObserver((l) =>
        l.getEntries().forEach((e) => window.__long.push(Math.round(e.duration))),
      ).observe({
        type: 'longtask',
        buffered: true,
      });
      new PerformanceObserver((l) =>
        l.getEntries().forEach((e) => {
          if (!e.hadRecentInput) window.__cls += e.value;
        }),
      ).observe({ type: 'layout-shift', buffered: true });
    } catch {}
    window.__recordFrames = (on) => {
      window.__frames = [];
      let last = performance.now();
      window.__rec = on;
      const tick = (t) => {
        if (!window.__rec) return;
        window.__frames.push(t - last);
        last = t;
        requestAnimationFrame(tick);
      };
      if (on) requestAnimationFrame(tick);
    };
  });
  return { ctx, page, cdp };
};
const metrics = async (cdp) => {
  const { metrics: m } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(m.map((x) => [x.name, x.value]));
};
const delta = (a, b) => ({
  layouts: b.LayoutCount - a.LayoutCount,
  styleRecalcs: b.RecalcStyleCount - a.RecalcStyleCount,
  layoutMs: Math.round((b.LayoutDuration - a.LayoutDuration) * 1000),
  styleMs: Math.round((b.RecalcStyleDuration - a.RecalcStyleDuration) * 1000),
  scriptMs: Math.round((b.ScriptDuration - a.ScriptDuration) * 1000),
  taskMs: Math.round((b.TaskDuration - a.TaskDuration) * 1000),
});
const frames = async (page) => {
  const f = await page.evaluate(() => {
    window.__rec = false;
    return window.__frames;
  });
  const s = [...f].sort((x, y) => x - y);
  const pct = (p) =>
    s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(s.length * p))] * 10) / 10 : 0;
  return {
    n: f.length,
    p50: pct(0.5),
    p95: pct(0.95),
    max: pct(1),
    over20: f.filter((x) => x > 20).length,
    over50: f.filter((x) => x > 50).length,
  };
};
const heap = async (cdp) => {
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.collectGarbage');
  const m = await metrics(cdp);
  return {
    heapMB: Math.round((m.JSHeapUsedSize / 1048576) * 10) / 10,
    nodes: m.Nodes,
    listeners: m.JSEventListeners,
  };
};
const pick = (page, ch) =>
  page.evaluate((c) => {
    const radio = document.getElementById('ch-' + c);
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
  }, ch);

const profiles = {
  desktop: { cpu: 1, context: { viewport: { width: 1440, height: 900 } } },
  mobile: {
    cpu: 4,
    context: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
  },
};

for (const [name, profile] of Object.entries(profiles)) {
  const r = {};
  const { ctx, page, cdp } = await open(profile);
  const t0 = Date.now();
  await page.goto(base + '/', { waitUntil: 'load' });
  r.loadMs = Date.now() - t0;
  await page.waitForTimeout(1500);
  r.afterLoad = {
    ...(await heap(cdp)),
    longTasks: await page.evaluate(() => window.__long),
    cls: Number((await page.evaluate(() => window.__cls)).toFixed(4)),
  };

  // 1. Idle: the page should do almost nothing while the visitor reads.
  let a = await metrics(cdp);
  await page.waitForTimeout(5000);
  let b = await metrics(cdp);
  r.idle5s = delta(a, b);

  // 2. Scroll the whole page in wheel steps, measuring frames.
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.evaluate(() => window.__recordFrames(true));
  a = await metrics(cdp);
  for (let y = 0; y < height; y += 160) {
    await page.mouse.wheel(0, 160);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(400);
  b = await metrics(cdp);
  r.scroll = {
    px: height,
    ...delta(a, b),
    frames: await frames(page),
    longTasks: await page.evaluate(() => window.__long.length),
  };
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(500);

  // 3. Hero: step through every case.
  a = await metrics(cdp);
  await page.evaluate(() => window.__recordFrames(true));
  for (const tab of ['Unclear', 'Bad reading', 'Low score', 'Passes', 'Over capacity']) {
    await page.locator('.flow-tabs label', { hasText: tab }).click({ force: true });
    await page.waitForTimeout(350);
  }
  b = await metrics(cdp);
  r.hero = { ...delta(a, b), frames: await frames(page) };

  // 4. Bench: operate all channels, inspect each, close.
  await page.evaluate(() => document.querySelector('.bench').scrollIntoView());
  await page.waitForTimeout(600);
  a = await metrics(cdp);
  await page.evaluate(() => window.__recordFrames(true));
  for (const ch of ['email', 'rag', 'speech', 'pool']) {
    await pick(page, ch);
    await page.waitForTimeout(700);
    await page
      .locator(`[data-inspect-channel="${ch}"]`)
      .first()
      .click({ force: true })
      .catch(() => {});
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
  b = await metrics(cdp);
  r.bench = {
    ...delta(a, b),
    frames: await frames(page),
    longTasks: await page.evaluate(() => window.__long.length),
  };

  // 5. Long session: repeat the whole journey, compare heap, nodes and listeners after each lap.
  r.session = [await heap(cdp)];
  for (let lap = 0; lap < 6; lap++) {
    for (const ch of ['email', 'rag', 'speech', 'pool']) {
      await pick(page, ch);
      await page.waitForTimeout(250);
      await page
        .locator(`[data-inspect-channel="${ch}"]`)
        .first()
        .click({ force: true })
        .catch(() => {});
      await page.waitForTimeout(150);
      await page.keyboard.press('Escape');
    }
    for (let y = 0; y < height; y += 400) {
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(12);
    }
    await page.evaluate(() => scrollTo(0, 0));
    r.session.push(await heap(cdp));
  }
  results[name] = r;
  await ctx.close();
}

// Case-study route: load cost only.
const { ctx, page, cdp } = await open(profiles.desktop);
await page.goto(base + '/work/ride-pooling-lifecycle/', { waitUntil: 'load' });
await page.waitForTimeout(1500);
results.caseStudy = {
  ...(await heap(cdp)),
  longTasks: await page.evaluate(() => window.__long),
  cls: Number((await page.evaluate(() => window.__cls)).toFixed(4)),
};
await ctx.close();
await browser.close();
writeFileSync(`${outDir}runtime-${label}.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
