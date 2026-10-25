// Page turns for a storybook page (the home page, the résumé). One gesture turns exactly one page: the wheel, a swipe
// or a key is taken over, the page glides to the next stop, and input is locked until it has arrived. Nothing scrolls
// freely between pages. What is left alone: a page taller than the screen (an opened disclosure) is read natively until
// its end, scrollable boxes inside the page scroll themselves, controls and the open inspector keep their keys, and
// links, "try it", deep links and keyboard focus are settled onto a page by the browser's own scroll.
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
// The CSS snapping stays the fallback until this runs; from here the turns are ours.
root.dataset.pager = '';

type Stop = { top: number; end: number };

// A centred stop lands on the reading line: the middle of the screen, or on a phone the middle of the space under a
// pinned picture that spans the width (the résumé's dev room).
const focusLine = () => {
  const pin = document.querySelector<HTMLElement>('[data-story-pin]');
  const under =
    pin && pin.offsetWidth > innerWidth * 0.8
      ? (parseFloat(getComputedStyle(pin).top) || 0) + pin.offsetHeight
      : 0;
  // Like scrollIntoView({ block: 'center' }), the middle of what is left under the scroll padding.
  const top = Math.max(under, parseFloat(getComputedStyle(root).scrollPaddingTop) || 0);
  return top + (innerHeight - top) / 2;
};

const stops = (): Stop[] => {
  const pad = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
  const max = root.scrollHeight - innerHeight;
  const focus = focusLine();
  // On a phone the stage and the test log are not pinned beside the text: together they are one page of their own
  // (the Bench's heading is only its anchor on a wide screen).
  const narrow = innerWidth < 1000;
  return (
    [
      ...document.querySelectorAll<HTMLElement>(
        '.story-page, [data-story-stop], #site-footer' + (narrow ? ', .story .stagecol' : ', #bench-heading'),
      ),
    ]
      // On a phone a beat is its picture and its line together, one page (taller than the screen, it scrolls itself):
      // the second picture and a line that follows a picture are parts of that page, not pages of their own.
      .filter(
        (el) =>
          el.getClientRects().length &&
          !el.matches('.df[data-b="2"]') &&
          !(el.matches('.cblock') && el.previousElementSibling?.matches('.df')),
      )
      .map((el) => {
        const r = el.getBoundingClientRect();
        let tail: Element | null = el;
        if (el.matches('.df')) while (tail && !tail.matches('.cblock')) tail = tail.nextElementSibling;
        if (el.matches('.stagecol')) tail = document.querySelector('.story .tape');
        const bottom = (tail ?? el).getBoundingClientRect().bottom;
        // The first page of a document: it rests at the very top (bar and all), not at its own top edge.
        if (el.dataset.storyStop === 'top') {
          return { top: 0, end: Math.max(0, Math.round(Math.min(max, r.bottom + scrollY - innerHeight))) };
        }
        if (el.dataset.storyStop === 'center') {
          const top = Math.round(Math.min(max, Math.max(0, r.top + scrollY + r.height / 2 - focus)));
          return { top, end: top };
        }
        const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
        const top = Math.round(Math.min(max, Math.max(0, r.top + scrollY - pad - margin)));
        // Where the page's last line reaches the bottom of the screen: past `top` only when it is taller than the screen.
        // The last 40px of a page are its own bottom padding and margin: not worth a swipe of their own.
        return { top, end: Math.max(top, Math.round(Math.min(max, bottom + scrollY - innerHeight - 40))) };
      })
      .sort((a, b) => a.top - b.top)
  );
};

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
let frame = 0;
let gliding = false;
// Input is locked until this time: the glide, plus a beat for the page to settle and a trackpad's inertia to fade.
let lockedUntil = 0;
// After a turn, the same swipe's inertia must not turn a second page: wait for a fresh gesture.
let needFresh = false;

const glide = (to: number) => {
  cancelAnimationFrame(frame);
  const start = scrollY;
  const distance = to - start;
  if (Math.abs(distance) < 2) return;
  const duration = reduced.matches ? 0 : 900;
  lockedUntil = performance.now() + duration + 240;
  needFresh = true;
  if (!duration) {
    scrollTo({ top: to, behavior: 'instant' });
    return;
  }
  const t0 = performance.now();
  gliding = true;
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / duration);
    scrollTo({ top: start + distance * ease(t), behavior: 'instant' });
    if (t < 1) frame = requestAnimationFrame(step);
    else gliding = false;
  };
  frame = requestAnimationFrame(step);
};

