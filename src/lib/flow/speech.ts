// Extraction: a report line becomes a structured row. Every parsing step runs here, in the browser port of the
// project's parser, which matches the original Python on every golden line (see tests/unit/bench-speech.test.ts).
// The only recorded fact is what the report really said for the misread line, from the project README.
import { normalizeLabValue, parseLabResultRow, tokenSpans, type LabValue } from '../bench/speech';
import { presets } from '../bench/speech-stage';
import type { FlowData, FlowScenario, FlowStep } from './types';

/** Lines in the golden corpus the browser port is checked against (asserted by a unit test). */
export const GOLDEN_LINES = 184;

export const speechStages = [
  { id: 'raw', label: 'Raw line' },
  { id: 'tokens', label: 'Fields' },
  { id: 'rule', label: 'Parser rule' },
  { id: 'row', label: 'Structured row' },
  { id: 'result', label: 'Result' },
  { id: 'meaning', label: 'Meaning' },
];

const RULES = [
  { id: 'range', label: 'a range', example: '12.0 - 16.0' },
  { id: 'qualified', label: 'a qualified number', example: '<0.5' },
  { id: 'scientific', label: 'a scientific value', example: '1.2 x 10^3' },
  { id: 'plain', label: 'a plain number', example: '10.5 or 12,500' },
] as const;

function ruleOf(v: LabValue | null): (typeof RULES)[number]['id'] | null {
  if (!v) return null;
  if (v.kind === 'range') return 'range';
  if (v.operator) return 'qualified';
  if (v.raw && /10\^/i.test(v.raw)) return 'scientific';
  return 'plain';
}

const execNote = `Runs in your browser: the parser port, checked against the original Python on ${GOLDEN_LINES} golden lines.`;

