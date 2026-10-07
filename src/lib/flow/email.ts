// Email assistant: a request travels through the pipeline. Validation runs here (the ported validator, checked against
// the Python in tests). The input checker, the branch and generation are recorded outcomes of the project's own run:
// the model is never called in this page and the generated text was not kept, so none is shown.
import data from '../../data/bench/email-scenarios.json';
import { validateRequest, type EmailInput } from '../bench/email';
import type { FlowData, FlowScenario, FlowStep } from './types';

type Row = (typeof data.scenarios)[number];

// Committed judge scores for two scenarios (one run, scored by a model that was not recorded). They come from the
// project's recorded results, as written in the case study's evidence section.
const judged: Record<number, { baseline: number; gated: number }> = {
  3: { baseline: 2.33, gated: 5.0 },
  4: { baseline: 2.0, gated: 2.33 },
};

export const emailStages = [
  { id: 'request', label: 'Request' },
  { id: 'validate', label: 'Validation' },
  { id: 'checker', label: 'Input checker' },
  { id: 'branch', label: 'Clarify or generate' },
  { id: 'generate', label: 'Generation' },
  { id: 'evaluate', label: 'Evaluation' },
];

function rules(input: EmailInput) {
  const v = validateRequest(input);
  const problems = v.valid ? [] : v.problems;
  const has = (needle: RegExp) => problems.some((p) => needle.test(p));
  return {
    valid: v.valid,
    problems,
    rules: [
      { label: 'it says what the email is for', ok: !has(/intent|at least 1 character/i) },
      { label: 'it gives at least one fact', ok: !has(/List should|key_facts/i) },
      { label: 'the tone is one the pipeline knows', ok: !has(/^Input should be/) },
    ],
  };
}

const prov = {
  validate:
    'The ported validator runs on this request in your browser. Its messages are tested against the original Python.',
  checker:
    "A model call decided this. It is not run in this page. The checker's own output was not saved, so this decision is read from the recorded outcome (it asked, or it wrote). Why it decided so is not known.",
};

