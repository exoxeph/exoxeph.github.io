import { describe, expect, it } from 'vitest';
import { parseUrlState, toSearch } from '../../src/lib/trace/url-state.ts';

describe('trace url state', () => {
  it('round-trips variant and 1-based step', () => {
    const search = toSearch('t1', { variant: 'without-guard', step: 3 });
    expect(search).toBe('?trace=t1&variant=without-guard&step=4');
    expect(parseUrlState(search, 't1')).toEqual({ variant: 'without-guard', step: 3 });
  });
  it('ignores other traces and malformed steps', () => {
    expect(parseUrlState('?trace=other&step=2', 't1')).toBeNull();
    expect(parseUrlState('?trace=t1&step=abc', 't1')).toEqual({});
    expect(parseUrlState('?trace=t1&step=0', 't1')).toEqual({});
  });
  it('round-trips compare without changing the default URL', () => {
    const state = { variant: 'without-guard', step: 3 };
    const search = toSearch('tesla-capacity', state, true);
    expect(search).toBe('?trace=tesla-capacity&variant=without-guard&step=4&compare=1');
    expect(parseUrlState(search, 'tesla-capacity')).toEqual({ ...state, compare: true });
    expect(parseUrlState(toSearch('tesla-capacity', state), 'tesla-capacity')).toEqual(state);
  });
});
