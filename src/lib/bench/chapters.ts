const bench = document.querySelector<HTMLElement>('.bench');
if (bench) {
  bench.dataset.live = '';
  // Page turns load on their own, after the page: a short scroll glides to the next page.
  void import('../story/pager');
  const wide = matchMedia('(min-width: 1000px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const chapters = [...bench.querySelectorAll<HTMLElement>('.chapter')];
  let activeChapter = '';
  let activeBeat = -1;
  let navigating = false;

  // On a phone the stage is not pinned, so the inspection deck (one frame per beat and project) has nowhere to sit
  // beside the text. Each frame becomes its own story page just before the page it illustrates, so reading goes
  // picture, line, picture, line. Nothing is copied: wider screens put the same nodes back in the deck.
  const deckFrames = bench.querySelector<HTMLElement>('.deck-frames');
  const frames = [...bench.querySelectorAll<HTMLElement>('.df[data-ch][data-b]')];
  const placeFrames = () => {
    if (!deckFrames) return;
    for (const frame of frames) {
      // The beat 2 picture belongs to the "how it catches it" page, after the beat 1 picture.
      const block = bench.querySelector<HTMLElement>(
        `.chapter[data-chapter="${frame.dataset.ch}"] [data-beat="${frame.dataset.b === '2' ? 1 : frame.dataset.b}"]`,
      );
      const inline = !wide.matches && !!block;
      if (frame.hasAttribute('data-inline') === inline) continue;
      frame.toggleAttribute('data-inline', inline);
      frame.classList.toggle('story-page', inline);
      if (inline) block!.before(frame);
      else deckFrames.append(frame);
    }
  };
  placeFrames();
  wide.addEventListener('change', placeFrames);

  // Story flow: the active chapter is marked, and when scrolling hands the stage to the next system the outgoing
  // diagram lifts away as a ghost while the incoming one rises in. Nothing animates for reduced motion or on phones.
  // Restarting the animation needs the class removed and re-added with a reflow in between.
  let shiftTimer: number | undefined;
  const shift = () => {
    if (reduced.matches) return;
    bench.classList.remove('is-shift');
    void bench.offsetWidth;
    bench.classList.add('is-shift');
    window.clearTimeout(shiftTimer);
    shiftTimer = window.setTimeout(() => bench.classList.remove('is-shift'), 1800);
  };
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
    // The page this beat belongs to: the last storybook page at or before it. Its heading names it.
    const blocks = [...section.querySelectorAll<HTMLElement>('.cblock[data-beat]')];
    const page = blocks.reduce((at, block, i) => (Number(block.dataset.beat) <= beat ? i : at), 0);
    if (name) name.textContent = blocks[page]?.querySelector('h4')?.firstChild?.textContent?.trim() ?? '';
    section
      .querySelectorAll<HTMLElement>('[data-tick]')
      .forEach((tick) => tick.classList.toggle('on', Number(tick.dataset.tick) <= page));
  };

  // The stage hands over to the next project a little before that chapter reaches the top, so the diagram and the
  // colour do not lag behind the text that is already on screen. Phones do not pin a stage, so they need no lead.
  const lead = () => (wide.matches ? Math.round(window.innerHeight * 0.25) : 0);

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
    const current = chapters
      .filter((section) => section.getBoundingClientRect().top <= yc + 28 + lead())
      .pop();
    if (!current) return;
    const channel = current.dataset.chapter!;
    if (channel !== activeChapter) {
      activeChapter = channel;
      activeBeat = -1;
      setActive(channel);
      shift();
      ghostOut();
      select(channel);
    }
    let beat = 0;
    for (const block of current.querySelectorAll<HTMLElement>('[data-beat]'))
      // The band below fires as a page's top enters it (yb to yb + 4), so a page resting just inside it counts.
      if (block.getBoundingClientRect().top <= yb + 4) beat = Number(block.dataset.beat);
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
    band(chapter + lead(), chapters);
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
    shift();
    document.documentElement.dataset.stageMoved = '1';
    showBeat(section, 0);
    // The chapter's first page (on a phone, its first picture), landed under the sticky identity like any page turn.
    const first = section.querySelector<HTMLElement>('.story-page') ?? section;
    // Land exactly on it (the stage can change height, and stage code and fonts can still be arriving): a no-op when
    // it is already there.
    const land = () => {
      if (activeChapter !== channel) return;
      const pad = parseFloat(getComputedStyle(first).scrollMarginTop) || 0;
      if (Math.abs(first.getBoundingClientRect().top - pad) > 6)
        first.scrollIntoView({ block: 'start', behavior: 'auto' });
    };
    first.scrollIntoView({ block: 'start', behavior: reduced.matches ? 'auto' : 'smooth' });
    let timer: number | undefined;
    const hasScrollEnd = 'onscrollend' in (window as object);
    const cancel = () => {
      window.clearTimeout(timer);
      if (hasScrollEnd) window.removeEventListener('scrollend', done);
      cancelNavigation = undefined;
    };
    function done() {
      cancel();
      land();
      navigating = false;
      settledUntil = Math.max(settledUntil, performance.now() + 800);
      sync(true);
      window.setTimeout(land, 700);
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
}

export {};