function build(
  id: string,
  label: string,
  blurb: string,
  line: string,
  opts: { moment?: boolean; report?: string },
): FlowScenario {
  const spans = tokenSpans(line);
  const parts = spans.map((s) => ({
    part: s.part,
    text: line.slice(s.start, s.start + s.length),
    start: s.start,
    length: s.length,
  }));
  const valueText = parts.find((p) => p.part === 'value')?.text ?? '';
  const value = normalizeLabValue(valueText);
  const rule = ruleOf(value);
  const row = parseLabResultRow(line);
  const attempts = RULES.map((r, i) => ({
    ...r,
    state:
      rule === null
        ? 'no'
        : RULES.findIndex((x) => x.id === rule) > i
          ? 'no'
          : RULES[i]!.id === rule
            ? 'hit'
            : 'skip',
  }));
  const kept = !!row;
  const base = { line, parts };
  const steps: FlowStep[] = [
    {
      stage: 'raw',
      title: 'A line of report text',
      came: `The text of one line, as read from a photographed lab report: ${line.replace(/\s{2,}/g, '   ')}`,
      acted: 'The OCR reader produced this text; the parser has not touched it.',
      decided: 'Nothing yet.',
      changed: 'There is only text. No fields, no numbers.',
      next: 'The parser splits the line into fields.',
      prov: 'recorded',
      provNote: "A line from the project's test fixtures. The raw OCR output behind it is not committed.",
      v: { ...base, show: 'raw' },
    },
    {
      stage: 'tokens',
      title: 'Split into five fields',
      came: 'The raw line.',
      acted: 'The row parser: columns are separated by runs of spaces, or by the collapsed-line pattern.',
      decided: `Assign the pieces, in order, to test, value, unit, range and flag${parts.length === 1 ? ' (this line did not split)' : ''}.`,
      changed: `${parts.length} field${parts.length === 1 ? '' : 's'} found.`,
      next: 'The value field is checked against the known value forms.',
      prov: 'executed',
      provNote: execNote,
      extra: [
        {
          k: 'Source',
          v: 'app/services/report_parser.py (original Python); browser port in src/lib/bench/speech.ts.',
        },
      ],
      v: { ...base, show: 'fields' },
    },
    {
      stage: 'rule',
      title: rule ? `Matched: ${RULES.find((r) => r.id === rule)!.label}` : 'No known value form matches',
      came: `The value field: "${valueText}".`,
      acted:
        'The value normaliser tries the known forms in order: a range, a qualified number, a scientific value, a plain number.',
      decided: rule
        ? `"${valueText}" matches ${RULES.find((r) => r.id === rule)!.label}.`
        : `"${valueText}" matches none of the four known forms.`,
      changed: rule ? 'The value becomes a typed number.' : 'There is no value, so the row cannot be built.',
      next: rule ? 'The row is assembled.' : 'The row is left out.',
      tone: rule ? 'neutral' : 'catch',
      prov: 'executed',
      provNote: execNote,
      extra: [
        {
          k: 'Failure mode',
          v: 'The value forms are a whitelist. A misread digit that still forms a valid number matches and passes: there is no confidence measure.',
        },
      ],
      v: { ...base, show: 'rule', rule: { matched: rule, attempts, valueText } },
    },
    {
      stage: 'row',
      title: kept ? 'The structured row' : 'No row is produced',
      came: kept ? 'A typed value and four other fields.' : 'A value that matched no form.',
      acted: 'The row builder.',
      decided: kept
        ? 'Build the row and keep the raw line beside it.'
        : 'Omit the row: it is not guessed and not kept.',
      changed: kept
        ? `test "${row!.testName}", value ${row!.value.operator ?? ''}${row!.value.numeric ?? ''}, unit ${row!.unit}, range ${row!.referenceRange}, flag ${row!.flag || 'none'}.`
        : 'The report continues without this row.',
      next: 'The result.',
      tone: kept ? 'ok' : 'catch',
      prov: 'executed',
      provNote: execNote,
      v: {
        ...base,
        show: 'row',
        rule: { matched: rule, attempts, valueText },
        row: row
          ? {
              test: row.testName,
              value: `${row.value.operator ?? ''}${row.value.numeric ?? ''}`,
              unit: row.unit,
              range: row.referenceRange,
              flag: row.flag || 'none',
            }
          : null,
      },
    },
    {
      stage: 'result',
      title: kept ? 'Row kept' : 'Row left out',
      came: kept ? 'A valid structured row.' : 'No row.',
      acted: 'The survival rule: a row survives only if its value parsed.',
      decided: kept ? 'Keep it.' : 'Drop it.',
      changed: kept ? 'The row joins the structured output.' : 'The row never reaches the output.',
      next: opts.report ? 'Compare the output with what the report said.' : 'End of the trace.',
      tone: kept ? 'ok' : 'catch',
      prov: 'executed',
      provNote: execNote,
      v: {
        ...base,
        show: 'result',
        rule: { matched: rule, attempts, valueText },
        row: row
          ? {
              test: row.testName,
              value: `${row.value.operator ?? ''}${row.value.numeric ?? ''}`,
              unit: row.unit,
              range: row.referenceRange,
              flag: row.flag || 'none',
            }
          : null,
        kept,
      },
    },
  ];
  if (opts.report && kept)
    steps.push({
      stage: 'meaning',
      title: 'Parse success is not correct meaning',
      came: `The kept value ${row!.value.operator ?? ''}${row!.value.numeric} and what the report actually said: ${opts.report}.`,
      acted:
        'A comparison with the original report, from the project README (not something the parser can do).',
      decided: 'The parser accepted a value that is wrong. It has no way to know.',
      changed: 'A structured, valid-looking row now carries a wrong value, and nothing flags it.',
      next: 'End of the trace. The parser is a whitelist, not a verifier of meaning.',
      tone: 'fail',
      node: 'value-normalizer',
      extra: [
        {
          k: 'The lesson',
          v: 'Parse success is not semantic correctness. The output is well-formed and wrong. Catching this needs a confidence measure or a cross-check that does not exist in the project.',
        },
      ],
      prov: 'recorded',
      provNote:
        'Recorded: the project README records this OCR misread (self-reported evaluation); the raw OCR output is not committed.',
      v: {
        ...base,
        show: 'meaning',
        rule: { matched: rule, attempts, valueText },
        row: {
          test: row!.testName,
          value: `${row!.value.operator ?? ''}${row!.value.numeric ?? ''}`,
          unit: row!.unit,
          range: row!.referenceRange,
          flag: row!.flag || 'none',
        },
        kept,
        meaning: { report: opts.report, read: `${row!.value.operator ?? ''}${row!.value.numeric}` },
      },
    });
  return { id, label, blurb, steps, ...(opts.moment ? { moment: true } : {}) };
}

export function buildSpeechFlow(): FlowData {
  return {
    kind: 'speech',
    project: 'speech-document-extraction',
    stages: speechStages,
    scenarios: [
      build(
        'misread',
        'Looks valid, is wrong',
        'A misread digit that still parses.',
        presets['<8.5 misread'],
        {
          moment: true,
          report: '<0.5',
        },
      ),
      build(
        'omitted',
        'Caught: row left out',
        'A misread that matches no value form.',
        presets['1.2 x 1043 misread'],
        {},
      ),
      build('clean', 'A clean line', 'A plain number.', presets.clean, {}),
      build(
        'qualified',
        'A qualified value',
        'An operator and a number, read correctly.',
        presets.qualified,
        {},
      ),
    ],
    footnote: `Every parsing step runs in your browser, in the port that matches the original Python on ${GOLDEN_LINES} golden lines. Only what the report really said is recorded.`,
  };
}
