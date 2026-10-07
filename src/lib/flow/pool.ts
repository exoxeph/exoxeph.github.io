// Ride pooling: an accept meets the capacity guard. The sequential states are the project's recorded test run (the
// same data as the Engineering Trace below). The capacity arithmetic runs here. The concurrent case is an observation
// under the project's database mock, and "what a stronger version needs" is a design note that is not in the project.
import trace from '../../data/traces/tesla-capacity.json';
import type { FlowData, FlowScenario, FlowStep } from './types';

const CAP = 3;
const conflict = trace.states.find((s) => s.variant === 'with-guard');
const HTTP_409 =
  conflict?.record?.httpMessage ??
  'This vehicle is already carrying too many committed seats across its current trips';

export const poolStages = [
  { id: 'request', label: 'Request' },
  { id: 'match', label: 'Pool matching' },
  { id: 'transition', label: 'State transition' },
  { id: 'guard', label: 'Capacity check' },
  { id: 'decide', label: 'Accept or refuse' },
  { id: 'event', label: 'Status event' },
  { id: 'fix', label: 'A stronger version' },
];

type Seat = [string, 'on' | 'ghost' | 'bad' | 'empty'];
const seats = (cells: Seat[]) => cells;
const A: Seat[] = [['A', 'on']];
const AB: Seat[] = [
  ['A', 'on'],
  ['B', 'on'],
  ['B', 'on'],
];

const recorded = (what: string) => ({
  prov: 'recorded' as const,
  provNote: `Recorded in the project's own test run: ${what}`,
});
const arithmetic = (committed: number, asked: number) => ({
  prov: 'executed' as const,
  provNote: `The guard's arithmetic, run in your browser: ${committed} + ${asked} ${committed + asked <= CAP ? '\u2264' : '>'} ${CAP}.`,
});

