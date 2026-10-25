# Storybook home page: design

Date: 2026-10-25. Status: written up after the conversation and a builder review; awaiting the owner's approval.

## Intent

The home page of exoxeph.github.io should read like a storybook: every scroll turns a page, one picture and one short
line at a time, with the page leading the visitor instead of handing them a dashboard to decode.

Two pieces of feedback drive it, both from the owner's supervisor:

- "I like the concept and style, but too much text. Reduce as much as possible; it's an overwhelming amount of text."
- "Every scroll, I would like it to be like a story book. That would be nice to have, like navigating the user."

What a visitor should feel by the last page, in the owner's words: "damn, this guy understood everything he did and
knows his stuff well", from a recruiter's perspective and from an engineer's.

The site already has the right ingredients (a pinned diagram stage that changes with scrolling, per-project diagrams,
hands-on controls, hand notes). It does not feel like a story because a scroll does not land on one complete moment,
many elements compete on screen at once, page turns are too quiet to notice, each moment carries paragraphs, and four
projects told in an identical five-step template read as a catalogue rather than an arc.

## Goals

- Each scroll step shows one moment: the pinned picture plus roughly one line of text (about 10 to 20 words).
- Every project on the home page gets its own moment, told in three beats: where it fails, where it survives, and where
  the idea is reinforced.
- The story has an arc: an opening that sets up the idea, the four project moments, a closing page.
- A clear sense of progress and of each page turn.
- The full honesty of the current site is kept: every fact, number, evidence label and limitation stays true and stays
  with its project.

## Non-goals

- The résumé page (including the isometric dev room) and the case-study pages are not part of this change.
- No new framework, library or rendering approach.
- No new claims, numbers or results.

## Anti-goals (would make this a failure even if it works)

- A beat made more dramatic than the evidence allows, or a caveat dropped to save words (for example losing "stand-in
  (mock) database", "mock generator", "self-reported", or "two requests at the same moment still get through").
- Throwing away the existing diagrams and redrawing them.
- A page that only works with a mouse on a wide screen.
- Script-driven scroll hijacking that fights the reader's own scrolling (native snapping, chosen by the owner, is not
  this).

## The arc (decided)

1. **Opening page: who and the idea.** Name, "AI Engineer", and the existing one line "I build AI systems and test what
   they do when inputs go wrong." One small picture of the idea itself: a request comes in, a check sits in its path,
   and the system acts only if the check passes. Nothing to click; a scroll cue. The current five-tab hero demo is
   removed from the top (its five cases already live inside the four projects).
2. **The promise.** One line, in the spirit of "Four systems. Each one breaks somewhere. Here's where, and what catches
   it." The four projects as four small icons in a row (car, envelope, document, report) that light up one by one as the
   reader scrolls and hand off to their project. One proof line stays here (for example the over-capacity request
   refused with HTTP 409) so a recruiter who never scrolls further still sees something real.
3. **Four project moments,** in the existing order (ride pooling, email, retrieval, extraction). Each has three beats.
4. **Closing page.** The four icons side by side with "Four systems, one idea: check before acting", then three actions:
   résumé, case studies, contact. The existing "What you tested" record of what the visitor tried sits here too.

## A project moment (decided: layout "B")

- The project's picture stays pinned and changes in place; short beat lines scroll past beside it, and the active line
  lights up.
- The pinned picture is the project's existing diagram (the ride-pooling car and seats, the email checker, the retrieval
  score, the extraction rows), reused and pointed at the beats. Retaining the existing diagrams is a priority, though
  not the top one.
