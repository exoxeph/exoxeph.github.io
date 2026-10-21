// The résumé dev room: a two-floor isometric building, drawn at build time with the same camera helper as the Bench
// stages. The ground floor is the work: one station per experience point. The upper floor holds the certifications and
// is reached by a portal. Each floor is a corner diorama: its back walls are the planes y = 0 (left) and x = W
// (right); anything nearer the viewer has a larger y and a smaller x, and is drawn later.
//
// Every station plays the same three-act clock (6 s: acts at 8%, 36% and 64%), and the matching words on the page light
// on the same beats, so the text and the room tell one story at one time.
import { camera, type Tone } from '../bench/iso';
import {
  agentsIg,
  armchairIg,
  bedIg,
  beltIg,
  boardIg,
  carBodyIg,
  deskIg,
  fireplaceIg,
  guitarIg,
  loungeIg,
  plantIg,
  portalPadIg,
  rackIg,
  recordPlayerIg,
  redisIg,
  shelfIg,
  sofaIg,
  streetLampIg,
  treeIg,
  trophyIg,
  windowIg,
} from './ig.ts';

const S = 5.6;
export const VIEW = { w: 960, h: 800 };
const W = 130;
const D = 100;
const H = 60;
/** The upper floor's level, and its wall height. */
export const UP = 66;
const H2 = 46;
const cam = camera({ ox: 24, oy: 566, s: S, az: -45 });
const { at, prism, poly, puck } = cam;
/** How far the camera pans up for the upper floor, in view units. */
export const PAN = +(S * Math.cos(Math.PI / 6) * UP).toFixed(1);

type P3 = [number, number, number];
const r1 = (n: number) => +n.toFixed(1);
const r2 = (n: number) => +n.toFixed(2);
const pt = (x: number, y: number, z = 0): [number, number] => {
  const [a, b] = at(x, y, z);
  return [r1(a), r1(b)];
};
const O = at(0, 0, 0);
const vec = (x: number, y: number, z: number): [number, number] => {
  const [a, b] = at(x, y, z);
  return [a - O[0], b - O[1]];
};
/** A world offset as two CSS custom properties (view units) that the keyframes read. */
const move = (name: string, x: number, y: number, z: number) => {
  const [a, b] = vec(x, y, z);
  return `--${name}x:${r1(a)}px;--${name}y:${r1(b)}px`;
};
const ZPX = S * Math.cos(Math.PI / 6);
const XLEN = Math.hypot(...vec(1, 0, 0));

const quad = (cls: string, list: P3[]) => poly(cls, list);
/** A prop and what stands on it (a frame on its chimney, a cube on its top, a cat on its blanket), lifted over the
 * mascot together: the prop's footprint moves from the prop to the group. */
const withProp = (...parts: string[]) => {
  const s = parts.join('');
  const m = s.match(/ data-occ="([^"]+)"/);
  return m ? `<g data-occ="${m[1]}">${s.replace(m[0], '')}</g>` : s;
};
const floorRect = (x0: number, y0: number, x1: number, y1: number, z: number, cls: string) =>
  quad(cls, [
    [x0, y0, z],
    [x1, y0, z],
    [x1, y1, z],
    [x0, y1, z],
  ]);
/** A rectangle on a plane parallel to the left wall (y fixed). */
const yRect = (x0: number, x1: number, z0: number, z1: number, cls: string, y = 0.2) =>
  quad(cls, [
    [x0, y, z0],
    [x1, y, z0],
    [x1, y, z1],
    [x0, y, z1],
  ]);
/** A rectangle on a plane parallel to the right wall (x fixed). */
const xRect = (y0: number, y1: number, z0: number, z1: number, cls: string, x = W - 0.2) =>
  quad(cls, [
    [x, y0, z0],
    [x, y1, z0],
    [x, y1, z1],
    [x, y0, z1],
  ]);
// Text painted on a plane: skewed to its slope, so it reads as part of the room.
const yText = (x: number, z: number, s: string, cls = 'wt', y = 0.3) => {
  const [X, Y] = pt(x, y, z);
  return `<text class="${cls}" transform="translate(${X} ${Y}) skewY(-26.565)">${s}</text>`;
};
const xText = (y: number, z: number, s: string, cls = 'wt', x = W - 0.3) => {
  const [X, Y] = pt(x, y, z);
  return `<text class="${cls}" transform="translate(${X} ${Y}) skewY(26.565)">${s}</text>`;
};
/** Text painted on the floor, running along x (left-wall stations) or along y (right-wall stations). */
const floorText = (x: number, y: number, z: number, s: string, alongY: boolean, cls = 'ft') => {
  const [X, Y] = pt(x, y, z);
  const m = alongY ? '0.894 0.447 -0.894 0.447' : '0.894 -0.447 0.894 0.447';
  return `<text class="${cls}" transform="matrix(${m} ${X} ${Y})">${s}</text>`;
};
// Images hung on a wall: the unit square is mapped onto the wall plane, w units wide.
const yImage = (href: string, x0: number, z1: number, w: number, y = 0.4) => {
  const [a, b] = vec(w, 0, 0);
  const [X, Y] = pt(x0, y, z1);
  const h = (w * XLEN) / ZPX;
  return `<image href="${href}" width="1" height="1" preserveAspectRatio="xMidYMid meet" transform="matrix(${r2(a)} ${r2(b)} 0 ${r2(ZPX * h)} ${X} ${Y})"/>`;
};
const xImage = (href: string, y0: number, z1: number, w: number, x = W - 0.4) => {
  const [a, b] = vec(0, w, 0);
  const [X, Y] = pt(x, y0, z1);
  const h = (w * XLEN) / ZPX;
  return `<image href="${href}" width="1" height="1" preserveAspectRatio="xMidYMid meet" transform="matrix(${r2(a)} ${r2(b)} 0 ${r2(ZPX * h)} ${X} ${Y})"/>`;
};
const legs = (x0: number, y0: number, x1: number, y1: number, z0: number, h: number) =>
  (
    [
      [x0, y0],
      [x1 - 1.2, y0],
      [x0, y1 - 1.2],
      [x1 - 1.2, y1 - 1.2],
    ] as const
  )
    .map(([x, y]) => cyl(x + 0.6, y + 0.6, z0, 0.55, h, 'n'))
    .join('');
const line = (cls: string, ...p: P3[]) =>
  `<path class="${cls}" d="M${p.map((q) => pt(...q).join(' ')).join('L')}"/>`;
const dot = (cls: string, x: number, y: number, z: number, r: number, style = '') => {
  const [cx, cy] = pt(x, y, z);
  return `<circle class="${cls}" cx="${cx}" cy="${cy}" r="${r}"${style ? ` style="${style}"` : ''}/>`;
};

/** Fairy lights strung along the top of a wall: bulbs that sag between hooks and twinkle. */
const fairy = (alongY: boolean, from: number, to: number, z: number, wall: number) => {
  const p: P3[] = [];
  for (let u = from; u <= to; u += 4) {
    const sag = 2.2 * Math.sin((Math.PI * ((u - from) % 16)) / 16);
    p.push(alongY ? [wall, u, z - sag] : [u, wall, z - sag]);
  }
  return `${line('wire', ...p)}${p.map((q, i) => dot(`bulb u${i % 3}${i % 7 === 0 ? ' tw' : ''}`, ...q, 1.7, `--d:${r2((i % 5) * 0.35)}s`)).join('')}`;
};
/* ---------------------------------------------------------------- soft shapes ----------------------------------- */
// Isometric is not only boxes. Curves are plotted point by point in the world and joined smoothly on screen; round
// things are true isometric circles; soft solids have rounded footprints and are shaded face by face as they turn.

type P2 = [number, number];
/** A smooth path through screen points (Catmull-Rom, written as cubic Béziers). */
function smoothD(p: P2[], closed = false) {
  const n = p.length;
  const get = (i: number) => p[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))]!;
  let d = `M${p[0]![0]} ${p[0]![1]}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [a, b, c, e] = [get(i - 1), get(i), get(i + 1), get(i + 2)];
    d += `C${r1(b[0] + (c[0] - a[0]) / 6)} ${r1(b[1] + (c[1] - a[1]) / 6)} ${r1(c[0] - (e[0] - b[0]) / 6)} ${r1(c[1] - (e[1] - b[1]) / 6)} ${c[0]} ${c[1]}`;
  }
  return closed ? `${d}Z` : d;
}
const curve = (cls: string, ...w: P3[]) => `<path class="${cls}" d="${smoothD(w.map((q) => pt(...q)))}"/>`;
const blob = (cls: string, w: P3[], extra = '') =>
  `<path class="${cls}" d="${smoothD(
    w.map((q) => pt(...q)),
    true,
  )}"${extra}/>`;
