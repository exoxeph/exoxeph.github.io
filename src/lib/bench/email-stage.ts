import data from '../../data/bench/email-scenarios.json';
import { validateRequest, type EmailInput, type Validation } from './email';

export type Scenario = (typeof data.scenarios)[number];
export const scenarios: Scenario[] = data.scenarios;
export const defaultScenario = scenarios.find((scenario) => scenario.id === 3)!;

const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export type EmailFrame = {
  mode: 'replay' | 'live';
  scenarioId: number | null;
  edited: boolean;
  input: EmailInput;
  limit: boolean;
};

export const inputOf = (scenario: Scenario): EmailInput => ({
  intent: scenario.intent,
  keyFacts: [...scenario.keyFacts],
  tone: scenario.tone,
});

export const defaultFrame: EmailFrame = {
  mode: 'replay',
  scenarioId: defaultScenario.id,
  edited: false,
  input: inputOf(defaultScenario),
  limit: false,
};

export const gateSvg = (valid: boolean) =>
  `<svg viewBox="0 0 150 200" aria-hidden="true" class="${valid ? 'is-valid' : 'is-invalid'}">` +
  `<path class="${valid ? 'ln' : 'mu'}" d="M0 100H25"/>` +
  `<path class="${valid ? 'ln' : 'gate-bad'}" d="M75 50L125 100L75 150L25 100Z" ${valid ? 'style="fill:var(--surface)"' : 'fill="url(#bench-hatch)"'}/>` +
  `<text x="75" y="178" text-anchor="middle">basic checks</text>` +
  `<circle cx="75" cy="100" r="6" fill="${valid ? 'var(--verified)' : 'var(--invalid)'}"/>` +
  (valid
    ? '<path class="ln" d="M125 100H150"/>'
    : '<path class="mu" d="M125 100H150" stroke-dasharray="3 3"/>') +
  '</svg>';

export function checkerText(frame: EmailFrame, validation: Validation) {
  const scenario = scenarios.find((item) => item.id === frame.scenarioId);
  if (!validation.valid) return { cls: 'idle', lines: ['not reached'] };
  if (!scenario || frame.edited) return { cls: 'idle', lines: ['no recorded outcome for this input'] };
  const asked = scenario.recordedGated === 'clarification';
  const miss = scenario.expectedClarify && !asked;
  return {
    cls: miss ? 'miss' : asked ? 'asks' : 'email',
    lines: [
      `recorded: ${asked ? 'asks first' : 'writes the email'}`,
      `expected: ${scenario.expectedClarify ? 'asks first' : 'writes the email'}`,
    ],
  };
}

export function readoutHtml(validation: Validation) {
  const ok = validation.valid;
  return (
    `<div class="email-number ${ok ? 'ok' : 'bad'}" data-email-number>${ok ? 'basics ok' : 'stopped'}</div>` +
    `<div class="email-word" data-email-word>${ok ? 'then a model checks' : 'before the AI is asked to write'}</div>` +
    `<div class="email-explain" data-email-explain>${ok ? '' : validation.problems.map(esc).join('<br>')}</div>`
  );
}

export const checkerHtml = (frame: EmailFrame, validation: Validation) => {
  const { cls, lines } = checkerText(frame, validation);
  return `<div class="checker-lines ${cls}">${lines.map((line, i) => `<span class="${i ? 'sub' : 'main'}">${esc(line)}</span>`).join('')}</div>`;
};

export const frameValidation = (frame: EmailFrame) => validateRequest(frame.input);
