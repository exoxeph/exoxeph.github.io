# Storybook Home Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the home page into a snap-scrolled storybook: an opening page, a promise page, four project moments of four pages each (layout B, pinned live diagram), and a closing page, with far less text and every existing fact kept.

**Architecture:** Keep the existing bench machinery (pinned stage, `bench:beat` events, per-beat deck frames, notes, guide) and its five canonical beat frames per project, but tell each project in four pages: beat `0` (it fails), beat `1` (how it catches it, showing the beat 1 and beat 2 inspector pictures together), beat `3` (it survives), beat `4` (the idea holds). Chapter blocks carry those `data-beat` values, so stage controllers and guide stops keep working unchanged; the deck shows frames `1` and `2` together on the beat 1 page. No existing diagram is removed. Short beat lines come from new content fields; the long wording moves into the existing disclosures. Native CSS scroll snapping turns each block into a page.

**Tech Stack:** Astro 7, TypeScript, CSS, Playwright e2e, axe.

**Spec:** `docs/superpowers/specs/2026-10-25-storybook-home-design.md`

## Global Constraints

- Do not commit or push. The owner commits only when they say "push it"; each task ends with a checkpoint instead.
- Never stage `scripts/assets/make-thumbnail.mjs`, `scripts/assets/thumbnail.html`, `scripts/assets/thumbnail-retrieval.html`, or the unrelated résumé CGPA edits (`src/pages/resume.astro`, `tests/e2e/resume.spec.ts`).
- Copy: first person, no em or en dashes (the résumé test enforces `/[–—]/`), no "2x"-style claims, no new claims or numbers.
- Every fact, number, evidence label and limitation on today's home page stays true and stays with its project; full wording stays one click away.
- Beat lines: one line, at most 20 words.
- Snapping: native CSS `scroll-snap-type: y mandatory` on the home page only; no script scroll hijacking.
- Every snapped page fits one viewport at 1440x900, 1280x720 and 390x844 with disclosures closed.
- Hand notes start on; the header toggle stays as is.
- Existing budgets (`npm run size`, `node scripts/perf-assets.mjs --check`) and checks (`npx astro check`, `npm run lint:content`, `npm run build`, `npx playwright test`) must pass at every checkpoint.
- Tests change with the structure but keep checking the same things (order, copy honesty, controls, accessibility); never delete an assertion without replacing what it protected.

## Review Focus

1. Opening an "In engineering terms" disclosure inside a snapped beat makes it taller than the screen: the reader must be able to scroll through it and on, never get pulled back to the beat's top. (Task 3, `disclosure-does-not-trap`.)
2. Short laptop screens (1280x720) and landscape phones: beats must still fit, or the snap hides text. (Task 3, `pages-fit-viewport`.)
3. Keyboard users tabbing into a beat's controls (the seat slider, email scenarios): focus moves must not be fought by snapping, and the focused control stays visible. (Task 3, `keyboard-focus-visible`.)
4. Deep links (`/#work`, `/#chapter-email`) and the chapters' "try it ↑" buttons must land on the right page under snapping. (Task 3, `deep-links-land`.)
5. No JavaScript and reduced motion: the page still reads top to bottom, every beat line visible, no animation needed. (Task 6, `nojs-reads`, `reduced-motion-reads`.)

---

### Task 1: Clear the superseded experiment and set the baseline

**Files:**
- Modify (restore from HEAD): `src/components/bench/Chapters.astro`, `src/components/bench/Deck.astro`, `src/styles/bench.css`, `tests/e2e/a11y-phase17.spec.ts`, `tests/e2e/chapters.spec.ts`, `tests/e2e/notes.spec.ts`, `tests/e2e/opening.spec.ts`
- Keep: `src/components/bench/BenchEnd.astro`, `src/components/notes/stageNotes.ts` (their copy edits stay)
- Modify: `.gitignore`

- [ ] **Step 1:** `git checkout -- src/components/bench/Chapters.astro src/components/bench/Deck.astro src/styles/bench.css tests/e2e/a11y-phase17.spec.ts tests/e2e/chapters.spec.ts tests/e2e/notes.spec.ts tests/e2e/opening.spec.ts`
- [ ] **Step 2:** Re-apply the two kept copy edits in `Chapters.astro`: the operate button text `bench ↑` becomes `try it ↑` (both places), and the `<dt>Why it matters</dt><dd>{c.matters}</dd>` row is removed. In `tests/e2e/opening.spec.ts` change the story terms assertion to `toEqual(['Goes wrong', 'What it does'])`.
- [ ] **Step 3:** Add `.superpowers/` to `.gitignore`.
- [ ] **Step 4: Checkpoint.** Run `npx astro check && npm run lint:content && npm run build && npx playwright test`. Expected: 0 errors and all tests pass (277 at the time of writing).

