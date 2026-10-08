# Revamp guide

Read this before changing the portfolio again. It records how the site is built, what the automated gate enforces, and the mistakes that cost time on the way here. Written October 2026.

## 1. Start here

1. Work in `G:\exoxeph.github.io` (the site). Node 24, then `npm ci`.
2. `npm run dev` for a live preview. Use a port that is not 4321 (for example `npx astro dev --port 4400`), because the test suite uses 4321.
3. Before every push, run the same gate CI runs (section 3). If it is green locally it will be green on GitHub. Every failed deploy in this project came from skipping one of these steps.
4. Push to `main`. GitHub Actions verifies, builds and deploys to https://exoxeph.github.io/ in about 3 minutes. Watch it: `gh run watch`.

## 2. Two repositories, do not mix them up

| What | Repo | Local folder |
| --- | --- | --- |
| The portfolio website | `exoxeph/exoxeph.github.io` | `G:\exoxeph.github.io` |
| The GitHub profile page (README) | `exoxeph/exoxeph` | `G:\exoxeph` |

"The website" always means the first one. The profile README is a separate, much simpler repo (`README.md`, `assets/headers/*.svg`, `assets/certs/*.png`). Ask which one is meant before editing anything that could be either (certifications and the GitHub picture exist in both).

CV files live in `G:\` as `Imtiaz Mashrafee.docx` (main, designed), `Imtiaz Mashrafee - ATS.docx` (plain single column, generated) and PDFs. When a fact changes (a certification, a title), update all of them and the site's `src/pages/resume.astro`.

## 3. The gate (what CI runs)

Run these in `G:\exoxeph.github.io`, in this order:

```
npm run check          # Astro type check, must be 0 errors
npm test               # unit tests (59)
npm run lint:content   # content rules, see section 4
npm run release:check  # stricter content rules
npm run build
npm run size           # size and route budgets
npx playwright test    # 273 end-to-end tests, builds and serves on port 4321 itself
```

Also run `npx prettier --write` on any `.css`, `.astro` or `.ts` file you touched (CI does not check it, the repo keeps its files formatted). Prettier must not be run on `.mdx`, it flattens lists and breaks JSX.

### Budgets (deliberate, documented in `scripts/size-report.ts` and `scripts/perf-assets.mjs`)

| Budget | Limit |
| --- | --- |
| Largest page inline CSS (gzip) | 21.5 KB |
| Home page initial JS (gzip) | 9 KB, full Bench JS 31 KB |
| Transfer (brotli) | home 122 KB, case studies 105 KB, other pages 100 KB |
| Fonts | 135 KB total, 72 KB preloaded |
| Any single image | 40 KB |

Budgets have been raised on purpose several times, each with a comment saying why (new feature, measured size). That is allowed. Do it consciously, in both files, with a comment, never to silence a failure you do not understand.

## 4. Content rules (enforced by `npm run lint:content`)

- No en or em dashes anywhere in `src/`. Use a comma, colon or period.
- No multiplier claims such as "2x" or "400x", even inside a code comment. Write "twice" or state the numbers.
- Every project case study needs its required sections (see `src/lib/content/lint.ts`).
- `release:check` also fails on placeholders and on unconfirmed wording (`aiAssistanceConfirmed`, contact details, résumé switch in `src/data/site.ts`).
- Never weaken the release check to get a deploy through.

### The evidence rule behind the whole site

Every claim carries an evidence state: verified, partially verified, or not claimed. Behaviour shown on the page is one of three kinds, and must be labelled as that kind:

1. Recorded project run: reproduces recorded project output.
2. Runs in browser: a port of the real logic, checked against the original.
3. Modelled from the code: an explanation derived from the implementation, not an execution.

Never present a model as a live run. Source priority when facts disagree: verified code, committed outputs, git history, approved strategy, public README text, old draft wording. The public GitHub descriptions of some repositories overclaim (for example headline multipliers); do not copy them onto the site.

Voice and attribution:

- First person ("I built", "my part"), never "the owner" or "someone".
- Say "sole contributor in the commit history", not "sole author".
- Teammate-owned or group work is never presented as personal work. Upstream baseline code is never counted as original.
- Name credentials exactly: "AWS Certified AI Practitioner". The Udacity items are a nanodegree completion, not an AWS certification.
- The phone number is not published on the site. No secrets, no `.env` contents, anywhere.
- The research entry stays `status: draft` (no route, no nav item) until publishing is explicitly approved.

## 5. Design and behaviour invariants

These are the things that look safe to change and are not. Each has a test that will fail if broken.

- Visible project = active channel = sticky identity = inspector = stage frame. Scrolling must never fight a visitor's manual choice.
- The pinned Bench stage must fit its height at 1440x900, 1536x864 and 1920x1080 (`chapters.spec.ts`). Anything taller in the stage (a bigger headline, an extra row) will fail it. Scale with `vh` as well as `vw`.
- Without JavaScript the stage is not pinned and shows recorded states with a visible note. Keep that fallback.
- Navigation stays native: no scroll hijacking.
- Decorative images (portrait, GitHub avatar) have an empty `alt`, and the tests assert exactly one such image on those pages.
- Motion respects `prefers-reduced-motion`, and forced-colors mode gets system colors. No animation runs forever on a timer. Shimmers play a few times, or follow scroll or hover.
- Do not add particles, glowing blobs, random WebGL or decorative neural nets. The distinctive part of the site is the inspectable systems, not effects.
- The creative approach: capability first, then what could go wrong, then the control, then the measured outcome. The homepage must not read as a list of failures.
- Case-study flow styles use the `cf-` prefix and deck classes the `d-` prefix. A class collision with the hero already happened once. Namespace new CSS.

## 6. Performance decisions already made (do not relitigate without measuring)

- CSS is inlined into every page (`build.inlineStylesheets: 'always'`): faster first paint, small cost on case studies.
- Fonts are vendored, Newsreader narrowed to weights 400 to 700, Comic Neue subset to the used characters.
- Portrait is a line-engraving WebP; AVIF was rejected because it softened the dither.
- Rejected after measuring: `content-visibility` on chapters, link prefetching, a service worker, deferring the Tesla controller, a post-build CSS optimiser.
- Hand-note placement was the big scroll cost; it is lazy and read-before-write. Do not make it eager.
- Images: use small WebP at about twice the display size. PNG logos (58 KB) broke the `/resume/` budget on the first attempt; 168 px WebP (5 KB each) fixed it.
- Logos for credentials: take the official image (for Credly, the 600 px `images.credly.com` file), not a crop from a CV. Tint lightly (about 20 percent for a multicolour badge, about 50 percent for a flat logo) so they stay recognisable.

## 7. Lessons learned (the expensive ones)

1. **Failures came from skipping the local gate**, not from hard problems: a size budget (PNG logos), the content lint (the characters "2x" in a comment), a layout test (headline too tall for the pinned stage), a CSS budget missed by 0.05 KB. Run section 3 first, every time.
2. **Stop servers before the e2e run.** A dev or preview server holding `dist/` makes Playwright's build-and-serve step fail. Different ports (4321 for tests, 4400 for you) avoid clashes.
3. **Do not judge layout from a zoomed screenshot.** Zooming reflows the page and shows a layout that does not exist. Measure with Playwright at 375, 768, 1000, 1280 and 1920 wide, and check every channel, not just the first.
4. **Make visual checks reproducible**: pause an animation at a fixed time with the Web Animations API (`getAnimations()[0].pause(); currentTime = ...`) before screenshotting.
5. **Real data beats approximations.** The GitHub picture is now loaded live from `https://github.com/exoxeph.png?size=280` with a bundled fallback, so it can never go stale, but note GitHub caches it for about 5 minutes.
6. **The live link needs a fallback.** The `onerror` handler swaps to a bundled copy. Keep that copy current when the picture changes a lot.
7. **Keep private planning out of public repos.** Strategy, audit and analysis folders were once kept inside the public profile repo and protected only by a `.gitignore` that was itself never committed. That is one `git add .` away from publishing private work. Keep planning outside any public repository.
8. **Cleanup debt builds up.** By the end the profile repo folder held 4.5 GB of cloned repositories, 338 MB of design experiments, phase reports and crash dumps, none of it part of either repo. Delete as you go, and keep working files outside the repo folders.
9. **Windows tooling traps.** Skill helper scripts that expect Linux (`soffice`, `zip`, docx validators) fail here. What worked: Python `zipfile` for packaging a docx, Word's own COM export for PDF and page checks, python-docx for generating the ATS CV. Python cannot see Git Bash `/tmp`; use real paths. Be careful with recursive deletes: the safety checks block them when a path cannot be resolved.
10. **Hooks may ask for facts before an edit** (importers, affected functions, the request). Provide them; they are there to prevent blind edits.
11. **Word documents split text into many tiny runs**, so searching the XML for a phrase finds nothing. Merge runs first, or rewrite whole paragraphs, and always render to check.
12. **Fix the content in every place it lives.** The same certification appears in the site, the profile README, the main CV, the ATS CV and the PDFs. A change is only done when all of them agree.
13. **Do not claim what was not tested.** Not tested: Firefox, WebKit, a physical phone, a real screen reader (NVDA/JAWS), Lighthouse after Phase 16. The site and docs say so; keep saying so until it changes.
14. **Codex (when used) has no network and a usage limit.** Claude collects remote data into local files first; Codex works offline on those. Treat its output as evidence, not as a decision.

