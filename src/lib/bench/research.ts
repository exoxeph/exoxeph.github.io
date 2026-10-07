// Synthetic illustration of weight interpolation, the public mechanics of the published baseline
// (Here's a Free Lunch: Sanitizing Backdoored Models with Model Merge, ACL 2024).
// The numbers are made up. This is not a model, not data, and not the group's work.
export const SUSPECT = [0.8, -0.3, 0.5, 0.1] as const;
export const CLEAN = [0.2, 0.4, -0.1, 0.3] as const;
export const NAMES = ['w1', 'w2', 'w3', 'w4'] as const;

/** (1 - alpha) * suspect + alpha * clean for the selected weights; unselected weights stay as the suspect's. */
export function merge(alpha: number, mask: readonly boolean[]): number[] {
  return SUSPECT.map((s, i) => (mask[i] ? (1 - alpha) * s + alpha * CLEAN[i]! : s));
}
export const fmt = (n: number) => (Math.abs(n) < 0.005 ? '0.00' : n.toFixed(2));
