import { add, subscribe, type LogEntry } from '../engine';
import { DEFAULT_CONFIG, finalDecision } from '../rag';
import { defaultRagFrame, recorded, renderRag, type RagFrame } from '../rag-stage';

const bench = document.querySelector<HTMLElement>('.bench')!;
const stage = bench.querySelector<HTMLElement>('.rag-stage')!;
const inspector = bench.querySelector<HTMLElement>('.inspector')!;
const provenance = bench.querySelector<HTMLElement>('.rag .provenance')!;
const liveRegion = bench.querySelector<HTMLElement>('[data-bench-live]')!;
let frame: RagFrame = { ...defaultRagFrame };
let timer: number | undefined;
let latest: LogEntry | undefined;
let returnFocus: HTMLElement | SVGElement | null = null;
const fmt = (n: number) => n.toFixed(2);
const snap = (n: number, step: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(n / step) * step));
const visibleArt = () =>
  stage.querySelector<HTMLElement>(
    matchMedia('(max-width: 860px)').matches ? '.rag-art.mobile' : '.rag-art.desktop',
  )!;
const current = () =>
  finalDecision(frame.draft, frame.after, { ...DEFAULT_CONFIG, acceptThreshold: frame.threshold });

subscribe((entries) => {
  latest = entries.at(-1);
  if (!frame.limit && entries.some((entry) => entry.title === 'Repair is not a guarantee' && entry.limit)) {
    frame.limit = true;
    render();
  }
});

function render(focus?: string) {
  stage.querySelector<HTMLElement>('.rag-art.desktop')!.innerHTML = renderRag(frame);
  stage.querySelector<HTMLElement>('.rag-art.mobile')!.innerHTML = renderRag(frame, true);
  stage
    .querySelectorAll<HTMLButtonElement>('[data-rag-chip]')
    .forEach((button) =>
      button.setAttribute(
        'aria-pressed',
        String(frame.mode === 'replay' && frame.chip === button.dataset.ragChip),
      ),
    );
  stage.querySelector<HTMLElement>('.rag-assumption')!.hidden = frame.mode !== 'live' || !current().repaired;
  provenance.querySelector<HTMLElement>('[data-provenance="replay"]')!.hidden = frame.mode === 'live';
  provenance.querySelector<HTMLElement>('[data-provenance="executed"]')!.hidden = frame.mode !== 'live';
  provenance.querySelector<HTMLElement>('p:not([data-executed-explain])')!.hidden = frame.mode === 'live';
  provenance.querySelector<HTMLElement>('[data-executed-explain]')!.hidden = frame.mode !== 'live';
  if (focus) visibleArt().querySelector<SVGElement>(`[data-rag-slider="${focus}"]`)?.focus();
}

function discover(source: 'replay' | 'executed') {
  if (frame.limit) return;
  frame.limit = true;
  add({
    channel: 'rag',
    title: 'Repair is not a guarantee',
    detail: 'repaired once, still below the threshold',
    provenance: source,
    limit: true,
  });
  render();
}
function recordLive() {
  const result = current();
  const title = `Draft score ${fmt(frame.draft)}`;
  const detail = result.repaired
    ? `repair, then ${fmt(frame.after)}: ${result.accepted ? 'accepted' : 'not accepted'}`
    : 'accepted, no repair';
  if (latest?.title !== title || latest.detail !== detail || latest.provenance !== 'executed')
    add({ channel: 'rag', title, detail, provenance: 'executed' });
  liveRegion.textContent = `${title}, ${detail}`;
}
function changed(focus?: string) {
  frame.mode = 'live';
  if (current().repaired && !current().accepted) discover('executed');
  render(focus);
  window.clearTimeout(timer);
  timer = window.setTimeout(recordLive, 800);
}
function chip(id: string) {
  const item = recorded.find((row) => row.id === id);
  if (!item) return;
  frame = { ...frame, mode: 'replay', chip: id, draft: item.score, after: item.score };
  render();
  const title = `Recorded ${id}: ${item.score}`;
  const detail = item.repaired ? 'repaired once, not accepted' : 'accepted';
  if (latest?.title !== title || latest.detail !== detail || latest.provenance !== 'replay')
    add({ channel: 'rag', title, detail, provenance: 'replay' });
  if (item.repaired) discover('replay');
  liveRegion.textContent = `${title}, ${detail}`;
}
function selectTab(id: string) {
  inspector.querySelector<HTMLElement>('#rag-inspector-title')!.textContent =
    id === 'repair-step' ? 'Repair step' : 'Acceptance rule';
  inspector
    .querySelectorAll<HTMLButtonElement>('[data-rag-tab]')
    .forEach((tab) => tab.setAttribute('aria-pressed', String(tab.dataset.ragTab === id)));
  inspector
    .querySelectorAll<HTMLElement>('[data-rag-panel]')
    .forEach((panel) => (panel.hidden = panel.dataset.ragPanel !== id));
}
function openInspector(from: HTMLElement | SVGElement | null) {
  returnFocus = from;
  inspector.classList.remove('speech-inspector');
  inspector.classList.add('rag-inspector');
  inspector.setAttribute('aria-labelledby', 'rag-inspector-title');
  inspector.querySelector<HTMLElement>('[data-tesla-inspector]')!.hidden = true;
  inspector.querySelector<HTMLElement>('[data-speech-inspector]')!.hidden = true;
  inspector.querySelector<HTMLElement>('[data-rag-inspector]')!.hidden = false;
  inspector.querySelector<HTMLElement>('[data-email-inspector]')!.hidden = true;
  inspector.classList.remove('email-inspector');
  inspector.hidden = false;
  selectTab('accept-threshold');
  inspector.focus();
}
function closeInspector() {
  inspector.hidden = true;
  returnFocus?.focus();
}

