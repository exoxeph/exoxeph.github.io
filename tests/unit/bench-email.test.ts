import { describe, expect, it } from 'vitest';
import golden from '../fixtures/email/golden.json';
import scenarios from '../../src/data/bench/email-scenarios.json';
import { TONES, validateRequest } from '../../src/lib/bench/email';

describe('email validation port equals the original Python', () => {
  it('uses the repository tone values', () => {
    expect([...TONES]).toEqual(golden.tones);
  });
  it('matches every golden case exactly', () => {
    expect(golden.cases.length).toBeGreaterThanOrEqual(800);
    for (const [i, c] of golden.cases.entries()) {
      const out = validateRequest({ intent: c.intent, keyFacts: c.keyFacts, tone: c.tone });
      expect(out.valid, `case ${i}`).toBe(c.valid);
      if (!out.valid) expect(out.message, `case ${i}`).toBe(c.message);
    }
  });
});

describe('recorded scenarios', () => {
  it('holds ten scenarios and the documented outcomes', () => {
    const list = scenarios.scenarios;
    expect(list).toHaveLength(10);
    expect(list.filter((s) => s.expectedClarify).map((s) => s.id)).toEqual([3, 4, 7]);
    const misses = list.filter((s) => s.expectedClarify && s.recordedGated === 'email');
    expect(misses.map((s) => s.id)).toEqual([4]);
    const asked = list.filter((s) => s.expectedClarify && s.recordedGated === 'clarification');
    expect(asked).toHaveLength(2);
  });
  it('contains no email bodies or judge text', () => {
    expect(Object.keys(scenarios.scenarios[0]!).sort()).toEqual(
      [
        'expectedClarify',
        'id',
        'intent',
        'keyFacts',
        'name',
        'recordedBaseline',
        'recordedGated',
        'tone',
        'type',
      ].sort(),
    );
  });
});
