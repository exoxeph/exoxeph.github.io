export type LabValue = {
  kind: 'scalar' | 'range';
  numeric: number | null;
  operator: string | null;
  range: { lower: number; upper: number } | null;
  raw: string | null;
};
export type LabResult = {
  testName: string;
  value: LabValue;
  unit: string;
  referenceRange: string;
  flag: string;
  rawLine: string;
};

const aliases: Record<string, string> = {
  'gm/dl': 'g/dL',
  'g/dl': 'g/dL',
  'g/dL': 'g/dL',
  'mg/dl': 'mg/dL',
  'mg/dL': 'mg/dL',
  'mg/di': 'mg/dL',
  'mg/dt': 'mg/dL',
  'mg/dt3': 'mg/dL',
  'mg/d': 'mg/dL',
  'ag/di': 'mg/dL',
  'mmol/l': 'mmol/L',
  'mmol/L': 'mmol/L',
  'mmol/t': 'mmol/L',
  'mmol/i': 'mmol/L',
  'mmol/L3': 'mmol/L',
  'anol/t': 'mmol/L',
  'mt/min/{1.73_m2}': 'mL/min/{1.73_m2}',
  'mt /min/{2-73_02)': 'mL/min/{1.73_m2}',
  '10^3/ul': '10^3/uL',
  '10^3/uL': '10^3/uL',
  '10^3/µL': '10^3/uL',
};
export const normalizeUnit = (unit: string) => aliases[unit.trim()] ?? unit.trim();
const pyTrim = (text: string) => text.replace(/^\s+|\s+$/gu, '');
const digit = '[0-9\\p{Nd}]';
const plain = new RegExp(
  `^[+-]?${digit}+(?:,${digit}{3})*(?:\\.${digit}+)?$|^[+-]?${digit}+(?:\\.${digit}+)?$`,
  'u',
);
const qualified = new RegExp(
  `^(?<operator><=|>=|<|>)\\s*(?<number>[+-]?${digit}+(?:,${digit}{3})*(?:\\.${digit}+)?|[+-]?${digit}+(?:\\.${digit}+)?)$`,
  'u',
);
const scientific = new RegExp(
  `^(?<base>[+-]?${digit}+(?:\\.${digit}+)?)\\s*(?:x|\\*)\\s*10\\^(?<exponent>[+-]?${digit}+)$`,
  'iu',
);
const range = new RegExp(`^[+-]?${digit}+(?:\\.${digit}+)?\\s*-\\s*[+-]?${digit}+(?:\\.${digit}+)?$`, 'u');
const pyNumber = (s: string) => {
  const cleaned = s.replaceAll(',', '').replace(/[\p{Nd}]/gu, (d) => {
    const code = d.codePointAt(0)!;
    let start = code;
    while (start > 0 && /\p{Nd}/u.test(String.fromCodePoint(start - 1))) start--;
    return String((code - start) % 10);
  });
  const number = Number(cleaned);
  if (!cleaned || Number.isNaN(number)) throw new Error(`could not convert string to float: ${s}`);
  return number;
};
export function normalizeLabValue(text: string): LabValue | null {
  const candidate = pyTrim(text);
  if (!candidate) return null;
  let normalized = candidate.replaceAll('\u00c2\u00a9', '0').replaceAll('©', '0').replaceAll('@', '0');
  if (new RegExp(`^[+-]?${digit}+,${digit}{1,2}$`, 'u').test(normalized))
    normalized = normalized.replace(',', '.');
  if (range.test(normalized)) {
    const separator = /\s*-\s*/.exec(normalized)!;
    const lower = normalized.slice(0, separator.index),
      upper = normalized.slice(separator.index + separator[0].length);
    return {
      kind: 'range',
      numeric: null,
      operator: null,
      range: { lower: pyNumber(lower), upper: pyNumber(upper) },
      raw: candidate,
    };
  }
  const q = qualified.exec(normalized);
  if (q)
    return {
      kind: 'scalar',
      numeric: pyNumber(q.groups!.number!),
      operator: q.groups!.operator!,
      range: null,
      raw: candidate,
    };
  const s = scientific.exec(normalized);
  if (s)
    return {
      kind: 'scalar',
      numeric: pyNumber(s.groups!.base!) * 10 ** pyNumber(s.groups!.exponent!),
      operator: null,
      range: null,
      raw: candidate,
    };
  if (plain.test(normalized))
    return { kind: 'scalar', numeric: pyNumber(normalized), operator: null, range: null, raw: candidate };
  return null;
}
const ref = (s: string) => {
  const stripped = pyTrim(s);
  const compact = stripped.toLowerCase().replace(/[^a-z/]/g, '');
  return ['na', 'n/a', '/a', 'fa', 'ta', 'wa'].includes(compact) || compact.endsWith('/a') ? 'N/A' : stripped;
};
const result = (
  testName: string,
  value: LabValue,
  unit: string,
  referenceRange: string,
  flag: string,
  rawLine: string,
): LabResult => ({
  testName,
  value,
  unit: normalizeUnit(unit),
  referenceRange: ref(referenceRange),
  flag,
  rawLine,
});
const collapsedPattern = `^(?<test_name>.+?)\\s+(?<value>(?:<=|>=|<|>)?\\s*[+-]?${digit}+(?:,${digit}{3})*(?:\\.${digit}+)?(?:\\s*(?:x|\\*)\\s*10\\^?${digit}+)?|[+-]?${digit}+(?:,${digit}{3})*(?:\\.${digit}+)?\\s*-\\s*[+-]?${digit}+(?:,${digit}{3})*(?:\\.${digit}+)?)\\s+(?<unit>\\S+/\\S+|mmol/L3|mmol/L|mmol/t|mmol/i|10(?:\\^|\\*)3/\\S+|1043/\\S+)\\s+(?<reference_range>(?:<=|>=|<|>)?\\s*[+-]?${digit}+(?:,${digit}{3})*(?:\\.${digit}+)?(?:\\s*-\\s*[+-]?${digit}+(?:,${digit}{3})*(?:\\.${digit}+)?)?|N/?A)(?:\\s+(?<flag>[A-Za-z/]+))?$`;
const collapsed = new RegExp(collapsedPattern, 'iu');
const collapsedIndices = new RegExp(collapsedPattern, 'idu');
export function parseLabResultRow(line: string): LabResult | null {
  if (line.includes('|')) {
    const parts = line.split('|').map(pyTrim);
    if (parts.length < 3 || ['test name', '---'].includes(parts[0]!.toLowerCase())) return null;
    const value = normalizeLabValue(parts[1]!);
    return value ? result(parts[0]!, value, parts[2]!, parts[3] ?? '', parts[4] ?? '', line) : null;
  }
  const parts = line
    .split(/\s{2,}/u)
    .filter((p) => pyTrim(p))
    .map(pyTrim);
  if (parts.length >= 3) {
    const value = normalizeLabValue(parts[1]!);
    return value ? result(parts[0]!, value, parts[2]!, parts[3] ?? '', parts[4] ?? '', line) : null;
  }
  const m = collapsed.exec(line);
  if (!m) return null;
  const g = m.groups!;
  const value = normalizeLabValue(g.value!);
  return value ? result(pyTrim(g.test_name!), value, g.unit!, g.reference_range!, g.flag ?? '', line) : null;
}
const looksLikeTestNameLine = (line: string) => {
  const s = pyTrim(line);
  return (
    !!s &&
    !s.toLowerCase().includes('observed value') &&
    (s.includes('[') ||
      /\b(glucose|urea|creatinine|calcium|sodium|potassium|chloride|hemoglobin|platelet|crp)\b/i.test(s))
  );
};
const cleanTestName = (line: string) =>
  pyTrim(pyTrim(pyTrim(line).replace(/^\p{Nd}+[\).,]\s*/u, '')).replace(/^[ ,.;:%)\]*]+/, ''))
    .replace(/\s*[:;]\s*(?:n\/?a|w\/?a)$/i, '')
    .trim();
