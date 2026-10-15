// The résumé dev room: a two-floor isometric building, drawn at build time with the same camera helper as the Bench
// stages. The ground floor is the work: one station per experience point. The upper floor holds the certifications and
// is reached by a portal. Each floor is a corner diorama: its back walls are the planes y = 0 (left) and x = W
// (right); anything nearer the viewer has a larger y and a smaller x, and is drawn later.
//
// Every station plays the same three-act clock (6 s: acts at 8%, 36% and 64%), and the matching words on the page light
// on the same beats, so the text and the room tell one story at one time.
import { camera, type Tone } from '../bench/iso';

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
/** A potted plant: a round pot and a spray of leaves. */
const plant = (x: number, y: number, z: number, k = 1) => {
  const [px, py] = pt(x, y, z + 4.5 * k);
  const angles = [-160, -135, -112, -90, -68, -45, -20];
  return `${cyl(x, y, z, 2.3 * k, 4.5 * k, 'n')}<g class="plant">${angles
    .map((d, i) => leaf(px, py, d + (i % 2 ? 6 : -4), (14 + (i % 3) * 5) * k, 3.6 * k, i % 2 ? 'lf' : 'lf2'))
    .join('')}</g>`;
};
/** A curtain on the left wall: a panel that drapes forward, with its folds. */
const curtain = (xa: number, xb: number, top: number, bottom: number) => {
  const mid = (top + bottom) / 2;
  const edge: P3[] = [
    [xa, 0.4, top],
    [xb, 0.4, top],
    [xb + 0.5, 1.4, mid],
    [xb, 0.8, bottom + 1],
    [(xa + xb) / 2 + 0.4, 2.2, bottom],
    [xa, 1.2, bottom + 0.8],
    [xa - 0.4, 1.6, mid],
  ];
  const folds = [0.3, 0.6]
    .map((f) =>
      curve(
        'fold',
        [xa + (xb - xa) * f, 0.6, top - 1],
        [xa + (xb - xa) * f + 0.3, 1.8, mid],
        [xa + (xb - xa) * f, 1.4, bottom + 1.5],
      ),
    )
    .join('');
  return `${blob('drape', edge)}${folds}`;
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
const LABEL = /<text[\s\S]*?<\/text>|<g data-label[^>]*>[\s\S]*?<\/g>/g;
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
/** City light through window blinds: slats on the glass and striped shafts across the floor. */
function blinds(x0: number, x1: number, z0: number, z1: number, floor: number) {
  const slats: string[] = [];
  for (let z = z0 + 1.6; z < z1; z += 2.2) slats.push(line('slat', [x0, 0.32, z], [x1, 0.32, z]));
  const w = (x1 - x0) / 4;
  const shafts = [0, 1, 2, 3]
    .map((i) => {
      const a = x0 + i * w + 0.4;
      const b = a + w * 0.55;
      const corners: P3[] = [
        [a, 0.4, z0 + 4],
        [b, 0.4, z0 + 4],
        [b + 12, 34, floor + 0.13],
        [a + 12, 34, floor + 0.13],
      ];
      return `<polygon class="shaft" points="${corners.map((q) => pt(...q).join(',')).join(' ')}" fill="url(#dr-shaft)"/>`;
    })
    .join('');
  return { slats: slats.join(''), shafts };
}
/** A hologram: a translucent panel floating in the room, with scan lines and something drawn on it. */
function holo(alongY: boolean, plane: number, a0: number, a1: number, z0: number, z1: number, draw: P3[]) {
  const q = (u: number, z: number): P3 => (alongY ? [plane, u, z] : [u, plane, z]);
  const scan: string[] = [];
  for (let z = z0 + 1.5; z < z1; z += 1.8) scan.push(line('scan', q(a0 + 0.5, z), q(a1 - 0.5, z)));
  return `<g class="holo-g">${quad('holo-p', [q(a0, z0), q(a1, z0), q(a1, z1), q(a0, z1)])}${scan.join('')}${line('holo-l', ...draw)}</g>`;
}

/** A flame, drawn upright from its base. */
const flame = (x: number, y: number, h: number, cls: string) =>
  `<path class="${cls}" d="M${r1(x - 3.4)} ${y}Q${r1(x - 4.4)} ${r1(y - h * 0.55)} ${x} ${r1(y - h)}Q${r1(x + 4.4)} ${r1(y - h * 0.55)} ${r1(x + 3.4)} ${y}Z"/>`;

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
    `<g class="city">${towers}</g>`,
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
    return `${line('lpole', [x, y, g], [x, y, g + 17])}<ellipse class="pool" cx="${bx}" cy="${by}" rx="30" ry="15" fill="url(#dr-warm)"/><circle class="glow" cx="${hx}" cy="${hy}" r="18" fill="url(#dr-warm)"/><circle class="lhead" cx="${hx}" cy="${hy}" r="2.4"/>`;
  };
  const tree = (x: number, y: number, k = 1) => {
    const [tx, ty] = pt(x, y, g);
    const crown = Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2;
      const r = (12 + ((i * 7) % 3) * 2.2) * k;
      return [r1(tx + Math.cos(a) * r), r1(ty - 30 * k + Math.sin(a) * r * 0.9)] as P2;
    });
    return `${line('trunk', [x, y, g], [x, y, g + 6 * k])}<path class="canopy" d="${smoothD(crown, true)}"/><path class="canopy-hi" d="${smoothD(
      crown.slice(5).map(([a, b]) => [r1(a + 2 * k), r1(b + 3 * k)] as P2),
    )}"/>`;
  };
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
    const box = (u0: number, u1: number, v0: number, v1: number, z0: number, z1: number) =>
      alongX ? soft(u0, v0, z0, u1, v1, z1, 0.8, tone) : soft(v0, u0, z0, v1, u1, z1, 0.8, tone);
    const head = dir > 0 ? a1 + 0.3 : a0 - 0.3;
    const tail = dir > 0 ? a0 - 0.2 : a1 + 0.2;
    const at3 = (u: number, v: number, z: number): [number, number, number] =>
      alongX ? [u, v, z] : [v, u, z];
    const span = 300 * dir;
    return `<g class="car" style="${alongX ? move('c', span, 0, 0) : move('c', 0, span, 0)};animation-delay:${delay}s">${box(a0, a1, lane - 1.6, lane + 1.6, g, g + 2.2)}${box(a0 + 1.4, a1 - 1.6, lane - 1.3, lane + 1.3, g + 2.2, g + 3.7)}${dot('hl', ...at3(head, lane, g + 1.2), 1.6)}<ellipse class="beamh" cx="${pt(...at3(head + 4 * dir, lane, g))[0]}" cy="${pt(...at3(head + 4 * dir, lane, g))[1]}" rx="14" ry="5"/>${dot('tl', ...at3(tail, lane, g + 1.2), 1.3)}</g>`;
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
  const tiles: string[] = [];
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 5; col++) {
      const x0 = 11 + col * 3.05;
      const z1 = 27.6 - row * 2.9;
      tiles.push(
        `<g class="tile" style="--d:${r2(((row * 5 + col) * 7) % 11) / 100}s">${quad('q', [
          [x0, 5.05, z1 - 2.4],
          [x0 + 2.6, 5.05, z1 - 2.4],
          [x0 + 2.6, 5.05, z1],
          [x0, 5.05, z1],
        ])}</g>`,
      );
    }
  const [rx, ry] = pt(28.75, 7.75, 20.2);
  return [
    floorRect(4, 0.2, 34, 30, 0.15, 'pad'),
    floorText(6, 33, 0.2, '01', false),
    yRect(6, 31, 37.4, 39, 'bar old'),
    yRect(6, 13, 33, 34.6, 'bar new'),
    yText(6, 40.4, 'was 10 to 15 s', 'wn'),
    yText(14, 33.2, 'now 2 to 5 s', 'wn new-t'),
    yText(27.6, 21.2, 'redis · TTL', 'wn sm'),
    legs(6.5, 2.5, 31.5, 15.5, 0, 15),
    soft(6, 2, 15, 32, 16, 16.5, 1.2, 'n'),
    box(17.5, 3.8, 16.5, 19.5, 4.8, 18.5, 'n'),
    box(10, 3.4, 18.5, 27, 5, 31, 'k'),
    yText(11, 29.2, 'linx360', 'scr', 5.05),
    tiles.join(''),
    box(12, 8.5, 16.5, 22, 12, 17, 'l'),
    box(23.5, 9.5, 16.5, 25, 11.5, 17.2, 'l'),
    `<g class="redis">${box(27, 6, 16.5, 30.5, 9.5, 20, 'a')}</g>`,
    `<ellipse class="ttl" cx="${rx}" cy="${ry}" rx="15" ry="7.5"/>`,
    cyl(20, 23, 0, 2.4, 0.7, 'n'),
    cyl(20, 23, 0.7, 0.5, 3.6, 'n'),
    cyl(20, 23, 4.3, 3.6, 1.5, 'a'),
    mug(29, 13, 16.5),
  ].join('');
}

