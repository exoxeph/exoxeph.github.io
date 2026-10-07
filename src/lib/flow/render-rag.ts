import { h } from './dom';
import type { FlowStep } from './types';
import type { Ctx } from './render';
import { SCORE_PARTS } from './rag';

type Change = { label: string; from: string | number; to: string | number };
type V = {
  query: string;
  required: number;
  facts?: string[];
  mock?: boolean;
  compose?: boolean;
  meter?: { draft: number | null; after: number | null };
  decision?: 'accept' | 'repair';
  changes?: Change[];
  final?: { accepted: boolean };
};

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function meter(label: string, score: number | null, required: number, ok: boolean | null) {
  return h(
    'div',
    { class: 'fv-mrow' },
    h('span', { class: 'fv-mlabel', text: label }),
    h(
      'div',
      { class: 'st-meter' },
      h('i', {
        class: `st-fill ${score === null ? 'unknown' : ok ? 'ok' : 'low'}`,
        style: `--w:${score === null ? 58 : pct(score)}`,
      }),
      h('u', { class: 'st-req', style: `--at:${pct(required)}` }, h('b', { text: `required ${required}` })),
    ),
    h('span', { class: 'fv-mval', text: score === null ? 'not recorded' : String(score) }),
  );
}

export default function renderRag(host: HTMLElement, step: FlowStep, _ctx: Ctx) {
  const v = step.v as V;
  const cards: HTMLElement[] = [
    h(
      'div',
      { class: 'fv-card in' },
      h('p', { class: 'fv-k', text: 'The question' }),
      h('blockquote', { class: 'fv-quote', text: `\u201c${v.query}\u201d` }),
      v.mock
        ? h('p', { class: 'fv-meta', text: 'drafted by a mock generator: no answer text exists' })
        : null,
    ),
  ];
  if (v.facts)
    cards.push(
      h(
        'div',
        { class: 'fv-card in' },
        h('p', { class: 'fv-k', text: 'Settings this step uses' }),
        h('p', { class: 'fv-chips' }, ...v.facts.map((f) => h('span', { text: f }))),
      ),
    );
  if (v.compose)
    cards.push(
      h(
        'div',
        { class: 'fv-card fv-wide in' },
        h('p', { class: 'fv-k', text: 'What the score is made of (rule-based, 0 to 1)' }),
        h(
          'ul',
          { class: 'fv-parts' },
          ...SCORE_PARTS.map((p) =>
            h(
              'li',
              {},
              h('b', { text: p.k }),
              h('span', { class: 'fv-pw', text: `${p.w}%` }),
              h('u', { style: `--w:${p.w * 2.5}%` }),
              h('em', { text: p.what }),
            ),
          ),
        ),
        h('p', {
          class: 'fv-notgrounded',
          text: 'Not a grounding check: the verifier never compares the draft with the retrieved passages.',
        }),
      ),
    );
  if (v.meter) {
    const m = v.meter;
    const rows: HTMLElement[] = [];
    if (m.draft !== null || m.after === null)
      rows.push(meter('score', m.draft, v.required, m.draft === null ? null : m.draft >= v.required));
    if (m.after !== null) rows.push(meter('after repair', m.after, v.required, m.after >= v.required));
    cards.push(
      h(
        'div',
        { class: 'fv-card fv-wide in' },
        h('p', { class: 'fv-k', text: 'Score against the required score' }),
        ...rows,
      ),
    );
  }
  if (v.decision)
    cards.push(
      h(
        'div',
        { class: `fv-card in ${v.decision === 'accept' ? 'is-ok' : 'is-catch'}` },
        h('p', { class: 'fv-k', text: 'Decision' }),
        h('p', {
          class: 'fv-big',
          text: v.decision === 'accept' ? 'Accept: skip repair' : 'Below the line: repair once',
        }),
      ),
    );
  if (v.changes && step.stage === 'repair')
    cards.push(
      h(
        'div',
        { class: 'fv-card in' },
        h('p', { class: 'fv-k', text: 'What the repair changes' }),
        h(
          'ul',
          { class: 'fv-changes' },
          ...v.changes.map((c) =>
            h('li', {}, h('span', { text: c.label }), h('code', { text: `${c.from} \u2192 ${c.to}` })),
          ),
        ),
      ),
    );
  if (v.final)
    cards.push(
      h(
        'div',
        { class: `fv-card in ${v.final.accepted ? 'is-ok' : 'is-fail'}` },
        h('p', { class: 'fv-k', text: 'Returned to the caller' }),
        h('p', { class: 'fv-big', text: v.final.accepted ? 'accepted' : 'marked not accepted' }),
        v.final.accepted
          ? null
          : h('p', { class: 'fv-meta', text: 'Repair ran once and the score stayed below the line.' }),
      ),
    );
  host.replaceChildren(h('div', { class: 'fv-cards' }, ...cards));
}