### Task 2: Four pages per project, with short beat lines

**Files:**
- Modify: `src/content.config.ts` (chapter schema), `src/content/projects/ride-pooling-lifecycle.mdx`, `llm-email-pipeline.mdx`, `retrieval-orchestration.mdx`, `speech-document-extraction.mdx`
- Create: `src/lib/bench/beats.ts`
- Modify: `src/components/bench/Chapters.astro`, `src/lib/bench/chapters.ts`, `src/components/bench/Deck.astro`, `src/styles/deck.css`, `src/styles/bench.css`
- Create: `tests/e2e/storybook.spec.ts`
- Modify: `tests/e2e/chapters.spec.ts`, `tests/e2e/a11y-phase17.spec.ts`, `tests/e2e/notes.spec.ts`, `tests/e2e/opening.spec.ts`

**Interfaces:**
- Produces: content field `chapter.beats: { fails: string; catches: string; survives: string; holds: string }` (each 20 words or fewer); chapter blocks `.cblock[data-beat="0"|"1"|"3"|"4"]` with `h4` texts `It fails`, `How it catches it`, `It survives`, `The idea holds`, each holding one `.beat-line`; `export const BEATS = [0, 1, 3, 4] as const` and `export const BEAT_NAMES: Record<number, string> = { 0: 'It fails', 1: 'How it catches it', 3: 'It survives', 4: 'The idea holds' }` in `src/lib/bench/beats.ts`, used by both `Chapters.astro` and `chapters.ts`.

- [ ] **Step 1: Write the failing test** `tests/e2e/storybook.spec.ts`, test `each project is told in four pages`:
  - for each channel in `['pool', 'email', 'rag', 'speech']`, the chapter's `.cblock` elements have `data-beat` values `['0', '1', '3', '4']` and `h4` texts starting `It fails`, `How it catches it`, `It survives`, `The idea holds`;
  - the visible text of each `.cblock .beat-line` is 20 words or fewer;
  - every deck frame that exists today is still in the page: `.df[data-ch="<channel>"][data-b]` count is 5 for each channel;
  - the chapter still contains (as text, inside disclosures is fine) its existing `wrong`, `does`, `decisionPlain`, `evidenceHuman` and `limitationPlain` copy, read from the content files the way `chapters.spec.ts` reads `copy[channel]`.
