/**
 * Progressive enhancement for the Engineering Trace. The static markup is already complete;
 * this builds a stepper from the same embedded JSON. If anything throws, the static trace stays as it is.
 */
import { STAGES, STAGE_LABEL } from './types.ts';
import type { TraceData } from './types.ts';
import { current, initialState, lastStep, reduce } from './machine.ts';
import type { Action, MachineState } from './machine.ts';
import type { TraceStateData } from './types.ts';
import { parseUrlState, toSearch } from './url-state.ts';

function el<K extends keyof HTMLElementTagNameMap>(
  name: K,
  attrs?: Record<string, string>,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(name);
  if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

function tag(kind: string, text: string): HTMLElement {
  const s = el('span', { class: `tag ${kind}` });
  s.append(el('i', { 'aria-hidden': 'true' }), document.createTextNode(text));
  return s;
}

const KIND_TAG = {
  valid: ['valid', 'Valid state'],
  invalid: ['invalid', 'Invalid state'],
  rejected: ['control', 'Rejected transition'],
} as const;

function mount(root: HTMLElement): void {
  const host = root.querySelector<HTMLElement>('[data-instrument]');
  const json = root.querySelector<HTMLScriptElement>('script[data-trace-data]');
  const id = root.dataset['trace'];
  if (!host || !json?.textContent || !id) return;
  const trace = JSON.parse(json.textContent) as TraceData;

  const fromUrl = parseUrlState(location.search, id);
  let state: MachineState = initialState(trace, fromUrl?.variant, fromUrl?.step ?? 0);
  let compare = fromUrl?.compare ?? false;
  let timer: ReturnType<typeof setInterval> | undefined;

  host.textContent = '';
  host.setAttribute('role', 'group');
  host.setAttribute('aria-label', `Interactive trace: ${trace.title}`);

  const rail = el('ol', { class: 'rail', 'aria-label': 'Stages of this trace' });
  for (const s of STAGES) rail.append(el('li', { 'data-stage': s }, STAGE_LABEL[s]));
  const step = el('p', { class: 'step' });
  const cap = el('div', { class: 'cap' });
  const gauge = el('div', { class: 'gauge' });
  const hint = el('p', { class: 'hint' });
  const live = el('p', { class: 'visually-hidden', role: 'status', 'aria-live': 'polite' });
  const log = el('details', { class: 'log' });
  log.append(el('summary', undefined, 'Recorded state'));
  const logBody = el('div', { class: 'cols' });
  log.append(logBody);

  const seg = el('fieldset', { class: 'seg' });
  seg.append(el('legend', undefined, 'Code version'));
  const name = `variant-${id}`;
  for (const v of trace.variants) {
    const label = el('label');
    const input = el('input', { type: 'radio', name, value: v.id });
    input.checked = v.id === state.variant;
    input.addEventListener('change', () => {
      pause();
      dispatch({ type: 'setVariant', variant: v.id });
    });
    label.append(input, el('span', undefined, v.label));
    seg.append(label);
  }
  const prev = el('button', { type: 'button', class: 'btn' }, 'Previous');
  const next = el('button', { type: 'button', class: 'btn solid' }, 'Next step');
  const reset = el('button', { type: 'button', class: 'btn' }, 'Reset');
  const play = el('button', { type: 'button', class: 'btn', 'aria-pressed': 'false' }, 'Play');
  prev.addEventListener('click', () => {
    pause();
    dispatch({ type: 'prev' });
  });
  next.addEventListener('click', () => {
    pause();
    dispatch({ type: 'next' });
  });
  reset.addEventListener('click', () => {
    pause();
    dispatch({ type: 'reset' });
  });
  play.addEventListener('click', () => {
    if (timer !== undefined) {
      pause();
      return;
    }
    if (document.hidden) return;
    if (state.step === lastStep(trace, state.variant)) dispatch({ type: 'reset' });
    play.textContent = 'Pause';
    play.setAttribute('aria-pressed', 'true');
    timer = setInterval(() => {
      dispatch({ type: 'next' });
      if (state.step === lastStep(trace, state.variant)) pause();
    }, 1100);
  });
  const nav = el('div', { class: 'nav' });
  nav.append(prev, next, reset, play);
  const cmpLabel = el('label', { class: 'cmp-switch' });
  const cmpInput = el('input', { type: 'checkbox', role: 'switch', class: 'cmp-switch-input' });
  cmpInput.checked = compare;
  cmpInput.addEventListener('change', () => {
    pause();
    compare = cmpInput.checked;
    render();
    updateUrl();
  });
  const cmpTrack = el('span', { class: 'cmp-switch-track', 'aria-hidden': 'true' });
  cmpTrack.append(el('span', { class: 'cmp-switch-thumb' }));
  cmpLabel.append(cmpInput, cmpTrack, el('span', undefined, 'Compare both versions'));
  const ctl = el('div', { class: 'ctl' });
  ctl.append(seg, cmpLabel, nav);

  host.append(rail, step, cap, gauge, ctl, hint, log, live);
  host.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') pause();
    if (t instanceof HTMLInputElement && t.type === 'radio') return;
    if (e.key === 'ArrowRight') {
      dispatch({ type: 'next' });
      e.preventDefault();
    }
    if (e.key === 'ArrowLeft') {
      dispatch({ type: 'prev' });
      e.preventDefault();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });

  function pause(): void {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    play.textContent = 'Play';
    play.setAttribute('aria-pressed', 'false');
  }

  const shown = new Map<string, number>();
  const hadPending = new Map<string, boolean>();
  const eventCount = new Map<string, number>();

  function makeGauge(s: TraceStateData, variant: string, heading: boolean): HTMLElement {
    const panel = el('div', { class: 'gauge-panel' });
    if (heading) {
      panel.append(
        el('h4', { class: 'gauge-heading' }, trace.variants.find((v) => v.id === variant)?.label ?? variant),
      );
      panel.append(el('p', { class: 'gauge-title' }, s.title));
    }
    if (s.visual.kind === 'state-gauge') {
      const v = s.visual;
      const slots = Math.max(v.capacity + 2, v.cells.length + (v.pending?.seats ?? 0));
      const track = el('div', { class: 'track', 'aria-hidden': 'true' });
      for (let i = 0; i < slots; i++) {
        if (i === v.capacity) {
          const th = el('div', { class: `thresh${v.refused ? ' refused' : ''}` });
          th.append(el('span', undefined, `capacity ${v.capacity}`));
          if (v.refused && s.record?.httpStatus)
            th.append(el('p', { class: 'refusal' }, `HTTP ${s.record.httpStatus} refused`));
          track.append(th);
        }
        let cls = 'slot';
        let txt = '';
        const cell = v.cells[i];
        if (cell !== undefined) {
          cls += ` fill${cell === v.cells[0] ? ' first' : ''}${i >= v.capacity ? ' over' : ''}`;
          txt = cell;
          if (i >= (shown.get(variant) ?? 0)) cls += i >= v.capacity ? ' over-enter' : ' enter';
        } else if (v.pending && i >= v.cells.length && i < v.cells.length + v.pending.seats) {
          cls += ' ghost';
          if (!hadPending.get(variant)) cls += ' ghost-enter';
          if (v.refused) cls += ' recoil';
          txt = v.pending.label;
        } else if (i >= v.capacity) {
          cls += ' beyond';
        }
        const slot = el('div', { class: cls }, txt);
        if (cls.includes('over-enter')) slot.style.setProperty('--stagger', `${(i - v.capacity) * 60}ms`);
        track.append(slot);
      }
      shown.set(variant, v.cells.length);
      hadPending.set(variant, !!v.pending);
      panel.append(track);
      const total = v.cells.length;
      panel.append(
        el(
          'p',
          { class: `sum${total > v.capacity ? ' over' : ''}` },
          `Committed seats: ${total} of ${v.capacity}${total > v.capacity ? ' (over capacity)' : ''}`,
        ),
      );
    }
    const events = el('ol', { class: 'events', 'aria-label': 'Audit events recorded at this step' });
    const recorded = s.record?.events ?? [];
    if (recorded.length === 0) events.append(el('li', { class: 'empty' }, 'no events yet'));
    for (const [i, event] of recorded.entries()) {
      const item = el('li', {
        class: `event ${event === 'CONFLICT' ? 'conflict' : 'success'}${i >= (eventCount.get(variant) ?? 0) ? ' appended' : ''}`,
      });
      item.append(
        el('span', { class: 'event-marker', 'aria-hidden': 'true' }),
        document.createTextNode(event),
      );
      events.append(item);
    }
    eventCount.set(variant, recorded.length);
    // The event row sits between the capacity cells and their sum.
    const sum = panel.querySelector('.sum');
    if (sum) panel.insertBefore(events, sum);
    else panel.append(events);
    return panel;
  }

  function render(): void {
    const s = current(trace, state);
    const guarded = current(trace, { variant: 'with-guard', step: state.step });
    const unguarded = current(trace, { variant: 'without-guard', step: state.step });
    const last = lastStep(trace, state.variant);
    step.textContent = `Step ${state.step + 1} of ${last + 1}`;

    cap.textContent = '';
    cap.classList.toggle('comparing', compare);
    cap.append(el('h3', undefined, compare ? guarded.title : s.title));
    const [k, label] = KIND_TAG[s.kind];
    const tags = el('div', { class: 'tags' });
    tags.append(tag(k, label));
    if (compare) {
      tags.textContent = '';
      for (const [version, compared] of [
        ['With the guard:', guarded],
        ['Without the guard:', unguarded],
      ] as const) {
        const [kind, title] = KIND_TAG[compared.kind];
        const item = el('span', { class: 'version-state' });
        item.append(
          el('span', { class: 'version-name' }, version),
          document.createTextNode(' '),
          tag(kind, title),
        );
        tags.append(item);
      }
    }
    cap.append(tags, el('p', undefined, compare ? guarded.text : s.text));

    for (const li of Array.from(rail.children)) {
      const stage = (li as HTMLElement).dataset['stage'] as (typeof STAGES)[number];
      const on = s.stages.includes(stage);
      const wasOn = li.classList.contains('on');
      li.className = on
        ? `on ${stage === 'invalid' ? 'invalid' : stage === 'control' ? 'control' : ''}`.trim()
        : '';
      if (on && !wasOn) li.classList.add('new-on');
      if (on) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    }

    gauge.textContent = '';
    if (compare) {
      gauge.classList.add('comparing');
      gauge.append(makeGauge(guarded, 'with-guard', true), makeGauge(unguarded, 'without-guard', true));
    } else {
      gauge.classList.remove('comparing');
      gauge.append(makeGauge(s, state.variant, false));
    }
    seg.hidden = compare;

    logBody.textContent = '';
    const r = s.record;
    if (r) {
      const a = el('div');
      a.append(el('h4', undefined, 'Requests'));
      const ua = el('ul');
      for (const q of r.requests)
        ua.append(
          el(
            'li',
            undefined,
            `${q.label} (${q.seats} ${q.seats === 1 ? 'seat' : 'seats'}): ${q.status}${q.pool ? ` in ${q.pool}` : ''}`,
          ),
        );
      a.append(ua);
      const b = el('div');
      b.append(el('h4', undefined, 'Recorded response'));
      const ub = el('ul');
      ub.append(
        el(
          'li',
          undefined,
          r.httpStatus
            ? `Last accept: HTTP ${r.httpStatus}${r.httpMessage ? ` (${r.httpMessage})` : ''}`
            : 'No accept yet',
        ),
      );
      ub.append(el('li', undefined, `Audit events: ${r.events.length ? r.events.join(', ') : 'none yet'}`));
      b.append(ub);
      logBody.append(a, b);
    }

    (prev as HTMLButtonElement).disabled = state.step === 0;
    (next as HTMLButtonElement).disabled = state.step === last;
    hint.textContent =
      state.step === last ? 'End of the trace. Reset to replay, or open "Also known" below.' : '';
    const total = s.visual.kind === 'state-gauge' ? s.visual.cells.length : 0;
    const reading = (v: TraceStateData) =>
      `${v.title}, committed ${v.visual.kind === 'state-gauge' ? v.visual.cells.length : 0} of ${v.visual.kind === 'state-gauge' ? v.visual.capacity : 0}`;
    live.textContent = compare
      ? `Compare. With the guard: ${reading(guarded)}. Without the guard: ${reading(unguarded)}.`
      : `${s.title}. ${label}.${s.visual.kind === 'state-gauge' ? ` Committed seats ${total} of ${s.visual.capacity}.` : ''}`;
    for (const input of Array.from(seg.querySelectorAll('input')))
      input.checked = input.value === state.variant;
  }

  function dispatch(a: Action): void {
    state = reduce(trace, state, a);
    render();
    updateUrl();
  }

  function updateUrl(): void {
    history.replaceState(
      null,
      '',
      `${location.pathname}${toSearch(id as string, state, compare)}${location.hash}`,
    );
  }

  render();
  host.hidden = false;
  root.classList.add('is-enhanced');
}

for (const root of Array.from(document.querySelectorAll<HTMLElement>('[data-trace]'))) {
  try {
    mount(root);
  } catch (err) {
    console.error('Engineering Trace enhancement failed; the static trace remains.', err);
  }
}
if (typeof console !== 'undefined') {
  console.info(
    "Engineering Trace: the state machine is a pure reducer (src/lib/trace/machine.ts) and the data is the JSON embedded in script[data-trace-data]. Try: location.search = '?trace=tesla-capacity&variant=without-guard&step=4&compare=1'",
  );
}
