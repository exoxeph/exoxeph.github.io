// Build output size report with working budgets from TECHNICAL_DESIGN.md section 19. Run after `npm run build`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = new URL('../dist', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const BUDGET = {
  jsPerPageGz: 10 * 1024,
  // Raised from 15 KB: the Bench, inspection deck, hand notes, hero and résumé page were added after this was set.
  // Raised again (17 to 19 KB) when the Work page became a GitHub-style profile with repository cards.
  // Phase 16 inlines the CSS into each page, so this is now the largest single page's CSS (gzip), not a sum across
  // sheets. Measured: 15.9 KB on the home page, the largest.
  // Phase 19R-B: 18 to 19 KB for the four story strips (home measures 18.2 KB, every page inlines the sheet).
  // Phase 20: case-study pages also carry the playable-flow styles (home is 18.5 KB; the case studies are 19.8 KB).
  cssGz: 20 * 1024,
  // Phase 16 measured 125.6 KB of fonts (Newsreader instanced to 400 to 700) and no image above 25 KB.
  fontsRaw: 135 * 1024,
  // Raised from 40 KB in Phase 19R: the home page now carries a recruiter layer and the engineering layer for all four
  // projects. Home brotli transfer is 107.4 KB in total; the per-route brotli budgets are unchanged.
  // Phase 19R-B: 44 to 46 KB for the story strips (home measures 44.3 KB).
  htmlGz: 46 * 1024,
  imageRaw: 40 * 1024,
};

interface F {
  path: string;
  raw: number;
  gz: number;
}
const files: F[] = [];
(function walk(d: string) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else {
      const b = readFileSync(p);
      files.push({
        path: relative(dist, p).replaceAll('\\', '/'),
        raw: b.length,
        gz: gzipSync(b, { level: 9 }).length,
      });
    }
  }
})(dist);

const by = (ext: string[]) => files.filter((f) => ext.includes(extname(f.path)));
const sum = (a: F[], k: 'raw' | 'gz') => a.reduce((s, f) => s + f[k], 0);
const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
const html = by(['.html']),
  css = by(['.css']),
  js = by(['.js']),
  fonts = by(['.woff2', '.woff']),
  imgs = by(['.png', '.jpg', '.jpeg', '.webp', '.avif']);

// JS referenced per page: external scripts plus inline module scripts
const perPage = html.map((f) => {
  const t = readFileSync(join(dist, f.path), 'utf8');
  const inline = [
    ...t.matchAll(/<script(?![^>]*src=)(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g),
  ]
    .map((m) => m[1] ?? '')
    .join('');
  const ext = [...t.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1] as string);
  let gz = inline ? gzipSync(inline, { level: 9 }).length : 0;
  for (const s of ext) {
    const hit = files.find((x) => '/' + x.path === s);
    if (hit) gz += hit.gz;
  }
  // The build inlines the CSS, so each page carries its own: that is the figure a visitor actually pays.
  const style = [...t.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1] ?? '').join('');
  const cssGz = style ? gzipSync(style, { level: 9 }).length : 0;
  return { page: f.path, jsGz: gz, htmlGz: f.gz, cssGz };
});

console.log('Build size report');
console.log(`  HTML pages: ${html.length}`);
console.log(`  JS files:   ${js.length} (${kb(sum(js, 'gz'))} gzip total)`);
console.log(`  CSS:        ${kb(sum(css, 'raw'))} raw, ${kb(sum(css, 'gz'))} gzip`);
console.log(`  Fonts:      ${fonts.length} files, ${kb(sum(fonts, 'raw'))}`);
console.log(`  Images:     ${imgs.length} files, ${kb(sum(imgs, 'raw'))}`);
console.log('  Per page (JS gzip incl. inline, HTML gzip):');
for (const p of perPage)
  console.log(
    `    ${p.page.padEnd(48)} JS ${kb(p.jsGz).padStart(8)}   HTML ${kb(p.htmlGz).padStart(8)}   inline CSS ${kb(p.cssGz).padStart(8)}`,
  );

const fails: string[] = [];
for (const p of perPage) {
  if (p.jsGz > BUDGET.jsPerPageGz) fails.push(`${p.page}: JS ${kb(p.jsGz)} over ${kb(BUDGET.jsPerPageGz)}`);
  if (p.htmlGz > BUDGET.htmlGz) fails.push(`${p.page}: HTML ${kb(p.htmlGz)} over ${kb(BUDGET.htmlGz)}`);
}
const worstCss = Math.max(sum(css, 'gz'), ...perPage.map((p) => p.cssGz));
if (worstCss > BUDGET.cssGz) fails.push(`CSS ${kb(worstCss)} over ${kb(BUDGET.cssGz)}`);
if (sum(fonts, 'raw') > BUDGET.fontsRaw)
  fails.push(`fonts ${kb(sum(fonts, 'raw'))} over ${kb(BUDGET.fontsRaw)}`);
for (const i of imgs)
  if (i.raw > BUDGET.imageRaw) fails.push(`${i.path}: ${kb(i.raw)} over ${kb(BUDGET.imageRaw)}`);
console.log(fails.length ? `\nOVER BUDGET:\n  ${fails.join('\n  ')}` : '\nAll budgets met.');
process.exit(fails.length ? 1 : 0);