// 02 At the conveyor: the mascot works the lever. Act 1, questions ride into the critic arch; act 2, one fails, the
// lever sends it back; act 3, it comes round again and the counter reads 15 / 15.
function s2() {
  const card = (cls: string) =>
    `<g class="card ${cls}" style="${move('e', 26, 0, 0)};${move('h', 13, 0, 0)};${move('u', 13, 0, 10)};${move('v', 0, 0, 10)}">${box(39, 7.5, 7, 42.6, 10.5, 7.6, 'l')}</g>`;
  const [lx, ly] = pt(52, 9, 22.6);
  const [bx, by] = pt(59.7, 20, 9.8);
  return [
    floorRect(36, 0.2, 70, 30, 0.15, 'pad'),
    floorText(38, 33, 0.2, '02', false),
    yRect(54, 68, 26, 46, 'win'),
    blinds(54, 68, 26, 46, 0).slats,
    skyline(54, 68, 26),
    yRect(40, 52, 25, 33, 'disp'),
    yText(41, 30.6, 'critic', 'dt'),
    yText(41, 26.6, '14/15', 'dn n14'),
    yText(41, 26.6, '15/15 ✓', 'dn n15'),
    legs(38.5, 5.5, 67.5, 12.5, 0, 4),
    soft(38, 5, 4, 68, 13, 7, 2.6, 'n'),
    curtain(51, 54.5, 47, 24),
    curtain(67.5, 71, 47, 24),
    line('belt', [38.5, 9, 7.05], [67.5, 9, 7.05]),
    box(51, 3.5, 7, 53, 5, 20, 'w'),
    card('c1'),
    card('c2'),
    card('c3'),
    box(51, 13, 7, 53, 14.5, 20, 'w'),
    box(51, 3.5, 20, 53, 14.5, 22, 'w'),
    `<circle class="lamp" cx="${lx}" cy="${ly}" r="2.6"/>`,
    box(56, 17, 0, 63, 22, 9, 'n'),
    box(57, 17.6, 9, 62, 19, 9.8, 'k'),
    `<g class="lever" style="transform-origin:${bx}px ${by}px">${line('stick', [59.7, 20, 9.8], [59.7, 20, 15])}${dot('knob', 59.7, 20, 15, 2.6)}</g>`,
  ].join('');
}