## 8. Safe revamp procedure

1. Pull `main`, `npm ci`, run the full gate once to confirm a green start.
2. Make one change at a time. Re-run the relevant spec (`npx playwright test tests/e2e/<file>`), then the full gate before pushing.
3. For visual work, keep the creative freeze rules in section 5 and check widths and every channel with Playwright, not by eye alone.
4. If a budget fails, find out why first. If the growth is a deliberate feature, raise the budget in both files with a comment; otherwise shrink the asset.
5. Update the CVs and the profile README if any public fact changed.
6. Push, then watch the deploy and open the live pages (`/`, `/work/`, the four case studies, `/resume/`, `/contact/`, a bad URL).

## 9. Known open items

- No test with a real screen reader, a physical phone, Firefox or WebKit.
- Retrieval case study still lacks a genuinely recorded answer; Ride pooling concurrency (two accepts at once) is a stated gap; the Email case could use stronger recorded outputs.
- LinkedIn cannot be checked by script (it returns 405); click it by hand.
- The résumé header uses the formal full name while the site uses "Imtiaz Mashrafee"; confirm that is intended.
- `scripts/perf-lighthouse.mjs` and `scripts/perf-runtime.mjs` write into a folder outside the repo that no longer exists; create it or change the path before using them.
- `scripts/assets/` holds the generators for `public/og.png`, `public/apple-touch-icon.png` and the line-engraving portrait. `node scripts/assets/make-og.mjs` was re-run and works (the icon is identical, the OG image is close but not byte-identical, because the committed file was optimised afterwards, so check before committing a regenerated one). `make-portrait.mjs` needs the source photo, which is the CV portrait stored inside `Imtiaz Mashrafee.docx` (`word/media/image1.png`).

## 10. Record of the October 2026 cleanup

The old planning workspace in `G:\exoxeph` (phase reports, audits, design experiments, prototypes, strategy and concept notes, analysis clones of 15 repositories) was deleted. Every cloned repository was fully pushed to GitHub before deletion, so nothing unique was lost there. The decisions that mattered are summarised in this guide.
