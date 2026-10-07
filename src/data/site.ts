/** Public site facts. Contact placeholders are `null` on purpose: they cannot ship (see scripts/validate-content.ts --release). */
export const site = {
  name: 'Imtiaz Mashrafee',
  role: 'AI Engineer',
  url: 'https://exoxeph.github.io',
  title: 'Imtiaz Mashrafee, AI Engineer',
  description:
    'AI engineer who builds language-model systems and tests how they behave when inputs go wrong. Four case studies, each with its evidence and limits.',
  lede: 'I build AI systems and test what they do when inputs go wrong.',
  areas: ['AI/ML systems', 'LLM systems', 'Applied ML and NLP research'],
  links: {
    github: 'https://github.com/exoxeph',
    linkedin: 'https://www.linkedin.com/in/imtiazmashrafee' as string | null,
    email: 'imtiazmashrafee@gmail.com' as string | null,
  },
  /** The résumé page is published (privacy review done); set `available: false` to hide it. */
  resume: { available: true, path: '/resume/' },
} as const;

export type Site = typeof site;