// Scroll beats set a canonical frame that matches the chapter text. They never write to the log.
document.addEventListener('bench:beat', (event) => {
  const { channel, beat } = (event as CustomEvent<{ channel: string; beat: number }>).detail;
  if (channel !== 'rag') return;
  const replayChip = (id: string) => {
    const item = recorded.find((row) => row.id === id)!;
    frame = { ...frame, mode: 'replay', chip: id, draft: item.score, after: item.score, threshold: 0.72 };
  };
  const live = (draft: number, after: number) => {
    frame = { ...frame, mode: 'live', draft, after, threshold: 0.72 };
  };
  if (beat === 0) replayChip('q1');
  else if (beat === 1) live(0.6, 0.6);
  else if (beat === 2) live(0.6, 0.74);
  else if (beat === 3) replayChip('q4');
  else live(0.6, 0.66);
  render();
});
stage.addEventListener('click', (event) => {
  const target = event.target as Element;
  const selected = target.closest<HTMLElement>('[data-rag-chip]');
  if (selected) chip(selected.dataset.ragChip!);
});
bench.addEventListener('click', (event) => {
  const target = event.target as Element;
  if (target.closest('[data-inspect-channel="rag"]')) openInspector(target.closest<HTMLElement>('button'));
});
inspector.addEventListener('click', (event) => {
  const target = event.target as Element;
  const tab = target.closest<HTMLElement>('[data-rag-tab]');
  if (tab) selectTab(tab.dataset.ragTab!);
  if (target.closest('[data-rag-close]')) closeInspector();
  if (target.closest('[data-rag-limit-example]')) {
    frame = { ...frame, mode: 'live', draft: 0.6, after: 0.66, threshold: 0.72 };
    changed();
    closeInspector();
  }
});
bench.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !inspector.hidden && inspector.classList.contains('rag-inspector')) {
    closeInspector();
    return;
  }
  const slider = (event.target as Element).closest<SVGElement>('.rag-stage [data-rag-slider]');
  if (!slider) return;
  const kind = slider.dataset.ragSlider!;
  const step = kind === 'threshold' ? 0.01 : event.shiftKey ? 0.05 : 0.005;
  const min = kind === 'threshold' ? 0.05 : 0;
  const max = kind === 'threshold' ? 0.95 : 1;
  const old = kind === 'threshold' ? frame.threshold : kind === 'after' ? frame.after : frame.draft;
  let next = old;
  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next += step;
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next -= step;
  else if (event.key === 'Home') next = min;
  else if (event.key === 'End') next = max;
  else if ((event.key === 'Enter' || event.key === ' ') && kind === 'threshold') {
    event.preventDefault();
    openInspector(slider);
    return;
  } else return;
  event.preventDefault();
  next = snap(next, step, min, max);
  if (kind === 'threshold') frame.threshold = next;
  else if (kind === 'after') frame.after = next;
  else frame.draft = next;
  changed(kind);
});
stage.addEventListener('pointerdown', (event) => {
  const slider = (event.target as Element).closest<SVGElement>('[data-rag-slider]');
  if (!slider) return;
  const kind = slider.dataset.ragSlider!;
  const art = slider.closest<HTMLElement>('.rag-art')!;
  art.setPointerCapture(event.pointerId);
  const start = event.clientX;
  let moved = false;
  let geometry: { rect: DOMRect; mobile: boolean } | undefined;
  let pending: number | undefined;
  let animation: number | undefined;
  const value = () => (kind === 'threshold' ? frame.threshold : kind === 'after' ? frame.after : frame.draft);
  const flush = () => {
    if (animation !== undefined) cancelAnimationFrame(animation);
    animation = undefined;
    const next = pending;
    pending = undefined;
    if (next === undefined || next === value()) return;
    if (kind === 'threshold') frame.threshold = next;
    else if (kind === 'after') frame.after = next;
    else frame.draft = next;
    changed();
  };
  const update = (ev: PointerEvent) => {
    if (ev.pointerId !== event.pointerId) return;
    moved ||= Math.abs(ev.clientX - start) >= 3;
    if (!moved) return;
    if (!geometry) {
      const svg = art.querySelector<SVGSVGElement>('svg')!;
      geometry = { rect: svg.getBoundingClientRect(), mobile: svg.classList.contains('mobile') };
    }
    const { rect, mobile } = geometry;
    const position =
      (ev.clientX - rect.left - rect.width * (mobile ? 24 / 360 : 60 / 800)) /
      (rect.width * (mobile ? 312 / 360 : 680 / 800));
    const next = snap(
      position,
      kind === 'threshold' ? 0.01 : 0.005,
      kind === 'threshold' ? 0.05 : 0,
      kind === 'threshold' ? 0.95 : 1,
    );
    // A return to the current value supersedes any queued move.
    pending = next;
    if (next === value()) {
      pending = undefined;
      if (animation !== undefined) cancelAnimationFrame(animation);
      animation = undefined;
      return;
    }
    if (animation === undefined) animation = requestAnimationFrame(flush);
  };
  const end = (ev: PointerEvent) => {
    if (ev.pointerId !== event.pointerId) return;
    // Apply the last move before click handling or subsequent drags.
    flush();
    stage.removeEventListener('pointermove', update);
    stage.removeEventListener('pointerup', end);
    stage.removeEventListener('pointercancel', end);
    if (kind === 'threshold' && !moved) openInspector(slider);
  };
  stage.addEventListener('pointermove', update);
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
});
