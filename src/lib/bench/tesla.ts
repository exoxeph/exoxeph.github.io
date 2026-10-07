export type Pool = { id: string; seats: number; status: 'OPEN' | 'COMPLETED'; riderCancelled: boolean };
export type State = { capacity: number; pools: Pool[]; nextLetter: number };
export type Decision =
  | { kind: 'invalid' }
  | { decision: 'refused'; code: 409; committed: number; seats: number }
  | { decision: 'accepted'; code: 200; before: number; after: number };

export const RECORDED_RUN = [
  { id: 'A', seats: 1, code: 200, committed: 1 },
  { id: 'B', seats: 2, code: 200, committed: 3 },
  { id: 'C', seats: 2, code: 409, committed: 3 },
] as const;

export const SIMULTANEOUS_REPLAY = {
  read: 1,
  requests: [
    { id: 'B', seats: 2, code: 200 },
    { id: 'C', seats: 2, code: 200 },
  ],
  final: 5,
} as const;

export const initialState = (): State => ({
  capacity: 3,
  pools: [
    { id: 'A', seats: 1, status: 'OPEN', riderCancelled: false },
    { id: 'B', seats: 2, status: 'OPEN', riderCancelled: false },
  ],
  nextLetter: 2,
});

export function committedSeats(state: State): number {
  return state.pools.reduce((sum, pool) => sum + (pool.status === 'OPEN' ? pool.seats : 0), 0);
}

export function evaluateAccept(state: State, seats: number, opts: { guard?: boolean } = {}): Decision {
  if (!Number.isInteger(seats) || seats < 1 || seats > 6) return { kind: 'invalid' };
  const before = committedSeats(state);
  if (opts.guard !== false && before + seats > state.capacity)
    return { decision: 'refused', code: 409, committed: before, seats };
  return { decision: 'accepted', code: 200, before, after: before + seats };
}

export function accept(state: State, seats: number, opts: { guard?: boolean } = {}): State {
  const result = evaluateAccept(state, seats, opts);
  if (!('decision' in result) || result.decision === 'refused' || state.nextLetter >= 26) return state;
  return {
    ...state,
    pools: [
      ...state.pools,
      { id: String.fromCharCode(65 + state.nextLetter), seats, status: 'OPEN', riderCancelled: false },
    ],
    nextLetter: state.nextLetter + 1,
  };
}

export function completePool(state: State, id: string): State {
  return {
    ...state,
    pools: state.pools.map((pool) => (pool.id === id ? { ...pool, status: 'COMPLETED' } : pool)),
  };
}

// A cancelled rider remains committed in this model until the whole pool completes.
export function cancelRider(state: State, id: string): State {
  return {
    ...state,
    pools: state.pools.map((pool) => (pool.id === id ? { ...pool, riderCancelled: true } : pool)),
  };
}
