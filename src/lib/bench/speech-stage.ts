import { parseLabResultRow, parseLabResultRows, tokenSpans, type LabResult, type LabValue } from './speech';

export const presets = {
  clean: 'Hemoglobin            10.5            g/dL          12.0 - 16.0          L',
  qualified: 'CRP                   <0.5            mg/dL         <1.0                 N/A',
  '<8.5 misread': 'RP                    <8.5            mg/dL         <1.0                 N/A',
  '1.2 x 1043 misread': 'Cell Count            1.2 x 1043      10^3/µL       1.0 - 2.0            N/A',
  thousands: 'Platelet Count        12,500          10^3/µL       10,000 - 15,000      N/A',
  'unit alias': 'Albumin               3.7             gm/dl         3.5 - 5.0            N/A',
} as const;
export const defaultLine = presets['1.2 x 1043 misread'];
const otherLines = [
  presets.clean,
  presets.thousands,
  '',
  'Glucose               180             mg/dL         70 - 100             H',
  presets['unit alias'],
];
export const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
export const valueLabel = (value: LabValue) =>
  value.kind === 'range'
    ? 'range'
    : value.operator
      ? 'qualified number'
      : /\s*[x*]\s*10\^/i.test(value.raw ?? '')
        ? 'scientific'
        : 'plain number';
export const valueText = (value: LabValue) =>
  value.kind === 'range'
    ? `${value.range!.lower} - ${value.range!.upper}`
    : valueLabel(value) === 'scientific'
      ? (value.raw ?? '')
      : `${value.operator ?? ''}${value.numeric}`;
const tooFew = (line: string) => {
  if (line.includes('|')) return line.split('|').length < 3;
  if (line.split(/\s{2,}/).filter((part) => part.trim()).length >= 3) return false;
  try {
    return !parseLabResultRow(line);
  } catch {
    return false;
  }
};
export function speechFrame(line: string, limit = false) {
  const lines = [...otherLines];
  lines[2] = line;
  let results: LabResult[];
  try {
    results = parseLabResultRows(lines);
  } catch {
    results = parseLabResultRows([...lines.slice(0, 2), ...lines.slice(3)]);
  }
  const row = results.find((item) => item.rawLine === line) ?? null;
  const omittedReason = tooFew(line) ? 'too few columns' : 'value did not parse';
  const bracket =
    tokenSpans(line)
      .map((span) => {
        const invalid = (span.part === 'value' && !row) || span.part === 'row';
        const label =
          span.part === 'value'
            ? row
              ? `value: ${valueLabel(row.value)}`
              : 'value: no match'
            : span.part === 'row'
              ? 'row: too few columns'
              : span.part;
        const cls = invalid ? 'invalid' : row ? 'kept' : 'muted';
        const content = `<span class="speech-bracket ${cls}" style="left:${span.start}ch;width:${Math.max(1, span.length)}ch"><span>${escapeHtml(label)}</span></span>`;
        return span.part === 'value' || span.part === 'row'
          ? `<button type="button" class="speech-bracket-button" style="left:${span.start}ch;width:${Math.max(1, span.length)}ch" aria-label="Inspect the value parser">${content.replace(`left:${span.start}ch;width:${Math.max(1, span.length)}ch`, 'left:0;width:100%')}</button>`
          : content;
      })
      .join('') + (limit ? '<span class="speech-limit">◆ limit found</span>' : '');
  const cells = (item: LabResult, edited: boolean) =>
    `<div class="speech-tr${edited ? ' edited' : ''}"><span>${escapeHtml(item.testName)}</span><span>${escapeHtml(valueText(item.value))}</span><span>${escapeHtml(item.unit)}</span><span>${escapeHtml(item.referenceRange)}</span><span>${escapeHtml(item.flag)}</span><span class="speech-status">kept</span></div>`;
  const table = lines
    .map((source, i) => {
      const found = results.find((item) => item.rawLine === source);
      return found
        ? cells(found, i === 2)
        : `<div class="speech-tr omitted"><span>omitted: ${i === 2 ? 'the ' + omittedReason : 'the value did not parse'}</span><span class="speech-status">omitted</span></div>`;
    })
    .join('');
  return { row, omittedReason, brackets: bracket, table, kept: results.length, line };
}