type Move = { kind: 'native' } | { kind: 'clamp'; to: number } | { kind: 'go'; to: number };
const native: Move = { kind: 'native' };

// What a move of `dy` (positive: down) means from where the page is now.
const decide = (dy: number): Move => {
  const list = stops();
  if (!list.length) return native;
  const y = scrollY;
  const dir = Math.sign(dy);
  // A page taller than the screen that is being read: scroll it natively, clamped to its own ends.
  const tall = list.findLast((p) => p.end > p.top + 2 && y > p.top - 3 && y < p.end + 3);
  if (tall) {
    if (dir > 0 && y < tall.end - 2) return y + dy <= tall.end ? native : { kind: 'clamp', to: tall.end };
    if (dir < 0 && y > tall.top + 2) return y + dy >= tall.top ? native : { kind: 'clamp', to: tall.top };
  }
  // Otherwise the next and previous pages are the nearest other positions (a few pixels either way is the page the
  // reader is on: a layout nudge, a rounded position). The last pages can share one position at the very bottom of
  // the document, so a neighbour is always a different position, never the same spot under another name.
  if (dir > 0) {
    const next = list.find((p) => p.top > y + 24);
    return next ? { kind: 'go', to: next.top } : native;
  }
  const prev = list.findLast((p) => p.top < y - 24);
  if (!prev) return native;
  return { kind: 'go', to: prev.end < y - 4 ? prev.end : prev.top };
};

// The open inspector and dialogs keep the wheel; boxes with their own scroll (a table, the speech scroller) scroll
// themselves while they can.
const keepsInput = (target: EventTarget | null, dy: number) => {
  if (!(target instanceof Element)) return false;
  if (document.querySelector('.inspector:not([hidden])')) return true;
  for (let el: Element | null = target; el && el !== root && el !== document.body; el = el.parentElement) {
    const cs = getComputedStyle(el);
    if (!/(auto|scroll)/.test(cs.overflowY) || el.scrollHeight <= el.clientHeight + 1) continue;
    if (dy > 0 ? el.scrollTop < el.scrollHeight - el.clientHeight - 1 : el.scrollTop > 0) return true;
  }
  return false;
};

// Do a decided move, if the lock allows; returns whether the browser's own handling should be stopped.
const take = (m: Move, fresh: boolean) => {
  if (m.kind === 'native') return false;
  if (m.kind === 'clamp') {
    scrollTo({ top: m.to, behavior: 'instant' });
    return true;
  }
  if (performance.now() < lockedUntil) return true;
  if (needFresh && !fresh) return true;
  needFresh = false;
  glide(m.to);
  return true;
};

// Wheel and trackpad: a small accumulated push is ignored (an accidental brush), anything more turns one page.
let acc = 0;
let lastWheel = 0;
let lastAbs = 0;
addEventListener(
  'wheel',
  (e) => {
    if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
    const dy = e.deltaY * unit;
    if (!dy || keepsInput(e.target, dy)) return;
    const now = performance.now();
    const abs = Math.abs(dy);
    // A new gesture: a pause in the stream, or a push that grows after the inertia of the last one has been fading.
    const fresh = now - lastWheel > 160 || abs > lastAbs + 12;
    if (now - lastWheel > 160 || Math.sign(acc) !== Math.sign(dy)) acc = 0;
    lastWheel = now;
    lastAbs = abs;
    acc += dy;
    const move = decide(dy);
    if (move.kind === 'native') return;
    e.preventDefault();
    if (Math.abs(acc) < 12) return;
    if (take(move, fresh)) acc = 0;
  },
  { passive: false },
);

