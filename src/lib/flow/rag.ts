// Retrieval with verify and repair: a question passes the quality gate. The accept-or-repair comparison is the ported
// router logic (runs here). The pipeline stages are described from the implementation, and the scores are the committed
// evaluation runs'. The drafts came from a mock generator, so no answer text exists and none is shown.
import { DEFAULT_CONFIG, route } from '../bench/rag';
import { recorded } from '../bench/rag-stage';
import type { FlowData, FlowScenario, FlowStep } from './types';

const cfg = DEFAULT_CONFIG;
const REQ = cfg.acceptThreshold;

/** The verifier's weights, from rag_papers/generation/verifier.py (ResponseVerifier.verify_response). */
export const SCORE_PARTS = [
  { k: 'Length', w: 20, what: 'the draft is neither too short nor too long' },
  { k: 'Relevance', w: 30, what: "the share of the question's words that appear in the draft" },
  { k: 'Coherence', w: 25, what: 'sentence-structure heuristics' },
  { k: 'Completeness', w: 15, what: 'heuristics such as the draft not ending abruptly' },
  { k: 'Repetition', w: 10, what: 'the draft does not repeat itself' },
];

export const ragStages = [
  { id: 'question', label: 'Question' },
  { id: 'plan', label: 'Plan' },
  { id: 'retrieve', label: 'Retrieve' },
  { id: 'rerank', label: 'Rerank' },
  { id: 'prune', label: 'Prune and contextualize' },
  { id: 'draft', label: 'Draft' },
  { id: 'verify', label: 'Quality score' },
  { id: 'decide', label: 'Pass or repair' },
  { id: 'repair', label: 'Repair' },
  { id: 'final', label: 'Final state' },
];

const MEASURES =
  "A rule-based answer-quality score from 0 to 1 (higher is better): length, how many of the question's words the draft uses, sentence structure, completeness and repetition.";
const NOT =
  'It is not proof that the answer is grounded in the retrieved sources. The verifier is handed the context but does not use it, and it cannot tell whether a claim is true.';
const mod = (note: string) => ({ prov: 'modelled' as const, provNote: note });