/** An oval lying on a floor: the true isometric view of a circle or an ellipse. */
const oval = (cls: string, cx: number, cy: number, rx: number, ry: number, z: number, extra = '') =>
  blob(
    cls,
    Array.from({ length: 20 }, (_, i) => {
      const a = (i / 20) * Math.PI * 2;
      return [cx + rx * Math.cos(a), cy + ry * Math.sin(a), z] as P3;
    }),
    extra,
  );
/** An upright cylinder of world radius r and height h. */
const cyl = (x: number, y: number, z: number, r: number, h: number, tone: Tone) =>
  puck(...pt(x, y, z), r1(r * S), r1(h * ZPX), tone);
/** A rounded footprint, counter-clockwise, as world points at height z. */
function rounded(x0: number, y0: number, x1: number, y1: number, r: number, z: number): P3[] {
  const out: P3[] = [];
  const corners: [number, number, number][] = [
    [x1 - r, y0 + r, -90],
    [x1 - r, y1 - r, 0],
    [x0 + r, y1 - r, 90],
    [x0 + r, y0 + r, 180],
  ];
  const steps = r < 0.7 ? 1 : 3;
  for (const [cx, cy, a0] of corners)
    for (let k = 0; k <= steps; k++) {
      const a = ((a0 + (k * 90) / steps) * Math.PI) / 180;
      out.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z]);
    }
  return out;
}
/** A soft solid, given like a box (x0, y0, z0 to x1, y1, z1): a rounded footprint raised from z0 to z1. The sides that face the viewer are shaded by the way they
 * turn (end, between, front), then the top is laid over them. */
function soft(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r: number, tone: Tone) {
  const lo = rounded(x0, y0, x1, y1, r, z0);
  const hi = rounded(x0, y0, x1, y1, r, z1);
  const n = lo.length;
  // Which way each side faces: the end (e), between (m), the front (f), or away from the viewer ('').
  const kind = (i: number): '' | 'e' | 'm' | 'f' => {
    const j = (i + 1) % n;
    const nx = lo[j]![1] - lo[i]![1];
    const ny = -(lo[j]![0] - lo[i]![0]);
    if (ny - nx <= 0.0001) return '';
    const a = Math.atan2(ny, -nx);
    return a > (Math.PI * 5) / 8 ? 'f' : a < (Math.PI * 3) / 8 ? 'e' : 'm';
  };
  // Neighbouring sides that face the same way are drawn as one strip, which keeps the markup small.
  let start = 0;
  while (start < n && kind(start) === kind((start + n - 1) % n)) start++;
  start %= n;
  const runs: Record<'e' | 'm' | 'f', string[]> = { e: [], m: [], f: [] };
  for (let i = 0; i < n;) {
    const c = kind((start + i) % n);
    let j = i;
    while (j + 1 < n && kind((start + j + 1) % n) === c) j++;
    if (c) {
      const idx = Array.from({ length: j - i + 2 }, (_, k) => (start + i + k) % n);
      const strip = [...idx.map((k) => lo[k]!), ...idx.reverse().map((k) => hi[k]!)];
      runs[c].push(`M${strip.map((q) => pt(...q).join(' ')).join('L')}Z`);
    }
    i = j + 1;
  }
  const side = (['e', 'm', 'f'] as const)
    .map((c) => (runs[c].length ? `<path class="${c}" d="${runs[c].join('')}"/>` : ''))
    .join('');
  return `<g class="${tone} soft">${side}<path class="t" d="M${hi.map((q) => pt(...q).join(' ')).join('L')}Z"/></g>`;
}
/** Any piece of furniture: a box with its edges softened in proportion to its size. */
const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, tone: Tone) =>
  soft(x0, y0, z0, x1, y1, z1, r2(Math.max(0.2, Math.min(1.6, 0.28 * Math.min(x1 - x0, y1 - y0)))), tone);
/** A leaf: a pointed oval in screen space, from a root, turned to an angle. */
const leaf = (x: number, y: number, deg: number, len: number, w: number, cls = 'lf') => {
  const a = (deg * Math.PI) / 180;
  const [dx, dy] = [Math.cos(a), Math.sin(a)];
  const [mx, my] = [x + (dx * len) / 2, y + (dy * len) / 2];
  return `<path class="${cls}" d="M${r1(x)} ${r1(y)}Q${r1(mx - dy * w)} ${r1(my + dx * w)} ${r1(x + dx * len)} ${r1(y + dy * len)}Q${r1(mx + dy * w)} ${r1(my - dx * w)} ${r1(x)} ${r1(y)}Z"/>`;
};
/** A mug with steam curling off it. */
const mug = (x: number, y: number, z: number) => {
  const [mx, my] = pt(x, y, z + 2.2);
  return `${cyl(x, y, z, 0.9, 2.2, 'l')}<path class="steam" d="M${mx} ${r1(my - 2)}c-3 -4 3 -6 0 -10c-3 -4 3 -6 0 -10"/>`;
};

/** Floorboards: long boards along the left wall, their joints staggered row by row. */
const planks = (z: number) => {
  const d: string[] = [];
  for (let y = 4; y < D; y += 4) d.push(`M${pt(0, y, z).join(' ')}L${pt(W, y, z).join(' ')}`);
  for (let y = 0, row = 0; y < D; y += 4, row++)
    for (let x = row % 2 ? 9 : 19; x < W; x += 20)
      d.push(`M${pt(x, y, z).join(' ')}L${pt(x, y + 4, z).join(' ')}`);
  return `<path class="plank" d="${d.join('')}"/>`;
};
/** Readable things (text, and groups marked data-label) are lifted out of a drawing onto a layer the pixel filter does
 * not touch, so the lettering stays sharp. */
// Text drawn on a prop's own plane (it carries data-keep) stays where it is; every other label is lifted above the art.
const LABEL = /<text(?![^>]*data-keep)[\s\S]*?<\/text>|<g data-label[^>]*>[\s\S]*?<\/g>/g;
const split = (svg: string) => ({ art: svg.replace(LABEL, ''), text: (svg.match(LABEL) ?? []).join('') });

/** A neon tube: a soft halo under a bright core. */
const neon = (c: 'm' | 'c', ...p: P3[]) => `${line(`nh ${c}`, ...p)}${line(`nc ${c}`, ...p)}`;

/** Neon set into a floor: seam strips at the foot and top of both walls, and their glow on the glossy floor. */
function neonShell(z: number, top: number) {
  const band = (list: [number, number][], fill: string) =>
    `<polygon class="refl" points="${list.map(([x, y]) => pt(x, y, z + 0.11).join(',')).join(' ')}" fill="url(#${fill})"/>`;
  return [
    band(
      [
        [0, 0.3],
        [W, 0.3],
        [W, 9],
        [0, 9],
      ],
      'dr-rm',
    ),
    band(
      [
        [W - 9, 0],
        [W - 0.3, 0],
        [W - 0.3, D],
        [W - 9, D],
      ],
      'dr-rc',
    ),
    neon('m', [0.5, 0.7, z + 0.5], [W - 0.6, 0.7, z + 0.5]),
    neon('c', [W - 0.7, 0.6, z + 0.5], [W - 0.7, D - 0.5, z + 0.5]),
    neon('c', [0.5, 0.6, z + top - 1], [W - 0.6, 0.6, z + top - 1]),
    neon('m', [W - 0.6, 0.6, z + top - 1], [W - 0.6, D - 0.5, z + top - 1]),
  ].join('');
}
/** A hologram: a translucent panel floating in the room, with scan lines and something drawn on it. */
function holo(alongY: boolean, plane: number, a0: number, a1: number, z0: number, z1: number, draw: P3[]) {
  const q = (u: number, z: number): P3 => (alongY ? [plane, u, z] : [u, plane, z]);
  const scan: string[] = [];
  for (let z = z0 + 1.5; z < z1; z += 1.8) scan.push(line('scan', q(a0 + 0.5, z), q(a1 - 0.5, z)));
  return `<g class="holo-g">${quad('holo-p', [q(a0, z0), q(a1, z0), q(a1, z1), q(a0, z1)])}${scan.join('')}${line('holo-l', ...draw)}</g>`;
}