function build(row: Row, kind: 'good' | 'miss' | 'clear'): FlowScenario {
  const input: EmailInput = { intent: row.intent, keyFacts: [...row.keyFacts], tone: row.tone };
  const val = rules(input);
  const asked = row.recordedGated === 'clarification';
  const j = judged[row.id];
  const base = { intent: input.intent, facts: input.keyFacts, tone: input.tone };
  const steps: FlowStep[] = [
    {
      stage: 'request',
      title: 'A request arrives',
      came: `A request: "${row.intent}", with ${row.keyFacts.length} fact${row.keyFacts.length === 1 ? '' : 's'} and a ${row.tone} tone.`,
      acted: 'The request enters the pipeline.',
      decided: 'Nothing yet. No model has been called.',
      changed: 'The request is now the pipeline input.',
      next: 'Validation checks the request in code.',
      prov: 'recorded',
      provNote: `Scenario ${row.id} of the project's ten committed scenarios.`,
      v: { ...base },
    },
    {
      stage: 'validate',
      title: 'Validation, in code',
      came: 'The request fields: intent, key facts, tone.',
      acted: 'Request validation (a typed schema plus a non-empty check), before any model is called.',
      decided: val.valid
        ? 'The request has the basics, so it may go on.'
        : `The request is rejected: ${val.problems.join('; ')}.`,
      changed: val.valid
        ? 'Nothing. The request passes unchanged.'
        : 'The pipeline stops. No model is called.',
      next: 'The input checker (a model) judges whether there is enough to write from.',
      prov: 'executed',
      provNote: prov.validate,
      node: 'code-validation',
      tone: val.valid ? 'ok' : 'fail',
      v: { ...base, validation: val },
    },
    {
      stage: 'checker',
      title: 'The input checker judges',
      came: 'The validated request.',
      acted: 'The input checker, a model call that decides whether there is enough usable information.',
      decided: asked
        ? 'Not enough to write from, so clarification is needed.'
        : 'Enough to write from, so generation can go ahead.',
      changed: asked ? 'The status becomes "clarification".' : 'The request goes through as clean input.',
      next: asked
        ? 'The pipeline returns a question and writes no email.'
        : 'The pipeline generates the email.',
      prov: 'recorded',
      provNote: prov.checker,
      node: 'input-checker',
      tone: asked ? 'catch' : kind === 'miss' ? 'fail' : 'neutral',
      v: { ...base, validation: val, checker: asked ? 'asks' : 'enough' },
    },
    {
      stage: 'branch',
      title: asked ? 'Clarify: no email is written' : 'Generate: the email is written',
      came: asked ? 'A "clarification" status.' : 'Clean input and a "go ahead" status.',
      acted: 'The clarify or generate branch.',
      decided: asked ? 'Return a question and stop.' : 'Continue to the generator.',
      changed: asked
        ? 'No email is produced. The clarification text was not kept in the record.'
        : 'The generator is called.',
      next: asked
        ? 'The evaluation compares this outcome with what was expected.'
        : 'The email is generated.',
      prov: 'recorded',
      provNote: 'Recorded outcome of the project run. The branch runs inside the pipeline, not in this page.',
      node: 'clarify-or-generate',
      tone: asked ? 'catch' : 'neutral',
      v: {
        ...base,
        validation: val,
        checker: asked ? 'asks' : 'enough',
        outcome: asked ? 'clarify' : 'write',
      },
    },
  ];
  if (!asked)
    steps.push({
      stage: 'generate',
      title: 'Generation',
      came: 'Clean input from the checker.',
      acted: 'The generator, a model call.',
      decided: 'None. It writes.',
      changed: 'An email is produced. The recorded run did not keep its text, so none is shown.',
      next: 'The evaluation scores it against what was expected.',
      prov: 'recorded',
      provNote: 'Recorded: the run produced an email. The text was not saved.',
      tone: kind === 'miss' ? 'fail' : 'neutral',
      v: { ...base, validation: val, checker: 'enough', outcome: 'write' },
    });
  const match = asked === row.expectedClarify;
  steps.push({
    stage: 'evaluate',
    title: match ? 'Evaluation: as expected' : 'Evaluation: a recorded miss',
    came: `The outcome (${asked ? 'asked first' : 'wrote the email'}) and the scenario's expected behavior (${row.expectedClarify ? 'ask first' : 'write the email'}).`,
    acted:
      'The offline evaluation runner. It is not part of the live pipeline: it scores both strategies on the ten scenarios afterwards.',
    decided: match
      ? 'The outcome matches what was expected.'
      : 'The outcome does not match: this request should have triggered clarification.',
    changed: j
      ? `Recorded judge scores out of 5: a single prompt ${j.baseline}, the checked pipeline ${j.gated}.`
      : 'No per-scenario judge score is quoted here.',
    next: 'End of the run. Reset to replay, or inspect any step.',
    prov: 'recorded',
    provNote: 'Recorded. One run, ten scenarios, scored by a model whose identity was not recorded.',
    node: 'evaluation-runner',
    extra: [
      {
        k: 'Limitation',
        v: 'Ten scenarios and one run. The checker is a model and in one recorded scenario it did not ask when it should have.',
      },
    ],
    tone: match ? 'ok' : 'fail',
    v: {
      ...base,
      validation: val,
      checker: asked ? 'asks' : 'enough',
      outcome: asked ? 'clarify' : 'write',
      evalr: {
        expected: row.expectedClarify ? 'ask first' : 'write',
        recorded: asked ? 'ask first' : 'write',
        match,
        judged: j ?? null,
      },
    },
  });
  return {
    id: `s${row.id}`,
    label:
      kind === 'good'
        ? 'Vague request: asks first'
        : kind === 'miss'
          ? 'Recorded miss'
          : 'Clear request: writes',
    blurb:
      kind === 'good'
        ? 'The checker holds the request back and asks.'
        : kind === 'miss'
          ? 'The checker should have asked, and did not.'
          : 'Enough information, so the pipeline writes.',
    moment: kind === 'miss',
    steps,
  };
}

/** The same request with every fact removed: validation stops it, with no model call. Runs entirely in the browser. */
function stopped(row: Row): FlowScenario {
  const input: EmailInput = { intent: row.intent, keyFacts: [], tone: row.tone };
  const val = rules(input);
  const base = { intent: input.intent, facts: [] as string[], tone: input.tone };
  return {
    id: 'stop',
    label: 'Validation stops it',
    blurb: 'Scenario 3 with every fact removed. Runs here.',
    steps: [
      {
        stage: 'request',
        title: 'The same request, with no facts',
        came: `"${row.intent}", with the key facts removed.`,
        acted: 'You (this is an edit of scenario 3, not a recorded scenario).',
        decided: 'Nothing yet.',
        changed: 'The request has no facts.',
        next: 'Validation checks it in code.',
        prov: 'executed',
        provNote: 'Built in your browser from scenario 3 by removing its facts.',
        v: { ...base },
      },
      {
        stage: 'validate',
        title: 'Validation rejects it',
        came: 'A request with an empty fact list.',
        acted: 'Request validation, in code.',
        decided: `Rejected: ${val.problems.join('; ')}.`,
        changed: 'The pipeline stops here. No model is called.',
        next: 'Nothing: the input checker is never reached.',
        prov: 'executed',
        provNote: prov.validate,
        node: 'code-validation',
        tone: 'fail',
        v: { ...base, validation: val, outcome: 'stopped' },
      },
    ],
  };
}

export function buildEmailFlow(): FlowData {
  const by = (id: number) => data.scenarios.find((s) => s.id === id)!;
  return {
    kind: 'email',
    project: 'llm-email-pipeline',
    stages: emailStages,
    scenarios: [build(by(3), 'good'), build(by(4), 'miss'), build(by(1), 'clear'), stopped(by(3))],
    footnote:
      'Validation runs in your browser. The input checker, branch, generation and evaluation are recorded outcomes: no model is called here.',
  };
}
