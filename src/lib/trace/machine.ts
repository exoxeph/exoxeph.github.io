/** Pure, deterministic trace state machine. No DOM, no globals. Unit-tested. */
import type { TraceData, TraceStateData } from './types.ts';

export interface MachineState {
  variant: string;
  step: number;
}
export type Action =
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'reset' }
  | { type: 'goto'; step: number }
  | { type: 'setVariant'; variant: string };

/** States that play for a variant, in authored order. */
export function sequenceFor(trace: TraceData, variant: string): TraceStateData[] {
  return trace.states.filter((s) => s.variant === '*' || s.variant === variant);
}

export function defaultVariant(trace: TraceData): string {
  return trace.variants[0]?.id ?? '';
}

export function isVariant(trace: TraceData, id: string): boolean {
  return trace.variants.some((v) => v.id === id);
}

export function lastStep(trace: TraceData, variant: string): number {
  return Math.max(0, sequenceFor(trace, variant).length - 1);
}

export function initialState(trace: TraceData, variant?: string, step = 0): MachineState {
  const v = variant !== undefined && isVariant(trace, variant) ? variant : defaultVariant(trace);
  return { variant: v, step: clamp(step, 0, lastStep(trace, v)) };
}

export function reduce(trace: TraceData, s: MachineState, a: Action): MachineState {
  switch (a.type) {
    case 'next':
      return { ...s, step: clamp(s.step + 1, 0, lastStep(trace, s.variant)) };
    case 'prev':
      return { ...s, step: clamp(s.step - 1, 0, lastStep(trace, s.variant)) };
    case 'reset':
      return { ...s, step: 0 };
    case 'goto':
      return { ...s, step: clamp(a.step, 0, lastStep(trace, s.variant)) };
    case 'setVariant':
      if (!isVariant(trace, a.variant)) return s;
      // keep the same position when it exists in the other variant, otherwise clamp
      return { variant: a.variant, step: clamp(s.step, 0, lastStep(trace, a.variant)) };
  }
}

export function current(trace: TraceData, s: MachineState): TraceStateData {
  const seq = sequenceFor(trace, s.variant);
  return seq[clamp(s.step, 0, seq.length - 1)] as TraceStateData;
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.trunc(n)));
}
