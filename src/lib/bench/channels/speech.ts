import { add, subscribe, type LogEntry } from '../engine';
import { presets, speechFrame, valueLabel, valueText } from '../speech-stage';

const bench = document.querySelector<HTMLElement>('.bench')!;
const stage = bench.querySelector<HTMLElement>('.speech-stage')!;
const input = stage.querySelector<HTMLInputElement>('input[aria-label="OCR line"]')!;
const brackets = stage.querySelector<HTMLElement>('.speech-brackets')!;
const rows = stage.querySelector<HTMLElement>('[data-speech-rows]')!;
const number = stage.querySelector<HTMLElement>('[data-speech-number]')!;
const explain = stage.querySelector<HTMLElement>('[data-speech-explain]')!;
const word = stage.querySelector<HTMLElement>('.speech-word')!;
const inspector = bench.querySelector<HTMLElement>('.inspector')!;
const source = stage.querySelector<HTMLElement>('.speech-line-width')!;
const provenance = bench.querySelector<HTMLElement>('.speech .provenance')!;
const live = bench.querySelector<HTMLElement>('[data-bench-live]')!;
let mode: 'replay' | 'live' = 'replay';
let timer: number | undefined;
let latest: LogEntry | undefined;
let limit = false;
subscribe((entries) => {
  latest = entries.at(-1);
  const found = entries.some((entry) => entry.title === 'Misread value kept' && entry.limit);
  if (found !== limit) {
    limit = found;
    render();
  }
});
function render() {
  const frame = speechFrame(input.value, limit);
  source.style.width = `max(100%, ${Math.max(82, input.value.length + 2)}ch)`;
  brackets.innerHTML = frame.brackets;
  rows.innerHTML = frame.table;
  number.textContent = `${frame.kept} of 5`;
  number.classList.toggle('all-kept', frame.kept === 5);
  const blind = input.value.trimEnd().toLowerCase() === presets['<8.5 misread'].toLowerCase() && !!frame.row;
  number.classList.toggle('blind', blind);
  word.textContent = blind ? 'one is wrong' : 'rows kept';
  rows.querySelector('.speech-tr.edited')?.classList.toggle('misread', blind);
  explain.textContent = blind
    ? '<8.5 was read in place of <0.5. Nothing flagged it.'
    : frame.kept === 5
      ? 'every line parsed'
      : frame.omittedReason === 'too few columns'
        ? 'too few columns'
        : 'value did not match any form';
  stage
    .querySelectorAll<HTMLButtonElement>('[data-speech-preset]')
    .forEach((chip) =>
      chip.setAttribute(
        'aria-pressed',
        String(input.value === presets[chip.dataset.speechPreset as keyof typeof presets]),
      ),
    );
  provenance.querySelector<HTMLElement>('[data-provenance="replay"]')!.hidden = mode === 'live';
  provenance.querySelector<HTMLElement>('[data-provenance="executed"]')!.hidden = mode !== 'live';
  provenance.querySelector<HTMLElement>('p:not([data-executed-explain])')!.hidden = mode === 'live';
  provenance.querySelector<HTMLElement>('[data-executed-explain]')!.hidden = mode !== 'live';
  return frame;
}
function record() {
  const frame = speechFrame(input.value, limit);
  const isLimit =
    input.value.trimEnd().toLowerCase() === presets['<8.5 misread'].toLowerCase() && !!frame.row;
  const title = isLimit
    ? 'Misread value kept'
    : frame.row
      ? 'Edited line: row kept'
      : 'Edited line: row omitted';
  const detail = isLimit
    ? '<8.5 is well formed, so it parsed'
    : frame.row
      ? `${valueLabel(frame.row.value)}, ${valueText(frame.row.value)}`
      : frame.omittedReason;
  if (latest?.title === title && latest.detail === detail && latest.provenance === 'executed') return;
  add({ channel: 'speech', title, detail, provenance: 'executed', ...(isLimit ? { limit: true } : {}) });
  if (isLimit) {
    limit = true;
    render();
  }
  live.textContent = `${title}, ${detail}`;
}
function changed() {
  mode = 'live';
  render();
  window.clearTimeout(timer);
  timer = window.setTimeout(record, 800);
}
// Scroll beats set a canonical line that matches the chapter text. They never write to the log.
document.addEventListener('bench:beat', (event) => {
  const { channel, beat } = (event as CustomEvent<{ channel: string; beat: number }>).detail;
  if (channel !== 'speech') return;
  const lineFor = ['clean', 'qualified', '1.2 x 1043 misread', 'unit alias', '<8.5 misread'] as const;
  input.value = presets[lineFor[Math.min(beat, 4)]!];
  mode = beat === 2 || beat === 4 ? 'replay' : 'live';
  render();
});
stage.addEventListener('input', (event) => {
  if (event.target === input) changed();
});
stage.addEventListener('focusout', (event) => {
  if (event.target === input && mode === 'live') {
    window.clearTimeout(timer);
    record();
  }
});
stage.addEventListener('click', (event) => {
  const target = event.target as Element;
  const preset = target.closest<HTMLButtonElement>('[data-speech-preset]');
  if (preset) {
    input.value = presets[preset.dataset.speechPreset as keyof typeof presets];
    changed();
    window.clearTimeout(timer);
    record();
    return;
  }
  if (target.closest('.speech-bracket-button')) {
    openInspector();
  }
});
bench.addEventListener('click', (event) => {
  if ((event.target as Element).closest('[data-inspect-channel="speech"]')) openInspector();
});
function openInspector() {
  inspector.classList.add('speech-inspector');
  inspector.classList.remove('rag-inspector');
  inspector.setAttribute('aria-labelledby', 'speech-inspector-title');
  inspector.querySelector<HTMLElement>('[data-tesla-inspector]')!.hidden = true;
  inspector.querySelector<HTMLElement>('[data-rag-inspector]')!.hidden = true;
  inspector.querySelector<HTMLElement>('[data-speech-inspector]')!.hidden = false;
  inspector.querySelector<HTMLElement>('[data-email-inspector]')!.hidden = true;
  inspector.classList.remove('email-inspector');
  inspector.hidden = false;
  selectTab('value-normalizer');
  inspector.focus();
}
function selectTab(id: string) {
  inspector.querySelector<HTMLElement>('#speech-inspector-title')!.textContent =
    id === 'row-omission' ? 'Row omission' : 'Value parser';
  inspector
    .querySelectorAll<HTMLButtonElement>('[data-speech-tab]')
    .forEach((tab) => tab.setAttribute('aria-pressed', String(tab.dataset.speechTab === id)));
  inspector
    .querySelectorAll<HTMLElement>('[data-speech-panel]')
    .forEach((panel) => (panel.hidden = panel.dataset.speechPanel !== id));
}
inspector.addEventListener('click', (event) => {
  const target = event.target as Element;
  const tab = target.closest<HTMLElement>('[data-speech-tab]');
  if (tab) {
    selectTab(tab.dataset.speechTab!);
    return;
  }
  if (target.closest('[data-speech-close]')) {
    inspector.hidden = true;
    stage.querySelector<HTMLButtonElement>('.speech-bracket-button')?.focus();
    return;
  }
  if (target.closest('[data-load-misread]')) {
    input.value = presets['<8.5 misread'];
    changed();
    window.clearTimeout(timer);
    record();
    input.focus();
  }
});
bench.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !inspector.hidden && inspector.classList.contains('speech-inspector')) {
    inspector.hidden = true;
    stage.querySelector<HTMLButtonElement>('.speech-bracket-button')?.focus();
  }
});
