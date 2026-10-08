// Per-route transfer measurement for the production build (dist). Run after `npm run build`.
//   node scripts/perf-assets.mjs [--json out.json]
// For each HTML route it follows what the browser really fetches on load: stylesheets, scripts and their static
// imports, modulepreloads, preloaded fonts, and images. Sizes are raw, gzip (level 9) and brotli.
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { extname, join, relative, posix } from 'node:path';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

const dist = new URL('../dist', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const out = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;

const sizeOf = (b, url) => ({
  url,
  raw: b.length,
  gz: gzipSync(b, { level: 9 }).length,
  br: brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
});
const sizeCache = new Map();
const size = (url) => {
  if (sizeCache.has(url)) return sizeCache.get(url);
  const p = join(dist, decodeURIComponent(url.split(/[?#]/)[0]));
  let r = null;
  if (existsSync(p) && statSync(p).isFile()) {
    const b = readFileSync(p);
    r = {
      url,
      raw: b.length,
      gz: gzipSync(b, { level: 9 }).length,
      br: brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
    };
  }
  sizeCache.set(url, r);
  return r;
};
const text = (url) => readFileSync(join(dist, url.split(/[?#]/)[0]), 'utf8');

const htmlFiles = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (extname(n) === '.html') htmlFiles.push(relative(dist, p).replaceAll('\\', '/'));
  }
})(dist);

// Static imports of a JS module (minified output: import"./x.js", from"./x.js"; import("./x.js") is dynamic).
const jsDeps = (url, seen = new Set()) => {
  if (seen.has(url)) return seen;
  seen.add(url);
  const dir = posix.dirname(url);
  const t = text(url);
  for (const m of t.matchAll(/(?:^|[;,}\s])(?:import|export)[^"'`;]*?["']([^"']+\.js)["']/g)) {
    if (m[1].startsWith('.') || m[1].startsWith('/')) jsDeps(posix.normalize(posix.join(dir, m[1])), seen);
  }
  return seen;
};

const routes = htmlFiles.map((file) => {
  const route = '/' + file.replace(/index\.html$/, '');
  const t = readFileSync(join(dist, file), 'utf8');
  const parts = { html: size('/' + file), css: [], js: [], inlineJs: 0, fonts: [], images: [] };
  const seen = new Set();
  const add = (list, url) => {
    if (!url || seen.has(url)) return;
    const s = size(url);
    if (!s) return;
    seen.add(url);
    list.push(s);
  };
  for (const m of t.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"/g)) add(parts.css, m[1]);
  for (const m of t.matchAll(/<link[^>]+href="([^"]+\.css)"[^>]*rel="stylesheet"/g)) add(parts.css, m[1]);
  // The build inlines the CSS. Count it as CSS and take it out of the HTML figure, so nothing is counted twice.
  let styleText = '';
  for (const m of t.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) styleText += m[1];
  if (styleText) {
    parts.css.push(sizeOf(Buffer.from(styleText), 'inline-css'));
    parts.html = sizeOf(Buffer.from(t.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')), '/' + file);
  }
  const scripts = [...t.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
  for (const m of t.matchAll(/<link[^>]+rel="modulepreload"[^>]*href="([^"]+)"/g)) scripts.push(m[1]);
  for (const s of scripts) for (const d of jsDeps(s)) add(parts.js, d);
  let inline = '';
  for (const m of t.matchAll(
    /<script(?![^>]*\ssrc=)(?![^>]*type="application\/(?:ld\+)?json")[^>]*>([\s\S]*?)<\/script>/g,
  ))
    inline += m[1];
  parts.inlineJs = inline ? gzipSync(inline, { level: 9 }).length : 0;
  for (const m of inline.matchAll(/["'](\/_astro\/[^"']+\.js)["']/g))
    for (const d of jsDeps(m[1])) add(parts.js, d);
  for (const m of t.matchAll(/<link[^>]+rel="preload"[^>]*as="font"[^>]*href="([^"]+)"/g))
    add(parts.fonts, m[1]);
  for (const m of t.matchAll(/<link[^>]+href="([^"]+\.woff2?)"[^>]*as="font"/g)) add(parts.fonts, m[1]);
  for (const m of t.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)) add(parts.images, m[1]);
  for (const m of t.matchAll(/<link[^>]+rel="preload"[^>]*as="image"[^>]*href="([^"]+)"/g))
    add(parts.images, m[1]);
  // Chunks reached only through dynamic import() from the loaded scripts: fetched later, not on first load.
  const lazy = [];
  const lazySeen = new Set();
  for (const f of [...parts.js]) {
    const dir = posix.dirname(f.url);
    for (const m of text(f.url).matchAll(/import\(\s*["'`]([^"'`]*?\.js)["'`]\s*\)/g)) {
      const u = posix.normalize(posix.join(dir, m[1]));
      for (const d of jsDeps(u)) {
        if (seen.has(d) || lazySeen.has(d)) continue;
        lazySeen.add(d);
        const s = size(d);
        if (s) lazy.push(s);
      }
    }
  }
  const sum = (a, k) => a.reduce((s, f) => s + f[k], 0);
  const total = (k) =>
    parts.html[k] + sum(parts.css, k) + sum(parts.js, k) + sum(parts.fonts, k) + sum(parts.images, k);
  return {
    route,
    html: parts.html,
    css: {
      n: parts.css.length,
      raw: sum(parts.css, 'raw'),
      gz: sum(parts.css, 'gz'),
      br: sum(parts.css, 'br'),
    },
    js: {
      n: parts.js.length,
      raw: sum(parts.js, 'raw'),
      gz: sum(parts.js, 'gz') + parts.inlineJs,
      br: sum(parts.js, 'br'),
      files: parts.js.map((f) => f.url),
    },
    lazyJs: { n: lazy.length, raw: sum(lazy, 'raw'), gz: sum(lazy, 'gz'), files: lazy.map((f) => f.url) },
    fonts: { n: parts.fonts.length, raw: sum(parts.fonts, 'raw'), files: parts.fonts.map((f) => f.url) },
    images: { n: parts.images.length, raw: sum(parts.images, 'raw'), files: parts.images.map((f) => f.url) },
    transferGz: total('gz') + parts.inlineJs,
    transferBr: total('br'),
  };
});

const kb = (n) => (n / 1024).toFixed(1).padStart(7);
console.log('route'.padEnd(46), 'html.br  css.br   js.br  fonts  images  TOTAL.br  TOTAL.gz');
for (const r of routes)
  console.log(
    r.route.padEnd(46),
    kb(r.html.br),
    kb(r.css.br),
    kb(r.js.br),
    kb(r.fonts.raw),
    kb(r.images.raw),
    kb(r.transferBr),
    kb(r.transferGz),
  );
if (out) writeFileSync(out, JSON.stringify(routes, null, 2));

// Route budgets (`--check`), set from the measured Phase 16 build with about 15 to 20 percent headroom, so ordinary
// polish passes but a stray dependency, an unsubsetted font or an uncompressed image fails clearly.
//   homepage initial JS: 7.4 KB gz measured     full Bench JS (initial + every lazy channel): 26.3 KB gz
//   largest route CSS: 15.9 KB gz               preloaded fonts: 62 KB      homepage transfer: 104 KB br
//   case study transfer: 88 KB br               every other page: 87 KB br or less
if (process.argv.includes('--check')) {
  const KB = 1024;
  const BUDGET = {
    homeInitialJsGz: 9 * KB,
    homeFullBenchJsGz: 31 * KB,
    routeCssGz: 21.5 * KB, // Phase 20: case-study pages also carry the playable-flow styles (19.8 KB); home is 18.5 KB. Phase 21: 21 KB for the big-screen layout rules. Shimmering system headlines: 21.5 KB
    preloadedFontsRaw: 72 * KB,
    homeTransferBr: 122 * KB,
    caseStudyTransferBr: 105 * KB,
    otherTransferBr: 100 * KB,
  };
  const fails = [];
  const check = (what, value, limit) => {
    if (value > limit)
      fails.push(`${what}: ${(value / KB).toFixed(1)} KB over ${(limit / KB).toFixed(1)} KB`);
  };
  for (const r of routes) {
    check(`${r.route} CSS (gzip)`, r.css.gz, BUDGET.routeCssGz);
    check(`${r.route} preloaded fonts`, r.fonts.raw, BUDGET.preloadedFontsRaw);
    if (r.route === '/') {
      check('/ initial JS (gzip)', r.js.gz, BUDGET.homeInitialJsGz);
      check('/ full Bench JS (gzip)', r.js.gz + r.lazyJs.gz, BUDGET.homeFullBenchJsGz);
      check('/ transfer (brotli)', r.transferBr, BUDGET.homeTransferBr);
    } else if (r.route.startsWith('/work/') && r.route !== '/work/') {
      check(`${r.route} transfer (brotli)`, r.transferBr, BUDGET.caseStudyTransferBr);
    } else check(`${r.route} transfer (brotli)`, r.transferBr, BUDGET.otherTransferBr);
  }
  console.log(
    fails.length ? `\nROUTE BUDGETS EXCEEDED:\n  ${fails.join('\n  ')}` : '\nAll route budgets met.',
  );
  process.exit(fails.length ? 1 : 0);
}