function sequential(kind: 'accept' | 'refuse'): FlowScenario {
  const ok = kind === 'accept';
  const asked = 2;
  const committed = ok ? 1 : 3;
  const who = ok ? 'B' : 'C';
  const before: Seat[] = ok ? A : AB;
  const after: Seat[] = ok ? AB : [...AB, ['C', 'ghost'], ['C', 'ghost']];
  const total = committed + asked;
  const steps: FlowStep[] = [
    {
      stage: 'request',
      title: `Request ${who} asks for 2 seats`,
      came: `A passenger request for ${asked} seats, with the vehicle at ${committed} of ${CAP} committed.`,
      acted: 'The passenger creates the request; the server computes an integer-paisa fare.',
      decided: 'Nothing yet.',
      changed: `${who} exists with status REQUESTED.`,
      next: 'A driver accepts it.',
      node: 'request',
      ...recorded(`request ${who}, ${asked} seats.`),
      v: { seats: seats(before), committed, asked, cap: CAP },
    },
    {
      stage: 'match',
      title: ok ? 'Pool matching: a new pool' : 'Pool matching',
      came: "The accepted request and the vehicle's current pools.",
      acted: 'Pool matching.',
      decided: 'Join an existing pool when the routes are compatible, or found a new one.',
      changed: ok
        ? 'In the recorded run, B ends up in Pool 2.'
        : 'In the recorded run, C is placed in a pool before the capacity check refuses it.',
      next: 'The status moves through the transition table.',
      node: 'pool-matching',
      ...recorded(`request ${who}'s pool.`),
      v: { seats: seats(before), committed, asked, cap: CAP },
    },
    {
      stage: 'transition',
      title: 'The conditional accept',
      came: "A driver's accept.",
      acted: 'The transition table and a conditional (compare-and-set) update.',
      decided: `Move ${who} from REQUESTED to MATCHED only if it is still REQUESTED.`,
      changed: 'The status can change, if the guard allows it.',
      next: "The capacity guard sums the vehicle's seats.",
      node: 'accept-update',
      prov: 'modelled',
      provNote: 'Described from the implementation: every status change goes through one transition table.',
      v: { seats: seats(before), committed, asked, cap: CAP },
    },
    {
      stage: 'guard',
      title: `The guard counts: ${committed} + ${asked} = ${total}`,
      came: `${committed} seats already committed across the vehicle's active pools, and ${asked} requested.`,
      acted: 'The capacity guard, inside the accept transaction.',
      decided: ok
        ? `${total} fits within ${CAP}, so the accept may proceed.`
        : `${total} is more than ${CAP}, so the accept is refused.`,
      changed: ok ? 'Nothing is blocked.' : 'The transaction rolls back.',
      next: ok ? 'The accept is written.' : 'A conflict is returned.',
      node: 'capacity-guard',
      tone: ok ? 'ok' : 'catch',
      ...arithmetic(committed, asked),
      v: { seats: seats(after), committed, asked, cap: CAP, check: { total, pass: ok } },
    },
    {
      stage: 'decide',
      title: ok ? 'Accepted: HTTP 200' : 'Refused: HTTP 409',
      came: "The guard's verdict.",
      acted: 'The accept endpoint.',
      decided: ok ? 'Commit the accept.' : 'Refuse the accept.',
      changed: ok
        ? `${who} is MATCHED. The vehicle is at ${total} of ${CAP}.`
        : `The car stays at ${CAP} of ${CAP}. The project\'s message reads: "${HTTP_409}". It refers to the accept that would exceed capacity.`,
      next: 'A status event is recorded.',
      node: 'accept-update',
      tone: ok ? 'ok' : 'catch',
      ...recorded(ok ? `request ${who} returned HTTP 200.` : `request ${who} returned HTTP 409.`),
      v: { seats: seats(ok ? AB : AB), committed: ok ? total : CAP, asked, cap: CAP, http: ok ? 200 : 409 },
    },
    {
      stage: 'event',
      title: ok ? 'Event: SUCCESS' : 'Event: CONFLICT, written after the rollback',
      came: 'The outcome of the accept.',
      acted: 'The status-event writer.',
      decided: 'Every transition leaves an audit event.',
      changed: ok
        ? 'A SUCCESS event is committed with the state change.'
        : 'A CONFLICT event is written after the rollback, so the refusal is audited.',
      next: 'End of the trace.',
      node: 'audit-events',
      tone: ok ? 'ok' : 'catch',
      ...recorded(ok ? 'events SUCCESS, SUCCESS.' : 'events SUCCESS, SUCCESS, CONFLICT.'),
      v: {
        seats: seats(ok ? AB : AB),
        committed: ok ? total : CAP,
        asked,
        cap: CAP,
        http: ok ? 200 : 409,
        events: ok ? ['SUCCESS', 'SUCCESS'] : ['SUCCESS', 'SUCCESS', 'CONFLICT'],
      },
    },
  ];
  return {
    id: ok ? 'accept' : 'refuse',
    label: ok ? 'Request B fits' : 'Request C is refused',
    blurb: ok ? 'A sequential accept, recorded.' : 'A sequential accept the guard refuses, recorded.',
    steps,
  };
}

