// Places hand-drawn notes against the real elements they explain, and redraws each arrow to the element's
// current position. Notes are data-driven: data-to is a selector inside the layer's parent, data-at picks a point
// on the target, data-dx / data-dy move the note from that point. Placement is collision-aware: a note's box and
// its arrow are scored against every piece of text and every control in the diagram (and against the other notes),
// and the note slides to the nearest clear spot. Re-runs whenever the stage changes.
type Pt = { x: number; y: number };
type Box = { l: number; t: number; r: number; b: number };

const AT: Record<string, [number, number]> = {
  tl: [0, 0],
  tc: [0.5, 0],
  tr: [1, 0],
  ml: [0, 0.5],
  c: [0.5, 0.5],
  mr: [1, 0.5],
  bl: [0, 1],
  bc: [0.5, 1],
  br: [1, 1],
};
const ns = 'http://www.w3.org/2000/svg';

const rectOf = (el: Element, text: boolean): DOMRect => {
  if (!text) return el.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(el);
  return range.getBoundingClientRect();
};
const target = (scope: Element, selector: string): Element | null => {
  for (const el of scope.querySelectorAll(selector)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && !el.closest('[hidden]')) return el;
  }
  return null;
};

// Keep source elements so each note can exclude its target without measuring the scope again.
function obstacles(scope: Element): Array<{ box: Box; el: Element; control: boolean }> {
  const out: Array<{ box: Box; el: Element; control: boolean }> = [];
  const parents = new Map<Element, boolean>();
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue?.trim()) continue;
    const parent = node.parentElement;
    if (!parent) continue;
    let visible = parents.get(parent);
    if (visible === undefined) {
      // Screen-reader-only text (hints, live regions) takes no visual space, so it is never an obstacle.
      visible = !parent.closest('.notes-layer, .visually-hidden') && !parent.closest('[hidden]');
      if (visible) {
        const style = getComputedStyle(parent);
        visible = style.visibility !== 'hidden' && style.display !== 'none';
      }
      parents.set(parent, visible);
    }
    if (!visible) continue;
    range.selectNodeContents(node);
    for (const r of range.getClientRects())
      if (r.width > 1 && r.height > 1)
        out.push({ box: { l: r.left, t: r.top, r: r.right, b: r.bottom }, el: parent, control: false });
  }
  for (const el of scope.querySelectorAll(
    'select, textarea, input:not(.channel-radio):not(.flow-radio), button',
  )) {
    if (el.closest('.notes-layer') || el.closest('[hidden]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 1 && r.height > 1)
      out.push({ box: { l: r.left, t: r.top, r: r.right, b: r.bottom }, el, control: true });
  }
  return out;
}

const hit = (a: Box, b: Box, pad = 0) =>
  a.l < b.r + pad && a.r > b.l - pad && a.t < b.b + pad && a.b > b.t - pad;
const inside = (p: Pt, b: Box, pad = 0) =>
  p.x > b.l - pad && p.x < b.r + pad && p.y > b.t - pad && p.y < b.b + pad;

function curve(from: Pt, to: Pt, bend: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const k = len * 0.2 * bend;
  const c1 = { x: from.x + dx * 0.3 + nx * k, y: from.y + dy * 0.3 + ny * k };
  const c2 = { x: from.x + dx * 0.72 + nx * k * 0.7, y: from.y + dy * 0.72 + ny * k * 0.7 };
  return { c1, c2 };
}
const bezier = (p0: Pt, c1: Pt, c2: Pt, p3: Pt, t: number): Pt => {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y,
  };
};

// Edge of the note box on the line to the target, and the arrow tip just short of the target.
function ends(nc: Pt, w: number, h: number, t: Pt) {
  const vx = t.x - nc.x;
  const vy = t.y - nc.y;
  const scale = Math.min(
    Math.abs(vx) > 0.01 ? (w / 2 + 7) / Math.abs(vx) : Infinity,
    Math.abs(vy) > 0.01 ? (h / 2 + 5) / Math.abs(vy) : Infinity,
  );
  if (scale >= 1) return null;
  const from: Pt = { x: nc.x + vx * scale, y: nc.y + vy * scale };
  const dist = Math.hypot(t.x - from.x, t.y - from.y);
  if (dist < 14) return null;
  const gap = Math.min(5, dist / 3);
  return { from, to: { x: t.x - ((t.x - from.x) / dist) * gap, y: t.y - ((t.y - from.y) / dist) * gap } };
}

function arrowPath(from: Pt, to: Pt, bend: number) {
  const { c1, c2 } = curve(from, to, bend);
  const tail = Math.atan2(to.y - c2.y, to.x - c2.x);
  const barb = (a: number) => `M${to.x - Math.cos(a) * 9} ${to.y - Math.sin(a) * 9}L${to.x} ${to.y}`;
  return `M${from.x} ${from.y}C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${to.x} ${to.y}${barb(tail - 0.5)}${barb(tail + 0.5)}`;
}