/* ---------------------------------------------------------------- outside --------------------------------------- */

// Outside the building: a city behind the back walls, a moon and stars, a plane crossing, birds and drifting
// fireflies. It stands further back than the room, so the script moves it less when the camera pans.
function outside() {
  // [x0, y0, width, depth, height]
  const blocks: [number, number, number, number, number][] = [];
  for (let k = 0; k < 11; k++)
    blocks.push([6 + k * 12.5, -22 - (k % 3) * 13, 9 + (k % 2) * 3, 9, 52 + ((k * 37) % 70)]);
  for (let k = 0; k < 9; k++)
    blocks.push([W + 12 + (k % 3) * 13, -6 + k * 12, 9, 9 + (k % 2) * 2, 48 + ((k * 53) % 72)]);
  // Far to near, so nearer towers are painted over farther ones.
  const near = (b: (typeof blocks)[number]) => b[1] + b[3] / 2 - (b[0] + b[2] / 2);
  blocks.sort((a, b) => near(a) - near(b));
  const towers = blocks
    .map(([x, y, w, d, h], k) => {
      const lit: string[] = [];
      for (let z = 10; z < h - 6; z += 13)
        for (let c = 0; c < 2; c++) {
          if ((k * 7 + z + c * 5) % 3 === 0) continue;
          const face: P3[] = [
            [x + 1.5 + c * (w / 2), y + d + 0.05, z],
            [x + c * (w / 2) + w / 2 - 1, y + d + 0.05, z],
            [x + c * (w / 2) + w / 2 - 1, y + d + 0.05, z + 4],
            [x + 1.5 + c * (w / 2), y + d + 0.05, z + 4],
          ];
          lit.push(`M${face.map((q) => pt(...q).join(' ')).join('L')}Z`);
        }
      const roof =
        k % 3 === 0
          ? `${line('ant', [x + w / 2, y + d / 2, h], [x + w / 2, y + d / 2, h + 12])}${dot('beacon', x + w / 2, y + d / 2, h + 12, 2, `--d:${r2((k % 4) * 0.4)}s`)}`
          : '';
      // Some towers carry a vertical neon sign; one carries a billboard that cycles its colour.
      const sign =
        k % 4 === 2
          ? neon(
              k % 8 === 2 ? 'm' : 'c',
              [x + w / 2, y + d + 0.1, h * 0.25],
              [x + w / 2, y + d + 0.1, h * 0.7],
            )
          : '';
      const bill =
        k === 6
          ? quad('bill', [
              [x + 0.8, y + d + 0.12, h - 22],
              [x + w - 0.8, y + d + 0.12, h - 22],
              [x + w - 0.8, y + d + 0.12, h - 8],
              [x + 0.8, y + d + 0.12, h - 8],
            ])
          : '';
      return `${prism(x, y, 0, x + w, y + d, h, 'n')}<path class="bw${k % 3 === 0 ? ' m' : k % 3 === 1 ? ' c' : ''}${k % 4 === 1 ? ' tw' : ''}" d="${lit.join('')}"/>${sign}${bill}${roof}`;
    })
    .join('');
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const stars = Array.from({ length: 28 }, (_, i) => {
    const [x, y] = [r1(rnd() * VIEW.w), r1(rnd() * 560 - 360)];
    return `<circle class="sky-star${i % 6 === 0 ? ' tw' : ''}" style="--d:${r2((i % 7) * 0.6)}s" cx="${x}" cy="${y}" r="${i % 5 === 0 ? 1.6 : 1}"/>`;
  }).join('');
  const flies = Array.from({ length: 10 }, (_, i) => {
    const [x, y] = [r1(60 + rnd() * 840), r1(rnd() * 300 - 120)];
    return `<circle class="fly" style="--d:${r2(i * 0.7)}s" cx="${x}" cy="${y}" r="1.8"/>`;
  }).join('');
  return [
    `<ellipse class="haze" cx="480" cy="230" rx="560" ry="330" fill="url(#dr-haze)"/>`,
    stars,
    `<g class="moon"><circle cx="862" cy="62" r="17"/><circle class="crater" cx="856" cy="57" r="3.4"/><circle class="crater" cx="868" cy="69" r="2.4"/></g>`,
    `<g class="plane"><path class="trail" d="M-34 4H-120"/><path class="body" d="M-14 0L12 -1.6L16 0L12 1.6ZM-2 0L-8 -9L-4 -9L4 0L-4 9L-8 9ZM-12 0L-15 -4L-13 -4L-9 0Z"/><circle class="nav r" cx="-6" cy="-8" r="1.4"/><circle class="nav g" cx="-6" cy="8" r="1.4"/></g>`,
    `<g class="fcar f1"><path class="ftrail" d="M-6 0H-70"/><rect x="-6" y="-2.6" width="14" height="5.2" rx="2.6"/><circle class="flite" cx="8" cy="0" r="1.8"/></g>`,
    `<g class="fcar f2"><path class="ftrail" d="M6 0H70"/><rect x="-8" y="-2.4" width="13" height="4.8" rx="2.4"/><circle class="flite" cx="-8" cy="0" r="1.7"/></g>`,
    (
      [
        [180, 40, 1],
        [640, -10, 0.8],
        [420, 110, 0.6],
      ] as const
    )
      .map(
        ([x, y, k], i) =>
          `<path class="cloud" style="--d:${-i * 9}s" d="M${x} ${y}c${r1(-4 * k)} ${r1(-12 * k)} ${r1(14 * k)} ${r1(-16 * k)} ${r1(18 * k)} ${r1(-6 * k)}c${r1(4 * k)} ${r1(-12 * k)} ${r1(24 * k)} ${r1(-10 * k)} ${r1(22 * k)} ${r1(2 * k)}c${r1(12 * k)} ${r1(-2 * k)} ${r1(16 * k)} ${r1(12 * k)} ${r1(4 * k)} ${r1(12 * k)}h${r1(-40 * k)}c${r1(-10 * k)} 0 ${r1(-12 * k)} ${r1(-8 * k)} ${r1(-4 * k)} ${r1(-8 * k)}z"/>`,
      )
      .join(''),
    `<g class="birds"><path d="M0 0q4 -4 8 0q4 -4 8 0"/><path d="M22 -10q3 -3 6 0q3 -3 6 0"/></g>`,
    `<g class="city ig" data-ig="sky">${towers}</g>`,
    flies,
  ].join('');
}

/* ---------------------------------------------------------------- the street ------------------------------------ */

