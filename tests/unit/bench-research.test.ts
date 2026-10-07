import { describe, expect, it } from 'vitest';
import { CLEAN, SUSPECT, fmt, merge } from '../../src/lib/bench/research';

describe('synthetic interpolation', () => {
  it('is the suspect at 0 and the clean at 1 for merged weights', () => {
    expect(merge(0, [true, true, true, true])).toEqual([...SUSPECT]);
    expect(merge(1, [true, true, true, true])).toEqual([...CLEAN]);
  });
  it('leaves unselected weights as the suspect values', () => {
    const out = merge(1, [true, false, true, false]);
    expect(out[1]).toBe(SUSPECT[1]);
    expect(out[3]).toBe(SUSPECT[3]);
    expect(out[0]).toBe(CLEAN[0]);
  });
  it('blends linearly', () => {
    expect(merge(0.5, [true, true, true, true]).map(fmt)).toEqual(['0.50', '0.05', '0.20', '0.20']);
  });
});
