import { add, subscribe, type LogEntry } from '../engine';
import { TONES, validateRequest, type EmailInput } from '../email';
import {
  checkerHtml,
  defaultFrame,
  gateSvg,
  inputOf,
  readoutHtml,
  scenarios,
  type EmailFrame,
} from '../email-stage';

const bench = document.querySelector<HTMLElement>('.bench')!;
const stage = bench.querySelector<HTMLElement>('.email-stage')!;
const inspector = bench.querySelector<HTMLElement>('.inspector')!;
const channel = bench.querySelector<HTMLElement>('.channel.email')!;
const provenance = channel.querySelector<HTMLElement>('.provenance')!;
const liveRegion = bench.querySelector<HTMLElement>('[data-bench-live]')!;
const select = stage.querySelector<HTMLSelectElement>('[data-email-scenario]')!;
const intent = stage.querySelector<HTMLTextAreaElement>('[data-email-intent]')!;
const facts = stage.querySelector<HTMLElement>('[data-email-facts]')!;
const tone = stage.querySelector<HTMLSelectElement>('[data-email-tone]')!;
const gate = stage.querySelector<HTMLElement>('.email-gate')!;
const checker = stage.querySelector<HTMLElement>('[data-email-checker]')!;
const readout = stage.querySelector<HTMLElement>('[data-email-readout]')!;
const limitMark = stage.querySelector<HTMLElement>('[data-email-limit]')!;

let frame: EmailFrame = {
  ...defaultFrame,
  input: { ...defaultFrame.input, keyFacts: [...defaultFrame.input.keyFacts] },
};
let timer: number | undefined;
let latest: LogEntry | undefined;
let returnFocus: HTMLElement | SVGElement | null = null;

subscribe((entries) => {
  latest = entries.at(-1);
  if (entries.some((entry) => entry.limit && entry.title.startsWith('Scenario 4'))) {
    frame.limit = true;
    limitMark.hidden = false;
  }
});

const readInput = (): EmailInput => ({
  intent: intent.value,
  keyFacts: [...facts.querySelectorAll<HTMLInputElement>('input')].map((item) => item.value),
  tone: tone.value,
});

function factRow(value: string) {
  const row = document.createElement('div');
  row.className = 'email-fact';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.setAttribute('aria-label', 'Key fact');
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.setAttribute('aria-label', 'Remove fact');
  remove.setAttribute('data-email-remove', '');
  remove.textContent = '×';
  row.append(input, remove);
  return row;
}

function writeForm(input: EmailInput) {
  intent.value = input.intent;
  tone.value = input.tone;
  facts.replaceChildren(...input.keyFacts.map(factRow));
}

function render() {
  const validation = validateRequest(frame.input);
  gate.innerHTML = gateSvg(validation.valid);
  checker.innerHTML = checkerHtml(frame, validation);
  readout.innerHTML = readoutHtml(validation);
  select.value = frame.edited || frame.scenarioId === null ? 'own' : String(frame.scenarioId);
  limitMark.hidden = !frame.limit;
  const live = frame.mode === 'live';
  provenance.querySelector<HTMLElement>('[data-provenance="replay"]')!.hidden = live;
  provenance.querySelector<HTMLElement>('[data-provenance="executed"]')!.hidden = !live;
  provenance.querySelector<HTMLElement>('p:not([data-executed-explain])')!.hidden = live;
  provenance.querySelector<HTMLElement>('[data-executed-explain]')!.hidden = !live;
}

function logCheck() {
  const validation = validateRequest(frame.input);
  const detail = validation.valid ? 'valid, reaches the input checker' : `stopped: ${validation.problems[0]}`;
  if (latest?.title !== 'Request checked' || latest.detail !== detail || latest.provenance !== 'executed')
    add({ channel: 'email', title: 'Request checked', detail, provenance: 'executed' });
  liveRegion.textContent = `Request checked, ${detail}`;
}

function edited() {
  frame.input = readInput();
  frame.mode = 'live';
  frame.edited = true;
  render();
  window.clearTimeout(timer);
  timer = window.setTimeout(logCheck, 800);
}

function chooseScenario(id: number) {
  const scenario = scenarios.find((item) => item.id === id);
  if (!scenario) return;
  frame = { ...frame, mode: 'replay', scenarioId: id, edited: false, input: inputOf(scenario) };
  writeForm(frame.input);
  const asked = scenario.recordedGated === 'clarification';
  const miss = scenario.expectedClarify && !asked;
  if (miss) frame.limit = true;
  render();
  const detail = miss
    ? 'recorded: wrote an email, expected a question'
    : `recorded: ${asked ? 'asks first' : 'writes the email'}`;
  add({
    channel: 'email',
    title: `Scenario ${id}: ${scenario.name}`,
    detail,
    provenance: 'replay',
    ...(miss ? { limit: true } : {}),
  });
  liveRegion.textContent = `Scenario ${id}, ${detail}`;
}

