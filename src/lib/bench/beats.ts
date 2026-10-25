// The storybook pages of every project chapter. The stage keeps five canonical beats (0 to 4); the chapter tells the
// story in four of them, and the beat 1 page shows the beat 2 inspection picture beside its own.
export const BEATS = [0, 1, 3, 4] as const;
export const BEAT_NAMES: Record<number, string> = {
  0: 'It fails',
  1: 'How it catches it',
  3: 'It survives',
  4: 'The idea holds',
};