// The block the building stands on: pavement, two roads with traffic, street lamps and trees, so the room sits in a
// place rather than in empty space. The back part is drawn behind the building; lamps and trees in front of it after.
function street() {
  const g = -6;
  const lamp = (x: number, y: number) => {
    const [hx, hy] = pt(x, y, g + 17);
    const [bx, by] = pt(x, y, g);
    return streetLampIg(
      pt,
      vec,
      x,
      y,
      g,
      `<ellipse class="pool" cx="${bx}" cy="${by}" rx="30" ry="15" fill="url(#dr-warm)"/><circle class="glow" cx="${hx}" cy="${hy}" r="18" fill="url(#dr-warm)"/><circle class="lhead" cx="${hx}" cy="${hy}" r="2.4"/>`,
    );
  };
  const tree = (x: number, y: number, k = 1) => treeIg(pt, vec, x, y, g, k);
  // A car: a body, a cabin, head and tail lights; it drives the length of its road and comes round again.
  const car = (
    alongX: boolean,
    lane: number,
    from: number,
    dir: 1 | -1,
    tone: 'l' | 'a' | 'n',
    delay: number,
  ) => {
    const L = 6;
    const [a0, a1] = dir > 0 ? [from, from + L] : [from - L, from];
    const head = dir > 0 ? a1 + 0.3 : a0 - 0.3;
    const tail = dir > 0 ? a0 - 0.2 : a1 + 0.2;
    const at3 = (u: number, v: number, z: number): [number, number, number] =>
      alongX ? [u, v, z] : [v, u, z];
    const span = 300 * dir;
    return `<g class="car" style="${alongX ? move('c', span, 0, 0) : move('c', 0, span, 0)};animation-delay:${delay}s">${carBodyIg(pt, vec, alongX, lane, a0, a1, g, tone)}${dot('hl', ...at3(head, lane, g + 1.2), 1.6)}<ellipse class="beamh" cx="${pt(...at3(head + 4 * dir, lane, g))[0]}" cy="${pt(...at3(head + 4 * dir, lane, g))[1]}" rx="14" ry="5"/>${dot('tl', ...at3(tail, lane, g + 1.2), 1.3)}</g>`;
  };
  const dashes = (alongX: boolean, c: number, from: number, to: number) => {
    const d: string[] = [];
    for (let u = from; u < to; u += 10) {
      const [p0, p1] = alongX
        ? [pt(u, c, g + 0.02), pt(u + 5, c, g + 0.02)]
        : [pt(c, u, g + 0.02), pt(c, u + 5, g + 0.02)];
      d.push(`M${p0.join(' ')}L${p1.join(' ')}`);
    }
    return `<path class="lane" d="${d.join('')}"/>`;
  };
  return {
    back: [
      floorRect(-130, -90, W + 120, D + 150, g - 0.02, 'ground'),
      floorRect(-130, D + 16, W + 120, D + 36, g - 0.01, 'road'),
      floorRect(-44, -90, -22, D + 150, g - 0.01, 'road'),
      dashes(true, D + 26, -130, W + 120),
      dashes(false, -33, -90, D + 150),
      floorRect(-16, -16, W + 16, D + 12, g - 0.005, 'walk'),
      ...[0, 1, 2, 3, 4].map((i) => floorRect(-20, D + 17 + i * 4, -10, D + 19 + i * 4, g, 'zebra')),
      car(false, -28, -150, 1, 'a', -2),
      car(false, -38, D + 160, -1, 'l', -7),
      car(true, D + 21, -170, 1, 'l', -1),
      car(true, D + 31, W + 170, -1, 'a', -5),
      car(true, D + 21, -170, 1, 'n', -6.5),
      tree(W + 10, 8),
      lamp(W + 10, 40),
    ].join(''),
    // These stand in front of the building (beside its open sides), so they are drawn after it.
    front: [
      tree(-10, 30, 1.1),
      lamp(-10, 60),
      tree(-10, 86),
      lamp(24, D + 9),
      tree(66, D + 8, 1.15),
      lamp(96, D + 9),
      tree(W + 9, D + 6),
    ].join(''),
  };
}

/* ---------------------------------------------------------------- ground floor ---------------------------------- */

// 01 At the desk: the mascot sits down. Act 1, fifteen tiles light at once; act 2, the Redis cube holds them while its
// TTL ring runs down; act 3, the latency bar drops.
function s1() {
  // The Redis cube stands at the desk's far end, clear of the screens, with its TTL ring on top of it.
  const [rx, ry] = pt(29.75, 8.75, 17.9);
  return [
    floorRect(4, 0.2, 34, 30, 0.15, 'pad'),
    floorText(6, 33, 0.2, '01', false),
    yRect(6, 31, 37.4, 39, 'bar old'),
    yRect(6, 13, 33, 34.6, 'bar new'),
    yText(6, 40.4, 'was 10 to 15 s', 'wn'),
    yText(14, 33.2, 'now 2 to 5 s', 'wn new-t'),
    yText(26, 22, 'redis · TTL', 'wn sm'),
    withProp(
      deskIg(pt, vec),
      `<g class="redis">${box(28, 7, 14.3, 31.5, 10.5, 17.8, 'a')}</g>`,
      `<ellipse class="ttl" cx="${rx}" cy="${ry}" rx="12" ry="6"/>`,
    ),
    cyl(20, 20, 0, 2.4, 0.7, 'n'),
    cyl(20, 20, 0.7, 0.5, 3.6, 'n'),
    cyl(20, 20, 4.3, 3.6, 1.5, 'a'),
  ].join('');
}

// 02 At the conveyor: the mascot works the lever. Act 1, questions ride into the critic arch; act 2, one fails, the
// lever sends it back; act 3, it comes round again and the counter reads 15 / 15.
function s2() {
  const card = (cls: string) =>
    `<g class="card ${cls}" style="${move('e', 26, 0, 0)};${move('h', 13, 0, 0)};${move('u', 13, 0, 10)};${move('v', 0, 0, 10)}">${box(39, 7.5, 8, 42.6, 10.5, 8.6, 'l')}</g>`;
  const [lx, ly] = pt(52.6, 9, 21.6);
  const [beltBack, beltFront] = beltIg(pt, vec);
  const [bx, by] = pt(59.7, 20, 9.8);
  return [
    floorRect(36, 0.2, 70, 30, 0.15, 'pad'),
    floorText(38, 33, 0.2, '02', false),
    skyline(54, 68, 26),
    windowIg(pt, vec, 54, 68, 26, 46, 0).frame,
    yRect(40, 52, 25, 33, 'disp'),
    yText(41, 30.6, 'critic', 'dt'),
    yText(41, 26.6, '14/15', 'dn n14'),
    yText(41, 26.6, '15/15 ✓', 'dn n15'),
    legs(38.5, 5.5, 67.5, 12.5, 0, 4),
    soft(38, 5, 4, 68, 13, 7, 2.6, 'n'),
    beltBack,
    card('c1'),
    card('c2'),
    card('c3'),
    beltFront,
    `<circle class="lamp" cx="${lx}" cy="${ly}" r="2.6"/>`,
    box(56, 17, 0, 63, 22, 9, 'n'),
    box(57, 17.6, 9, 62, 19, 9.8, 'k'),
    `<g class="lever" style="transform-origin:${bx}px ${by}px">${line('stick', [59.7, 20, 9.8], [59.7, 20, 15])}${dot('knob', 59.7, 20, 15, 2.6)}</g>`,
  ].join('');
}

// 03 At the whiteboard: the mascot steps on the stool and points. Act 1, the records pile up; act 2, the bars reorder
// into a ranking; act 3, the top of the ranking is marked, Precision@50.
function s3() {
  return [
    floorRect(72, 0.2, 103, 30, 0.15, 'pad'),
    floorText(74, 33, 0.2, '03', false),
    boardIg(pt, vec),
  ].join('');
}

// 04 Between the rack and the cloud: the mascot carries a container. Act 1, it is built on the Linux rack; act 2, the
// pipeline lights build, GHCR, deploy; act 3, it lands on the DigitalOcean shelf.
function s4() {
  const leds = Array.from({ length: 10 }, (_, i) => {
    const y = 25 + (i % 5) * 1.25;
    const z = 30 - Math.floor(i / 5) * 6;
    return `<g class="led" style="--d:${r2((i * 0.37) % 1.4)}s">${quad('ld', [
      [124.5, y, z],
      [124.5, y + 0.8, z],
      [124.5, y + 0.8, z + 0.8],
      [124.5, y, z + 0.8],
    ])}</g>`;
  }).join('');
  const steps = ['build', 'GHCR', 'deploy']
    .map(
      (s, i) => `${dot('pl', W - 0.3, 26 + i * 9, 46, 3, `--d:${i}`)}${xText(24 + i * 9, 41.4, s, 'wn sm')}`,
    )
    .join('');
  return [
    floorRect(100, 22, W - 0.2, 48, 0.15, 'pad'),
    floorText(101, 24, 0.2, '04', true),
    xText(24, 52, 'GitHub Actions', 'wn'),
    line('pipe', [W - 0.3, 26, 46], [W - 0.3, 44, 46]),
    steps,
    xText(24.5, 37, 'linux host', 'wn sm'),
    rackIg(pt, vec),
    leds,
    box(110, 24, 0, 115, 29, 4, 'n'),
    `<g class="pick">${box(110.6, 24.6, 4, 114.4, 28.4, 7.8, 'a')}</g>`,
    `<g class="landed">${box(120, 40, 23.5, 123.6, 43.6, 27.1, 'a')}</g>`,
    (() => {
      const [dx, dy] = pt(123, 41, 28.5);
      return `<text class="wn sm" x="${dx}" y="${dy}" text-anchor="middle">DigitalOcean</text>`;
    })(),
  ].join('');
}

