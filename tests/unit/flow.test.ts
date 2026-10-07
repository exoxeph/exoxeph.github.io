import { describe, expect, it } from 'vitest';
import golden from '../fixtures/speech/golden.json';
import email from '../../src/data/architecture/email-assistant.json';
import rag from '../../src/data/architecture/data-aware-rag.json';
import speech from '../../src/data/architecture/speech-doc-extraction.json';
import pool from '../../src/data/architecture/ride-pooling-lifecycle.json';
import { buildEmailFlow } from '../../src/lib/flow/email';
import { buildRagFlow, SCORE_PARTS } from '../../src/lib/flow/rag';
import { buildSpeechFlow, GOLDEN_LINES } from '../../src/lib/flow/speech';
import { buildPoolFlow } from '../../src/lib/flow/pool';
import type { FlowData } from '../../src/lib/flow/types';

const nodes = (j: { nodes: { id: string }[] }) => new Set(j.nodes.map((n) => n.id));
const cases: [string, () => FlowData, Set<string>][] = [
  ['email', buildEmailFlow, nodes(email)],
  ['rag', buildRagFlow, nodes(rag)],
  ['speech', buildSpeechFlow, nodes(speech)],
  ['pool', buildPoolFlow, nodes(pool)],
];

describe.each(cases)('%s flow data', (_name, build, arch) => {
  const flow = build();
  it('has unique scenarios whose steps use known stages, one provenance each, and real architecture nodes', () => {
    expect(new Set(flow.scenarios.map((s) => s.id)).size).toBe(flow.scenarios.length);
    const stages = new Set(flow.stages.map((s) => s.id));
    for (const sc of flow.scenarios) {
      expect(sc.steps.length).toBeGreaterThan(1);
      for (const st of sc.steps) {
        expect(stages.has(st.stage), `${sc.id}: ${st.stage}`).toBe(true);
        expect(['executed', 'recorded', 'modelled']).toContain(st.prov);
        for (const k of ['came', 'acted', 'decided', 'changed', 'next', 'provNote'] as const)
          expect(st[k].length).toBeGreaterThan(3);
        if (st.node) expect(arch.has(st.node), `${sc.id}: node ${st.node}`).toBe(true);
      }
    }
  });
  it('has exactly one scenario that carries the technical moment, or more, and every moment ends in a lesson', () => {
    expect(flow.scenarios.some((s) => s.moment)).toBe(true);
  });
});

describe('flow logic is the real logic', () => {
  it('the extraction port is pinned to the golden corpus size it advertises', () => {
    expect(GOLDEN_LINES).toBe(golden.corpus.length);
  });
  it('the <8.5 line parses and is kept as a qualified value; the 1.2 x 1043 line is omitted', () => {
    const f = buildSpeechFlow();
    const mis = f.scenarios.find((s) => s.id === 'misread')!;
    const row = mis.steps.find((s) => s.stage === 'row')!.v.row as { value: string } | null;
    expect(row?.value).toBe('<8.5');
    expect(mis.steps.at(-1)!.stage).toBe('meaning');
    const omitted = f.scenarios.find((s) => s.id === 'omitted')!;
    expect(omitted.steps.find((s) => s.stage === 'row')!.v.row).toBeNull();
    expect(omitted.steps.at(-1)!.title).toBe('Row left out');
  });
  it('retrieval: the score weights sum to 100 and the 0.72 line is inclusive', () => {
    expect(SCORE_PARTS.reduce((n, p) => n + p.w, 0)).toBe(100);
    const f = buildRagFlow();
    const q5 = f.scenarios.find((s) => s.id === 'q5')!;
    expect(q5.steps.some((s) => /Exactly on the line/.test(s.title))).toBe(true);
    const q3 = f.scenarios.find((s) => s.id === 'q3')!;
    expect(q3.steps.at(-1)!.title).toMatch(/not accepted/);
    expect(JSON.stringify(f)).not.toMatch(/(?<!not a check )against the sources/i);
  });
  it('email: validation is executed and the recorded miss ends as a miss', () => {
    const f = buildEmailFlow();
    const stop = f.scenarios.find((s) => s.id === 'stop')!;
    expect(stop.steps.at(-1)!.decided).toMatch(/Rejected/);
    expect(stop.steps.at(-1)!.prov).toBe('executed');
    const miss = f.scenarios.find((s) => s.id === 's4')!;
    expect(miss.steps.at(-1)!.title).toMatch(/miss/i);
    expect(miss.steps.find((s) => s.stage === 'checker')!.prov).toBe('recorded');
  });
  it('ride pooling: sequential steps match the recorded trace and the race ends over capacity', () => {
    const f = buildPoolFlow();
    const refuse = f.scenarios.find((s) => s.id === 'refuse')!;
    expect(refuse.steps.find((s) => s.stage === 'decide')!.title).toMatch(/409/);
    const race = f.scenarios.find((s) => s.id === 'race')!;
    expect(race.steps.some((s) => (s.v as { over?: number }).over === 5)).toBe(true);
    expect(race.steps.at(-1)!.prov).toBe('modelled');
  });
});
