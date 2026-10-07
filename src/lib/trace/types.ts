/** Shared trace types. Pure types only: safe to import in client code (no runtime cost). */
export type EvidenceState = 'verified' | 'partially-verified' | 'unverified';
export type Stage =
  'capability' | 'expected' | 'invalid' | 'control' | 'measurement' | 'outcome' | 'limitation';
export type StateKind = 'valid' | 'invalid' | 'rejected';

export const STAGES: readonly Stage[] = [
  'capability',
  'expected',
  'invalid',
  'control',
  'measurement',
  'outcome',
  'limitation',
];
export const STAGE_LABEL: Record<Stage, string> = {
  capability: 'Capability',
  expected: 'Expected behavior',
  invalid: 'Invalid state',
  control: 'Control',
  measurement: 'Measurement',
  outcome: 'Outcome',
  limitation: 'Limitation',
};

export interface RecordedRequest {
  label: string;
  seats: number;
  status: string;
  pool?: string | undefined;
}
export interface RecordedState {
  httpStatus?: number | undefined;
  httpMessage?: string | undefined;
  events: string[];
  requests: RecordedRequest[];
}

export type Visual =
  | {
      kind: 'state-gauge';
      capacity: number;
      cells: string[];
      pending?: { label: string; seats: number } | undefined;
      refused?: boolean | undefined;
    }
  | { kind: 'none' };

export interface TraceStateData {
  id: string;
  /** a variant id, or '*' when the state applies to every variant */
  variant: string;
  stages: Stage[];
  kind: StateKind;
  title: string;
  text: string;
  visual: Visual;
  record?: RecordedState | undefined;
}

export interface TraceData {
  project: string;
  title: string;
  summary: string;
  capability: string;
  expectedBehavior: string;
  trigger: string;
  control: string;
  measurement: string;
  outcome: string;
  limitation: string;
  verificationStatus: EvidenceState;
  evidence: { claim: string; state: EvidenceState; caveat?: string | undefined }[];
  provenance: {
    method: string;
    database: string;
    commits?: { before: string; after: string } | undefined;
    testName?: string | undefined;
  };
  variants: { id: string; label: string }[];
  states: TraceStateData[];
  alsoKnown?: { title: string; text: string; state: EvidenceState; caveat: string } | undefined;
}