function race(): FlowScenario {
  const lanes = (phase: number) => [
    { label: 'accept B', phase },
    { label: 'accept C', phase },
  ];
  const base = { cap: CAP, committed: 1, asked: 2 };
  const obs = {
    prov: 'recorded' as const,
    provNote:
      "Recorded: an observation under the project's in-memory database mock, consistent with the code's read-then-write structure. PostgreSQL was not run.",
  };
  const steps: FlowStep[] = [
    {
      stage: 'request',
      title: 'Two accepts at the same moment',
      came: 'A is already accepted (1 of 3). B and C each ask for 2 seats, and two drivers accept at the same time.',
      acted: 'Two accept requests run concurrently.',
      decided: 'Nothing yet.',
      changed: 'Two transactions are open at once.',
      next: "Each reads the vehicle's pools.",
      ...obs,
      v: { ...base, seats: seats(A), lanes: lanes(0) },
    },
    {
      stage: 'guard',
      title: 'Both read the pools, and both see 1 of 3',
      came: "Each accept's read of the vehicle's active pools.",
      acted: 'The capacity guard, in each transaction, reading before either has written.',
      decided: 'Each computes the committed seats from what it read: 1.',
      changed: "Neither transaction can see the other's pending change.",
      next: 'Each checks its own total.',
      node: 'capacity-guard',
      ...obs,
      v: { ...base, seats: seats(A), lanes: lanes(1) },
    },
    {
      stage: 'guard',
      title: 'Both pass: 1 + 2 = 3 each',
      came: '1 committed seat and 2 requested, in each transaction.',
      acted: "The guard's arithmetic, once per transaction.",
      decided: 'Each total, 3, fits within 3. Both pass.',
      changed: 'Both accepts are cleared to write.',
      next: 'Both write.',
      node: 'capacity-guard',
      tone: 'catch',
      prov: 'executed',
      provNote:
        "The guard's arithmetic, run in your browser: 1 + 2 \u2264 3, for each transaction separately.",
      v: { ...base, seats: seats(A), lanes: lanes(2), check: { total: 3, pass: true, both: true } },
    },
    {
      stage: 'decide',
      title: 'Both write: HTTP 200 twice',
      came: 'Two cleared accepts.',
      acted: 'The accept endpoint, twice.',
      decided: 'Each commits.',
      changed: 'B and C are both MATCHED.',
      next: 'The vehicle is over capacity.',
      node: 'accept-update',
      tone: 'fail',
      ...obs,
      v: {
        ...base,
        seats: seats([...A, ['B', 'on'], ['B', 'on'], ['C', 'bad'], ['C', 'bad']]),
        lanes: lanes(3),
        http: 200,
      },
    },
    {
      stage: 'event',
      title: '5 of 3: the boundary is crossed',
      came: 'The committed seats after both writes.',
      acted: 'Nothing: no component notices.',
      decided: 'None. The guard ran twice and passed twice.',
      changed: 'Five seats are committed on a three-seat vehicle, and both responses said 200.',
      next: 'What would prevent this?',
      node: 'capacity-guard',
      tone: 'fail',
      extra: [
        {
          k: 'Failure mode',
          v: 'The guard reads, sums, then writes. Two transactions can read before either writes, so each check passes against a stale total.',
        },
        {
          k: 'Caveat',
          v: "Observed under the mock's interleaving. Real PostgreSQL behavior was not run, so the exact interleaving there is unverified.",
        },
      ],
      ...obs,
      v: {
        ...base,
        seats: seats([...A, ['B', 'on'], ['B', 'on'], ['C', 'bad'], ['C', 'bad']]),
        lanes: lanes(4),
        http: 200,
        over: 5,
      },
    },
    {
      stage: 'fix',
      title: 'A design note, not implemented: what a stronger version would need',
      came: 'The failure above.',
      acted: 'A design change that is not in the project.',
      decided:
        'Make check-and-claim one indivisible step: serialize accepts per vehicle (lock the vehicle row or use a serializable transaction), or claim seats with a single conditional update on a committed-seat counter.',
      changed: "The second accept would see the first one's seats, or wait, and then be refused with a 409.",
      next: 'Then test it against a real PostgreSQL with true concurrency, not a mock.',
      tone: 'neutral',
      prov: 'modelled',
      provNote:
        'A design note, not an implementation: nothing here is in the repository and nothing here was run.',
      v: { ...base, seats: seats(A), lanes: lanes(4), fix: true },
    },
  ];
  return {
    id: 'race',
    label: 'Two accepts at once',
    blurb: 'The documented limit: both pass the guard.',
    moment: true,
    steps,
  };
}

export function buildPoolFlow(): FlowData {
  return {
    kind: 'pool',
    project: 'ride-pooling-lifecycle',
    stages: poolStages,
    scenarios: [sequential('accept'), sequential('refuse'), race()],
    footnote:
      'The sequential states are recorded from the project test run. The capacity arithmetic runs in your browser. The concurrent case is an observation under a database mock; the stronger version is a design note, not part of the project.',
  };
}
