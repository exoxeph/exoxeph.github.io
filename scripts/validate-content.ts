// Content lint. `npm run lint:content` (warnings allowed) and `npm run release:check` (placeholders and unconfirmed wording fail).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { lintAiAssistance, lintProjectSections, lintRelease, lintText } from '../src/lib/content/lint.ts';
import type { Issue } from '../src/lib/content/lint.ts';
import { site } from '../src/data/site.ts';

const release = process.argv.includes('--release');
const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function walk(dir: string, exts: string[]): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'fonts' ? [] : walk(p, exts);
    return exts.some((e) => p.endsWith(e)) ? [p] : [];
  });
}

const issues: Issue[] = [];
const rel = (p: string) => relative(root, p).replaceAll('\\', '/');
for (const f of walk(join(root, 'src'), ['.mdx', '.astro', '.ts', '.json', '.css'])) {
  const r = rel(f);
  const text = readFileSync(f, 'utf8');
  if (r.startsWith('src/lib/content/') || r === 'src/lib/bench/research-gate.ts') continue; // the rules contain the patterns they search for; the gate reads a build flag
  issues.push(...lintText(r, text, { checkEmail: r !== 'src/data/site.ts' }));
  if (r.startsWith('src/content/projects/') && r.endsWith('.mdx')) {
    issues.push(...lintProjectSections(r, text), ...lintAiAssistance(r, text, release));
  }
}
if (release) issues.push(...lintRelease(site));

const errors = issues.filter((i) => i.level === 'error');
for (const i of issues)
  console.log(`${i.level === 'error' ? 'ERROR' : 'warn '} ${i.file}:${i.line} ${i.message}`);
console.log(
  `\ncontent lint (${release ? 'release' : 'dev'}): ${errors.length} error(s), ${issues.length - errors.length} warning(s)`,
);
process.exit(errors.length ? 1 : 0);
