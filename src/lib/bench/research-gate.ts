import { getCollection } from 'astro:content';

/**
 * The sealed research channel is public-safe by construction, but Research must not appear before the
 * owner approves publication: it renders only when the draft's status is `published`. A preview build
 * for design review can set PUBLIC_BENCH_RESEARCH=1; production builds never do.
 */
export async function researchEntry() {
  const published = await getCollection('research', (entry) => entry.data.status === 'published');
  if (published[0]) return published[0];
  if (import.meta.env.PUBLIC_BENCH_RESEARCH === '1') return (await getCollection('research'))[0];
  return undefined;
}
