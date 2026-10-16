import { stops, footer } from './lines';

// The guide's behaviour. It loads on the first scroll (see Guide.astro), so the home page's first paint does not pay
// for it.
export function start(guide: HTMLElement) {
  const bench = document.querySelector<HTMLElement>('.bench');
  if (!bench) return;
  const actor = guide.querySelector<HTMLElement>('[data-actor]')!;
  const img = guide.querySelector<SVGImageElement>('[data-img]')!;
  const bubble = guide.querySelector<HTMLElement>('[data-bubble]')!;
  const on = guide.querySelector<HTMLElement>('[data-on]')!;
  const off = guide.querySelector<HTMLElement>('[data-off]')!;
  const stage = bench.querySelector<HTMLElement>('.stagecol');
  const pop = document.querySelector<HTMLElement>('#site-footer .pop');
  const tab = pop?.querySelector<HTMLAnchorElement>('a[href*="resume"]') ?? null;
  const wide = matchMedia('(min-width: 1000px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  // Feet position, and where he is going to stand. His whole sprite is 96 by 100, drawn at `scale`. He does not walk:
  // at each stop a teleporter pad opens where he is to stand, a beam rises and he materialises in it; when the stop
  // changes he dissolves back into the pad and it closes, and the next one opens somewhere else.
  let scale = 0.95;
  let cx = 60;
  let margin = 0;
  let enabled = false;
  let px = 0;
  let py = 0;
  let tx = 0;
  let ty = 0;
  let face = 1;
  let faceWant = 1;
  let zone: 'L' | 'R' | 'M' = 'L';
  let phase: 'hidden' | 'in' | 'on' | 'out' = 'hidden';
  let key = 'off';
  let shownKey = '';
  let pose = 'idle';
  let raf = 0;
  let run = 0;
  let timers: number[] = [];
  let phaseTimer = 0;
  let line: { say?: string; aside?: string; pose: string } = { pose: 'idle' };
  // When the page is being scrolled fast he does not linger to dissolve.
  let scrollV = 0;
  let lastY = scrollY;
  let lastT = performance.now();

  const ms = (n: number) => (reduced.matches ? 0 : n);
  const setPhase = (p: typeof phase) => {
    phase = p;
    guide.dataset.phase = p;
  };

  // The margin beside the diagram is all the room he has, so his size follows it.
  const measure = () => {
    margin = stage ? stage.getBoundingClientRect().left : 0;
    scale = Math.min(0.95, (margin - 10) / 53);
    enabled = wide.matches && scale >= 0.6;
    cx = margin / 2;
    actor.style.setProperty('--s', scale.toFixed(3));
  };

  // Where the bubble sits, set once he has stopped. In a margin it stays inside it, so it never covers what he is
  // presenting; out on the page it sits above his head, kept inside the window.
  const placeBubble = () => {
    const vw = innerWidth;
    let abs: number;
    let width: number;
    if (zone === 'L') {
      abs = 8;
      width = Math.max(150, margin - 16);
    } else if (zone === 'R') {
      abs = vw - margin + 8;
      width = Math.max(150, margin - 16);
    } else {
      width = 230;
      // Past the page's middle the bubble opens towards the left, so it does not cover the text column.
      abs = Math.min(Math.max(8, face === -1 ? px + 30 - width : px - 30), vw - width - 8);
    }
    actor.style.setProperty('--bl', `${(abs - (px - 48)).toFixed(1)}px`);
    actor.style.setProperty('--bw', `${width.toFixed(0)}px`);
  };

  const clear = () => {
    run++;
    for (const t of timers) window.clearTimeout(t);
    timers = [];
    bubble.classList.remove('is-on');
    delete guide.dataset.talk;
  };
  const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));

  // Typed one letter at a time. The whole line is laid out from the start (the untyped part is only transparent),
  // so the words do not jump to the next row as it grows.
  const say = (text: string, done?: () => void) => {
    const id = ++run;
    bubble.classList.add('is-on');
    if (reduced.matches) {
      on.textContent = text;
      off.textContent = '';
      done?.();
      return;
    }
    on.textContent = '';
    off.textContent = text;
    guide.dataset.talk = '1';
    let i = 0;
    const tick = () => {
      if (id !== run) return;
      i++;
      on.textContent = text.slice(0, i);
      off.textContent = text.slice(i);
      if (i >= text.length) {
        delete guide.dataset.talk;
        done?.();
        return;
      }
      later(tick, /[.,?!:]/.test(text[i - 1]!) ? 170 : 26);
    };
    tick();
  };

  // He says the line, lets it sit, clears it, and a while later adds the aside if he is still here.
  const perform = () => {
    pose = line.pose;
    const text = line.say;
    if (!text) return;
    placeBubble();
    say(text, () => {
      later(
        () => {
          bubble.classList.remove('is-on');
          if (line.aside) {
            const aside = line.aside;
            later(() => say(aside, () => later(() => bubble.classList.remove('is-on'), 4200)), 5000);
          }
        },
        Math.min(7000, 2600 + text.length * 45),
      );
    });
  };

  const decide = (): 'off' | 'bench' | 'footer' => {
    if (!enabled) return 'off';
    const vh = innerHeight;
    const p = pop?.getBoundingClientRect();
    if (p && tab && p.top < vh * 0.9) return 'footer';
    const b = bench.getBoundingClientRect();
    return b.top < vh * 0.3 && b.bottom > vh * 0.3 ? 'bench' : 'off';
  };

  const render = () => {
    actor.style.transform = `translate3d(${(px - 48).toFixed(1)}px, ${(py - 100).toFixed(1)}px, 0)`;
    guide.style.setProperty('--f', String(face));
    guide.dataset.pose = pose;
  };

  // The pad opens, the beam rises, he materialises; then he gestures and says his line.
  const startIn = () => {
    shownKey = key;
    px = tx;
    py = ty;
    face = faceWant;
    pose = 'idle';
    guide.hidden = false;
    img.setAttribute('href', '/resume-hero.png');
    setPhase('in');
    render();
    window.clearTimeout(phaseTimer);
    phaseTimer = window.setTimeout(() => {
      setPhase('on');
      // The stop may have changed while he was still appearing.
      if (key !== shownKey) kick();
      else perform();
      render();
    }, ms(720));
  };

  // He dissolves into the pad and the pad closes.
  const startOut = () => {
    clear();
    pose = 'idle';
    render();
    setPhase('out');
    const quick = performance.now() - lastT < 200 && scrollV > 900;
    window.clearTimeout(phaseTimer);
    phaseTimer = window.setTimeout(
      () => {
        setPhase('hidden');
        guide.hidden = true;
        shownKey = '';
        kick();
      },
      ms(quick ? 300 : 560),
    );
  };

  const frame = () => {
    raf = 0;
    const vh = innerHeight;
    const mode = decide();
    let stop: (typeof stops)[string][number] | undefined;
    let nextKey: string = mode;
    if (mode === 'bench') {
      const channel = bench.querySelector<HTMLElement>('.chapter.is-active')?.dataset.chapter ?? '';
      stop = stops[channel]?.[Math.min(Number(bench.dataset.beat ?? 0), 4)];
      nextKey = stop ? `${channel}:${bench.dataset.beat ?? 0}` : 'off';
    }
    key = nextKey;

    if (stop) {
      const vw = innerWidth;
      zone = stop.x === 'L' ? 'L' : stop.x === 'R' ? 'R' : 'M';
      tx = stop.x === 'L' ? cx : stop.x === 'R' ? vw - cx : stop.x * vw;
      ty = stop.y * vh;
      // He faces the diagram: to the right from the left margin, to the left from anywhere past its middle.
      faceWant = tx < vw * 0.38 ? 1 : -1;
      line = stop;
    } else if (mode === 'footer' && pop && tab) {
      const t = tab.getBoundingClientRect();
      zone = 'M';
      tx = Math.max(cx, t.left - 34 * scale - 16);
      ty = pop.getBoundingClientRect().top + 2;
      faceWant = 1;
      line = { say: footer.say, aside: footer.aside, pose: 'point' };
    }

    if (phase === 'hidden') {
      if (nextKey !== 'off') startIn();
    } else if (phase === 'on') {
      if (key !== shownKey) startOut();
      else {
        // Standing on the card at the foot of the page, he stays on it as the page moves.
        px = tx;
        py = ty;
        render();
      }
    } else if (phase === 'in' && key === shownKey) {
      px = tx;
      py = ty;
      render();
    }
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  const refresh = () => {
    measure();
    if (!enabled) {
      clear();
      window.clearTimeout(phaseTimer);
      setPhase('hidden');
      guide.hidden = true;
      shownKey = '';
      return;
    }
    kick();
  };
  addEventListener(
    'scroll',
    () => {
      const now = performance.now();
      const dtMs = Math.max(8, now - lastT);
      const v = (Math.abs(scrollY - lastY) / dtMs) * 1000;
      scrollV = Math.max(scrollV * 0.6, Math.min(5000, v));
      lastY = scrollY;
      lastT = now;
      kick();
    },
    { passive: true },
  );
  addEventListener('resize', refresh);
  wide.addEventListener('change', refresh);
  reduced.addEventListener('change', kick);
  addEventListener('load', refresh);
  refresh();
}