function selectTab(id: string) {
  inspector.querySelector<HTMLElement>('#email-inspector-title')!.textContent =
    id === 'input-checker' ? 'Input checker' : 'Request validation';
  inspector
    .querySelectorAll<HTMLButtonElement>('[data-email-tab]')
    .forEach((tab) => tab.setAttribute('aria-pressed', String(tab.dataset.emailTab === id)));
  inspector
    .querySelectorAll<HTMLElement>('[data-email-panel]')
    .forEach((panel) => (panel.hidden = panel.dataset.emailPanel !== id));
}

function openInspector(from: HTMLElement | SVGElement | null, tab: string) {
  returnFocus = from;
  inspector.classList.remove('speech-inspector', 'rag-inspector');
  inspector.classList.add('email-inspector');
  inspector.setAttribute('aria-labelledby', 'email-inspector-title');
  for (const selector of ['[data-tesla-inspector]', '[data-speech-inspector]', '[data-rag-inspector]'])
    inspector.querySelector<HTMLElement>(selector)!.hidden = true;
  inspector.querySelector<HTMLElement>('[data-email-inspector]')!.hidden = false;
  inspector.hidden = false;
  selectTab(tab);
  inspector.focus();
}
function closeInspector() {
  inspector.hidden = true;
  returnFocus?.focus();
}

// Scroll beats set a canonical frame that matches the chapter text. They never write to the log.
document.addEventListener('bench:beat', (event) => {
  const { channel, beat } = (event as CustomEvent<{ channel: string; beat: number }>).detail;
  if (channel !== 'email') return;
  const recordedScenario = (id: number) => {
    const scenario = scenarios.find((item) => item.id === id)!;
    frame = { ...frame, mode: 'replay', scenarioId: id, edited: false, input: inputOf(scenario) };
  };
  if (beat === 0) {
    const scenario = scenarios.find((item) => item.id === 3)!;
    frame = { ...frame, mode: 'live', scenarioId: null, edited: true, input: inputOf(scenario) };
  } else if (beat === 1) {
    const scenario = scenarios.find((item) => item.id === 3)!;
    frame = {
      ...frame,
      mode: 'live',
      scenarioId: null,
      edited: true,
      input: { ...inputOf(scenario), keyFacts: [] },
    };
  } else if (beat === 2) recordedScenario(3);
  else if (beat === 3) recordedScenario(1);
  else recordedScenario(4);
  writeForm(frame.input);
  render();
});
select.addEventListener('change', () => {
  if (select.value === 'own') {
    frame.mode = 'live';
    frame.edited = true;
    frame.input = readInput();
    render();
    window.clearTimeout(timer);
    timer = window.setTimeout(logCheck, 800);
  } else chooseScenario(Number(select.value));
});
stage.addEventListener('input', (event) => {
  const target = event.target as Element;
  if (target.closest('[data-email-intent], [data-email-facts]')) edited();
});
tone.addEventListener('change', edited);
stage.addEventListener('click', (event) => {
  const target = event.target as Element;
  if (target.closest('[data-email-add]')) {
    if (facts.children.length >= 5) return;
    const row = factRow('');
    facts.append(row);
    row.querySelector('input')!.focus();
    edited();
  }
  const remove = target.closest('[data-email-remove]');
  if (remove) {
    remove.closest('.email-fact')!.remove();
    edited();
  }
  if (target.closest('[data-inspect-gate]'))
    openInspector(target.closest<HTMLElement>('button'), 'code-validation');
  if (target.closest('[data-inspect-checker]'))
    openInspector(target.closest<HTMLElement>('button'), 'input-checker');
});
bench.addEventListener('click', (event) => {
  const target = event.target as Element;
  if (target.closest('[data-inspect-channel="email"]'))
    openInspector(target.closest<HTMLElement>('button'), 'input-checker');
});
inspector.addEventListener('click', (event) => {
  const target = event.target as Element;
  const tab = target.closest<HTMLElement>('[data-email-tab]');
  if (tab) selectTab(tab.dataset.emailTab!);
  if (target.closest('[data-email-close]')) closeInspector();
  if (target.closest('[data-email-miss]')) {
    chooseScenario(4);
    closeInspector();
  }
});
bench.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !inspector.hidden && inspector.classList.contains('email-inspector'))
    closeInspector();
});

// The tone options come from the repository; keep the form honest if the list ever changes.
if ([...tone.options].map((option) => option.value).join('|') !== TONES.join('|')) {
  tone.replaceChildren(
    ...TONES.map((value) => Object.assign(document.createElement('option'), { value, textContent: value })),
  );
  tone.value = frame.input.tone;
}
render();
