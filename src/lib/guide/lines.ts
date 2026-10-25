// What the guide does at each stop of the homepage bench: where he stands (feet, as a fraction of the window's
// height, in the left margin beside the pinned diagram), the gesture he makes, and what he says. The bench has four
// projects and five beats each; the storybook reads four of them (0 it fails, 1 how it catches it, 3 it survives,
// 4 the idea holds), so beat 2 is a silent gesture. The lines repeat what the page already says about each project,
// including its limits, and nothing more.
export type Pose = 'point' | 'talk' | 'think' | 'wow' | 'cheer' | 'hold';

export interface Stop {
  /** Where he stands: the left or right margin, or a fraction of the window's width for a spot out on the page. */
  x: 'L' | 'R' | number;
  /** The height of his feet, as a fraction of the window's height. */
  y: number;
  pose: Pose;
  /** Not every stop has a line: some are only a gesture. */
  say?: string;
  /** An aside he adds if the visitor stays on this beat for a while. */
  aside?: string;
}

export const stops: Record<string, Stop[]> = {
  pool: [
    {
      x: 0.6,
      y: 0.42,
      pose: 'point',
      say: 'A car has 3 seats. Each request looks fine on its own.',
      aside: 'Drag the seats on the diagram. It is a live test.',
    },
    { x: 'R', y: 0.5, pose: 'think', say: 'My call: count seats for the car, not for each group.' },
    { x: 'L', y: 0.64, pose: 'talk' },
    { x: 0.62, y: 0.56, pose: 'cheer' },
    {
      x: 'R',
      y: 0.3,
      pose: 'wow',
      say: 'Two requests at the same moment can both pass. I have not fixed that yet.',
    },
  ],
  email: [
    {
      x: 'L',
      y: 0.36,
      pose: 'point',
      say: 'When should an AI not start writing at all?',
      aside: 'Change the request and watch what the check does.',
    },
    { x: 0.62, y: 0.46, pose: 'talk' },
    { x: 'R', y: 0.62, pose: 'think' },
    { x: 'L', y: 0.8, pose: 'cheer', say: 'Ten scenarios, one recorded run. It asks before it writes.' },
    {
      x: 0.4,
      y: 0.92,
      pose: 'wow',
      say: 'One vague request still got an email. The checker is a model too.',
    },
  ],
  rag: [
    {
      x: 'R',
      y: 0.36,
      pose: 'point',
      say: 'A first draft can be short, drift off, or stop mid thought.',
      aside: 'Pick a prompt chip and watch the score move.',
    },
    { x: 0.58, y: 0.4, pose: 'think', say: 'My call: never return the first draft unchecked.' },
    { x: 'L', y: 0.6, pose: 'talk' },
    {
      x: 'R',
      y: 0.75,
      pose: 'hold',
      say: 'Honest result: both repairs still fell short. The drafts come from a mock generator.',
    },
    { x: 'L', y: 0.45, pose: 'think' },
  ],
  speech: [
    {
      x: 0.6,
      y: 0.4,
      pose: 'wow',
      say: 'A misread lab value can still look like a perfectly good number.',
      aside: 'Try the presets and compare what it keeps.',
    },
    { x: 'R', y: 0.6, pose: 'talk' },
    { x: 'L', y: 0.35, pose: 'think' },
    { x: 0.52, y: 0.58, pose: 'wow', say: 'Look. It read <8.5 in place of <0.5, and nothing flagged it.' },
    {
      x: 'R',
      y: 0.45,
      pose: 'hold',
      say: 'There is no confidence measure, so this is the case it cannot catch.',
    },
  ],
};

/** At the foot of the page he walks over to the résumé card and points at it. */
export const footer = {
  say: 'That is the tour. The résumé has the rest, right here.',
  aside: 'Or say hello on the contact page.',
};
