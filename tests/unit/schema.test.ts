import { describe, expect, it } from 'vitest';
import { traceSchema } from '../../src/lib/trace/schema.ts';
import raw from '../../src/data/traces/tesla-capacity.json';

const clone = () => structuredClone(raw) as Record<string, any>;

describe('trace schema', () => {
  it('accepts the production Tesla Pool trace', () => {
    const r = traceSchema.safeParse(raw);
    expect(r.success).toBe(true);
  });

  it('rejects a state that references an unknown variant', () => {
    const t = clone();
    t.states[3].variant = 'ghost';
    const r = traceSchema.safeParse(t);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('unknown variant');
  });

  it('rejects duplicate state ids', () => {
    const t = clone();
    t.states[1].id = t.states[0].id;
    expect(traceSchema.safeParse(t).success).toBe(false);
  });

  it('rejects a verification status stronger than the weakest evidence', () => {
    const t = clone();
    t.verificationStatus = 'verified';
    const r = traceSchema.safeParse(t);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('stronger than the weakest');
  });

  it('rejects a missing limitation and an unknown stage', () => {
    const a = clone();
    delete a.limitation;
    expect(traceSchema.safeParse(a).success).toBe(false);
    const b = clone();
    b.states[0].stages = ['wow'];
    expect(traceSchema.safeParse(b).success).toBe(false);
  });

  it('rejects a variant with fewer than two playable states', () => {
    const t = clone();
    t.states = t.states.filter(
      (s: any) => s.variant !== 'without-guard' && s.id !== 'a-accepted' && s.id !== 'b-accepted',
    );
    t.states = t.states.slice(0, 2);
    expect(traceSchema.safeParse(t).success).toBe(false);
  });
});
