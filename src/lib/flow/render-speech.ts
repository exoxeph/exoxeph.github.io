import { h } from './dom';
import type { FlowStep } from './types';
import type { Ctx } from './render';

type Part = { part: string; text: string; start: number; length: number };
type V = {
  line: string;
  parts: Part[];
  show: 'raw' | 'fields' | 'rule' | 'row' | 'result' | 'meaning';
  rule?: {
    matched: string | null;
    attempts: { id: string; label: string; example: string; state: string }[];
    valueText: string;
  };
  row?: { test: string; value: string; unit: string; range: string; flag: string } | null;
  kept?: boolean;
  meaning?: { report: string; read: string };
};
const ORDER = ['raw', 'fields', 'rule', 'row', 'result', 'meaning'];

export default function renderSpeech(host: HTMLElement, step: FlowStep, _ctx: Ctx) {
  const v = step.v as V;
  const at = ORDER.indexOf(v.show);
  const fieldsOn = at >= 1;
  // The raw line, with each field underlined once the parser has split it.
  const line = h('div', { class: 'fv-line', role: 'presentation' });
  let cursor = 0;
  const sorted = [...v.parts].sort((a, b) => a.start - b.start);
  for (const p of sorted) {
    if (p.start > cursor) line.append(v.line.slice(cursor, p.start));
    line.append(
      h('span', {
        class: `fv-tok${fieldsOn ? ' on' : ''}${p.part === 'value' && at >= 2 ? ' hot' : ''}`,
        'data-part': p.part,
        text: p.text,
      }),
    );
    cursor = p.start + p.length;
  }
  if (cursor < v.line.length) line.append(v.line.slice(cursor));

  const cards: HTMLElement[] = [
    h('div', { class: 'fv-card fv-wide in' }, h('p', { class: 'fv-k', text: 'The raw line' }), line),
  ];
  if (fieldsOn)
    cards.push(
      h(
        'div',
        { class: 'fv-card in' },
        h('p', { class: 'fv-k', text: 'Fields' }),
        h(
          'dl',
          { class: 'fv-fields' },
          ...v.parts.flatMap((p) => [h('dt', { text: p.part }), h('dd', { text: p.text })]),
        ),
      ),
    );
  if (v.rule && at >= 2)
    cards.push(
      h(
        'div',
        { class: `fv-card in ${v.rule.matched ? '' : 'is-catch'}` },
        h('p', { class: 'fv-k', text: `Is "${v.rule.valueText}" a known form?` }),
        h(
          'ul',
          { class: 'fv-attempts' },
          ...v.rule.attempts.map((a) =>
            h(
              'li',
              { class: `a-${a.state}` },
              h('i', {
                'aria-hidden': 'true',
                text: a.state === 'hit' ? '\u2713' : a.state === 'no' ? '\u2715' : '\u00b7',
              }),
              h('span', { text: a.label }),
              h('code', { text: `e.g. ${a.example}` }),
            ),
          ),
        ),
      ),
    );
  if (at >= 3)
    cards.push(
      v.row
        ? h(
            'div',
            { class: 'fv-card in is-ok' },
            h('p', { class: 'fv-k', text: 'Structured row' }),
            h(
              'dl',
              { class: 'fv-fields' },
              ...(['test', 'value', 'unit', 'range', 'flag'] as const).flatMap((k) => [
                h('dt', { text: k }),
                h('dd', { text: v.row![k] }),
              ]),
            ),
          )
        : h(
            'div',
            { class: 'fv-card in is-catch' },
            h('p', { class: 'fv-k', text: 'Structured row' }),
            h('p', { class: 'fv-big', text: 'none: omitted' }),
          ),
    );
  if (at >= 4)
    cards.push(
      h(
        'div',
        { class: `fv-card in ${v.kept ? 'is-ok' : 'is-catch'}` },
        h('p', { class: 'fv-k', text: 'Result' }),
        h('p', { class: 'fv-big', text: v.kept ? 'Row kept' : 'Row left out' }),
      ),
    );
  if (v.meaning)
    cards.push(
      h(
        'div',
        { class: 'fv-card fv-wide in is-fail' },
        h('p', { class: 'fv-k', text: 'Parse success is not correct meaning' }),
        h(
          'div',
          { class: 'fv-mismatch' },
          h('p', {}, h('span', { text: 'the report says' }), h('b', { text: v.meaning.report })),
          h('p', { class: 'bad' }, h('span', { text: 'the parser kept' }), h('b', { text: v.meaning.read })),
          h('p', { class: 'fv-big', text: 'Valid, structured and wrong. Nothing flags it.' }),
        ),
      ),
    );
  host.replaceChildren(h('div', { class: 'fv-cards' }, ...cards));
}
