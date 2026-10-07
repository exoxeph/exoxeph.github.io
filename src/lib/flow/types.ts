// Playable system flow: the data model shared by the four case studies. Everything is plain JSON so the server can
// render the full text version and the browser can play the same steps.

/** Where a step's facts come from. Never blurred: each step carries exactly one. */
export type Prov = 'executed' | 'recorded' | 'modelled';

export const PROV_LABEL: Record<Prov, string> = {
  executed: 'Runs in browser',
  recorded: 'Recorded project run',
  modelled: 'Modelled from the code',
};

export type Field = { k: string; v: string };

export type FlowStep = {
  /** Stage id from `FlowData.stages` (a stage can appear in more than one step). */
  stage: string;
  title: string;
  // The five questions Step mode answers.
  came: string;
  acted: string;
  decided: string;
  changed: string;
  next: string;
  prov: Prov;
  /** One restrained line saying exactly what is executed, recorded or modelled here. */
  provNote: string;
  /** Architecture node this step opens in the Inspector and the Architecture section. */
  node?: string;
  /** Extra Inspector rows for this step (implementation, evidence, limitation and so on). */
  extra?: Field[];
  tone?: 'ok' | 'catch' | 'fail' | 'neutral';
  /** The state the project's visual draws for this step. Cumulative, so rendering is stateless. */
  v: Record<string, unknown>;
};

export type FlowScenario = {
  id: string;
  label: string;
  blurb: string;
  /** Marks the scenario that carries the project's technical moment. */
  moment?: boolean;
  steps: FlowStep[];
};

export type FlowData = {
  kind: 'email' | 'rag' | 'speech' | 'pool';
  project: string;
  stages: { id: string; label: string }[];
  scenarios: FlowScenario[];
  /** Shown once, beneath the controls, in the restrained status line. */
  footnote: string;
};
