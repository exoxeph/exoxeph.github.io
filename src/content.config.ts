import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { traceSchema, evidenceState } from './lib/trace/schema.ts';

const link = z.object({ label: z.string().min(2), url: z.url() });

const projectBase = z.object({
  title: z.string().min(5),
  description: z.string().min(40),
  capability: z.string().min(20),
  type: z.enum(['solo', 'team', 'research-group']),
  domain: z.string().min(3),
  status: z.enum(['complete', 'prototype', 'ongoing', 'archived']),
  tier: z.enum(['primary', 'secondary', 'archive']),
  order: z.number().int(),
  publicLevel: z.enum(['public', 'public-with-attribution-care']),
  diagram: z.enum(['email', 'rag', 'speech', 'pool']),
  chapter: z.object({
    channel: z.enum(['email', 'rag', 'speech', 'pool']),
    question: z.string().min(15).max(80),
    // One sentence a recruiter with no specialist knowledge can repeat; the technical `capability` stays underneath it.
    plain: z.string().min(40).max(220),
    // Level 1 (recruiter): what goes wrong, why it matters, what the system does about it, and my part in it.
    wrong: z.string().min(30).max(220),
    matters: z.string().min(30).max(220),
    does: z.string().min(30).max(240),
    myPart: z.string().min(30).max(240),
    // The same decision, evidence and limitation in plain words; the technical versions stay beneath them.
    decisionPlain: z.string().min(30).max(240),
    evidenceHuman: z.string().min(30).max(260),
    limitationPlain: z.string().min(30).max(320),
    problem: z.string().min(40),
    decision: z.string().min(30),
    limitation: z.string().min(30),
  }),
  technologies: z.array(z.string().min(2)).min(2).max(5),
  contribution: z.object({
    role: z.string().min(5),
    personal: z.string().min(10),
    basis: z.enum(['commit-attributed', 'blame-attributed', 'user-stated']),
    team: z.string().optional(),
    upstream: z.string().optional(),
    aiAssistance: z.string().optional(),
    aiAssistanceConfirmed: z.boolean().default(false),
    provenance: z.string().optional(),
  }),
  evidenceLine: z.object({ text: z.string().min(20), state: z.literal('verified'), evidenceId: z.string() }),
  evidence: z
    .array(
      z.object({
        id: z.string(),
        claim: z.string().min(10),
        state: evidenceState,
        source: z.string().min(3),
        howChecked: z.string().min(3),
        caveat: z.string().optional(),
      }),
    )
    .min(1),
  limitations: z.array(z.string().min(10)).min(1),
  traces: z.array(z.string()).default([]),
  links: z.array(link).min(1),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/projects' }),
  schema: projectBase.superRefine((p, ctx) => {
    const ref = p.evidence.find((e) => e.id === p.evidenceLine.evidenceId);
    if (!ref) {
      ctx.addIssue({
        code: 'custom',
        message: `evidenceLine references unknown evidence "${p.evidenceLine.evidenceId}"`,
        path: ['evidenceLine'],
      });
    } else if (ref.state !== 'verified') {
      ctx.addIssue({
        code: 'custom',
        message: 'evidenceLine must reference VERIFIED evidence',
        path: ['evidenceLine'],
      });
    }
    for (const e of p.evidence) {
      if (e.state === 'partially-verified' && !e.caveat) {
        ctx.addIssue({
          code: 'custom',
          message: `partially-verified evidence "${e.id}" needs a caveat`,
          path: ['evidence'],
        });
      }
    }
    if (p.type !== 'solo' && !p.contribution.team) {
      ctx.addIssue({
        code: 'custom',
        message: 'team and research projects require contribution.team',
        path: ['contribution', 'team'],
      });
    }
  }),
});

const research = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/research' }),
  schema: z.object({
    title: z.string().min(5),
    description: z.string().min(40),
    status: z.enum(['draft', 'published']),
    researchLevel: z.enum(['A', 'B']),
    question: z.string().min(20),
    contribution: z.object({ role: z.string(), team: z.string(), upstream: z.string() }),
    approvals: z.array(z.string()).default([]),
    disclosureNotes: z.string().min(20),
    limitations: z.array(z.string()).min(1),
  }),
});

const traces = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/data/traces' }),
  schema: traceSchema,
});

export const collections = { projects, research, traces };