- [ ] **Step 2:** Run `npx playwright test storybook` and expect FAIL (five blocks today).
- [ ] **Step 3:** Add `beats` to the chapter schema in `src/content.config.ts` (`z.object({ fails: z.string().max(140), catches: z.string().max(140), survives: z.string().max(140), holds: z.string().max(140) })`) and write the sixteen lines in the four project files. Rules: each line paraphrases existing copy only; `fails` comes from `wrong`; `catches` from the mechanism (`does` and `decisionPlain`, matching the two inspector pictures); `survives` from `does` plus the recorded result in `evidenceHuman`; `holds` from `decisionPlain` and always states the project's limit from `limitationPlain` in short form. Keep the mock/self-reported qualifiers wherever the result is quoted. List the sixteen lines in the checkpoint message for the owner's review.
- [ ] **Step 4:** Rebuild `Chapters.astro` so each project renders four blocks: `data-beat="0"` (question, `myPart`, `beat-line` = `beats.fails`, disclosure "In engineering terms" with `wrong`, `capability`, `problem`, stack), `data-beat="1"` (`beat-line` = `beats.catches`, disclosure with `does`, `decisionPlain`, `decision` and the route map list), `data-beat="3"` (`beat-line` = `beats.survives`, disclosure with `evidenceHuman` and the evidence detail), `data-beat="4"` (`beat-line` = `beats.holds`, disclosure with `limitationPlain`, `limitation`, then the case study / watch it run links and the next-system link). Header ticks: four. Keep ids, `data-chapter`, `#work` on the first chapter, and the research chapter unchanged.
- [ ] **Step 5:** In `src/lib/bench/chapters.ts` replace the `beatNames` array with `BEAT_NAMES`; `showBeat` lights ticks by the beat's index in `BEATS`. Keep every `Deck.astro` frame. In `src/styles/deck.css` show frame `2` together with frame `1` while `bench[data-beat='1']` (side by side when the stage is wide enough, otherwise stacked compactly; the existing test "the pinned stage never overflows its height with the deck" must still pass), and make the deck ticks four: beats 0, 1, 3, 4 light one to four. In `placeFrames` (`chapters.ts`) insert frame `2` into the beat `1` block on phones. In `src/styles/bench.css` retarget the `.cblock[data-beat='2'|'3'|'4']` rules to the new blocks and add `.beat-line` (today's `.csub` serif style, larger).
- [ ] **Step 6:** Update the existing tests to four pages without dropping what they protect: `chapters.spec.ts` (deck follows beats `[0, 1, 3, 4]` for every channel, and on beat `1` both frames `1` and `2` are shown; jump-into-beat uses beat `3`; show-on-the-bench uses the route map now inside beat 1's disclosure), `a11y-phase17.spec.ts` (four `h4` per chapter with unique suffixes), `notes.spec.ts` (every deck frame keeps its note; overlap checks over beats `0, 1, 3, 4`), `opening.spec.ts` (engineering-depth needles still found, now in disclosures).
- [ ] **Step 7: Checkpoint.** Run the full check list from Global Constraints. Expected: all pass; `storybook.spec.ts` passes.

### Task 3: Snap scrolling, one screen per page

**Files:**
- Modify: `src/styles/bench.css`, `src/pages/index.astro`
- Modify: `tests/e2e/storybook.spec.ts`

**Interfaces:**
- Consumes: `.cblock[data-beat]` from Task 2.
- Produces: the snap container rule on `html:has(.story)` and the class `story-page` (snap point, `scroll-snap-align: start`, height of one screen below the sticky header) that Tasks 4 and 5 apply to their pages.

- [ ] **Step 1: Write the failing tests** in `storybook.spec.ts`:
  - `home snaps, other pages do not`: on `/`, `getComputedStyle(document.documentElement).scrollSnapType` contains `y mandatory`; on `/work/` it is `none`.
  - `pages-fit-viewport`: at 1440x900, 1280x720 and 390x844, every `.story-page` has `getBoundingClientRect().height <= innerHeight + 1` with all `details` closed.
  - `disclosure-does-not-trap`: open the first beat's `details`, press `PageDown` until `scrollY` stops growing; the last value is beyond that block's bottom.
  - `keyboard-focus-visible`: focus the pool seat slider (`getByRole('slider', { name: /request/i })`), press `ArrowRight`; the slider's rect stays inside the viewport.
  - `deep-links-land`: `/#chapter-email` and `/#work` end with that element's top within 0 to 100 px of the viewport top; clicking a chapter's `try it ↑` brings the stage into view.
- [ ] **Step 2:** Run them and expect FAIL.
- [ ] **Step 3:** Add `class="story"` to the storybook wrapper in `index.astro`; add `html:has(.story) { scroll-snap-type: y mandatory; scroll-padding-top: <header height>; }` and `.story-page { scroll-snap-align: start; scroll-snap-stop: normal; min-height: calc(100svh - <header height>); }`; give each `.cblock` the `story-page` class. Remove the `min-height: calc(100vh - 160px)` on `.chapter` (the beats now set the height).
- [ ] **Step 4:** Run the tests and expect PASS; then the full checkpoint.

### Task 4: Opening page and promise page

**Files:**
- Create: `src/components/story/StoryOpen.astro`, `src/components/story/ProjectIcons.astro`, `src/lib/story/promise.ts`
- Modify: `src/pages/index.astro` (replace `<Hero />` with `<StoryOpen />`)
- Delete: `src/components/hero/Hero.astro` and its script/styles if nothing else imports them; rewrite `tests/e2e/hero.spec.ts`
- Modify: `tests/e2e/storybook.spec.ts`, plus any hero assertions in `a11y-phase17.spec.ts`, `opening.spec.ts`, `notes.spec.ts`, `mobile.spec.ts`, `nojs.spec.ts`, `a11y.spec.ts`, `contact.spec.ts`

**Interfaces:**
- Consumes: `story-page` from Task 3; `site` data (`src/data/site.ts`) for name and role.
- Produces: two `.story-page` sections, `#story-open` and `#story-promise`; `ProjectIcons.astro` rendering `a.promise-icon` links with `href` `#work`, `#chapter-email`, `#chapter-rag`, `#chapter-speech` (car, envelope, document, report), reused by Task 5; `promise.ts` adds `.is-lit` to an icon once its chapter has been reached (listening to the existing `bench:beat` event).

- [ ] **Step 1: Write the failing tests** in `storybook.spec.ts`:
  - `opening page`: one `h1` with the owner's name; text `AI Engineer`; text `I build AI systems and test what they do when inputs go wrong.`; no `role="tab"` inside `#story-open`; an `svg` picture of the idea with an accessible name.
  - `promise page`: `#story-promise` contains four `a.promise-icon` with the hrefs above, in that order; contains `409`; its text outside the icon labels is 30 words or fewer.
- [ ] **Step 2:** Run and expect FAIL.
- [ ] **Step 3:** Build `StoryOpen.astro`: page 1 (name, role, the one line, the idea picture: a request, a check in its path, the system acts only if it passes, drawn in the site's existing SVG language and tones, plus a scroll cue); page 2 (one line in the spirit of "Four systems. Each one breaks somewhere. Here's where, and what catches it.", `ProjectIcons`, and the proof line about the over-capacity request refused with HTTP 409 taken from the ride-pooling evidence). The notes system may annotate these pages with the existing `Note` component. Remove the five-tab hero demo and its now-unused script; keep anything the bench or notes still import.
- [ ] **Step 4:** Update the hero tests: every hero assertion is either moved to the opening/promise tests (name, role, one line, proof) or removed because the five-tab demo is gone (its five cases are covered by the project beats).
- [ ] **Step 5:** Run and expect PASS; full checkpoint.

### Task 5: Closing page

**Files:**
- Create: `src/components/story/StoryEnd.astro`
- Modify: `src/components/bench/Bench.astro` (move `<BenchEnd />` out), `src/pages/index.astro`
- Modify: `tests/e2e/storybook.spec.ts`, and any test that locates `BenchEnd` inside `.bench`

**Interfaces:**
- Consumes: `story-page`, `ProjectIcons.astro`, `BenchEnd.astro` (its `data-end-*` hooks unchanged, so `src/lib/bench/chapters.ts` keeps filling it).
- Produces: `.story-page#story-end` after the bench.

- [ ] **Step 1: Write the failing test** `closing page`: `#story-end` contains `Four systems, one idea: check before acting`; links named résumé, case studies and contact pointing to `/resume/`, `/work/`, `/contact/`; contains `[data-end-empty]`; contains four `a.promise-icon`.
- [ ] **Step 2:** Run and expect FAIL.
- [ ] **Step 3:** Build `StoryEnd.astro` with `ProjectIcons`, the line, three links and `<BenchEnd />`. Remove `<BenchEnd />` from `Bench.astro`. Confirm the "What you tested" record still fills after operating a control (`chapters.spec.ts` test "what you tested lists earlier tests and copies them as text").
- [ ] **Step 4:** Run and expect PASS; full checkpoint.

### Task 6: Phones, no JavaScript, reduced motion

**Files:**
- Modify: `src/styles/bench.css`, `src/styles/deck.css`, `src/lib/bench/chapters.ts` (`placeFrames` insert point) as needed
- Modify: `tests/e2e/storybook.spec.ts`, `tests/e2e/mobile.spec.ts`, `tests/e2e/nojs.spec.ts`

- [ ] **Step 1: Write the failing tests:**
  - `phone beats stack`: at 390x844, each beat block contains its inline deck frame before its `.beat-line`, and fits the viewport.
  - `nojs-reads`: with JavaScript disabled, all sixteen `.beat-line` texts and the opening and closing lines are visible.
  - `reduced-motion-reads`: with `reducedMotion: 'reduce'`, snapping still applies and no element has a running animation after load.
- [ ] **Step 2:** Run and expect FAIL where the layout needs work.
- [ ] **Step 3:** On narrow screens order each beat as frame then line (adjust `placeFrames`' insert point and the block layout); keep the controls under each project's first beat; make sure the no-JS page shows recorded frames and the lines.
- [ ] **Step 4:** Run and expect PASS; full checkpoint.

### Task 7: Guide, measurements and owner review

**Files:**
- Modify: `src/lib/guide/lines.ts` (only if the beat 2 stops are now dead and should be removed)
- Modify: `tests/e2e/storybook.spec.ts`

- [ ] **Step 1: Write the failing test** `guide follows the four pages`: at 1440x900, scrolling to each project's beats `0`, `1`, `3`, `4` keeps `[data-guide]` visible and changes its stop each time, and it never shows a line for beat `2`.
- [ ] **Step 2:** Run; fix the guide only if it fails (stops are indexed by beat number, so beats 0, 1, 3 and 4 already resolve).
- [ ] **Step 3:** Measure the main text on `/` at 1440x900 (report the number against today's ~1,860 words), the number of pages, and take one screenshot per page at 1440x900 and 390x844.
- [ ] **Step 4: Final checkpoint.** Full check list, the Impeccable detector once (`impeccable detect --json src/components src/pages`), then hand the owner the sixteen beat lines, the opening, promise and closing copy, the screenshots and the word count. Commit only after the owner says "push it".
