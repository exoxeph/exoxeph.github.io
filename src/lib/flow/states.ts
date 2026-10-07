import type { FlowData, FlowScenario } from './types';

export type StageState = 'done' | 'active' | 'ahead' | 'skip';

/** Where every stage stands at a given step. A stage the scenario never reaches is "skip" (not reached). */
export function stageStates(
  data: FlowData,
  scenario: FlowScenario,
  index: number,
): Record<string, StageState> {
  const reached = new Set(scenario.steps.map((s) => s.stage));
  const seenSoFar = new Set(scenario.steps.slice(0, index).map((s) => s.stage));
  const current = scenario.steps[index]!.stage;
  const out: Record<string, StageState> = {};
  for (const stage of data.stages) {
    if (stage.id === current) out[stage.id] = 'active';
    else if (seenSoFar.has(stage.id)) out[stage.id] = 'done';
    else out[stage.id] = reached.has(stage.id) ? 'ahead' : 'skip';
  }
  return out;
}