function place(layer: HTMLElement) {
  const box = layer.getBoundingClientRect();
  if (!box.width || !box.height) return;
  const scope = layer.parentElement;
  if (!scope) return;

  // Read everything first, then write: notes are absolutely positioned, so placing one never changes what the next
  // one measures, and interleaving the two would force a layout per note.
  const collected = obstacles(scope);
  const measured = [...layer.querySelectorAll<HTMLElement>('.note[data-to]')].map((note) => {
    const el = target(scope, note.dataset.to!);
    if (!el) return { note, el: null } as const;
    return {
      note,
      el,
      r: rectOf(el, note.dataset.text === '1'),
      w: note.offsetWidth,
      h: note.offsetHeight,
    } as const;
  });

  let svg = layer.querySelector<SVGSVGElement>('svg.notes-arrows');
  if (!svg) {
    svg = document.createElementNS(ns, 'svg') as SVGSVGElement;
    svg.setAttribute('class', 'notes-arrows');
    svg.setAttribute('aria-hidden', 'true');
    layer.prepend(svg);
  }
  svg.replaceChildren();

  const placedBoxes: Box[] = [];
  const placedPaths: Pt[] = [];
  let index = 0;
  for (const m of measured) {
    index += 1;
    if (!m.el) {
      m.note.style.visibility = 'hidden';
      continue;
    }
    const { note, el, r, w, h } = m;
    const [fx, fy] = AT[note.dataset.at ?? 'c'] ?? AT.c!;
    const tp: Pt = {
      x: r.left + r.width * fx + Number(note.dataset.tx ?? 0),
      y: r.top + r.height * fy + Number(note.dataset.ty ?? 0),
    };
    const isMargin = note.classList.contains('margin');
    const dx0 = Number(note.dataset.dx ?? 0);
    const dy0 = Number(note.dataset.dy ?? 0);
    const obs = collected
      .filter((o) => !el.contains(o.el) && !(o.control && o.el.contains(el)))
      .map((o) => o.box);

    // Score a candidate note centre: boxes on text or other notes cost a lot, arrows through text cost some.
    const score = (cx: number, cy: number) => {
      const nb: Box = { l: cx - w / 2 - 3, t: cy - h / 2 - 2, r: cx + w / 2 + 3, b: cy + h / 2 + 2 };
      if (!isMargin && (nb.l < box.left || nb.r > box.right || nb.t < box.top || nb.b > box.bottom))
        return { s: 1e6, bend: 1 };
      let s = 0;
      for (const o of obs) if (hit(nb, o, 1)) s += 1000;
      for (const p of placedBoxes) if (hit(nb, p, 2)) s += 1000;
      for (const p of placedPaths) if (inside(p, nb, 1)) s += 400;
      const e = ends({ x: cx, y: cy }, w, h, { x: tp.x, y: tp.y });
      let bend = index % 2 ? 1 : -1;
      if (e) {
        let best = Infinity;
        for (const b of [bend, -bend]) {
          const { c1, c2 } = curve(e.from, e.to, b);
          let hits = 0;
          for (let i = 1; i < 14; i++) {
            const pt = bezier(e.from, c1, c2, e.to, i / 14);
            if (Math.hypot(pt.x - tp.x, pt.y - tp.y) < 12) continue;
            for (const o of obs) if (inside(pt, o, 1)) hits += 1;
            for (const p of placedBoxes) if (inside(pt, p, 1)) hits += 2;
          }
          if (hits < best) {
            best = hits;
            bend = b;
          }
        }
        s += 120 * best;
      }
      s += Math.hypot(cx - tp.x, cy - tp.y) / 9;
      return { s, bend };
    };

    const want = { x: tp.x + dx0, y: tp.y + dy0 };
    let pick = { cx: want.x, cy: want.y, ...score(want.x, want.y) };
    if (pick.s >= 120) {
      const base = Math.max(46, Math.hypot(dx0, dy0));
      const tried: Array<{ cx: number; cy: number; d: number }> = [];
      for (const radius of [base, base + 26, base + 52, base + 84, base + 124]) {
        for (let a = 0; a < 360; a += 20) {
          const cx = tp.x + Math.cos((a * Math.PI) / 180) * radius * 1.35;
          const cy = tp.y + Math.sin((a * Math.PI) / 180) * radius * 0.8;
          tried.push({ cx, cy, d: Math.hypot(cx - want.x, cy - want.y) });
        }
      }
      tried.sort((p, q) => p.d - q.d);
      for (const c of tried.slice(0, 120)) {
        const sc = score(c.cx, c.cy);
        const total = sc.s + c.d / 12;
        if (total < pick.s + (pick.cx === want.x ? 0 : 0) - 0.01 && total < pick.s)
          pick = { cx: c.cx, cy: c.cy, ...sc, s: total };
        if (pick.s < 8) break;
      }
    }

    let left = pick.cx - box.left - w / 2;
    let top = pick.cy - box.top - h / 2;
    if (!isMargin) {
      left = Math.max(0, Math.min(box.width - w, left));
      top = Math.max(0, Math.min(box.height - h, top));
    }
    note.style.left = `${left}px`;
    note.style.top = `${top}px`;
    note.style.visibility = 'visible';
    const cx = left + box.left + w / 2;
    const cy = top + box.top + h / 2;
    placedBoxes.push({ l: cx - w / 2 - 2, t: cy - h / 2 - 2, r: cx + w / 2 + 2, b: cy + h / 2 + 2 });
    const e = ends({ x: cx, y: cy }, w, h, tp);
    if (!e) continue;
    const local = (p: Pt): Pt => ({ x: p.x - box.left, y: p.y - box.top });
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('class', 'note-arrow');
    path.setAttribute('d', arrowPath(local(e.from), local(e.to), pick.bend));
    svg.append(path);
    const { c1, c2 } = curve(e.from, e.to, pick.bend);
    for (let i = 1; i < 14; i++) placedPaths.push(bezier(e.from, c1, c2, e.to, i / 14));
  }
}

