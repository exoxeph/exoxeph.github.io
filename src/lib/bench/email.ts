// Port of the email-assistant request validation (src/schemas.py EmailRequest, model_b_approach/pipeline.py validate_request).
// Pure and DOM free. Messages match the original Python (pydantic v2) exactly; see tests/unit/bench-email.test.ts.

export const TONES = [
  'professional',
  'polite',
  'formal',
  'friendly',
  'empathetic',
  'urgent but respectful',
  'casual but respectful',
] as const;

export type EmailInput = { intent: string; keyFacts: string[]; tone: string };
export type Validation = { valid: true } | { valid: false; problems: string[]; message: string };

// Python str.strip() removes the characters for which str.isspace() is true.
const PY_SPACE =
  '\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const stripRe = new RegExp(`^[${PY_SPACE}]+|[${PY_SPACE}]+$`, 'g');
export const pyStrip = (value: string) => value.replace(stripRe, '');

const toneMessage = () => {
  const quoted = TONES.map((tone) => `'${tone}'`);
  return `Input should be ${quoted.slice(0, -1).join(', ')} or ${quoted.at(-1)}`;
};

export function validateRequest(input: EmailInput): Validation {
  const problems: string[] = [];
  if (input.intent.length === 0) problems.push('String should have at least 1 character');
  else if (pyStrip(input.intent) === '') problems.push('Value error, intent must not be empty');

  if (input.keyFacts.length === 0) problems.push('List should have at least 1 item after validation, not 0');
  else if (input.keyFacts.filter((fact) => fact && pyStrip(fact) !== '').length === 0)
    problems.push('Value error, key_facts must contain at least one non-empty fact');

  if (!(TONES as readonly string[]).includes(input.tone)) problems.push(toneMessage());

  return problems.length === 0 ? { valid: true } : { valid: false, problems, message: problems.join('; ') };
}
