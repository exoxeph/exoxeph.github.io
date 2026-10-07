import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import golden from '../fixtures/rag/golden.json';
import { DEFAULT_CONFIG, finalDecision, route } from '../../src/lib/bench/rag';
import { recorded } from '../../src/lib/bench/rag-stage';

const root = 'tests/fixtures/rag';
const parseCsv = (name: string) => {
  const [head, ...lines] = readFileSync(`${root}/${name}`, 'utf8').trim().split(/\r?\n/);
  const keys = head!.split(',');
  return lines.map((line) => Object.fromEntries(line.split(',').map((value, i) => [keys[i], value])));
};

describe('retrieval router Python golden', () => {
  it('matches every executed threshold and draft score', () => {
    expect(golden.cases).toHaveLength(33);
    for (const row of golden.cases) {
      const cfg = { ...DEFAULT_CONFIG, acceptThreshold: row.threshold };
      const path = route(row.draftScore, cfg);
      const result = finalDecision(row.draftScore, row.finalScore, cfg);
      expect(path.kind === 'repair', JSON.stringify(row)).toBe(row.repaired);
      expect(result).toEqual({ repaired: row.repaired, finalScore: row.finalScore, accepted: row.accepted });
      if (row.repaired) {
        expect(row.repairSearch).toEqual({
          top_k: cfg.rerankTopK,
          bm25_weight: cfg.bm25WeightOnRepair,
          vector_weight: cfg.vectorWeightOnRepair,
        });
        expect(row.repairPruneOverlap).toBe(cfg.pruneMinOverlap + 1);
        expect(row.repairTemplate).toBe('constrained');
        expect(row.repairTemperature).toBe(cfg.temperatureOnRepair);
        expect(path.changes.map((change) => change.to)).toEqual([0.7, 0.3, 2, 'constrained', 0.1]);
      } else expect(path.changes).toEqual([]);
    }
  });
  it('uses the committed default run for the four chips', () => {
    const rows = parseCsv('run_001d32e8-18c0-49cf-bd68-039ffc6bfe99_results.csv');
    expect(
      recorded.map((chip) => {
        const source = rows.find((row) => row.id === chip.id)!;
        return [
          chip.id,
          chip.query,
          chip.score,
          chip.accepted,
          chip.repaired,
          source.query,
          Number(source.verify_score),
          source.accepted === 'True',
          source.repair_used === 'True',
        ];
      }),
    ).toEqual(
      recorded.map((chip) => [
        chip.id,
        chip.query,
        chip.score,
        chip.accepted,
        chip.repaired,
        chip.query,
        chip.score,
        chip.accepted,
        chip.repaired,
      ]),
    );
  });
  it('records no accepted repaired query in any committed run with accepted queries', () => {
    const files = readdirSync(root).filter((name) => name.endsWith('_results.csv'));
    expect(files).toHaveLength(8);
    for (const file of files) {
      const rows = parseCsv(file);
      if (!rows.some((row) => row.accepted === 'True')) continue;
      expect(
        rows.filter((row) => row.repair_used === 'True' && row.accepted === 'True'),
        file,
      ).toEqual([]);
    }
  });
});
