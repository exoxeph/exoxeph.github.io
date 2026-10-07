import { describe, expect, it } from 'vitest';
import pre from '../fixtures/tesla/trace-pre.json';
import fix from '../fixtures/tesla/trace-fix.json';
import simultaneous from '../fixtures/tesla/trace-fix-simultaneous.json';
import {
  accept,
  cancelRider,
  committedSeats,
  completePool,
  evaluateAccept,
  SIMULTANEOUS_REPLAY,
  type State,
} from '../../src/lib/bench/tesla';

const empty = (): State => ({ capacity: 3, pools: [], nextLetter: 0 });
describe('Tesla capacity model', () => {
  for (const [guard, fixture] of [
    [false, pre],
    [true, fix],
  ] as const) {
    it(`matches the ${guard ? 'guarded' : 'unguarded'} recorded run`, () => {
      let state = empty();
      for (const [i, seats] of [1, 2, 2].entries()) {
        const result = evaluateAccept(state, seats, { guard });
        const recorded = fixture.steps[i + 2]!;
        expect('code' in result && result.code).toBe(recorded.http?.status);
        state = accept(state, seats, { guard });
        expect(committedSeats(state)).toBe(recorded.pools.reduce((sum, pool) => sum + pool.seatsTaken, 0));
      }
    });
  }
  it('matches the simultaneous fixture', () => {
    const final = simultaneous.steps.at(-1)!;
    expect(SIMULTANEOUS_REPLAY.final).toBe(final.pools.reduce((sum, pool) => sum + pool.seatsTaken, 0));
    expect(SIMULTANEOUS_REPLAY.requests.map((request) => request.code)).toEqual(
      final.parallel?.map((request) => request.status),
    );
  });
  it('frees completed pools and keeps cancelled riders committed', () => {
    let state = accept(empty(), 2);
    state = cancelRider(state, 'A');
    expect(committedSeats(state)).toBe(2);
    state = completePool(state, 'A');
    expect(committedSeats(state)).toBe(0);
  });
  it('rejects invalid counts and increments letters', () => {
    for (const count of [-1, 0, 1.5, 7]) expect(evaluateAccept(empty(), count)).toEqual({ kind: 'invalid' });
    let state = accept(empty(), 1);
    state = accept(state, 1);
    expect(state.pools.map((pool) => pool.id)).toEqual(['A', 'B']);
  });
});
