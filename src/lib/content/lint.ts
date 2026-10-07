/** Pure content lint rules. Used by scripts/validate-content.ts and unit-tested. No Astro imports. */
export interface Issue {
  level: 'error' | 'warn';
  file: string;
  line: number;
  message: string;
}

const DASHES = /[\u2013\u2014]/; // en and em dash: not used on this site
const BANNED: { re: RegExp; why: string }[] = [
  { re: /production[- ](grade|ready)/i, why: 'unverified qualifier "production-grade/ready"' },
  { re: /state[- ]of[- ]the[- ]art/i, why: 'unverified qualifier "state-of-the-art"' },
  { re: /\bscalable\b/i, why: 'unverified qualifier "scalable"' },
  {
    re: /\b\d+(\.\d+)?\s?[x\u00d7]\b(?!\s*\d)/i,
    why: 'multiplier claim such as "400x" (state it only as a not-claimed item, in words)',
  },
  { re: /\b(TODO|FIXME|lorem ipsum|XXX)\b/i, why: 'unfinished marker' },
  { re: /auditRef|\baudit\/|C:\\Users|G:\\|\.env\b/i, why: 'looks like an internal or private reference' },
  {
    re: /[\w.+-]+@[\w-]+\.[\w.-]+/,
    why: 'email address literal (contact details live in src/data/site.ts only)',
  },
];

export const REQUIRED_PROJECT_SECTIONS = [
  'problem',
  'built',
  'contribution',
  'architecture',
  'decisions',
  'evaluation',
  'results',
  'limitations',
  'repository',
] as const;

export function lintText(file: string, text: string, opts: { checkEmail?: boolean } = {}): Issue[] {
  const out: Issue[] = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (DASHES.test(line))
      out.push({
        level: 'error',
        file,
        line: i + 1,
        message: 'en or em dash found; use a comma, colon or period',
      });
    for (const b of BANNED) {
      if (b.re.source.includes('@') && opts.checkEmail === false) continue;
      if (b.re.test(line)) out.push({ level: 'error', file, line: i + 1, message: b.why });
    }
  });
  return out;
}

export function lintProjectSections(file: string, text: string): Issue[] {
  const out: Issue[] = [];
  for (const id of REQUIRED_PROJECT_SECTIONS) {
    if (!new RegExp(`<Section[^>]*\\bid="${id}"`).test(text))
      out.push({ level: 'error', file, line: 1, message: `missing required section "${id}"` });
  }
  return out;
}

export function lintAiAssistance(file: string, text: string, release: boolean): Issue[] {
  const has = /^\s*aiAssistance:/m.test(text);
  const confirmed = /^\s*aiAssistanceConfirmed:\s*true\b/m.test(text);
  if (has && !confirmed)
    return [
      {
        level: release ? 'error' : 'warn',
        file,
        line: 1,
        message: 'AI-assistance wording is not confirmed by the owner (aiAssistanceConfirmed: false)',
      },
    ];
  return [];
}

export interface SiteLike {
  links: { github: string; linkedin: string | null; email: string | null };
  resume: { available: boolean };
}
export function lintRelease(site: SiteLike): Issue[] {
  const f = 'src/data/site.ts';
  const out: Issue[] = [];
  if (!site.links.email)
    out.push({ level: 'error', file: f, line: 1, message: 'contact email is a placeholder (not approved)' });
  if (!site.links.linkedin)
    out.push({ level: 'error', file: f, line: 1, message: 'LinkedIn URL is a placeholder' });
  if (!site.resume.available)
    out.push({
      level: 'warn',
      file: f,
      line: 1,
      message: 'resume is not published (privacy review pending)',
    });
  return out;
}