// 05 At the standing desk: the mascot directs two agents. Act 1, the plan is ticked off; act 2, Claude Code and Codex
// circle while the code is typed; act 3, the tests go from red to green.
function s5() {
  return [
    floorRect(100, 48, W - 0.2, 72, 0.15, 'pad'),
    floorText(101, 50, 0.2, '05', true),
    agentsIg(pt, vec),
  ].join('');
}

function skyline(x0: number, x1: number, z0: number) {
  const blocks = [3, 6, 4, 8, 5, 7, 3.5, 6.5];
  const w = (x1 - x0) / blocks.length;
  return blocks
    .map((h, i) => yRect(x0 + i * w + 0.3, x0 + (i + 1) * w - 0.3, z0, z0 + h * 1.6, 'city', 0.22))
    .concat(
      [
        [2, 4],
        [4, 9],
        [6, 6],
        [3, 11],
      ].map(([i, z]) => dot('lit', x0 + (i! + 0.5) * w, 0.24, z0 + z!, 0.9)),
    )
    .join('');
}

function ground() {
  const books = [2.5, 4.4, 6.8, 8.6, 11.2, 13, 15.4, 17.6]
    .map((y, i) =>
      [12.6, 26.6]
        .map((z) => prism(121, y, z, 129.4, y + 1.6, z + 5.5 + (i % 3), i % 4 === 1 ? 'a' : 'l'))
        .join(''),
    )
    .join('');
  const [kx, ky] = pt(W - 0.3, 11, 52);
  return {
    shell: [
      prism(-3, -3, -6, W + 3, D, 0, 'fl'),
      floorRect(0, 0, W, D, 0.05, 'dith'),
      planks(0),
      prism(-3, -3, 0, W, 0, H, 'r'),
      prism(W, -3, 0, W + 3, D, H, 'r'),
      yRect(0, W, 0, 2, 'skirt', 0.25),
      xRect(0, D, 0, 2, 'skirt', W - 0.25),
      yText(6, 51.5, 'DATA SOLUTION-360', 'neon'),
      yText(6, 46.4, 'AI ENGINEER · JAN 2026 TO PRESENT', 'wn'),
      `<g class="clock" transform="translate(${kx} ${ky}) skewY(26.565)"><circle r="7"/><path class="hand h1" d="M0 0V-5"/><path class="hand h2" d="M0 0H3.6"/></g>`,
      oval('rug', 53, 63, 25, 19, 0.1),
      oval('rug-in', 53, 63, 21.5, 15.5, 0.12),
      floorRect(38, 88, 54, 99, 0.1, 'doormat'),
      floorText(40.5, 93.5, 0.15, 'START', false, 'ft sm'),
      neonShell(0, H),
      fairy(false, 2, 104, 57.5, 0.5),
      `<g data-label class="nsign">${xText(4, 48, '&lt;/&gt;', 'nsign-h', W - 0.35)}${xText(4, 48, '&lt;/&gt;', 'nsign-c', W - 0.3)}</g>`,
      fairy(true, 24, 72, 57.5, W - 0.5),
      `<ellipse class="warm" cx="${pt(23, 47, 0)[0]}" cy="${pt(23, 47, 0)[1]}" rx="70" ry="35" fill="url(#dr-warm)"/>`,
      floorRect(4, 79, 25, 89, 0.12, 'mat2'),
      line('cable', [118, 31.5, 0.1], [104, 31.5, 0.1], [104, 18, 0.1], [34, 18, 0.1]),
    ].join(''),
    corner: [
      box(120, 1, 0, 129.6, 21, 44, 'n'),
      box(120.6, 1.4, 12, 129.6, 20.6, 12.6, 'n'),
      box(120.6, 1.4, 26, 129.6, 20.6, 26.6, 'n'),
      books,
      box(106, 3, 0, 112, 9, 13, 'l'),
      puck(...pt(109, 6, 13), 6, 9, 'w'),
      plantIg(pt, vec, 'snake', [108.5, 16.5, 0], 1.15, 7),
    ].join(''),
    lounge: [
      loungeIg(pt, vec, 0),
      soft(28, 80, 0, 33, 84, 1.2, 0.6, 'a'),
      soft(28.4, 80.3, 1.2, 32.6, 83.7, 2.2, 0.6, 'l'),
      soft(28.2, 80.6, 2.2, 32.2, 83.4, 3.1, 0.6, 'n'),
      // A plant hung on the wall, its vines trailing down.
      cyl(35.5, 2, 44, 1.8, 2.6, 'n'),
      (() => {
        const vines = [
          [35, 3, 44, 33.5, 3.2, 36, 34.5, 3.4, 30],
          [36.2, 3, 44, 37.6, 3.4, 37, 36.8, 3.6, 32],
          [35.6, 3, 44, 35.8, 3.3, 39, 36.2, 3.5, 34],
        ];
        return vines
          .map(([a, b, c, d, e, f, g, h, i]) => {
            const pts: P3[] = [
              [a!, b!, c!],
              [d!, e!, f!],
              [g!, h!, i!],
            ];
            const leaves = pts
              .slice(1)
              .map((q, k) => {
                const [lx, ly] = pt(...q);
                return leaf(lx, ly, k % 2 ? -30 : 210, 7, 2.6, k % 2 ? 'lf' : 'lf2');
              })
              .join('');
            return `${curve('vine', ...pts)}${leaves}`;
          })
          .join('');
      })(),
    ].join(''),
    bedroom: (() => {
      const [cx, cy] = pt(9, 64, 5.9);
      return [
        `<ellipse class="under" cx="${pt(13, 65, 0)[0]}" cy="${pt(13, 65, 0)[1]}" rx="92" ry="46" fill="url(#dr-um)"/>`,
        withProp(
          bedIg(pt, vec, 0),
          `<g class="cat" style="transform-origin:${cx}px ${cy}px"><ellipse cx="${cx}" cy="${r1(cy - 3.5)}" rx="9.5" ry="5"/><circle cx="${r1(cx - 8.5)}" cy="${r1(cy - 6.5)}" r="4.2"/><path d="M${r1(cx - 12.2)} ${r1(cy - 8.4)}l1.2 -4.6 2.6 3.2zM${r1(cx - 8.2)} ${r1(cy - 9.6)}l1.6 -4.4 2.2 3.4z"/><path class="tail" d="M${r1(cx + 8.5)} ${r1(cy - 2.5)}q7 1 3.5 6.5"/></g>`,
        ),
        plantIg(pt, vec, 'monstera', [30, 44, 0], 1, 0),
      ].join('');
    })(),
    front: [
      `<g data-occ="95,87,103,95">${box(95, 87, 0, 103, 95, 17, 'n')}${xRect(88, 94, 5, 15, 'vend', 94.95)}${xRect(88.5, 93.5, 2, 3.6, 'vend-slot', 94.95)}</g>`,
      portal(0, true),
      floorText(104, 97.5, 0.15, 'PORTAL · LEVEL 2', false, 'ft sm'),
    ].join(''),
    light: [
      windowIg(pt, vec, 54, 68, 26, 46, 0).beams,
      holo(false, 12, 9, 25, 33, 43, [
        [10.5, 12, 35],
        [14, 12, 39],
        [17.5, 12, 37],
        [21, 12, 41.5],
        [23.5, 12, 40],
      ]),
      holo(true, 111.5, 50, 62, 38, 47, [
        [111.5, 51, 40],
        [111.5, 55, 44],
        [111.5, 58, 41],
        [111.5, 61, 45],
      ]),
    ].join(''),
  };
}

/** Where the portal stands, on both floors. */
const PORTAL: [number, number] = [122, 86];

