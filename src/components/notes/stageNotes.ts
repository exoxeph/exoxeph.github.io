// Hand-drawn notes. Stage and deck notes are anchored: `to` is a selector for the real element inside the
// stage or frame, `at` is the point on it, and dx/dy move the note away from that point. The arrow is drawn from
// the note to the element's current position, so it stays correct as the stage changes.
export type NoteData = {
  t: string;
  // anchored mode
  to?: string;
  at?: 'tl' | 'tc' | 'tr' | 'ml' | 'c' | 'mr' | 'bl' | 'bc' | 'br';
  dx?: number;
  dy?: number;
  tx?: number;
  ty?: number;
  text?: boolean;
  // fixed mode
  x?: string;
  y?: string;
  dir?: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
  len?: number;
  r?: number;
  w?: string;
  cls?: string;
};

const inspect: NoteData = {
  t: 'see how it decides',
  to: 'button.header-inspect',
  at: 'ml',
  dx: -112,
  dy: 2,
  r: -2,
  w: '130px',
};

export const stageNotes: Record<string, NoteData[]> = {
  pool: [
    inspect,
    { t: 'the pools already in the car', to: '[data-pool]', at: 'tc', dx: -20, dy: -58, r: -3, w: '150px' },
    { t: 'the wall: 3 seats, no more', to: '[data-guard]', at: 'ml', dx: -112, dy: -8, r: 2, w: '130px' },
    { t: "the guard's answer", to: 'g.readout .word', at: 'tc', dx: 62, dy: -50, r: -2, w: '130px' },
    { t: 'press to send the request', to: '[data-send]', at: 'mr', dx: 82, dy: 6, r: 2, w: '115px' },
    { t: 'drag to change the seats', to: '[data-handle]', at: 'ml', dx: -90, dy: 40, r: -2, w: '120px' },
  ],
  email: [
    inspect,
    {
      t: 'pick a recorded request',
      to: 'select[data-email-scenario]',
      at: 'ml',
      dx: -120,
      dy: -6,
      r: -2,
      w: '130px',
    },
    { t: 'add a fact or remove one', to: 'button.email-add', at: 'mr', dx: 112, dy: 0, r: 2, w: '120px' },
    { t: 'code checks the rules first', to: 'button.email-gate', at: 'bc', dx: 0, dy: 42, r: -2, w: '120px' },
    {
      t: 'a model decides here (recorded, not live)',
      to: '[data-email-checker]',
      at: 'bc',
      dx: 0,
      dy: 66,
      r: 2,
      w: '170px',
    },
    {
      t: 'the result of the check',
      to: '[data-email-word]',
      at: 'mr',
      dx: 96,
      dy: 0,
      text: true,
      r: 2,
      w: '120px',
    },
  ],
  rag: [
    inspect,
    { t: 'pick a recorded query', to: '.rag-chips', at: 'ml', dx: -112, dy: -4, r: -2, w: '120px' },

    {
      t: "drag the bar to change the draft's score",
      to: 'g.rag-needle.draft',
      at: 'tc',
      dx: -92,
      dy: -66,
      r: -2,
      w: '170px',
    },
    {
      t: 'required quality: 0.72',
      to: 'g[data-rag-slider]:not(.draft)',
      at: 'mr',
      dx: 90,
      dy: -16,
      r: 2,
      w: '110px',
    },
  ],
  speech: [
    inspect,
    { t: 'load a real OCR line', to: '.speech-presets', at: 'tl', dx: 96, dy: -34, r: -2, w: '150px' },
    {
      t: 'edit this line, it re-reads',
      to: '.speech-scroll',
      at: 'br',
      tx: -150,
      dx: 40,
      dy: 34,
      r: 2,
      w: '175px',
    },
    {
      t: "the parser's guess per column",
      to: 'button.speech-bracket-button',
      at: 'bc',
      dx: 190,
      dy: 46,
      r: -2,
      w: '230px',
    },
    {
      t: 'this row is left out, not guessed',
      to: '.speech-tr.omitted',
      at: 'mr',
      dx: 96,
      dy: 40,
      r: 2,
      w: '140px',
    },
  ],
};