// 03 At the whiteboard: the mascot steps on the stool and points. Act 1, the records pile up; act 2, the bars reorder
// into a ranking; act 3, the top of the ranking is marked, Precision@50.
function s3() {
  const raw = [5, 11, 3, 9, 13, 6, 8];
  const sorted = [...raw].sort((a, b) => b - a);
  const bars = (hs: number[], cls: string) =>
    `<g class="${cls}">${hs
      .map((h, i) => ({ h, i, x: 77 + i * 2.85 }))
      .reverse()
      .map(
        ({ h, i, x }) =>
          `<g style="--d:${r2(i * 0.08)}s">${box(x, 6, 9, x + 2, 8.6, 9 + h, cls === 'sorted' && i < 2 ? 'a' : 'l')}</g>`,
      )
      .join('')}</g>`;
  const stacks = [0, 1, 2]
    .map(
      (i) =>
        `<g class="stack" style="--d:${r2(i * 0.18)}s">${[0, 1, 2, 3].map((k) => box(99 - i * 0.2, 4 + i * 2.6, k * 1.4, 102.2 - i * 0.2, 6.2 + i * 2.6, k * 1.4 + 1.2, 'l')).join('')}</g>`,
    )
    .reverse()
    .join('');
  return [
    floorRect(72, 0.2, 103, 30, 0.15, 'pad'),
    floorText(74, 33, 0.2, '03', false),
    yRect(75, 101, 20, 50, 'board'),
    yText(77, 46, 'PRECISION@50', 'bt'),
    yText(77, 42.2, 'held-out · 30K', 'bt sm'),
    line('chalk', [77, 0.3, 24], [83, 0.3, 28], [89, 0.3, 26.5], [96, 0.3, 33]),
    yText(87.5, 36, 'top 50 ✓', 'bt hit sm'),
    stacks,
    soft(76, 3, 0, 98, 11, 9, 1.4, 'n'),
    bars(raw, 'raw'),
    bars(sorted, 'sorted'),
    box(84, 18, 0, 89, 23, 4, 'n'),
  ].join('');
}