// The portal: a pad and a beam of light. The mascot rises up the beam to the upper floor, and sinks back down it.
function portal(z: number, beam: boolean) {
  const [cx, cy] = pt(PORTAL[0], PORTAL[1], z);
  const top = r1(cy - 4);
  const motes = [-22, -9, 4, 17, 26, -15]
    .map(
      (dx, i) =>
        `<circle class="mote" style="--d:${r2(i * 0.45)}s" cx="${r1(cx + dx)}" cy="${r1(top - 10 - (i % 3) * 30)}" r="1.6"/>`,
    )
    .join('');
  return [
    beam
      ? `<rect class="beam" x="${r1(cx - 34)}" y="${r1(top - PAN)}" width="68" height="${PAN}" fill="url(#dr-beam)"/>`
      : '',
    portalPadIg(pt, vec, PORTAL[0], PORTAL[1], z),
    beam ? motes : '',
  ].join('');
}

/* ---------------------------------------------------------------- upper floor ----------------------------------- */

// 06 By the fireplace: the badge hangs over the mantel. Act 1, the fire flares as the mascot arrives; act 2, the badge
// rises over its head; act 3, confetti, and the frame over the mantel lights.
function c1(stand: [number, number]) {
  const z = UP;
  const [gx, gy] = pt(40, 14, z);
  const confetti = Array.from({ length: 12 }, (_, i) => {
    const [x, y] = pt(28 + i * 2.2, 10 + (i % 3) * 4, z + 30 + (i % 4) * 3);
    return `<rect class="conf" style="--d:${r2((i % 6) * 0.12)}s" x="${x}" y="${y}" width="3" height="4.5" rx="0.8"/>`;
  }).join('');
  return [
    floorRect(26, 6, 54, 32, z + 0.15, 'pad'),
    `<ellipse class="spot warm" cx="${gx}" cy="${gy}" rx="72" ry="36" fill="url(#dr-warm)"/>`,
    `<ellipse class="rugr" cx="${pt(40, 18, z + 0.1)[0]}" cy="${pt(40, 18, z + 0.1)[1]}" rx="52" ry="26"/>`,
    floorText(31, 35, z + 0.2, '06', false),
    withProp(
      fireplaceIg(pt, vec, z, H2),
      yRect(34.4, 45.6, z + 20, z + 33, 'frame cframe', 4.05),
      yImage('/certs/aws-ai-practitioner.webp', 35.3, z + 32.2, 10.2, 4.1),
      // Kept in the art, not lifted into the labels, so the words move with the chimney they are on.
      yText(34.4, z + 38, 'AWS', 'wt sm', 4.15).replace('<text ', '<text data-keep '),
      yText(34.4, z + 35.4, 'CERTIFIED', 'wt sm', 4.15).replace('<text ', '<text data-keep '),
    ),
    `<image class="holo" href="/certs/aws-ai-practitioner.webp" x="${r1(stand[0] - 24)}" y="${r1(stand[1] - 158)}" width="48" height="48"/>`,
    confetti,
  ].join('');
}

// 07 At the trophy case: the mascot lifts the trophy. Act 1, the case lights; act 2, the trophy goes up; act 3, the
// certificate on the wall shines.
function c2(stand: [number, number]) {
  const z = UP;
  const sparks = Array.from({ length: 6 }, (_, i) =>
    dot('spark', W - 0.6, 40 + i * 2.6, z + 18 + (i % 2) * 8, 1.4, `--d:${r2(i * 0.25)}s`),
  ).join('');
  return [
    floorRect(98, 14, W - 0.2, 46, z + 0.15, 'pad'),
    floorText(99, 16, z + 0.2, '07', true),
    xRect(38.5, 56.5, z + 12, z + 31, 'frame cframe'),
    xImage('/certs/udacity.webp', 39.5, z + 30, 16),
    xText(38.5, z + 34, 'NANODEGREE', 'wt'),
    trophyIg(pt, vec, z, stand),
    sparks,
  ].join('');
}

// 08 At the Redis stack: the mascot points at it. Act 1, three keys are written; act 2, their TTL ring runs down; act 3,
// one key expires and the stack glows, and the badge rises over the mascot.
function c3(stand: [number, number]) {
  const z = UP;
  return [
    floorRect(104, 54, W - 0.2, 76, z + 0.15, 'pad'),
    floorText(105, 56, z + 0.2, '08', true),
    redisIg(pt, vec, z),
    `<image class="holo" href="/certs/redis.webp" x="${r1(stand[0] - 24)}" y="${r1(stand[1] - 158)}" width="48" height="48"/>`,
  ].join('');
}

function upper() {
  const z = UP;
  const top = [
    [-3, -3],
    [W + 3, -3],
    [W + 3, D],
    [-3, D],
  ]
    .map(([x, y]) => pt(x!, y!, z).join(','))
    .join(' ');
  return {
    shell: [
      `<g class="fl">${quad('e', [
        [-3, -3, z - 6],
        [-3, D, z - 6],
        [-3, D, z],
        [-3, -3, z],
      ])}${quad('f', [
        [-3, D, z - 6],
        [W + 3, D, z - 6],
        [W + 3, D, z],
        [-3, D, z],
      ])}<polygon class="t" points="${top}"/></g>`,
      floorRect(0, 0, W, D, z + 0.05, 'dith'),
      planks(z),
      prism(-3, -3, z, W, 0, z + H2, 'r'),
      prism(W, -3, z, W + 3, D, z + H2, 'r'),
      yRect(0, W, z, z + 2, 'skirt', 0.25),
      xRect(0, D, z, z + 2, 'skirt', W - 0.25),
      yText(62, z + 38, 'LEVEL 2 · CERTIFICATIONS', 'neon'),
      neonShell(z, H2),
      windowIg(pt, vec, 5, 26, z + 14, z + 34, z).frame,
      [
        [8, 28],
        [13, 22],
        [18, 31],
        [23, 25],
        [15, 18],
      ]
        .map(([x, h]) => dot('star', x!, 0.24, z + h!, 0.9))
        .join(''),
      Array.from({ length: 13 }, (_, i) => {
        const y0 = 4 + i * 7;
        return quad(i % 3 === 0 ? 'flag a1' : i % 3 === 1 ? 'flag a2' : 'flag a3', [
          [W - 0.3, y0, z + 42],
          [W - 0.3, y0 + 5, z + 42],
          [W - 0.3, y0 + 2.5, z + 37.5],
        ]);
      }).join(''),
      line('tl', [W - 0.3, 3, z + 42.5], [W - 0.3, 96, z + 42.5]),
      portal(z, false),
      fairy(false, 54, 128, z + 44.5, 0.5),
      xText(60, z + 26, 'SEP 2026 · AWS', 'wn'),
      xText(60, z + 21.6, 'OCT 2026 · UDACITY', 'wn'),
      xText(60, z + 17.2, 'OCT 2026 · REDIS', 'wn'),
      line('tl', [W - 0.3, 58, z + 30], [W - 0.3, 92, z + 30]),
    ].join(''),
    study: [
      shelfIg(pt, vec, z),
      yText(60, z + 23.6, 'study shelf', 'wn sm'),
      line('pole', [16, 15, z + 11], [12, 11, z]),
      line('pole', [16, 15, z + 11], [20, 12, z]),
      line('pole', [16, 15, z + 11], [16, 20, z]),
      line('scope', [12, 18, z + 10.5], [19.5, 10, z + 15.5]),
      dot('lens', 19.5, 10, z + 15.5, 2.6),
      armchairIg(pt, vec, z),
      plantIg(pt, vec, 'monstera', [7, 7, z], 1.2, 3),
    ].join(''),
    light: [
      windowIg(pt, vec, 5, 26, z + 14, z + 34, z).beams,
      holo(true, 118.5, 18, 32, z + 33, z + 43, [
        [118.5, 21, z + 36],
        [118.5, 25, z + 41],
        [118.5, 29, z + 36],
      ]),
    ].join(''),
    front: [
      `<ellipse class="rugr" cx="${pt(70, 60, z + 0.1)[0]}" cy="${pt(70, 60, z + 0.1)[1]}" rx="62" ry="31"/>`,
      puck(...pt(62, 54, z), 12, 4, 'w'),
      puck(...pt(80, 66, z), 12, 4, 'a'),
      cyl(70, 60, z, 5.2, 4, 'n'),
      cyl(70, 60, z + 4, 1.8, 1.6, 'l'),
      mug(67.6, 62.2, z + 4),
      puck(...pt(67.8, 62.4, z + 4), 1.6, 1.6, 'l'),
      puck(...pt(72.4, 57.8, z + 4), 1.6, 1.6, 'l'),
      plantIg(pt, vec, 'snake', [100, 56, z], 1.3, 5),
      // A sofa corner at the front, on its own rug, with a lamp on a side table.
      oval('rugw', 21, 82, 17, 10, z + 0.1),
      sofaIg(pt, vec, z),
      recordPlayerIg(pt, vec, z),
      guitarIg(pt, vec, z, [46, 90]),
      plantIg(pt, vec, 'monstera', [5, 42, z], 1.5, 9),
      // Pictures on the wall.
      ...[
        [106, 114, 16, 25],
        [117, 126, 13, 27],
      ].map(
        ([a, b, lo, hi]) =>
          `${yRect(a!, b!, z + lo!, z + hi!, 'frame')}${yRect(a! + 0.9, b! - 0.9, z + lo! + 0.9, z + hi! - 0.9, 'pic')}${quad(
            'hill',
            [
              [a! + 0.9, 0.35, z + lo! + 0.9],
              [(a! + b!) / 2, 0.35, z + (lo! + hi!) / 2 + 1],
              [b! - 0.9, 0.35, z + lo! + 0.9],
            ],
          )}${dot('sun', b! - 2.4, 0.36, z + hi! - 2.6, 1.6)}`,
      ),
    ].join(''),
  };
}

