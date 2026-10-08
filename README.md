# exoxeph.github.io

Source for the portfolio at https://exoxeph.github.io/. Astro 7 (static output), TypeScript, MDX, vanilla CSS. No backend, no runtime API calls, no analytics.

## Requirements

Node 24 (see `.nvmrc`; Node 22.19 or later also works) and npm.

## Commands

| Command                 | Purpose                                                                     |
| ----------------------- | --------------------------------------------------------------------------- |
| `npm run dev`           | Local development server                                                    |
| `npm run build`         | Production build into `dist/`                                               |
| `npm run preview`       | Serve the production build locally                                          |
| `npm run check`         | Astro type and diagnostics check                                            |
| `npm test`              | Unit tests (Vitest)                                                         |
| `npm run test:e2e`      | Playwright end-to-end, keyboard, mobile, no-JS and axe tests                |
| `npm run lint:content`  | Content lint (dashes, unverified qualifiers, required sections)             |
| `npm run release:check` | Stricter lint for publishing: fails on placeholders and unconfirmed wording |
| `npm run size`          | Build size report with budgets                                              |

## Structure

- `src/content/projects/*.mdx`: case studies (frontmatter is validated by Zod in `src/content.config.ts`).
- `src/data/traces/*.json`: Engineering Trace data, one canonical file per trace (schema in `src/lib/trace/schema.ts`).
- `src/lib/trace/`: pure trace state machine and the progressive enhancer.
- `src/components/`, `src/layouts/`, `src/styles/`: presentation.
- `src/data/site.ts`: person, links and the résumé switch.

## Rules

Evidence states (verified, partially verified, not claimed) are part of the content schema. Results are stated only with their evidence. Do not commit secrets or private material; the build needs none.

## Revamping

Read [`REVAMP_GUIDE.md`](REVAMP_GUIDE.md) before changing the site: the CI gate, the size budgets, the content and design rules, and the mistakes to avoid.
