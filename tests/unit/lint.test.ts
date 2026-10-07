import { describe, expect, it } from 'vitest';
import { lintAiAssistance, lintProjectSections, lintRelease, lintText } from '../../src/lib/content/lint.ts';

describe('content lint', () => {
  it('flags dashes, banned qualifiers, multipliers and unfinished markers', () => {
    const bad = [
      'a \u2014 b',
      'It is production-grade.',
      'a 400x speedup',
      'TODO write this',
      'see audit/notes',
    ].join('\n');
    expect(lintText('x.mdx', bad).length).toBe(5);
  });
  it('allows the same idea stated in words', () => {
    expect(lintText('x.mdx', 'The README states a 400 times speedup, so it is not claimed.')).toEqual([]);
  });
  it('does not treat OCR scientific notation as a speedup claim', () => {
    expect(lintText('x.ts', 'Cell Count 1.2 x 1043')).toEqual([]);
    expect(lintText('x.ts', 'Cell Count 1.2 x 10^3')).toEqual([]);
  });
  it('flags an email literal in content', () => {
    expect(lintText('x.mdx', 'write to a.b@example.com').length).toBe(1);
  });
  it('requires the core project sections', () => {
    expect(
      lintProjectSections('p.mdx', '<Section id="problem" title="Problem">x</Section>').length,
    ).toBeGreaterThan(5);
  });
  it('warns on unconfirmed AI wording in dev and fails in release', () => {
    const t = 'contribution:\n  aiAssistance: text\n  aiAssistanceConfirmed: false\n';
    expect(lintAiAssistance('p.mdx', t, false)[0]?.level).toBe('warn');
    expect(lintAiAssistance('p.mdx', t, true)[0]?.level).toBe('error');
    expect(lintAiAssistance('p.mdx', t.replace('false', 'true'), true)).toEqual([]);
  });
  it('release check fails on contact placeholders', () => {
    const issues = lintRelease({
      links: { github: 'g', linkedin: null, email: null },
      resume: { available: false },
    });
    expect(issues.filter((i) => i.level === 'error').length).toBe(2);
  });
});