export const deckNotes: Record<string, NoteData> = {
  'pool-0': {
    t: 'the catch is below',
    to: '.story-pool .story-head',
    at: 'mr',
    dx: 120,
    dy: 0,
    text: true,
    r: -2,
    w: '200px',
  },
  'pool-1': {
    t: 'no room for 2 more',
    to: '.sbar-seg.bad',
    at: 'tc',
    dx: 90,
    dy: -34,
    r: -2,
    w: '150px',
  },
  'pool-2': {
    t: 'it adds up the whole car',
    to: '.d-outcomes li:last-child .out',
    at: 'ml',
    dx: -110,
    dy: -34,
    r: 2,
    w: '150px',
  },
  'pool-3': {
    t: 'no guard: 5 in a 3-seat car!',
    to: '.sbar-seg.bad',
    at: 'tc',
    dx: 110,
    dy: -30,
    r: 2,
    w: '150px',
  },
  'pool-4': {
    t: 'both looked, both said ok',
    to: '.d-race p:first-child i:nth-of-type(2)',
    at: 'tc',
    dx: 120,
    dy: -34,
    r: 2,
    w: '150px',
  },
  'email-0': {
    t: 'the bottom row shows what changed',
    to: '.story-email .story-head',
    at: 'mr',
    dx: 120,
    dy: 0,
    text: true,
    r: -2,
    w: '200px',
  },
  'email-1': {
    t: 'this rule fails: no facts',
    to: '.d-rules li.fail .mono',
    at: 'mr',
    dx: 100,
    dy: -18,
    text: true,
    r: 2,
    w: '140px',
  },
  'email-2': {
    t: 'the model picks the branch',
    to: '.d-fork-out.take',
    at: 'tr',
    dx: 150,
    dy: -44,
    r: 2,
    w: '170px',
  },
  'email-3': {
    t: 'the hatched one is a miss',
    to: '.d-tally li.miss i',
    at: 'tc',
    dx: 190,
    dy: -44,
    r: 2,
    w: '150px',
  },
  'email-4': {
    t: 'the one documented miss',
    to: '.d-anatomy dd.bad',
    at: 'ml',
    tx: 200,
    dx: 120,
    dy: 0,
    r: 2,
    w: '140px',
  },
  'rag-0': {
    t: 'last row: did the retry work?',
    to: '.story-rag .story-head',
    at: 'mr',
    dx: 120,
    dy: 0,
    text: true,
    r: -2,
    w: '200px',
  },
  'rag-1': {
    t: 'below the line means try again',
    to: '.d-axis-q',
    at: 'tc',
    dx: -120,
    dy: -26,
    r: -2,
    w: '150px',
  },
  'rag-2': {
    t: 'one more attempt, once',
    to: '.d-loop',
    at: 'mr',
    dx: 96,
    dy: 0,
    text: true,
    r: 2,
    w: '140px',
  },
  'rag-3': {
    t: 'bar = score, blue tick = threshold',
    to: '.d-runs .meter u',
    at: 'tc',
    dx: 210,
    dy: -34,
    r: 2,
    w: '170px',
  },
  'rag-4': {
    t: 'still short after repair',
    to: '.d-axis-q.hatch:nth-of-type(3)',
    at: 'ml',
    dx: -120,
    dy: 16,
    r: -2,
    w: '130px',
  },
  'speech-0': {
    t: 'the catch is below',
    to: '.story-speech .story-head',
    at: 'mr',
    dx: 120,
    dy: 0,
    text: true,
    r: -2,
    w: '200px',
  },
  'speech-1': {
    t: 'boxed: the value column',
    to: '.d-cells dd.hot',
    at: 'bc',
    dx: 160,
    dy: 28,
    r: 2,
    w: '150px',
  },
  'speech-2': {
    t: 'no known form, so: omitted',
    to: '.d-cells dd.hot',
    at: 'bc',
    dx: 200,
    dy: 20,
    r: 2,
    w: '170px',
  },
  'speech-3': {
    t: 'one caught, one slipped by',
    to: '.out.kept',
    at: 'ml',
    dx: -130,
    dy: 0,
    r: -2,
    w: '150px',
  },
  'speech-4': {
    t: 'wrong but valid: it passes',
    to: '.d-cells dd.hot',
    at: 'mr',
    dx: 130,
    dy: 0,
    r: 2,
    w: '170px',
  },
};
// Under-diagram slots on the case-study pages: each note points up at one element, by its horizontal position.
const under = (t: string, at: number, r = 0, w = 112): NoteData => ({
  t,
  x: `max(0px, calc(${at}% - ${w / 2}px))`,
  y: '16px',
  dir: 'n',
  r,
  w: `${w}px`,
});
export const mechNotes: Record<string, NoteData[]> = {
  email: [
    under('what was asked', 8, -2),
    under('the rule check', 34, 2),
    under('the model writes', 63, -2),
    under('scored later, off the path', 88, 2, 100),
  ],
  rag: [
    under('picks the steps', 9, 2),
    under('finds the sources', 39, -2),
    under('scores the draft', 63, 2),
    under('returned either way', 90, -2, 100),
  ],
  speech: [
    under('audio or a photo', 14, -2),
    under('reads each value', 45, 2),
    under('rows that survive', 79, -2),
  ],
  pool: [
    under('seats already taken', 12, -2),
    under('the capacity line', 37, 2),
    under('the new request', 80, -2),
  ],
};
export const diagramNotes: Record<string, NoteData[]> = {
  email: [
    under('the ask-first branch', 34, 2),
    under('the model writes', 67, -2),
    under('scored later', 87, 2, 90),
  ],
  rag: [
    under('repair loops back once', 38, -2, 130),
    under('scores the draft', 63, 2),
    under('the answer', 90, -2, 90),
  ],
  speech: [
    under('audio or a photo', 18, -2),
    under('the parser', 45, 2, 90),
    under('a bad row is left out', 84, -2, 120),
  ],
  pool: [
    under('seats already taken', 12, -2),
    under('the capacity line', 37, 2),
    under('the new request', 82, -2),
  ],
};