/* ---------------------------------------------------------------- the rail beside the text ---------------------- */

/* ---------------------------------------------------------------- waypoint icons --------------------------------- */

/** A small isometric picture of a station, for the waypoints between the points on the page: same camera, same tones. */
export function renderIcon(kind: string) {
  const m = camera({ ox: 10, oy: 70, s: 2.2, az: -45 });
  const P = (x: number, y: number, z = 0) => m.at(x, y, z).map(r1) as [number, number];
  const sq = (cls: string, y: number, x0: number, x1: number, z0: number, z1: number) =>
    m.poly(cls, [
      [x0, y, z0],
      [x1, y, z0],
      [x1, y, z1],
      [x0, y, z1],
    ]);
  const ring = (cls: string, x: number, y: number, z: number, r: number) => {
    const [cx, cy] = P(x, y, z);
    return `<ellipse class="${cls}" cx="${cx}" cy="${cy}" rx="${r}" ry="${r / 2}"/>`;
  };
  const orb = (cls: string, x: number, y: number, z: number) => {
    const [cx, cy] = P(x, y, z);
    return `<circle class="${cls}" cx="${cx}" cy="${cy}" r="4"/>`;
  };
  const base = m.prism(0, 0, -2, 30, 30, 0, 'fl');
  const parts: Record<string, string> = {
    desk: [
      m.prism(5, 6, 0, 6, 7, 8, 'n'),
      m.prism(24, 14, 0, 25, 15, 8, 'n'),
      m.prism(4, 5, 8, 26, 16, 9, 'n'),
      m.prism(8, 6, 9, 22, 7.5, 18, 'k'),
      [0, 1, 2, 3].map((i) => sq('q on', 7.55, 9.5 + i * 3, 11.5 + i * 3, 11, 16)).join(''),
      m.prism(12, 20, 0, 18, 26, 4, 'n'),
    ].join(''),
    conveyor: [
      m.prism(2, 10, 0, 28, 18, 4, 'n'),
      m.prism(13, 9, 4, 15, 10.5, 14, 'w'),
      m.prism(18, 12, 4, 21.5, 16, 4.6, 'l'),
      m.prism(13, 17.5, 4, 15, 19, 14, 'w'),
      m.prism(13, 9, 14, 15, 19, 15.5, 'w'),
      orb('lampc', 14, 14, 16.5),
    ].join(''),
    board: [
      m.prism(3, 1, 4, 27, 2, 22, 'l'),
      m.prism(5, 9, 0, 25, 16, 6, 'n'),
      [9, 7, 5, 3]
        .map((h, i) => m.prism(7 + i * 4.4, 11, 6, 9.5 + i * 4.4, 13.5, 6 + h, i < 1 ? 'a' : 'l'))
        .reverse()
        .join(''),
    ].join(''),
    rack: [
      m.prism(12, 8, 0, 22, 16, 22, 'n'),
      [0, 1, 2, 3, 4].map((i) => sq('led on', 16.05, 13 + i * 1.6, 14 + i * 1.6, 18, 19)).join(''),
      m.prism(4, 18, 0, 9, 23, 5, 'a'),
      m.prism(20, 22, 10, 29, 29, 11.2, 'w'),
      m.prism(23, 24, 11.2, 26, 27, 14, 'a'),
    ].join(''),
    agents: [
      m.prism(6, 8, 0, 7, 9, 9, 'n'),
      m.prism(23, 19, 0, 24, 20, 9, 'n'),
      m.prism(5, 7, 9, 25, 21, 10, 'n'),
      m.prism(9, 10, 10, 18, 18, 10.5, 'l'),
      m.prism(18, 10, 10.5, 18.8, 18, 17, 'k'),
      orb('orb1', 6, 6, 22),
      orb('orb2', 16, 24, 20),
    ].join(''),
    portal: [
      ring('pglow', 15, 15, 0.1, 26),
      ring('prune', 15, 15, 0.2, 19),
      ring('pcore', 15, 15, 0.3, 9),
      (() => {
        const [cx, cy] = P(15, 15, 0);
        return `<rect class="wbeam" x="${r1(cx - 15)}" y="${r1(cy - 66)}" width="30" height="66"/>`;
      })(),
    ].join(''),
    redis: [
      m.prism(6, 8, 0, 24, 22, 4, 'n'),
      `<g class="ric">${[0, 1, 2].map((i) => m.prism(9, 11, 5 + i * 3.4, 21, 19, 7.6 + i * 3.4, 'a')).join('')}</g>`,
    ].join(''),
    trophy: [
      m.prism(10, 10, 0, 20, 20, 7, 'n'),
      (() => {
        const [cx, cy] = P(15, 15, 7);
        return `${m.puck(cx, cy, 6, 3, 'a')}${m.puck(cx, cy - 3, 2, 6, 'a')}${m.puck(cx, cy - 9, 9, 9, 'a')}`;
      })(),
    ].join(''),
  };
  return `<svg class="dr-svg wp-icon" viewBox="0 0 112 98" aria-hidden="true">${kind === 'portal' ? '' : base}${parts[kind] ?? ''}</svg>`;
}

/* ---------------------------------------------------------------- mascot and route ------------------------------ */

// The mascot is built from Kenney's "Male person" (Toon Characters 1, CC0, kenney.nl), redrawn younger (curly hair, a
// trimmed beard) in a green polo, jeans and sneakers. A sheet of 22 frames, 96 x 100 each: walk 0 to 7, idle, interact,
// back, switch 0 and 1, show, hold, talk, think, cheer 0 and 1, jump, and two frames sitting at a desk. The stylesheet
// picks the frame by sliding the sheet inside a one-frame window.
const MASCOT = `<g class="m-shuttle"><ellipse class="m-shadow" cx="0" cy="0" rx="20" ry="7"/>
  <g class="m-warp"><g class="m-flip" data-flip><g class="m-hop"><g class="m-body">
    <svg class="hero" x="-48" y="-100" width="96" height="100" viewBox="0 0 96 100"><image class="hero-img" href="/resume-hero.png" width="2112" height="100"/></svg>
    <g class="m-box" transform="translate(-17 -12)"><path class="bt" d="M10 -32l7 -3.5 7 3.5 -7 3.5z"/><path class="bf" d="M10 -32v8l7 3.5v-8z"/><path class="be" d="M24 -32v8l-7 3.5v-8z"/></g>
  </g></g></g></g></g>`;

export type RoomStation = { id: string; label: string };
type Stop = { at: P3; pose: string; face: 1 | -1; via?: P3[] };