- Four pages per project (the owner added "How it catches it" after review, to keep each project's mechanism
  diagrams on the scroll):
  - **It fails:** the input or situation that breaks a naive version (today's "What goes wrong").
  - **How it catches it:** the mechanism, shown by today's two "How it responds" and "Decision" inspector pictures
    together on one page.
  - **It survives:** the check catches it, and the picture shows it holding (today's "How it responds" and "What
    happened", including the recorded evidence).
  - **The idea holds:** why the catch matters, tied back to "check before acting", and the honest limit of where it
    still fails (today's "Decision" and "Where it still fails").
- Each beat line is about one line. The longer wording and every caveat stay one click away (the existing "In
  engineering terms" disclosures and the case study link), so nothing true is lost.
- The hands-on controls stay alongside each project (seat slider, email scenarios, retrieval scores, extraction lines):
  a reader can just scroll and watch, or stop and operate.
- Each project keeps its links: case study, watch it run.

## Fixed constraints

- The hand notes start on, with the existing header toggle to turn them off.
- On phones there is no room to pin a picture beside text: each beat becomes picture then its line, stacked, about one
  screen per beat, in the same order, with the controls under each project.
- Accessibility, progressive enhancement (the page still reads without scripts) and reduced motion keep working as they
  do today; the current axe and no-JS tests stay meaningful.
- Existing performance and size budgets apply.
- Copy rules of the site: first person, no em or en dashes, no "2x" style claims.
- Build inside the existing Astro site, reusing the bench, the deck frames, the diagrams, the controls, the notes system
  and the "What you tested" record.
- The homepage guide (the mascot that walks along beside the beats) must keep working with the new beat count.

## Current state the builder starts from

- `src/components/hero/Hero.astro` (hero with the five-tab demo), `src/components/bench/Bench.astro` (pinned stage with
  per-project controls), `src/components/bench/Chapters.astro` (the chapter text, five beats per project, driven by
  `src/lib/bench/chapters.ts`), `src/components/bench/Deck.astro` (one inspection frame per project and beat),
  `src/components/bench/BenchEnd.astro` ("What you tested"), `src/components/notes/` (hand notes),
  `src/components/guide/Guide.astro` (the mascot guide), `src/styles/bench.css`.
- Each project's chapter copy lives in its content file under `src/content/projects/` (`chapter.question`, `wrong`,
  `matters`, `does`, `myPart`, `decisionPlain`, `evidenceHuman`, `limitationPlain`, and the engineering versions).
- The working tree holds an uncommitted experiment that cut the email, retrieval and extraction chapters to one-step
  summaries and removed their later deck frames. This design brings every project back to a full moment, so that
  experiment is superseded; a backup of the original `Deck.astro` exists in the session scratchpad, and git holds the
  rest. The small copy changes made at the same time ("try it" instead of "bench", "see what fails below", the shorter
  empty "What you tested" line, the removed "Why it matters" row) can stay.
- Tests in `tests/e2e/` pin today's five-beat structure in several places; they will change with the new structure and
  should keep checking the same things (order, honesty of copy, controls, accessibility), not be weakened.

## Scrolling (decided by the owner: snap)

- Each scroll lands exactly on the next page: the opening, the promise, each project beat, the closing page. This uses
  the browser's native scroll snapping (CSS `scroll-snap-type: y mandatory` on the story container, one snap point per
  page), not script-driven scroll hijacking, so wheel, trackpad, touch, keyboard (space, page down, arrow keys) and
  scrollbar all keep working and the browser decides the motion.
- Because a mandatory snap can trap content taller than the screen, every snapped page must fit within one viewport at
  the supported sizes, on desktop and on phones (where each stacked beat is its own snapped page). Anything longer goes
  behind a disclosure or links out, and opening a disclosure must not leave the reader stuck between snap points.
- The snapping applies to the storybook part of the home page only; the header, footer and any content after the
  closing page scroll normally.

## Settled after review (marked as the designer's calls unless noted)

- **The pinned picture is the live stage, as today.** Scrolling a beat moves the project's live, operable stage (and
  its deck frame), exactly as `chapters.ts` does now. The existing rule stays: right after the visitor uses a control,
  scrolling does not overwrite what they did. Only the visitor's own actions go into "What you tested"; states set by
  scrolling do not. (Designer's call: keep today's behavior.)
- **Caveats on screen.** The evidence label that each stage already shows (for example "Recorded project run", "Runs in
  this browser") stays visible next to the picture. The "idea holds" beat line always states the project's limit in
  short form (for example "Two at the same instant still both get through"). The full caveat wording ("stand-in (mock)
  database", "mock generator", "self-reported" and the rest) stays one click away in the beat's disclosure, as agreed in
  conversation. A beat line must never contradict or overstate those caveats.
- **Research.** It is a draft and hidden in production today, and stays that way. The storybook arc, the four icons and
  the closing page cover the four live projects. If research is published later, it keeps its current place as a
  separate section after the closing page, and its sealed bench channel is not one of the four icons. (Designer's call.)
- **Phones.** The per-beat pictures are the existing deck frames, which already move inline under each beat on narrow
  screens (`placeFrames` in `chapters.ts`). No new per-beat drawings are needed. (Answered by the current code.)

## Left to the builder

- Exact wording of every beat line, within the text budget and the honesty rules above. The owner reviews the copy.
- How the existing five deck frames per project map onto three beats (merge, keep one per beat, or keep the extra ones
  behind the disclosure), as long as the existing diagrams are reused.
- The opening page's idea picture and the four project icons, drawn in the site's existing visual language.
- The page-turn treatment and the progress marker.
- How the closing page is laid out.

## Success

- The supervisor scrolls the home page without stopping to read paragraphs and can retell the four stories.
- A recruiter who reads only the opening two pages knows who the owner is, the one idea, and one real proof.
- An engineer who opens the disclosures finds every caveat and number that is on the site today.
