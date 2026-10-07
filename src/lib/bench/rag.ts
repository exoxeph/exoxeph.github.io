export type RagConfig = {
  topKFirst: number;
  acceptThreshold: number;
  maxRepairs: number;
  bm25WeightInit: number;
  vectorWeightInit: number;
  bm25WeightOnRepair: number;
  vectorWeightOnRepair: number;
  pruneMinOverlap: number;
  temperatureInit: number;
  temperatureOnRepair: number;
  rerankTopK: number;
  pruneMaxChars: number;
  contextMaxChars: number;
  enableStreaming: boolean;
  maxHistoryTurns: number;
  enableMemory: boolean;
  memoryMaxNotes: number;
  memoryTopK: number;
  memoryWritePolicy: string;
  memorySummarizeEvery: number;
  memorySummaryTargetChars: number;
  memoryInjectMaxChars: number;
};

export const DEFAULT_CONFIG: RagConfig = {
  topKFirst: 12,
  acceptThreshold: 0.72,
  maxRepairs: 1,
  bm25WeightInit: 0.5,
  vectorWeightInit: 0.5,
  bm25WeightOnRepair: 0.7,
  vectorWeightOnRepair: 0.3,
  pruneMinOverlap: 1,
  temperatureInit: 0.2,
  temperatureOnRepair: 0.1,
  rerankTopK: 8,
  pruneMaxChars: 2200,
  contextMaxChars: 4000,
  enableStreaming: true,
  maxHistoryTurns: 5,
  enableMemory: true,
  memoryMaxNotes: 32,
  memoryTopK: 5,
  memoryWritePolicy: 'conservative',
  memorySummarizeEvery: 4,
  memorySummaryTargetChars: 800,
  memoryInjectMaxChars: 1200,
};

export function route(score: number, cfg: RagConfig = DEFAULT_CONFIG) {
  const repair = score < cfg.acceptThreshold;
  return {
    kind: repair ? ('repair' as const) : ('accept' as const),
    changes: repair
      ? [
          { label: 'BM25 weight', from: cfg.bm25WeightInit, to: cfg.bm25WeightOnRepair },
          { label: 'vector weight', from: cfg.vectorWeightInit, to: cfg.vectorWeightOnRepair },
          { label: 'prune overlap', from: cfg.pruneMinOverlap, to: cfg.pruneMinOverlap + 1 },
          { label: 'template', from: 'compare', to: 'constrained' },
          { label: 'temperature', from: cfg.temperatureInit, to: cfg.temperatureOnRepair },
        ]
      : [],
  };
}

export function finalDecision(
  draftScore: number,
  afterRepairScore: number | null,
  cfg: RagConfig = DEFAULT_CONFIG,
) {
  const repaired = route(draftScore, cfg).kind === 'repair';
  const finalScore = repaired ? (afterRepairScore ?? draftScore) : draftScore;
  return { repaired, finalScore, accepted: finalScore >= cfg.acceptThreshold };
}
