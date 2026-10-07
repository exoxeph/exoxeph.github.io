import { h } from './dom';
import type { FlowStep } from './types';
import type { Ctx } from './render';

type Rule = { label: string; ok: boolean };
type V = {
  intent: string;
  facts: string[];
  tone: string;
  validation?: { valid: boolean; problems: string[]; rules: Rule[] };
  checker?: 'asks' | 'enough';
  outcome?: 'clarify' | 'write' | 'stopped';
  evalr?: {
    expected: string;
    recorded: string;
    match: boolean;
    judged: { baseline: number; gated: number } | null;
  };
};

const mark = (ok: boolean) =>
  h('i', { class: ok ? 'ok' : 'no', 'aria-hidden': 'true' }, ok ? '\u2713' : '\u2715');

export function renderEmail(host: HTMLElement, step: FlowStep, _ctx: Ctx) {
  const v = step.v as V;
  const req = h(
    'div',
    { class: 'fv-card fv-req in' },
    h('p', { class: 'fv-k', text: 'The request' }),
    h('blockquote', { class: 'fv-quote', text: `\u201c${v.intent}\u201d` }),
    v.facts.length
      ? h('ul', { class: 'fv-facts' }, ...v.facts.map((f) => h('li', { text: f })))
      : h('p', { class: 'fv-none', text: 'No facts given.' }),
    h('p', { class: 'fv-meta', text: `tone: ${v.tone}` }),
  );

  const cards: HTMLElement[] = [req];
  if (v.validation) {
    cards.push(
      h(
        'div',
        { class: `fv-card in ${v.validation.valid ? 'is-ok' : 'is-fail'}` },
        h('p', { class: 'fv-k', text: 'Validation, in code' }),
        h(
          'ul',
          { class: 'fv-rules' },
          ...v.validation.rules.map((r) => h('li', { class: r.ok ? 'ok' : 'no' }, mark(r.ok), r.label)),
        ),
        v.validation.valid ? null : h('p', { class: 'fv-mono', text: v.validation.problems.join('; ') }),
      ),
    );
  }
  if (v.checker) {
    cards.push(
      h(
        'div',
        { class: `fv-card in ${v.checker === 'asks' ? 'is-catch' : step.tone === 'fail' ? 'is-fail' : ''}` },
        h('p', { class: 'fv-k', text: 'Is there enough to write from?' }),
        h('p', {
          class: 'fv-big',
          text: v.checker === 'asks' ? 'No: ask first' : 'Yes: go ahead',
        }),
        h('p', { class: 'fv-meta', text: 'judged by a model (recorded)' }),
      ),
    );
  }
  if (v.outcome) {
    cards.push(
      h(
        'div',
        { class: `fv-card in ${v.outcome === 'write' ? '' : 'is-catch'}` },
        h('p', { class: 'fv-k', text: 'What the pipeline did' }),
        h('p', {
          class: 'fv-big',
          text:
            v.outcome === 'clarify'
              ? 'Returned a question. No email.'
              : v.outcome === 'stopped'
                ? 'Stopped. No model called.'
                : 'Wrote the email',
        }),
      ),
    );
  }
  if (v.evalr) {
    const e = v.evalr;
    const bars = e.judged
      ? h(
          'div',
          { class: 'fv-bars' },
          ...[
            ['single prompt', e.judged.baseline],
            ['checked pipeline', e.judged.gated],
          ].map(([label, n]) =>
            h(
              'div',
              {},
              h('span', { text: `${label} \u00b7 ${n} of 5` }),
              h('u', { style: `--w:${((n as number) / 5) * 100}%` }),
            ),
          ),
        )
      : null;
    cards.push(
      h(
        'div',
        { class: `fv-card in ${e.match ? 'is-ok' : 'is-fail'}` },
        h('p', { class: 'fv-k', text: 'Expected vs recorded' }),
        h(
          'p',
          { class: 'fv-cmp' },
          h('span', { text: `expected: ${e.expected}` }),
          h('span', { text: `recorded: ${e.recorded}` }),
        ),
        h('p', { class: 'fv-big', text: e.match ? 'Match' : 'Miss' }),
        bars,
      ),
    );
  }
  host.replaceChildren(h('div', { class: 'fv-cards' }, ...cards));
}