// Touch: a swipe past 40px turns one page; the page never follows the finger.
let touchY = 0;
let touchMode: 'none' | 'page' | 'native' = 'none';
addEventListener(
  'touchstart',
  (e) => {
    touchY = e.touches[0]!.clientY;
    touchMode = 'none';
  },
  { passive: true },
);
addEventListener(
  'touchmove',
  (e) => {
    const dy = touchY - e.touches[0]!.clientY;
    if (touchMode === 'none') {
      if (Math.abs(dy) < 6) return;
      touchMode = keepsInput(e.target, dy) || decide(dy).kind === 'native' ? 'native' : 'page';
    }
    if (touchMode === 'page' && e.cancelable) e.preventDefault();
  },
  { passive: false },
);
addEventListener('touchend', (e) => {
  // A flick that scrolled a tall page itself carries on by the browser's momentum, possibly past the page's end:
  // wherever it comes to rest between pages, it settles onto one.
  if (touchMode === 'native') arm();
  if (touchMode !== 'page') return;
  touchMode = 'none';
  const dy = touchY - e.changedTouches[0]!.clientY;
  if (Math.abs(dy) >= 40) take(decide(dy), true);
});

// Keys: arrows, page keys and space turn a page when the focus is not on something that uses them.
const keyMove: Record<string, number | undefined> = {
  ArrowDown: 80,
  ArrowUp: -80,
  PageDown: 0.9,
  PageUp: -0.9,
  ' ': 0.9,
};
addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return;
  const t = e.target as Element;
  if (
    t.closest(
      'input, textarea, select, button, a[href], summary, details, [contenteditable], [role="slider"], [role="radio"], [role="tab"], [role="button"]',
    )
  )
    return;
  if (document.querySelector('.inspector:not([hidden])')) return;
  if (e.key === 'Home' || e.key === 'End') {
    const list = stops();
    const to = e.key === 'Home' ? list[0]?.top : list.at(-1)?.top;
    if (to === undefined) return;
    e.preventDefault();
    if (performance.now() >= lockedUntil) glide(to);
    return;
  }
  const k = keyMove[e.key];
  if (k === undefined) return;
  const size = Math.abs(k) < 1 ? Math.abs(k) * innerHeight : Math.abs(k);
  const dy = (e.key === ' ' && e.shiftKey ? -1 : Math.sign(k)) * size;
  const move = decide(dy);
  if (move.kind === 'native') return;
  e.preventDefault();
  take(move, true);
});

// A keyboard user moving focus with Tab, or typing into a control, is never pulled to another page.
let tabbing = false;
addEventListener('keydown', (e) => e.key === 'Tab' && (tabbing = true));
addEventListener('pointerdown', () => (tabbing = false));
const keyboard = () => {
  const focused = document.activeElement;
  if (!focused || focused === document.body) return false;
  return (
    (tabbing && focused.matches(':focus-visible')) ||
    focused.matches('input:not([type="radio"]), textarea, select, [contenteditable], [role="slider"]')
  );
};

// Any scroll that ends between pages (a link, choosing a system, "try it", the scrollbar, a deep link) settles onto the
// nearest page, with the same glide.
const reading = (list: Stop[], y: number) => list.some((p) => y > p.top - 3 && y < p.end + 3);
const land = () => {
  const list = stops();
  if (!list.length || gliding || performance.now() < lockedUntil || keyboard() || reading(list, scrollY))
    return;
  const y = scrollY;
  glide(list.reduce((a, b) => (Math.abs(b.top - y) < Math.abs(a.top - y) ? b : a)).top);
};
// Only scrolls that mean "go to a page" land: an in-page link or "try it", a deep link, or dragging the scrollbar.
// A scroll a control causes by itself (focus, a click on something half hidden) is left exactly where it put the page.
let armedUntil = 0;
const arm = () => (armedUntil = performance.now() + 2500);
addEventListener(
  'click',
  (e) => (e.target as Element).closest?.('a[href^="#"], [data-operate]') && arm(),
  true,
);
addEventListener('hashchange', arm);
addEventListener('pointerdown', (e) => e.target === root && arm());
const armedLand = () => {
  if (performance.now() < armedUntil) land();
};
if ('onscrollend' in window) addEventListener('scrollend', armedLand);
else {
  let timer = 0;
  addEventListener('scroll', () => {
    clearTimeout(timer);
    timer = window.setTimeout(armedLand, 140);
  });
}
if (location.hash) {
  if (document.readyState === 'complete') setTimeout(land, 60);
  else addEventListener('load', () => setTimeout(land, 60), { once: true });
}

export {};