function multiline(testLine: string, valueLine: string): LabResult | null {
  const normalized = valueLine
    .replaceAll('â€”', ' ')
    .replace(/\s+[A-Za-z]-\s+(reference\s+range\b)/gi, ' $1');
  const observed =
    /\bobserved\s+value\b\s*[:.]?\s*(?<value>(?:<=|>=|<|>)?\s*[^\s]+(?:\s*(?:x|\*)\s*10\^?\p{Nd}+)?)\s+(?<unit>.+?)(?:\s+reference\s+range\s*[:!]?\s*(?<reference_range>.*))?$/iu.exec(
      normalized,
    );
  if (observed) {
    const g = observed.groups!;
    const value = normalizeLabValue(g.value!);
    if (value)
      return result(
        cleanTestName(testLine),
        value,
        g.unit!,
        g.reference_range ?? '',
        '',
        `${testLine}\n${valueLine}`,
      );
  }
  const kv =
    /\b[vy]alue\s*=\s*(?<value>[^\s;]+(?:\s*(?:x|\*)\s*10\^?\p{Nd}+)?)\s+[uy]nit\s*=\s*(?<unit>[^; ]+)(?:[; ]+\s*range\s*=\s*(?<reference_range>[^;]+))?/iu.exec(
      valueLine,
    );
  if (kv) {
    const g = kv.groups!;
    const value = normalizeLabValue(g.value!);
    if (value)
      return result(
        cleanTestName(testLine),
        value,
        g.unit!,
        g.reference_range ?? '',
        '',
        `${testLine}\n${valueLine}`,
      );
  }
  return null;
}
export function parseLabResultRows(lines: string[]): LabResult[] {
  const results: LabResult[] = [];
  let pending: string | null = null;
  for (const line of lines) {
    const row = parseLabResultRow(line);
    if (row) {
      results.push(row);
      pending = null;
      continue;
    }
    if (pending !== null) {
      const multi = multiline(pending, line);
      if (multi) {
        results.push(multi);
        pending = null;
        continue;
      }
    }
    if (looksLikeTestNameLine(line)) pending = line;
  }
  return results;
}
export type TokenSpan = {
  part: 'test' | 'value' | 'unit' | 'range' | 'flag' | 'row';
  start: number;
  length: number;
};
export function tokenSpans(line: string): TokenSpan[] {
  try {
    if (line.includes('|')) {
      if (line.split('|').length < 3) return [{ part: 'row', start: 0, length: Math.max(1, line.length) }];
      let offset = 0;
      return line
        .split('|')
        .slice(0, 5)
        .map((part, i) => {
          const start = offset + part.length - part.trimStart().length;
          offset += part.length + 1;
          return {
            part: ['test', 'value', 'unit', 'range', 'flag'][i] as TokenSpan['part'],
            start,
            length: Math.max(1, pyTrim(part).length),
          };
        });
    }
    const spans = [...line.matchAll(/\S(?:.*?\S)?(?=\s{2,}|$)/gu)];
    if (spans.length >= 3)
      return spans.slice(0, 5).map((m, i) => ({
        part: ['test', 'value', 'unit', 'range', 'flag'][i] as TokenSpan['part'],
        start: m.index,
        length: m[0].length,
      }));
    const m = collapsedIndices.exec(line);
    if (m?.indices?.groups)
      return (['test_name', 'value', 'unit', 'reference_range', 'flag'] as const).flatMap((key, i) => {
        const pair = m.indices!.groups![key];
        return pair
          ? [
              {
                part: ['test', 'value', 'unit', 'range', 'flag'][i] as TokenSpan['part'],
                start: pair[0],
                length: pair[1] - pair[0],
              },
            ]
          : [];
      });
  } catch {
    /* display fallback */
  }
  return [{ part: 'row', start: 0, length: Math.max(1, line.length) }];
}
