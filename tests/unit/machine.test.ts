import { describe, expect, it } from 'vitest';
import {
  current,
  defaultVariant,
  initialState,
  lastStep,
  reduce,
  sequenceFor,
} from '../../src/lib/trace/machine.ts';
import type { TraceData } from '../../src/lib/trace/types.ts';
import raw from '../../src/data/traces/tesla-capacity.json';

const trace = raw as unknown as TraceData;

describe('trace machine', () => {
  it('starts at step 0 of the default variant', () => {
    const s = initialState(trace);
    expect(s).toEqual({ variant: 'with-guard', step: 0 });
    expect(current(trace, s).id).toBe('start');
  });

  it('plays shared states first, then the variant states', () => {
    expect(sequenceFor(trace, 'with-guard').map((x) => x.id)).toEqual([
      'start',
      'a-accepted',
      'b-accepted',
      'c-guarded',
    ]);
    expect(sequenceFor(trace, 'without-guard').map((x) => x.id)).toEqual([
      'start',
      'a-accepted',
      'b-accepted',
      'c-unguarded',
    ]);
  });

  it('next and prev clamp at both ends', () => {
    let s = initialState(trace);
    s = reduce(trace, s, { type: 'prev' });
    expect(s.step).toBe(0);
    for (let i = 0; i < 10; i++) s = reduce(trace, s, { type: 'next' });
    expect(s.step).toBe(lastStep(trace, s.variant));
    expect(current(trace, s).kind).toBe('rejected');
  });

  it('reset returns to step 0 and keeps the variant', () => {
    let s = initialState(trace, 'without-guard', 3);
    expect(current(trace, s).kind).toBe('invalid');
    s = reduce(trace, s, { type: 'reset' });
    expect(s).toEqual({ variant: 'without-guard', step: 0 });
  });

  it('switching variant keeps the position and shows the other outcome', () => {
    let s = initialState(trace, 'with-guard', 3);
    s = reduce(trace, s, { type: 'setVariant', variant: 'without-guard' });
    expect(s.step).toBe(3);
    expect(current(trace, s).id).toBe('c-unguarded');
  });

  it('ignores unknown variants and invalid steps', () => {
    const s = initialState(trace, 'with-guard', 2);
    expect(reduce(trace, s, { type: 'setVariant', variant: 'nope' })).toBe(s);
    expect(initialState(trace, 'nope', 99)).toEqual({
      variant: defaultVariant(trace),
      step: lastStep(trace, defaultVariant(trace)),
    });
    expect(reduce(trace, s, { type: 'goto', step: Number.NaN }).step).toBe(0);
  });

  it('is deterministic: the same actions give the same state', () => {
    const run = () =>
      ['next', 'next', 'prev', 'next', 'next'].reduce(
        (st, a) => reduce(trace, st, { type: a as 'next' | 'prev' }),
        initialState(trace),
      );
    expect(run()).toEqual(run());
  });
});
