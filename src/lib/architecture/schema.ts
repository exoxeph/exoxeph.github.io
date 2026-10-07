import { z } from 'astro/zod';

const evidence = z.object({
  state: z.enum(['verified', 'partially-verified']),
  text: z.string(),
  caveat: z.string().optional(),
});

export const architectureSchema = z.object({
  project: z.string(),
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      order: z.number().optional(),
      role: z.string(),
      why: z.string().optional(),
      io: z.object({ in: z.string(), out: z.string() }).optional(),
      decision: z.string().optional(),
      failure: z.string().optional(),
      control: z.string().optional(),
      evidence: z.array(evidence).optional(),
      limitation: z.string().optional(),
      source: z.string().optional(),
    }),
  ),
  edges: z.array(z.object({ from: z.string(), to: z.string() })),
});
export type ArchitectureNode = z.infer<typeof architectureSchema>['nodes'][number];