// Where the mascot stands at each station, how it approaches it, and what it does there.
const STOPS: Stop[] = [
  {
    at: [20, 20, 5.6],
    pose: 'sit',
    face: -1,
    // From the door, up the lane on the beanbag's left (x 36: the bed ends at x 26.4, the beanbag begins at 39.8, the
    // monstera by the headboard spreads to about 33), then across to the desk: never over a prop (the mascot is drawn in
    // front of everything, so its path must not pass behind furniture).
    via: [
      [46, 88, 0],
      [36, 84, 0],
      [36, 34, 0],
      [20, 31, 0],
    ],
  },
  {
    at: [60, 26, 0],
    pose: 'lever',
    face: -1,
    via: [
      [20, 31, 0],
      [60, 30, 0],
    ],
  },
  {
    at: [87.5, 9.5, 4.1],
    pose: 'point',
    face: -1,
    via: [
      [87.5, 28, 0],
      [87.5, 16, 0],
    ],
  },
  {
    at: [106, 31, 0],
    pose: 'carry',
    face: 1,
    via: [
      [87.5, 28, 0],
      [106, 28, 0],
    ],
  },
  { at: [108, 58, 0], pose: 'conduct', face: 1, via: [[106, 44, 0]] },
  {
    at: [40, 17, UP],
    pose: 'raise',
    face: -1,
    via: [
      [112, 74, 0],
      [...PORTAL, 0],
      [...PORTAL, UP],
      [122, 72, UP],
      [110, 44, UP],
      [48, 24, UP],
    ],
  },
  {
    at: [104, 36, UP],
    pose: 'lift',
    face: 1,
    via: [
      [48, 24, UP],
      [100, 44, UP],
    ],
  },
  {
    at: [112, 65, UP],
    pose: 'point',
    face: 1,
    // From the trophy case, clear of the snake plant (its footprint ends at x 103.3), to the front of the stack.
    via: [[106, 48, UP]],
  },
];
const DOOR: P3 = [46, 94, 0];

export function renderRoom(stations: RoomStation[]) {
  // The route: the door, then for each station its approach points and its spot. The stops are route indices.
  const route: P3[] = [DOOR];
  const stops: number[] = [0];
  for (const s of STOPS) {
    route.push(...(s.via ?? []), s.at);
    stops.push(route.length - 1);
  }
  const screen = route.map(([x, y, z]) => pt(x, y, z));
  const stand = (i: number) => pt(...STOPS[i]!.at);
  const [sx0, sy0] = pt(106, 31, 0);
  const [sx1, sy1] = pt(106, 44, 0);
  const shuttle = `--hx:${r1(sx1 - sx0)}px;--hy:${r1(sy1 - sy0)}px`;
  const parts = [s1(), s2(), s3(), s4(), s5(), c1(stand(5)), c2(stand(6)), c3(stand(7))];
  const pieces = parts.map(split);
  const group = (i: number) =>
    `<a class="st" data-st="${i}" data-pose="${STOPS[i]!.pose}" data-face="${STOPS[i]!.face}" href="#${stations[i]!.id}" aria-label="${stations[i]!.label}"${i === 3 ? ` style="${shuttle}"` : ''}>${pieces[i]!.art}</a>`;
  const words = (i: number) => `<g class="stl" data-stl="${i}">${pieces[i]!.text}</g>`;
  const g = ground();
  const u = upper();
  const st = street();
  // Each floor's drawing, split into its art and its words.
  const gs = split(`${g.shell}${g.corner}`);
  const gl = split(`${g.lounge}${g.bedroom}`);
  const gf = split(`${g.front}${g.light}`);
  const us = split(`${u.shell}${u.study}`);
  const uf = split(`${u.front}${u.light}`);
  const [mx, my] = screen[0]!;
  // The focus layer sits above the room and below the words: a soft dimming with a bright hole that follows the
  // mascot, like a stage spotlight (the script moves the hole), and at the active station a pool of light on the
  // floor, a cone of light and a few rising sparks. Light drawn as shapes with gradient fills, not blur.
  const spotAt = (i: number) => {
    const [x, y] = stand(i);
    const motes = [-18, -6, 8, 18, -12, 12]
      .map(
        (dx, k) =>
          `<rect class="fp-mote" style="--d:${r2(k * 0.4)}s" x="${r1(x + dx)}" y="${r1(y - 8 - k * 7)}" width="2.6" height="2.6"/>`,
      )
      .join('');
    return `<g class="fspot" data-fspot="${i}"><ellipse cx="${r1(x)}" cy="${r1(y)}" rx="50" ry="25" fill="url(#dr-fpool)"/><ellipse class="fp-ring" cx="${r1(x)}" cy="${r1(y)}" rx="34" ry="17"/><path d="M${r1(x - 24)} ${r1(y - 2)}L${r1(x - 46)} ${r1(y - 150)}H${r1(x + 46)}L${r1(x + 24)} ${r1(y - 2)}Z" fill="url(#dr-fcone)"/>${motes}</g>`;
  };
  const focus = `<g class="fx-focus" aria-hidden="true" pointer-events="none"><defs><radialGradient id="dr-focus" gradientUnits="userSpaceOnUse" cx="${mx}" cy="${r1(my - 34)}" r="470"><stop offset=".18" stop-color="#08050c" stop-opacity="0"/><stop offset=".55" stop-color="#08050c" stop-opacity=".18"/><stop offset="1" stop-color="#08050c" stop-opacity=".28"/></radialGradient><radialGradient id="dr-fpool"><stop offset="0" stop-color="#ffc867" stop-opacity=".55"/><stop offset=".6" stop-color="#ffc867" stop-opacity=".2"/><stop offset="1" stop-color="#ffc867" stop-opacity="0"/></radialGradient><linearGradient id="dr-fcone" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffd98a" stop-opacity=".34"/><stop offset=".7" stop-color="#ffd98a" stop-opacity=".08"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></linearGradient></defs><rect x="-600" y="-600" width="${VIEW.w + 1200}" height="${VIEW.h + PAN + 1200}" fill="url(#dr-focus)"/>${STOPS.map((_, i) => spotAt(i)).join('')}</g>`;
  return `<svg class="dr-svg" viewBox="0 0 ${VIEW.w} ${VIEW.h}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="My dev room: two floors, one station for each point of my résumé" data-route="${JSON.stringify(screen)}" data-room="${JSON.stringify(route.map(([x, y]) => [x, y]))}" data-z="${JSON.stringify(route.map((p) => p[2]))}" data-stops="${JSON.stringify(stops)}" data-pan="${PAN}" data-up="${UP}"><defs><linearGradient id="dr-beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffc867" stop-opacity=".45"/><stop offset="1" stop-color="#ffc867" stop-opacity="0"/></linearGradient><radialGradient id="dr-warm"><stop offset="0" style="stop-color:var(--partial);stop-opacity:.34"/><stop offset="1" style="stop-color:var(--partial);stop-opacity:0"/></radialGradient><linearGradient id="dr-rm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a3d" stop-opacity=".3"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></linearGradient><linearGradient id="dr-rc" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#ffc867" stop-opacity=".26"/><stop offset="1" stop-color="#ffc867" stop-opacity="0"/></linearGradient><linearGradient id="dr-shaft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb057" stop-opacity=".3"/><stop offset="1" stop-color="#ffb057" stop-opacity="0"/></linearGradient><radialGradient id="dr-um"><stop offset="0" stop-color="#ff8a3d" stop-opacity=".42"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient><pattern id="dr-dither" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="#fff" fill-opacity=".07"/><rect x="2" y="2" width="1" height="1" fill="#fff" fill-opacity=".07"/></pattern><radialGradient id="dr-haze"><stop offset="0" stop-color="#ff9a55" stop-opacity=".09"/><stop offset="1" stop-color="#ff9a55" stop-opacity="0"/></radialGradient></defs><g data-cam><g data-art><g class="outside" data-outside>${outside()}</g>${st.back}<g class="mass">${prism(-3, -3, -6, W + 3, D, H, 'n')}</g><g class="floor-g">${gs.art}${group(2)}${group(1)}${group(0)}${gl.art}${group(3)}${group(4)}${gf.art}</g><g class="floor-u">${us.art}${group(5)}${group(6)}${group(7)}${uf.art}</g>${st.front}</g>${focus}<g class="labels"><g class="lbl-g">${gs.text}${gl.text}${gf.text}${[0, 1, 2, 3, 4].map(words).join('')}</g><g class="lbl-u">${us.text}${uf.text}${words(5)}${words(6)}${words(7)}</g></g><g class="mascot" data-mascot transform="translate(${mx} ${my})" style="${shuttle}">${MASCOT}</g></g></svg>`;
}
