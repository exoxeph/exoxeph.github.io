import { h } from './dom';
import type { FlowStep } from './types';
import type { Ctx } from './render';

type V = {
  seats: [string, 'on' | 'ghost' | 'bad' | 'empty'][];
  committed: number;
  asked: number;
  cap: number;
  check?: { total: number; pass: boolean; both?: boolean };
  lanes?: { label: string; phase: number }[];
  http?: number;
  events?: string[];
  over?: number;
  fix?: boolean;
};
const PHASES = ['accept starts', 'read the pools', 'pass the guard', 'write', 'done'];

export default function renderPool(host: HTMLElement, step: FlowStep, _ctx: Ctx) {
  const v = step.v as V;
  // Capacity seats: the car has `cap` seats; anything beyond is drawn past the capacity line.
  const empties = Math.max(0, v.cap - v.seats.filter(([, k]) => k === 'on').length);
  const row: [string, string][] = [
    ...v.seats.filter(([, k]) => k !== 'bad' && k !== 'ghost'),
    ...Array.from({ length: empties }, () => ['', 'empty'] as [string, string]),
  ];
  const withinCap = row.slice(0, v.cap);
  const beyond = [...row.slice(v.cap), ...v.seats.filter(([, k]) => k === 'bad' || k === 'ghost')];
  const seatRow = h(
    'div',
    { class: 'seats fv-seats' },
    ...withinCap.map(([l, k]) => h('i', { class: `seat ${k === 'empty' ? '' : 'on'}`, text: l })),
    ...beyond.map(([l, k]) => h('i', { class: `seat ${k}`, text: l })),
  );
  const cards: HTMLElement[] = [
    h(
      'div',
      { class: 'fv-card fv-wide in' },
      h('p', { class: 'fv-k', text: `The vehicle: ${v.cap} seats` }),
      seatRow,
      v.over ? h('p', { class: 'fv-big no', text: `${v.over} of ${v.cap} seats` }) : null,
    ),
  ];
  if (v.check)
    cards.push(
      h(
        'div',
        { class: `fv-card in ${v.check.pass ? 'is-ok' : 'is-catch'}` },
        h('p', { class: 'fv-k', text: v.check.both ? 'The guard, once in each transaction' : 'The guard' }),
        h('p', {
          class: 'fv-big',
          text: `${v.committed} + ${v.asked} ${v.check.pass ? '\u2264' : '>'} ${v.cap}`,
        }),
        h('p', {
          class: 'fv-meta',
          text: v.check.pass ? (v.check.both ? 'both pass' : 'passes') : 'refused',
        }),
      ),
    );
  if (v.http)
    cards.push(
      h(
        'div',
        { class: `fv-card in ${v.http === 200 ? 'is-ok' : 'is-catch'}` },
        h('p', { class: 'fv-k', text: 'Response' }),
        h('p', { class: 'fv-big', text: v.http === 200 ? 'HTTP 200' : 'HTTP 409' }),
      ),
    );
  if (v.events)
    cards.push(
      h(
        'div',
        { class: 'fv-card in' },
        h('p', { class: 'fv-k', text: 'Audit events so far' }),
        h('p', { class: 'fv-chips' }, ...v.events.map((e) => h('span', { text: e }))),
      ),
    );
  if (v.lanes)
    cards.push(
      h(
        'div',
        { class: 'fv-card fv-wide in' },
        h('p', { class: 'fv-k', text: 'Two accepts over time' }),
        h(
          'div',
          { class: 'fv-lanes' },
          ...v.lanes.map((l) =>
            h(
              'div',
              { class: 'fv-lane' },
              h('b', { text: l.label }),
              ...PHASES.slice(1, 4).map((p, i) =>
                h('span', {
                  class: `ph${l.phase >= i + 1 ? ' on' : ''}${l.phase === i + 1 ? ' now' : ''}`,
                  text: p,
                }),
              ),
            ),
          ),
        ),
        v.fix
          ? h('p', {
              class: 'fv-meta',
              text: 'with check and claim made one step, the second accept would see the first',
            })
          : null,
      ),
    );
  host.replaceChildren(h('div', { class: 'fv-cards' }, ...cards));
}
