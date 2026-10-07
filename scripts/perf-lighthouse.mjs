// Repeated Lighthouse runs against the local production preview, reported as medians.
//   node scripts/perf-lighthouse.mjs [--runs 3] [--tag before] [--base http://127.0.0.1:4321]
// Needs `npm run build` and `npm run preview` (port 4321) running. Reports are written to design/perf/lh/ (outside the repo).
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const runs = Number(arg('runs', '3'));
const tag = arg('tag', 'run');
const base = arg('base', 'http://127.0.0.1:4321');
const outDir = new URL('../../exoxeph/design/perf/lh/', import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
);
mkdirSync(outDir, { recursive: true });

// ONLY=home limits the run to one target (useful for A/B comparisons of a single page).
const allTargets = [
  ['home', '/'],
  ['case-study-heavy', '/work/ride-pooling-lifecycle/'],
  ['work', '/work/'],
  ['about', '/about/'],
];
const targets = process.env.ONLY ? allTargets.filter(([name]) => name === process.env.ONLY) : allTargets;
const presets = [
  ['mobile', []],
  ['desktop', ['--preset=desktop']],
];
const metricIds = {
  fcp: 'first-contentful-paint',
  lcp: 'largest-contentful-paint',
  cls: 'cumulative-layout-shift',
  tbt: 'total-blocking-time',
  si: 'speed-index',
  tti: 'interactive',
};
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const rows = [];
for (const [name, path] of targets) {
  for (const [preset, flags] of presets) {
    if (preset === 'desktop' && name !== 'home' && name !== 'case-study-heavy') continue;
    const vals = Object.fromEntries(Object.keys(metricIds).map((k) => [k, []]));
    const extra = { score: [], dom: [], bootup: [], mainthread: [], bytes: [] };
    for (let i = 0; i < runs; i++) {
      const file = `${outDir}${tag}-${name}-${preset}-${i}.json`;
      const r = spawnSync(
        'npx',
        [
          '--yes',
          'lighthouse',
          base + path,
          '--output=json',
          `--output-path=${file}`,
          '--only-categories=performance',
          '--quiet',
          '--chrome-flags="--headless=new --no-sandbox"',
          ...flags,
        ],
        { env: { ...process.env, CHROME_PATH: chromium.executablePath() }, shell: true, encoding: 'utf8' },
      );
      if (!existsSync(file)) {
        console.error('lighthouse failed', name, preset, r.stderr?.slice(-300));
        continue;
      }
      const j = JSON.parse(readFileSync(file, 'utf8'));
      for (const [k, id] of Object.entries(metricIds)) vals[k].push(j.audits[id].numericValue);
      extra.score.push(j.categories.performance.score * 100);
      extra.dom.push(j.audits['dom-size']?.numericValue ?? 0);
      extra.bootup.push(j.audits['bootup-time']?.numericValue ?? 0);
      extra.mainthread.push(j.audits['mainthread-work-breakdown']?.numericValue ?? 0);
      extra.bytes.push(j.audits['total-byte-weight']?.numericValue ?? 0);
    }
    if (!vals.fcp.length) continue;
    rows.push({
      page: name,
      preset,
      runs: vals.fcp.length,
      score: median(extra.score),
      fcp: Math.round(median(vals.fcp)),
      lcp: Math.round(median(vals.lcp)),
      cls: Number(median(vals.cls).toFixed(3)),
      tbt: Math.round(median(vals.tbt)),
      si: Math.round(median(vals.si)),
      tti: Math.round(median(vals.tti)),
      dom: median(extra.dom),
      bootupMs: Math.round(median(extra.bootup)),
      mainThreadMs: Math.round(median(extra.mainthread)),
      kb: Math.round(median(extra.bytes) / 1024),
    });
    console.log(JSON.stringify(rows.at(-1)));
  }
}
console.table(rows);