const nearViewport = new Set<HTMLElement>();
const narrow = matchMedia('(max-width: 1199px)');
let queued = false;
export function placeAll() {
  if (document.documentElement.dataset.notes === 'off' || narrow.matches) return;
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    if (document.documentElement.dataset.notes === 'off' || narrow.matches) return;
    nearViewport.forEach(place);
  });
}

function start() {
  if (!document.querySelector('.note[data-to]')) return;
  // The initial callback also places visible layers without measuring offscreen layers at startup.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const layer = entry.target as HTMLElement;
        if (entry.isIntersecting) {
          nearViewport.add(layer);
          placeAll();
        } else nearViewport.delete(layer);
      }
    },
    { rootMargin: '300px 0px' },
  );
  // A note only depends on what is inside its own diagram (the layer's parent), so changes elsewhere on the page,
  // such as the chapter text scrolling past, never need a placement pass.
  const scopes = new Set<Element>();
  const track = (layer: HTMLElement) => {
    observer.observe(layer);
    if (layer.parentElement) scopes.add(layer.parentElement);
  };
  const inScope = (target: EventTarget | Node | null) => {
    const start = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
    for (let el = start; el; el = el.parentElement) if (scopes.has(el)) return true;
    return false;
  };
  document.querySelectorAll<HTMLElement>('.notes-layer').forEach(track);
  placeAll();
  window.addEventListener('resize', placeAll);
  window.addEventListener('load', placeAll);
  void document.fonts?.ready.then(placeAll);
  // The note font loads lazily, after the first placement; its width changes once it arrives, so place again.
  document.fonts?.addEventListener('loadingdone', placeAll);
  for (const type of ['bench:beat', 'change', 'input', 'click', 'keyup', 'pointerup'])
    document.addEventListener(type, placeAll, true);
  // Transitions and animations end all over the page (navbar, chapter header, hover colors); only those inside a
  // diagram can move a note's target.
  for (const type of ['transitionend', 'animationend'])
    document.addEventListener(type, (event) => inScope(event.target) && placeAll(), true);
  const watch = document.querySelector('main') ?? document.body;
  new MutationObserver((records) => {
    let relevant = false;
    for (const m of records) {
      if (m.type === 'childList') {
        for (const node of [...m.removedNodes, ...m.addedNodes]) {
          if (!(node instanceof HTMLElement)) continue;
          const layers = [...node.querySelectorAll<HTMLElement>('.notes-layer')];
          if (node.matches('.notes-layer')) layers.unshift(node);
          for (const layer of layers) {
            if (layer.isConnected) track(layer);
            else {
              observer.unobserve(layer);
              nearViewport.delete(layer);
              if (layer.parentElement) scopes.delete(layer.parentElement);
            }
          }
        }
      }
      const node = m.target instanceof Element ? m.target : m.target.parentElement;
      if (!node?.closest('.notes-layer') && inScope(node)) relevant = true;
    }
    if (relevant) placeAll();
  }).observe(watch, { subtree: true, childList: true, attributes: true, characterData: true });
  new ResizeObserver(placeAll).observe(watch);
  document.documentElement.addEventListener('notes-toggle', placeAll);
}
start();