function build(row: (typeof recorded)[number]): FlowScenario {
  const repaired = row.repaired;
  const { accepted, score } = row;
  const base = { query: row.query, required: REQ };
  const s: FlowStep[] = [
    {
      stage: 'question',
      title: 'A question arrives',
      came: `"${row.query}"`,
      acted: 'The API hands the question to the retrieval pipeline.',
      decided: 'Nothing yet.',
      changed: 'The question becomes the pipeline input.',
      next: 'A query plan is chosen from its intent.',
      prov: 'recorded',
      provNote: `Query ${row.id} of the committed evaluation set (20 queries, eight recorded runs).`,
      v: { ...base },
    },
    {
      stage: 'plan',
      title: 'A plan is chosen',
      came: 'The question.',
      acted: 'The query planner.',
      decided: "A plan is chosen from the question's intent, then executed step by step.",
      changed: 'The pipeline now has an ordered list of steps to run.',
      next: 'Hybrid retrieval finds candidate passages.',
      node: 'plan',
      ...mod('Described from the implementation. Which plan ran for this query was not recorded.'),
      v: { ...base },
    },
    {
      stage: 'retrieve',
      title: 'Hybrid retrieval',
      came: 'The question and the plan.',
      acted: 'Two indexes behind an ensemble retriever: BM25 and an in-memory embedding store.',
      decided: `Weight the two equally the first time (BM25 ${cfg.bm25WeightInit}, vectors ${cfg.vectorWeightInit}) and take the top ${cfg.topKFirst}.`,
      changed: `Up to ${cfg.topKFirst} candidate passages (the actual count for this query was not recorded).`,
      next: 'The candidates are reranked.',
      node: 'retrieve',
      ...mod('Described from the implementation and its default configuration.'),
      v: {
        ...base,
        facts: [`BM25 ${cfg.bm25WeightInit}`, `vectors ${cfg.vectorWeightInit}`, `top ${cfg.topKFirst}`],
      },
    },
    {
      stage: 'rerank',
      title: 'Rerank',
      came: 'The candidate passages.',
      acted:
        'A deterministic re-sort by the retrieval score. It is not a second relevance signal or a learned reranker.',
      decided: `Keep the best ${cfg.rerankTopK}.`,
      changed: `Up to ${cfg.rerankTopK} passages, best first.`,
      next: 'Irrelevant sentences are pruned and the context is built.',
      ...mod('Described from the implementation.'),
      v: { ...base, facts: [`keep ${cfg.rerankTopK}`] },
    },
    {
      stage: 'prune',
      title: 'Prune and build the context',
      came: 'The reranked passages.',
      acted: 'A sentence-level prune, then context construction.',
      decided: `Drop sentences that share fewer than ${cfg.pruneMinOverlap} word with the question (a lexical overlap test, not a relevance judgment); cap the context.`,
      changed: `A context of at most ${cfg.contextMaxChars} characters.`,
      next: 'A draft answer is generated.',
      node: 'prune',
      ...mod('Described from the implementation and its default configuration.'),
      v: {
        ...base,
        facts: [
          `overlap ${cfg.pruneMinOverlap}`,
          `prune \u2264 ${cfg.pruneMaxChars}`,
          `context \u2264 ${cfg.contextMaxChars}`,
        ],
      },
    },
    {
      stage: 'draft',
      title: 'A draft is written',
      came: 'The question and the context.',
      acted: `The generator, at temperature ${cfg.temperatureInit}.`,
      decided: 'None. It writes.',
      changed:
        'A draft answer exists. The committed runs used a mock generator and do not include answer text, so none is shown.',
      next: 'The draft is scored.',
      prov: 'recorded',
      provNote:
        'Recorded: the committed runs use a mock generator, so scores describe the harness, not answer quality.',
      tone: 'neutral',
      v: { ...base, mock: true },
    },
    {
      stage: 'verify',
      title: 'What the quality score is made of',
      came: 'The draft and the question.',
      acted: 'The verifier, a rule-based scorer.',
      decided: `The draft must score at least ${REQ} to be accepted.`,
      changed: 'Nothing yet: this step shows the formula, not a result.',
      next: 'The score is computed.',
      node: 'accept-threshold',
      extra: [
        { k: 'What it measures', v: MEASURES },
        { k: 'What it does not measure', v: NOT },
        {
          k: 'Score weights',
          v:
            SCORE_PARTS.map((p) => `${p.k} ${p.w}%`).join(', ') +
            '. Per-query values for each part were not recorded.',
        },
        {
          k: 'Where it lives',
          v: 'rag_papers/generation/verifier.py, ResponseVerifier.verify_response; threshold in Stage4Config.accept_threshold (default 0.72).',
        },
      ],
      ...mod("From the verifier's code. The five parts of the score were not recorded per query."),
      v: { ...base, compose: true },
    },
  ];
  if (!repaired) {
    const r = route(score);
    s.push(
      {
        stage: 'verify',
        title: `The score: ${score}`,
        came: 'The draft.',
        acted: 'The verifier.',
        decided: `The draft scored ${score}.`,
        changed: 'The pipeline has a number to compare with the requirement.',
        next: 'The pass-or-repair rule compares it with the required score.',
        node: 'accept-threshold',
        prov: 'recorded',
        provNote: 'The recorded final score for this query in the committed runs.',
        v: { ...base, meter: { draft: score, after: null } },
      },
      {
        stage: 'decide',
        title: score === REQ ? 'Exactly on the line: accepted' : 'At or above the line: accepted',
        came: `A score of ${score} and a required score of ${REQ}.`,
        acted: 'The acceptance rule (the ported router logic).',
        decided: `${score} is ${score === REQ ? 'equal to' : 'above'} ${REQ}, so the answer is accepted and repair is skipped${score === REQ ? '. The comparison is inclusive: a score equal to the threshold passes' : ''}.`,
        changed: `Route: ${r.kind}. No repair runs.`,
        next: 'The answer is returned.',
        node: 'accept-threshold',
        tone: 'ok',
        prov: 'executed',
        provNote: 'This comparison runs in your browser, in the same function the route map uses.',
        v: { ...base, meter: { draft: score, after: null }, decision: r.kind },
      },
      {
        stage: 'final',
        title: 'Returned: accepted',
        came: 'An accepted draft.',
        acted: 'The API.',
        decided: 'None.',
        changed: 'The answer goes back to the caller as accepted.',
        next: 'End of the run.',
        tone: 'ok',
        prov: 'recorded',
        provNote: 'Recorded: this query was accepted without repair.',
        v: { ...base, meter: { draft: score, after: null }, decision: r.kind, final: { accepted: true } },
      },
    );
  } else {
    const changes = route(0).changes;
    s.push(
      {
        stage: 'verify',
        title: 'The first draft is scored',
        came: 'The first draft.',
        acted: 'The verifier.',
        decided: `The first draft fell below ${REQ}: the run recorded that repair ran, which only happens below the threshold.`,
        changed: 'The first draft is not good enough.',
        next: 'The pass-or-repair rule routes the run to repair.',
        node: 'accept-threshold',
        prov: 'recorded',
        provNote:
          "Recorded: repair ran. The first draft's actual score was not recorded, so it is not shown.",
        v: { ...base, meter: { draft: null, after: null } },
      },
      {
        stage: 'decide',
        title: 'Below the line: repair',
        came: `A first draft below ${REQ}.`,
        acted: 'The acceptance rule.',
        decided: 'Below the required score, and one repair attempt is allowed, so repair runs.',
        changed: 'Route: repair. This is the only repair the run gets (maximum 1).',
        next: 'The repair step tightens the settings and runs again.',
        node: 'accept-threshold',
        tone: 'catch',
        prov: 'recorded',
        provNote:
          'Recorded: this query took the repair route. The comparison itself is shown at the final step.',
        v: { ...base, meter: { draft: null, after: null }, decision: 'repair' },
      },
      {
        stage: 'repair',
        title: 'One bounded repair attempt',
        came: 'The question and the failed draft.',
        acted:
          'The repair step: retrieve again with tighter settings, prune harder, regenerate with a constrained template.',
        decided: 'Change five settings, once. There is no retry loop.',
        changed: changes.map((c) => `${c.label} ${c.from} to ${c.to}`).join('; ') + '.',
        next: 'The new draft is scored again.',
        node: 'repair-step',
        extra: [
          {
            k: 'Failure mode',
            v: 'After the single attempt the answer can still be below the threshold and is then returned as not accepted.',
          },
        ],
        ...mod('The settings are the router configuration. What the new draft contained was not recorded.'),
        v: { ...base, meter: { draft: null, after: null }, decision: 'repair', changes },
      },
      {
        stage: 'verify',
        title: `The second score: ${score}`,
        came: 'The repaired draft.',
        acted: 'The verifier again.',
        decided: `The repaired draft scored ${score}.`,
        changed: 'A recorded score exists for the final draft.',
        next: 'The final comparison.',
        node: 'accept-threshold',
        prov: 'recorded',
        provNote: 'The recorded final score after repair, for this query.',
        v: { ...base, meter: { draft: null, after: score }, decision: 'repair', changes },
      },
      {
        stage: 'final',
        title: accepted ? 'Returned: accepted after repair' : 'Returned: marked not accepted',
        came: `A final score of ${score} against ${REQ}.`,
        acted: 'The acceptance rule, run on the final score.',
        decided: accepted
          ? `${score} is at or above ${REQ}, so the repaired answer is accepted.`
          : `${score} is below ${REQ}. Repair is not repeated, so the answer is returned marked not accepted.`,
        changed: accepted
          ? 'Accepted after one repair.'
          : 'The pipeline returns the answer with an accepted flag of false.',
        next: 'End of the run. Repair controlled the workflow; it did not guarantee quality.',
        tone: accepted ? 'ok' : 'fail',
        extra: [
          {
            k: 'The lesson',
            v: 'Bounded repair controls workflow behavior. The verifier is a heuristic, not a grounding check, so a pass or a fail says little about whether the answer is right.',
          },
        ],
        prov: 'executed',
        provNote: 'The final comparison runs in your browser on the recorded final score.',
        v: {
          ...base,
          meter: { draft: null, after: score },
          decision: 'repair',
          changes,
          final: { accepted: score >= REQ },
        },
      },
    );
  }
  return {
    id: row.id,
    label: !repaired
      ? score === REQ
        ? 'Exactly at the line'
        : 'Passes first time'
      : accepted
        ? 'Repaired and accepted'
        : `Repaired, still below (${row.id})`,
    blurb: !repaired ? `Recorded score ${score}.` : `Repair ran; recorded final score ${score}.`,
    moment: row.id === 'q3',
    steps: s,
  };
}

export function buildRagFlow(): FlowData {
  const by = (id: string) => recorded.find((r) => r.id === id)!;
  return {
    kind: 'rag',
    project: 'retrieval-orchestration',
    stages: ragStages,
    scenarios: [build(by('q3')), build(by('q1')), build(by('q5'))],
    footnote:
      'The pass-or-repair comparison runs in your browser. Scores and routes are recorded from the committed runs, which used a mock generator. The score is a rule-based heuristic, not a check against the sources.',
  };
}
