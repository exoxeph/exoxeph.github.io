import { subscribe, type LogEntry } from './engine';

const bench = document.querySelector<HTMLElement>('.bench');
if (bench) {
  bench.dataset.live = '';
  const wide = matchMedia('(min-width: 1000px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const chapters = [...bench.querySelectorAll<HTMLElement>('.chapter')];
  const beatNames = ['What goes wrong', 'How it responds', 'Decision', 'What happened', 'Where it fails'];
  let activeChapter = '';
  let activeBeat = -1;
  let navigating = false;

  // On a phone the stage is not pinned, so the inspection deck (one frame per beat and project) has nowhere to sit
  // beside the text. Each frame moves into the chapter beat it illustrates, so reading goes text, picture, text,
  // picture. Nothing is copied: wider screens put the same nodes back in the deck.
  const deckFrames = bench.querySelector<HTMLElement>('.deck-frames');
  const frames = [...bench.querySelectorAll<HTMLElement>('.df[data-ch][data-b]')];
  const placeFrames = () => {
    if (!deckFrames) return;
    for (const frame of frames) {
      if (wide.matches) {
        if (frame.hasAttribute('data-inline')) {
          frame.removeAttribute('data-inline');
          deckFrames.append(frame);
        }
        continue;
      }
      const block = bench.querySelector<HTMLElement>(
        `.chapter[data-chapter="${frame.dataset.ch}"] [data-beat="${frame.dataset.b}"]`,
      );
      if (!block || frame.parentElement === block) continue;
      frame.setAttribute('data-inline', '');
      block.insertBefore(frame, block.querySelector('.clinks'));
    }
  };
  placeFrames();
  wide.addEventListener('change', placeFrames);

  // Story flow: the active chapter is marked, and when scrolling hands the stage to the next system the outgoing
  // diagram lifts away as a ghost while the incoming one rises in. Nothing animates for reduced motion or on phones.
  const setActive = (channel: string) =>
    chapters.forEach((section) => section.classList.toggle('is-active', section.dataset.chapter === channel));
  const ghostOut = () => {
    document.documentElement.dataset.stageMoved = '1';
    if (reduced.matches || !wide.matches) return;
    const stage = bench.querySelector<HTMLElement>('.stagecol');
    const shown =
      stage && [...stage.querySelectorAll<HTMLElement>(':scope > .channel')].find((c) => c.offsetParent);
    if (!stage || !shown) return;
    stage.querySelectorAll('.channel.ghost').forEach((old) => old.remove());
    const ghost = shown.cloneNode(true) as HTMLElement;
    ghost.classList.add('ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.removeAttribute('id');
    ghost.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
    ghost.querySelectorAll('.notes-layer').forEach((el) => el.remove());
    ghost
      .querySelectorAll<HTMLElement>('a, button, input, select, textarea, summary')
      .forEach((el) => el.setAttribute('tabindex', '-1'));
    ghost.addEventListener('animationend', () => ghost.remove());
    window.setTimeout(() => ghost.remove(), 600);
    stage.append(ghost);
  };

  const select = (channel: string) => {
    const radio = document.getElementById(`ch-${channel}`) as HTMLInputElement | null;
    if (!radio || radio.checked) return;
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // The invariant: visible project = active channel = identity label = beat shown on the stage.
  // Two reading lines sit just under the sticky identity; whatever chapter and beat span them is active.
  const identity = chapters[0]?.querySelector<HTMLElement>('[data-cid]');
  const lines = () => {
    const top = identity ? parseFloat(getComputedStyle(identity).top) || 72 : 72;
    const height = identity?.getBoundingClientRect().height ?? 48;
    return { chapter: top + 6, beat: top + height + 36 };
  };

  const showBeat = (section: HTMLElement, beat: number) => {
    bench.dataset.beat = String(Math.min(beat, 4));
    const name = section.querySelector<HTMLElement>('[data-beat-name]');
    const count = section.querySelectorAll('[data-tick]').length;
    if (name) name.textContent = beatNames[Math.min(beat, beatNames.length - 1)] ?? '';
    section
      .querySelectorAll<HTMLElement>('[data-tick]')
      .forEach((tick) => tick.classList.toggle('on', Number(tick.dataset.tick) <= Math.min(beat, count - 1)));
  };

  let lastY = -9999;
  let settledUntil = 0;
  // Scrolling never overwrites what the visitor just did on the stage.
  const touch = () => (settledUntil = Math.max(settledUntil, performance.now() + 1500));
  for (const type of ['pointerdown', 'keydown', 'input', 'change'])
    bench.querySelector('.stagecol')?.addEventListener(type, touch, true);
  function sync(quiet = false) {
    if (navigating) return;
    // A layout shift is not a reading step: only real scrolling may change what the stage shows.
    const moved = Math.abs(window.scrollY - lastY) > 2;
    lastY = window.scrollY;
    if (!moved) return;
    if (performance.now() < settledUntil) quiet = true;
    const { chapter: yc, beat: yb } = lines();
    // The last chapter whose top has reached the reading line (with slack for layout settling).
    const current = chapters.filter((section) => section.getBoundingClientRect().top <= yc + 28).pop();
    if (!current) return;
    const channel = current.dataset.chapter!;
    if (channel !== activeChapter) {
      activeChapter = channel;
      activeBeat = -1;
      setActive(channel);
      ghostOut();
      select(channel);
    }
    let beat = 0;
    for (const block of current.querySelectorAll<HTMLElement>('[data-beat]'))
      if (block.getBoundingClientRect().top <= yb) beat = Number(block.dataset.beat);
    if (beat === activeBeat) return;
    activeBeat = beat;
    showBeat(current, beat);
    if (!quiet) document.dispatchEvent(new CustomEvent('bench:beat', { detail: { channel, beat } }));
  }

  let observers: IntersectionObserver[] = [];
  function observe() {
    observers.forEach((observer) => observer.disconnect());
    observers = [];
    if (!('IntersectionObserver' in window)) return;
    const { chapter, beat } = lines();
    const height = window.innerHeight;
    const band = (y: number, elements: Element[]) => {
      const observer = new IntersectionObserver(() => sync(), {
        rootMargin: `-${Math.round(y)}px 0px -${Math.max(0, height - Math.round(y) - 4)}px 0px`,
      });
      elements.forEach((element) => observer.observe(element));
      observers.push(observer);
    };
    band(chapter, chapters);
    band(
      beat,
      chapters.flatMap((section) => [...section.querySelectorAll('[data-beat]')]),
    );
  }
  observe();
  setActive(chapters[0]?.dataset.chapter ?? '');
  // A refresh can restore any scroll position: the stage must agree with what is on screen.
  sync(true);
  window.addEventListener('load', () => sync(true));
  window.addEventListener('pageshow', () => sync(true));
  let resizeTimer: number | undefined;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(observe, 150);
  });

  // Choosing a channel navigates to that project's chapter, so the reading and the stage cannot disagree.
  // Only one navigation is ever pending: starting another cancels the previous one's scrollend listener and timer.
  let cancelNavigation: (() => void) | undefined;
  const navigate = (channel: string) => {
    const section = chapters.find((item) => item.dataset.chapter === channel);
    if (!section || channel === activeChapter) return;
    cancelNavigation?.();
    navigating = true;
    activeChapter = channel;
    activeBeat = 0;
    setActive(channel);
    document.documentElement.dataset.stageMoved = '1';
    showBeat(section, 0);
    section.scrollIntoView({ block: 'start', behavior: reduced.matches ? 'auto' : 'smooth' });
    let timer: number | undefined;
    const hasScrollEnd = 'onscrollend' in (window as object);
    const cancel = () => {
      window.clearTimeout(timer);
      if (hasScrollEnd) window.removeEventListener('scrollend', done);
      cancelNavigation = undefined;
    };
    function done() {
      cancel();
      // The stage can change height while the page scrolls; land exactly on the chapter.
      if (Math.abs(section!.getBoundingClientRect().top - lines().chapter + 6) > 6)
        section!.scrollIntoView({ block: 'start', behavior: 'auto' });
      navigating = false;
      settledUntil = Math.max(settledUntil, performance.now() + 800);
      sync(true);
    }
    cancelNavigation = cancel;
    if (hasScrollEnd) {
      window.addEventListener('scrollend', done);
      timer = window.setTimeout(done, 1500);
    } else timer = window.setTimeout(done, 900);
  };

  bench.addEventListener('change', (event) => {
    const target = event.target;
    if (!event.isTrusted || !(target instanceof HTMLInputElement) || !target.id.startsWith('ch-')) return;
    const channel = target.id.slice(3);
    document.documentElement.dataset.stageMoved = '1';
    if (wide.matches) navigate(channel);
    else {
      // Narrow screens do not pin the stage: if it is out of view, go to that project's chapter; otherwise switch in place.
      const stage = bench.querySelector<HTMLElement>('.stagecol');
      if (stage && stage.getBoundingClientRect().bottom < 120) navigate(channel);
      else {
        activeChapter = channel;
        bench.dataset.beat = '0';
      }
    }
  });

  // The channel controller loads lazily, so its inspect button may not exist yet: retry until the drawer has opened once.
  const inspectOnBench = (channel: string, tries = 0) => {
    const drawer = bench.querySelector<HTMLElement>('.inspector');
    if (drawer && !drawer.hidden) return;
    const button = bench.querySelector<HTMLButtonElement>(`[data-inspect-channel="${channel}"]`);
    if (button) {
      button.click();
      return;
    }
    if (tries < 10) window.setTimeout(() => inspectOnBench(channel, tries + 1), 150);
  };

  bench.addEventListener('click', (event) => {
    const target = event.target as Element;
    const operate = target.closest<HTMLElement>('[data-operate]');
    if (operate) {
      select(operate.dataset.operate!);
      bench
        .querySelector<HTMLElement>('.stagecol')
        ?.scrollIntoView({ block: 'start', behavior: reduced.matches ? 'auto' : 'smooth' });
    }
    const show = target.closest<HTMLElement>('[data-show-bench]');
    if (show) {
      select(show.dataset.showBench!);
      window.setTimeout(() => inspectOnBench(show.dataset.showBench!), 120);
    }
  });

  // What you tested: the visitor's own record, grouped by system.
  const names: Record<string, string> = {
    pool: 'Ride pooling',
    email: 'Email',
    rag: 'Retrieval',
    speech: 'Extraction',
    research: 'Research',
  };
  const list = bench.querySelector<HTMLElement>('[data-end-list]');
  const empty = bench.querySelector<HTMLElement>('[data-end-empty]');
  const summary = bench.querySelector<HTMLElement>('[data-end-summary]');
  const controls = bench.querySelector<HTMLElement>('[data-end-controls]');
  const copy = bench.querySelector<HTMLButtonElement>('[data-end-copy]');
  const copied = bench.querySelector<HTMLElement>('[data-end-copied]');
  const label = {
    executed: 'Runs in browser',
    replay: 'Recorded project run',
    model: 'modelled from the code',
  } as const;
  let current: LogEntry[] = [];
  const num = (entry: LogEntry) => String(entry.n + 3).padStart(2, '0');
  const lineOf = (entry: LogEntry) =>
    `${num(entry)}. ${entry.title}: ${entry.detail} [${label[entry.provenance]}]${entry.limit ? ' limit found' : ''}`;
  const observed = (entries: LogEntry[]) => {
    const found = new Set<string>();
    for (const entry of entries) {
      const text = `${entry.title} ${entry.detail}`;
      if (entry.channel === 'pool' && /refused|5 of 3/.test(text))
        found.add('The capacity guard refused a request.');
      if (entry.channel === 'speech' && /did not parse|too few columns|omitted/.test(text))
        found.add('The parser left out a row it could not read.');
      if (entry.channel === 'speech' && entry.limit)
        found.add('A misread that is still a valid number was accepted.');
      if (entry.channel === 'rag' && /repair/.test(text)) found.add('One repair attempt ran, and only one.');
      if (entry.channel === 'email' && /stopped|asks first/.test(text))
        found.add('The request was stopped, or a question asked, before any email was written.');
    }
    return [...found];
  };

  subscribe((entries) => {
    current = entries;
    if (!list || !empty || !summary || !copy || !controls) return;
    const has = entries.length > 0;
    empty.hidden = has;
    list.hidden = !has;
    summary.hidden = !has;
    copy.hidden = !has;
    const groups = new Map<string, LogEntry[]>();
    for (const entry of entries) {
      const key = entry.channel ?? 'other';
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    list.replaceChildren(
      ...[...groups].map(([key, items]) => {
        const group = document.createElement('li');
        const head = document.createElement('p');
        head.className = 'end-group';
        head.textContent = names[key] ?? 'Other';
        const inner = document.createElement('ol');
        for (const entry of items) {
          const item = document.createElement('li');
          const index = document.createElement('span');
          index.className = 'entry-index';
          index.textContent = num(entry);
          const body = document.createElement('div');
          const title = document.createElement('b');
          title.textContent = entry.title;
          const detail = document.createElement('span');
          detail.textContent = `${entry.detail} (${label[entry.provenance]})`;
          body.append(title, detail);
          if (entry.limit) {
            const flag = document.createElement('span');
            flag.className = 'limit-flag';
            flag.textContent = 'limit found';
            body.append(flag);
          }
          item.append(index, body);
          inner.append(item);
        }
        group.append(head, inner);
        return group;
      }),
    );
    const touched = new Set(entries.map((entry) => entry.channel).filter((c) => c && c !== 'research')).size;
    const limits = new Set(entries.filter((entry) => entry.limit).map((entry) => entry.title)).size;
    summary.textContent = `${entries.length} ${entries.length === 1 ? 'test' : 'tests'} across ${touched} of 4 systems, ${limits} documented ${
      limits === 1 ? 'limit' : 'limits'
    } found`;
    const seen = observed(entries);
    controls.hidden = seen.length === 0;
    controls.replaceChildren(
      ...(seen.length
        ? [
            Object.assign(document.createElement('p'), {
              className: 'end-group',
              textContent: 'Controls you saw act',
            }),
            ...seen.map((text) => Object.assign(document.createElement('p'), { textContent: text })),
          ]
        : []),
    );
  });

  copy?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(current.map(lineOf).join('\n'));
      if (copied) {
        copied.hidden = false;
        window.setTimeout(() => (copied.hidden = true), 1800);
      }
    } catch {
      /* clipboard unavailable: stay silent */
    }
  });
}