// 04 Between the rack and the cloud: the mascot carries a container. Act 1, it is built on the Linux rack; act 2, the
// pipeline lights build, GHCR, deploy; act 3, it lands on the DigitalOcean shelf.
function s4() {
  const leds = Array.from({ length: 10 }, (_, i) => {
    const y = 25 + (i % 5) * 1.25;
    const z = 30 - Math.floor(i / 5) * 6;
    return `<g class="led" style="--d:${r2((i * 0.37) % 1.4)}s">${quad('ld', [
      [117.9, y, z],
      [117.9, y + 0.8, z],
      [117.9, y + 0.8, z + 0.8],
      [117.9, y, z + 0.8],
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
    box(118, 24, 0, 129, 31, 34, 'n'),
    leds,
    box(110, 24, 0, 115, 29, 4, 'n'),
    `<g class="pick">${box(110.6, 24.6, 4, 114.4, 28.4, 7.8, 'a')}</g>`,
    box(128.6, 39, 18, 129.8, 40, 22, 'n'),
    box(117, 36, 22, 129.6, 46, 23.5, 'w'),
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
  const lines = [6, 8.5, 4.5, 7.5, 5.5]
    .map((len, i) => {
      const z = 31 - i * 1.25;
      return `<g class="ln" style="--d:${r2(i * 0.25)}s">${quad('lnp', [
        [125.9, 54, z - 0.5],
        [125.9, 54 + len, z - 0.5],
        [125.9, 54 + len, z],
        [125.9, 54, z],
      ])}</g>`;
    })
    .join('');
  const tests = [0, 1, 2, 3]
    .map(
      (i) =>
        `<g class="ts" style="--d:${r2(i * 0.18)}s">${quad('tsp', [
          [125.9, 54 + i * 2.2, 24.6],
          [125.9, 55.5 + i * 2.2, 24.6],
          [125.9, 55.5 + i * 2.2, 25.9],
          [125.9, 54 + i * 2.2, 25.9],
        ])}</g>`,
    )
    .join('');
  const notes = ['plan', 'build', 'test']
    .map((s, i) => {
      const y0 = 50 + i * 6.2;
      return `${xRect(y0, y0 + 5.4, 36, 43, 'note')}${xText(y0 + 0.5, 37, s, 'nt')}${dot('tick', W - 0.3, y0 + 4.3, 41.6, 1.9, `--d:${r2(i * 0.3)}s`)}`;
    })
    .join('');
  const orb = (cls: string, label: string, y: number, z: number) => {
    const [x0, y0] = pt(106, y, z);
    return `<g class="orb ${cls}"><circle cx="${x0}" cy="${y0}" r="8.5"/></g><g data-label class="orb ${cls}"><text x="${x0}" y="${r1(y0 - 13)}" text-anchor="middle">${label}</text></g>`;
  };
  return [
    floorRect(100, 48, W - 0.2, 72, 0.15, 'pad'),
    floorText(101, 50, 0.2, '05', true),
    notes,
    xText(50.5, 46.5, 'pytest · TDD', 'wn sm'),
    legs(116.5, 50.5, 128.5, 65.5, 0, 22),
    soft(116, 50, 22, 129, 66, 23.4, 1.4, 'n'),
    box(119, 53, 23.4, 125.8, 64, 24, 'l'),
    box(125.8, 53, 24, 126.6, 64, 33, 'k'),
    lines,
    tests,
    box(118.5, 64.6, 23.4, 120.5, 66, 25.4, 'a'),
    xText(64, 27.4, 'MCP', 'wn sm', 117.2),
    orb('o1', 'claude code', 62, 30),
    orb('o2', 'codex', 72, 26),
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
      plant(108.5, 16.5, 0, 1.15),
    ].join(''),
    lounge: [
      (() => {
        const [bx, by] = pt(42, 66, 0);
        return `<g class="bean"><path class="bean-b" d="M${r1(bx - 17)} ${by}C${r1(bx - 18)} ${r1(by - 22)} ${r1(bx + 16)} ${r1(by - 26)} ${r1(bx + 17)} ${by}A17 8.5 0 0 1 ${r1(bx - 17)} ${by}Z"/><path class="bean-c" d="M${r1(bx - 9)} ${r1(by - 12)}q8 5 15 -2"/></g>`;
      })(),
      cyl(59, 60, 0, 5.5, 4.6, 'n'),
      mug(58, 59, 4.6),
      cyl(61.5, 61.5, 4.6, 1.6, 0.5, 'l'),
      soft(54, 72, 0, 60, 78, 1.8, 2.4, 'a'),
      soft(64, 66, 0, 70, 72, 1.8, 2.4, 'l'),
      // An arc lamp leaning over the lounge.
      cyl(34, 76, 0, 2.6, 0.6, 'n'),
      curve('arc', [34, 76, 0.6], [34, 76, 18], [37, 72, 27], [43, 66, 29]),
      (() => {
        const [sx, sy] = pt(43, 66, 28);
        return `<path class="shade" d="M${r1(sx - 7)} ${r1(sy + 3)}Q${sx} ${r1(sy - 9)} ${r1(sx + 7)} ${r1(sy + 3)}Z"/><circle class="glow" cx="${sx}" cy="${r1(sy + 5)}" r="30" fill="url(#dr-warm)"/>`;
      })(),
      soft(28, 80, 0, 33, 84, 1.2, 0.6, 'a'),
      soft(28.4, 80.3, 1.2, 32.6, 83.7, 2.2, 0.6, 'l'),
      soft(28.2, 80.6, 2.2, 32.2, 83.4, 3.1, 0.6, 'n'),
      cyl(61.5, 58.2, 4.6, 0.6, 1.8, 'l'),
      cyl(62.8, 60.6, 4.6, 0.6, 1.2, 'l'),
      (() => {
        const [fx, fy] = pt(61.5, 58.2, 6.4);
        return `<path class="fl3 candle" d="M${fx} ${r1(fy - 6)}q2 3 0 5q-2 -2 0 -5z"/><circle class="glow" cx="${fx}" cy="${r1(fy - 3)}" r="16" fill="url(#dr-warm)"/>`;
      })(),
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
      const [cx, cy] = pt(9, 64, 7.8);
      const [lx, ly] = pt(23, 47, 15.5);
      return [
        `<ellipse class="under" cx="${pt(13, 65, 0)[0]}" cy="${pt(13, 65, 0)[1]}" rx="92" ry="46" fill="url(#dr-um)"/>`,
        soft(20, 44, 0, 26, 50, 9, 1.2, 'n'),
        mug(25, 49, 9),
        line('pole', [23, 47, 9.6], [23, 47, 13.5]),
        puck(lx, ly + 3, 4.5, 4, 'l'),
        `<circle class="glow" cx="${lx}" cy="${r1(ly - 1)}" r="26" fill="url(#dr-warm)"/>`,
        soft(24, 53, 0, 26.4, 77, 15, 1, 'n'),
        soft(2, 54, 0, 24, 76, 4, 1.6, 'n'),
        neon('m', [2.2, 76.3, 0.8], [24, 76.3, 0.8]),
        soft(2.4, 54.4, 4, 24, 75.6, 7, 2.2, 'l'),
        soft(18.4, 56, 7, 23.2, 64.4, 9.2, 2.2, 'l'),
        soft(18.4, 65.6, 7, 23.2, 74, 9.2, 2.2, 'l'),
        soft(1.8, 53.8, 6.2, 16, 76.2, 7.9, 2, 'a'),
        curve('fold', [4, 56, 7.95], [8, 62, 8.1], [6, 70, 7.95], [9, 75, 7.95]),
        curve('fold', [11, 55, 7.95], [13, 63, 8.1], [12, 72, 7.95]),
        `<g class="cat" style="transform-origin:${cx}px ${cy}px"><ellipse cx="${cx}" cy="${r1(cy - 3.5)}" rx="9.5" ry="5"/><circle cx="${r1(cx - 8.5)}" cy="${r1(cy - 6.5)}" r="4.2"/><path d="M${r1(cx - 12.2)} ${r1(cy - 8.4)}l1.2 -4.6 2.6 3.2zM${r1(cx - 8.2)} ${r1(cy - 9.6)}l1.6 -4.4 2.2 3.4z"/><path class="tail" d="M${r1(cx + 8.5)} ${r1(cy - 2.5)}q7 1 3.5 6.5"/></g>`,
        plant(4.5, 82.5, 0, 1.2),
      ].join('');
    })(),
    front: [
      box(102, 87, 0, 110, 95, 17, 'n'),
      xRect(88, 94, 5, 15, 'vend', 101.95),
      xRect(88.5, 93.5, 2, 3.6, 'vend-slot', 101.95),
      portal(0, true),
      floorText(104, 97.5, 0.15, 'PORTAL · LEVEL 2', false, 'ft sm'),
    ].join(''),
    light: [
      blinds(54, 68, 26, 46, 0).shafts,
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
    puck(cx, cy, 46, 4, 'n'),
    `<ellipse class="pglow" cx="${cx}" cy="${top}" rx="38" ry="19"/>`,
    `<ellipse class="prune" cx="${cx}" cy="${top}" rx="30" ry="15"/>`,
    `<ellipse class="pcore" cx="${cx}" cy="${top}" rx="15" ry="7.5"/>`,
    beam ? motes : '',
  ].join('');
}

/* ---------------------------------------------------------------- upper floor ----------------------------------- */

// 06 By the fireplace: the badge hangs over the mantel. Act 1, the fire flares as the mascot arrives; act 2, the badge
// rises over its head; act 3, confetti, and the frame over the mantel lights.
function c1(stand: [number, number]) {
  const z = UP;
  const [gx, gy] = pt(40, 14, z);
  const [fx, fy] = pt(40, 5.1, z + 2.8);
  const confetti = Array.from({ length: 12 }, (_, i) => {
    const [x, y] = pt(28 + i * 2.2, 10 + (i % 3) * 4, z + 30 + (i % 4) * 3);
    return `<rect class="conf" style="--d:${r2((i % 6) * 0.12)}s" x="${x}" y="${y}" width="3" height="4.5" rx="0.8"/>`;
  }).join('');
  return [
    floorRect(26, 6, 54, 32, z + 0.15, 'pad'),
    `<ellipse class="spot warm" cx="${gx}" cy="${gy}" rx="72" ry="36" fill="url(#dr-warm)"/>`,
    `<ellipse class="rugr" cx="${pt(40, 18, z + 0.1)[0]}" cy="${pt(40, 18, z + 0.1)[1]}" rx="52" ry="26"/>`,
    floorText(31, 35, z + 0.2, '06', false),
    box(29, 0.2, z, 51, 8, z + 2, 'n'),
    box(31, 0.2, z + 2, 49, 5, z + 16, 'n'),
    yRect(35, 45, z + 2.6, z + 11, 'firebox', 5.05),
    `<g class="fire">${flame(fx - 5, fy, 9, 'fl1')}${flame(fx + 4, fy, 11, 'fl2')}${flame(fx, fy, 14, 'fl3')}</g>`,
    box(29.5, 0.2, z + 16, 50.5, 6.6, z + 17.2, 'n'),
    puck(...pt(31.5, 4, z + 17.2), 1.6, 4, 'l'),
    puck(...pt(48, 4, z + 17.2), 1.6, 3, 'l'),
    box(33, 0.2, z + 17.2, 47, 4, z + H2, 'n'),
    yRect(34.4, 45.6, z + 20, z + 33, 'frame cframe', 4.05),
    yImage('/certs/aws-ai-practitioner.webp', 35.3, z + 32.2, 10.2, 4.1),
    yText(34.4, z + 38, 'AWS', 'wt sm', 4.15),
    yText(34.4, z + 35.4, 'CERTIFIED', 'wt sm', 4.15),
    `<image class="holo" href="/certs/aws-ai-practitioner.webp" x="${r1(stand[0] - 24)}" y="${r1(stand[1] - 158)}" width="48" height="48"/>`,
    confetti,
  ].join('');
}

// 07 At the trophy case: the mascot lifts the trophy. Act 1, the case lights; act 2, the trophy goes up; act 3, the
// certificate on the wall shines.
function c2(stand: [number, number]) {
  const z = UP;
  const [tx, ty] = pt(112, 36, z + 7);
  const lift = `--lx:${r1(stand[0] - tx)}px;--ly:${r1(stand[1] - 112 - ty)}px`;
  const minis = [20, 25, 30]
    .map((y, i) => puck(...pt(125, y, z + 10 + i * 0), 1.6, 3.4, i === 1 ? 'a' : 'l'))
    .join('');
  const sparks = Array.from({ length: 6 }, (_, i) =>
    dot('spark', W - 0.6, 40 + i * 2.6, z + 18 + (i % 2) * 8, 1.4, `--d:${r2(i * 0.25)}s`),
  ).join('');
  return [
    floorRect(98, 14, W - 0.2, 46, z + 0.15, 'pad'),
    floorText(99, 16, z + 0.2, '07', true),
    xRect(38.5, 56.5, z + 12, z + 31, 'frame cframe'),
    xImage('/certs/udacity.webp', 39.5, z + 30, 16),
    xText(38.5, z + 34, 'NANODEGREE', 'wt'),
    box(120, 16, z, 129.6, 34, z + 30, 'w'),
    box(120.4, 16.4, z + 9.4, 129.6, 33.6, z + 10, 'n'),
    box(120.4, 16.4, z + 20, 129.6, 33.6, z + 20.6, 'n'),
    minis,
    box(110, 34, z, 114, 38, z + 7, 'n'),
    `<g class="trophy" style="${lift}">${puck(tx, ty, 3.6, 2.4, 'a')}${puck(tx, ty - 2.4, 1.2, 4, 'a')}${puck(tx, ty - 6.4, 5, 6, 'a')}</g>`,
    sparks,
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
      yRect(5, 26, z + 14, z + 34, 'win'),
      blinds(5, 26, z + 14, z + 34, z).slats,
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
      line('tl', [W - 0.3, 58, z + 30], [W - 0.3, 92, z + 30]),
    ].join(''),
    study: [
      // An open shelf, drawn far to near: back, far side, a row of books on each plank, near side.
      box(58, 1, z, 96, 2.2, z + 21.5, 'n'),
      box(95, 1, z, 96.2, 8, z + 21.5, 'n'),
      ...[0, 10.5].map(
        (lift) =>
          box(58, 1, z + lift, 96.2, 8, z + lift + 0.6, 'n') +
          Array.from({ length: 22 }, (_, i) => 21 - i)
            .filter((i) => (i + (lift ? 1 : 0)) % 5 !== 0)
            .map((i) => {
              const x = 59.2 + i * 1.65;
              const tall = 6 + ((i * 5) % 4);
              return box(
                x,
                2.4,
                z + lift + 0.6,
                x + 1.3,
                7,
                z + lift + 0.6 + tall,
                (i + lift) % 6 === 1 ? 'a' : 'l',
              );
            })
            .join(''),
      ),
      box(58, 1, z + 21, 96.2, 8, z + 21.6, 'n'),
      box(57.4, 1, z, 58.6, 8, z + 21.5, 'n'),
      yText(60, z + 23.6, 'study shelf', 'wn sm'),
      line('pole', [16, 15, z + 11], [12, 11, z]),
      line('pole', [16, 15, z + 11], [20, 12, z]),
      line('pole', [16, 15, z + 11], [16, 20, z]),
      line('scope', [12, 18, z + 10.5], [19.5, 10, z + 15.5]),
      dot('lens', 19.5, 10, z + 15.5, 2.6),
      box(88, 18, z, 91, 21, z + 0.8, 'n'),
      line('pole', [89.5, 19.5, z + 0.8], [89.5, 19.5, z + 22]),
      puck(...pt(89.5, 19.5, z + 22), 6, 5, 'l'),
      // The footstool sits behind the armchair, so it is drawn first.
      soft(87, 23, z, 92, 27, z + 1.2, 0.6, 'a'),
      soft(87.4, 23.3, z + 1.2, 91.6, 26.7, z + 2.3, 0.6, 'l'),
      soft(73.5, 13.5, z, 84.5, 24.5, z + 4.5, 2, 'a'),
      soft(73.5, 13.5, z + 4.5, 84.5, 16.5, z + 13, 1.4, 'a'),
      soft(81.5, 16, z + 4.5, 84.5, 24.5, z + 8, 1.4, 'a'),
      soft(76.5, 16.5, z + 4.5, 81.5, 23.5, z + 6, 1.6, 'l'),
      soft(73.5, 16, z + 4.5, 76.5, 24.5, z + 8, 1.4, 'a'),
      // A throw draped over the near arm, on the side that faces the room.
      blob('throw', [
        [73.4, 17, z + 8.2],
        [73.3, 21.5, z + 8.4],
        [73.1, 24.4, z + 6],
        [72.9, 24.6, z + 1.8],
        [73.1, 20.5, z + 2.6],
        [73.3, 16.6, z + 4.2],
      ]),
      plant(7, 7, z, 1.2),
      curtain(2.5, 6, z + 36, z + 12),
      curtain(25, 28.5, z + 36, z + 12),
    ].join(''),
    light: [
      blinds(5, 26, z + 14, z + 34, z).shafts,
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
      plant(100, 56, z, 1.3),
      // A sofa corner at the front, on its own rug, with a lamp on a side table.
      oval('rugw', 21, 82, 17, 10, z + 0.1),
      cyl(38, 70, z, 2.6, 6, 'n'),
      cyl(38, 70, z + 6, 0.5, 5, 'n'),
      (() => {
        const [sx, sy] = pt(38, 70, z + 11);
        return `<path class="shade" d="M${r1(sx - 6)} ${r1(sy + 2)}L${r1(sx - 3.5)} ${r1(sy - 7)}H${r1(sx + 3.5)}L${r1(sx + 6)} ${r1(sy + 2)}Z"/><circle class="glow" cx="${sx}" cy="${r1(sy + 2)}" r="34" fill="url(#dr-warm)"/>`;
      })(),
      // The sofa, far to near: base, back, the far arm, the seat cushions, two pillows against the back, the near arm.
      soft(8, 64, z, 34, 80, z + 4.5, 2, 'a'),
      soft(8, 64, z + 4.5, 34, 67.5, z + 12, 1.6, 'a'),
      soft(30.5, 66, z + 4.5, 34, 80, z + 8, 1.4, 'a'),
      soft(11.5, 67.5, z + 4.5, 21, 79, z + 6.2, 1.8, 'l'),
      soft(21, 67.5, z + 4.5, 30.5, 79, z + 6.2, 1.8, 'l'),
      soft(24.5, 67.8, z + 6.2, 29, 70.6, z + 10.2, 1.2, 'l'),
      soft(12.5, 67.8, z + 6.2, 17, 70.6, z + 10.2, 1.2, 'n'),
      soft(8, 66, z + 4.5, 11.5, 80, z + 8, 1.4, 'a'),
      // A record player and a stack of vinyl.
      box(56, 84, z, 74, 92, z + 8, 'n'),
      cyl(62, 88, z + 8, 3.4, 0.5, 'k'),
      cyl(62, 88, z + 8.5, 0.9, 0.1, 'a'),
      line('arm', [68, 85.5, z + 9.2], [64.5, 88.2, z + 9]),
      cyl(70.5, 88.5, z + 8, 2.4, 1.6, 'a'),
      // A guitar on its stand.
      (() => {
        const [gx, gy] = pt(46, 90, z);
        return `<g class="guitar"><path class="gstand" d="M${r1(gx - 5)} ${gy}L${gx} ${r1(gy - 10)}L${r1(gx + 5)} ${gy}"/><ellipse class="gbody" cx="${gx}" cy="${r1(gy - 12)}" rx="7.5" ry="8.5"/><ellipse class="gbody" cx="${r1(gx + 0.6)}" cy="${r1(gy - 24)}" rx="5.5" ry="6"/><circle class="ghole" cx="${r1(gx + 0.4)}" cy="${r1(gy - 19)}" r="2.2"/><path class="gneck" d="M${r1(gx + 1)} ${r1(gy - 29)}L${r1(gx + 4)} ${r1(gy - 52)}"/><rect class="ghead" x="${r1(gx + 2.4)}" y="${r1(gy - 58)}" width="4" height="7" rx="1.2"/></g>`;
      })(),
      plant(90, 90, z, 1.8),
      // Pictures on the wall.
      ...[
        [100, 108, 16, 25],
        [111, 123, 13, 27],
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

/** The rail: the building in section, every stop on the way up, and where the mascot is now. Stops run from the street
 * door at the bottom, through the ground floor and the portal, to Level 2; the sky is above the roof. */
const RAIL = { w: 108, h: 664, x: 22, y: [628, 562, 514, 466, 418, 370, 200, 126] };
export function renderRail(names: string[]) {
  const { w, h, x, y } = RAIL;
  let seed = 3;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const stars = Array.from(
    { length: 11 },
    (_, i) =>
      `<circle class="r-star" style="--d:${r2(i * 0.5)}s" cx="${r1(4 + rnd() * 100)}" cy="${r1(4 + rnd() * 60)}" r="${i % 4 ? 0.9 : 1.4}"/>`,
  ).join('');
  const city = [
    [0, 58, 15, 42],
    [17, 48, 11, 52],
    [80, 42, 13, 58],
    [95, 64, 13, 36],
  ]
    .map(([a, b, c, d]) => `<rect class="r-city" x="${a}" y="${b}" width="${c}" height="${d}"/>`)
    .join('');
  const wins = Array.from({ length: 20 }, (_, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const yy = 136 + row * 44 + (row > 2 ? 34 : 0);
    return `<rect class="r-win${(i * 5) % 3 === 0 ? ' lit' : ''}" x="${84 + col * 8}" y="${yy}" width="4" height="6"/>`;
  }).join('');
  const nodes = y
    .map(
      (yy, k) =>
        `<g class="r-node" data-node="${k}"><circle cx="${x}" cy="${yy}" r="4.6"/><text x="${x + 11}" y="${yy + 3}">${k === 0 ? 'start' : `${String(k).padStart(2, '0')} ${names[k - 1]}`}</text></g>`,
    )
    .join('');
  return `<svg class="dr-rail-svg" data-rail viewBox="0 0 ${w} ${h}" data-y="${JSON.stringify(y)}" data-x="${x}" aria-hidden="true"><defs><linearGradient id="dr-rbeam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.55"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:.12"/></linearGradient></defs>${stars}<circle class="r-moon" cx="92" cy="18" r="6"/><g class="r-plane"><path d="M-6 0L5 -0.7L7 0L5 0.7ZM-1 0L-4 -4H-2.4L2 0L-2.4 4H-4Z"/></g>${city}<rect class="r-roof" x="2" y="92" width="${w - 4}" height="6" rx="1"/><rect class="r-bld" x="6" y="98" width="${w - 12}" height="${h - 130}"/><text class="r-floor" x="${w - 10}" y="114" text-anchor="end">LEVEL 2</text><rect class="r-slab" x="6" y="268" width="${w - 12}" height="7"/><text class="r-floor" x="${w - 10}" y="292" text-anchor="end">GROUND</text>${wins}<rect class="r-beam" x="${x - 6}" y="${y[6]}" width="12" height="${y[5]! - y[6]!}" fill="url(#dr-rbeam)"/><ellipse class="r-pad" cx="${x}" cy="${y[5]! - 9}" rx="10" ry="3"/><ellipse class="r-pad" cx="${x}" cy="${y[6]! + 9}" rx="10" ry="3"/><rect class="r-street" x="0" y="${h - 28}" width="${w}" height="20"/><path class="r-lane" d="M2 ${h - 18}H${w - 2}"/><path class="r-track" d="M${x} ${y[0]}V${y[7]}"/><line class="r-fill" data-rail-fill x1="${x}" x2="${x}" y1="${y[0]}" y2="${y[0]}"/>${nodes}<g class="r-icon" data-rail-icon transform="translate(${x} ${y[0]})"><circle class="r-halo" r="13"/><svg x="-13" y="-27" width="26" height="27" viewBox="768 0 96 100"><image href="/resume-hero.png" width="2112" height="100"/></svg></g></svg>`;
}

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
    at: [20, 23, 5.6],
    pose: 'sit',
    face: -1,
    // From the door, up the clear lane between the beanbag and the coffee table, then across to the desk: never over
    // the bed (the mascot is drawn in front of everything, so its path must not pass behind furniture).
    via: [
      [50, 86, 0],
      [50, 44, 0],
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
  { at: [86.5, 20.5, 4], pose: 'point', face: -1, via: [[86.5, 28, 0]] },
  {
    at: [106, 31, 0],
    pose: 'carry',
    face: 1,
    via: [
      [86.5, 28, 0],
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
  const parts = [s1(), s2(), s3(), s4(), s5(), c1(stand(5)), c2(stand(6))];
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
  return `<svg class="dr-svg" viewBox="0 0 ${VIEW.w} ${VIEW.h}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="My dev room: two floors, one station for each point of my résumé" data-route="${JSON.stringify(screen)}" data-z="${JSON.stringify(route.map((p) => p[2]))}" data-stops="${JSON.stringify(stops)}" data-pan="${PAN}" data-up="${UP}"><defs><linearGradient id="dr-beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffc867" stop-opacity=".45"/><stop offset="1" stop-color="#ffc867" stop-opacity="0"/></linearGradient><radialGradient id="dr-warm"><stop offset="0" style="stop-color:var(--partial);stop-opacity:.34"/><stop offset="1" style="stop-color:var(--partial);stop-opacity:0"/></radialGradient><linearGradient id="dr-rm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a3d" stop-opacity=".3"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></linearGradient><linearGradient id="dr-rc" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#ffc867" stop-opacity=".26"/><stop offset="1" stop-color="#ffc867" stop-opacity="0"/></linearGradient><linearGradient id="dr-shaft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb057" stop-opacity=".3"/><stop offset="1" stop-color="#ffb057" stop-opacity="0"/></linearGradient><radialGradient id="dr-um"><stop offset="0" stop-color="#ff8a3d" stop-opacity=".42"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient><pattern id="dr-dither" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="#fff" fill-opacity=".07"/><rect x="2" y="2" width="1" height="1" fill="#fff" fill-opacity=".07"/></pattern><radialGradient id="dr-haze"><stop offset="0" stop-color="#ff9a55" stop-opacity=".09"/><stop offset="1" stop-color="#ff9a55" stop-opacity="0"/></radialGradient></defs><g data-cam><g data-art><g class="outside" data-outside>${outside()}</g>${st.back}<g class="mass">${prism(-3, -3, -6, W + 3, D, H, 'n')}</g><g class="floor-g">${gs.art}${group(2)}${group(1)}${group(0)}${gl.art}${group(3)}${group(4)}${gf.art}</g><g class="floor-u">${us.art}${group(5)}${group(6)}${uf.art}</g>${st.front}</g><g class="labels"><g class="lbl-g">${gs.text}${gl.text}${gf.text}${[0, 1, 2, 3, 4].map(words).join('')}</g><g class="lbl-u">${us.text}${uf.text}${words(5)}${words(6)}</g></g><g class="mascot" data-mascot transform="translate(${mx} ${my})" style="${shuttle}">${MASCOT}</g></g></svg>`;
}
