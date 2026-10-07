/** Optional deep-link state; step is 1-based in the URL. */
import type { MachineState } from './machine.ts';

export function parseUrlState(
  search: string,
  traceId: string,
): { variant?: string; step?: number; compare?: boolean } | null {
  const p = new URLSearchParams(search);
  if (p.get('trace') !== traceId) return null;
  const out: { variant?: string; step?: number; compare?: boolean } = {};
  const v = p.get('variant');
  if (v) out.variant = v;
  const s = Number(p.get('step'));
  if (Number.isInteger(s) && s >= 1) out.step = s - 1;
  if (p.get('compare') === '1') out.compare = true;
  return out;
}

export function toSearch(traceId: string, s: MachineState, compare = false): string {
  const p = new URLSearchParams({ trace: traceId, variant: s.variant, step: String(s.step + 1) });
  if (compare) p.set('compare', '1');
  return `?${p.toString()}`;
}
