import { describe, expect, it } from 'vitest';
import golden from '../fixtures/speech/golden.json';
import { defaultLine, presets, speechFrame } from '../../src/lib/bench/speech-stage';
import {
  normalizeLabValue,
  normalizeUnit,
  parseLabResultRow,
  parseLabResultRows,
  tokenSpans,
  type LabResult,
} from '../../src/lib/bench/speech';

const python = (row: LabResult | null) =>
  row && {
    test_name: row.testName,
    value: row.value,
    unit: row.unit,
    reference_range: row.referenceRange,
    flag: row.flag,
    raw_line: row.rawLine,
  };
describe('speech parser Python golden', () => {
  it('matches every source and edge line', () => {
    expect(golden.corpus).toContain(presets.thousands);
    expect(golden.corpus.some((line) => line.includes('\u00c2\u00b5'))).toBe(false);
    expect(defaultLine).toContain('10^3/µL');
    expect(speechFrame(defaultLine).line).toContain('10^3/µL');
    golden.corpus.forEach((line, i) =>
      expect(python(parseLabResultRow(line)), `line ${i}: ${line}`).toEqual(golden.per_line[i]),
    );
  });
  it('matches whole report line lists', () => {
    golden.files.forEach((file) =>
      expect(parseLabResultRows(file.lines).map(python), file.name).toEqual(file.results),
    );
  });
  it('keeps valid misreads and omits malformed scientific values', () => {
    expect(normalizeLabValue('<8.5')).toMatchObject({ kind: 'scalar', operator: '<', numeric: 8.5 });
    expect(
      parseLabResultRow('Cell Count            1.2 x 1043      10^3/µL       1.0 - 2.0            N/A'),
    ).toBeNull();
    expect(normalizeUnit('gm/dl')).toBe('g/dL');
  });
  it('never throws when deriving display offsets', () => {
    golden.corpus.forEach((line) => expect(() => tokenSpans(line)).not.toThrow());
    expect(tokenSpans('Glucose | 12')).toEqual([{ part: 'row', start: 0, length: 12 }]);
  });
  it('preserves the Python negative lower range failure', () => {
    expect(() => normalizeLabValue('-1 - 2')).toThrow();
  });
});
