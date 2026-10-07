import { z } from 'astro/zod';

export const evidenceState = z.enum(['verified', 'partially-verified', 'unverified']);
const stage = z.enum([
  'capability',
  'expected',
  'invalid',
  'control',
  'measurement',
  'outcome',
  'limitation',
]);

const visual = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('state-gauge'),
    capacity: z.number().int().positive(),
    cells: z.array(z.string().min(1)),
    pending: z.object({ label: z.string().min(1), seats: z.number().int().positive() }).optional(),
    refused: z.boolean().optional(),
  }),
  z.object({ kind: z.literal('none') }),
]);

const state = z.object({
  id: z.string().min(1),
  variant: z.string().min(1),
  stages: z.array(stage).min(1),
  kind: z.enum(['valid', 'invalid', 'rejected']),
  title: z.string().min(3),
  text: z.string().min(10),
  visual,
  record: z
    .object({
      httpStatus: z.number().int().optional(),
      httpMessage: z.string().optional(),
      events: z.array(z.string()),
      requests: z.array(
        z.object({
          label: z.string(),
          seats: z.number().int(),
          status: z.string(),
          pool: z.string().optional(),
        }),
      ),
    })
    .optional(),
});

const rank = { verified: 3, 'partially-verified': 2, unverified: 1 } as const;

export const traceSchema = z
  .object({
    project: z.string().min(1),
    title: z.string().min(5),
    summary: z.string().min(20),
    capability: z.string().min(10),
    expectedBehavior: z.string().min(10),
    trigger: z.string().min(10),
    control: z.string().min(10),
    measurement: z.string().min(10),
    outcome: z.string().min(10),
    limitation: z.string().min(10),
    verificationStatus: evidenceState,
    evidence: z
      .array(z.object({ claim: z.string().min(10), state: evidenceState, caveat: z.string().optional() }))
      .min(1),
    provenance: z.object({
      method: z.string().min(10),
      database: z.string().min(3),
      commits: z.object({ before: z.string(), after: z.string() }).optional(),
      testName: z.string().optional(),
    }),
    variants: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(1),
    states: z.array(state).min(2),
    alsoKnown: z
      .object({ title: z.string(), text: z.string(), state: evidenceState, caveat: z.string() })
      .optional(),
  })
  .superRefine((t, ctx) => {
    const ids = new Set(t.variants.map((v) => v.id));
    const seen = new Set<string>();
    t.states.forEach((s, i) => {
      if (seen.has(s.id))
        ctx.addIssue({ code: 'custom', message: `duplicate state id "${s.id}"`, path: ['states', i, 'id'] });
      seen.add(s.id);
      if (s.variant !== '*' && !ids.has(s.variant)) {
        ctx.addIssue({
          code: 'custom',
          message: `state "${s.id}" references unknown variant "${s.variant}"`,
          path: ['states', i, 'variant'],
        });
      }
      if (s.visual.kind === 'state-gauge' && s.visual.cells.length > 10) {
        ctx.addIssue({
          code: 'custom',
          message: 'state-gauge supports at most 10 cells',
          path: ['states', i, 'visual'],
        });
      }
    });
    for (const v of t.variants) {
      const n = t.states.filter((s) => s.variant === '*' || s.variant === v.id).length;
      if (n < 2)
        ctx.addIssue({
          code: 'custom',
          message: `variant "${v.id}" has fewer than 2 states`,
          path: ['variants'],
        });
    }
    // the trace status can not be stronger than its weakest evidence
    const weakest = Math.min(...t.evidence.map((e) => rank[e.state]));
    if (rank[t.verificationStatus] > weakest) {
      ctx.addIssue({
        code: 'custom',
        message: 'verificationStatus is stronger than the weakest evidence item',
        path: ['verificationStatus'],
      });
    }
  });
