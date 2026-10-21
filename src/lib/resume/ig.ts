// The props gallery's drawing, in the dev room. Each prop is drawn in its own small units with a handful of helpers
// (planes for detail on the faces, rounded boxes with one continuous wall, paths in 3D). This is that kernel, ported
// to the room's camera, followed by each prop. A prop's `x` runs along the room's +y and its `y` along the room's -x,
// so the faces the viewer sees are its x-max and y-max faces, as in the gallery; a mirrored prop runs its x along
// the room's -x instead, so its y-max face is the one that faces the viewer (for props against the back wall).
// Everything live is a class (`lit`, `fire`, `str`...): the stylesheet and the room's script give each prop its click.
type P3 = [number, number, number];
export type Project = (x: number, y: number, z?: number) => [number, number];
export type Delta = (x: number, y: number, z: number) => [number, number];

// The footprint (in room units) of the boxes drawn since the last prop was finished: the script uses it to draw the
// prop in front of the mascot or behind it, depending on where the mascot walks.
let footprint: [number, number, number, number] | null = null;
const track = (a: P3, b: P3) => {
  const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
  const [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
  footprint = footprint
    ? [
        Math.min(footprint[0], x0),
        Math.min(footprint[1], y0),
        Math.max(footprint[2], x1),
        Math.max(footprint[3], y1),
      ]
    : [x0, y0, x1, y1];
};
// Props the mascot never walks by (or that are part of the street): they do not change layers.
const FIXED = new Set(['tree', 'lamp', 'car', 'window', 'portal', 'belt']);

export function igKernel(
  pt: Project,
  vec: Delta,
  ox: number,
  oy: number,
  oz: number,
  k: number,
  mirror = false,
) {
  const W = (x: number, y: number, z: number): P3 =>
    mirror ? [ox - x * k, oy + y * k, oz + z * k] : [ox - y * k, oy + x * k, oz + z * k];
  const P = (x: number, y: number, z: number): [number, number] => {
    const [a, b] = pt(...W(x, y, z));
    return [+a.toFixed(1), +b.toFixed(1)];
  };
  const D = (x: number, y: number, z: number) =>
    mirror ? vec(-x * k, y * k, z * k) : vec(-y * k, x * k, z * k);
  const n4 = (v: number) => +v.toFixed(3);
  const plane = (o: P3, u: P3, v: P3) => {
    const a = P(...o);
    const b = D(...u);
    const c = D(...v);
    return `matrix(${n4(b[0])} ${n4(b[1])} ${n4(c[0])} ${n4(c[1])} ${a[0]} ${a[1]})`;
  };
  const TOP = (x: number, y: number, z: number) => plane([x, y, z], [1, 0, 0], [0, 1, 0]);
  const FRONT = (x: number, y: number, z: number) => plane([x, y, z], [1, 0, 0], [0, 0, -1]);
  const SIDE = (x: number, y: number, z: number) => plane([x, y, z], [0, -1, 0], [0, 0, -1]);
  const rect = (t: string, w: number, h: number, r = 0, cls = 'face') =>
    `<g transform="${t}"><rect class="${cls}" width="${w}" height="${h}" rx="${r}"/></g>`;
  const rounded = (x: number, y: number, z: number, w: number, d: number, h: number, rr: number) => {
    const r = Math.min(rr, w / 2, d / 2);
    const n = 4;
    const z1 = z + h;
    const q = Math.PI / 4;
    const H = Math.PI / 2;
    const arc = (cx: number, cy: number, a0: number, a1: number) => {
      const o: [number, number][] = [];
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n;
        o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      return o;
    };
    const ring = [
      ...arc(x + w - r, y + r, -H, 0),
      ...arc(x + w - r, y + d - r, 0, H),
      ...arc(x + r, y + d - r, H, 2 * H),
      ...arc(x + r, y + r, 2 * H, 3 * H),
    ];
    const vis = [
      ...arc(x + w - r, y + r, -q, 0),
      ...arc(x + w - r, y + d - r, 0, H),
      ...arc(x + r, y + d - r, H, 3 * q),
    ];
    const d3 = (pts: P3[]) => 'M' + pts.map((pp) => P(...pp).join(' ')).join('L') + 'Z';
    const wall: P3[] = [
      ...vis.map(([a, b]): P3 => [a, b, z]),
      ...vis
        .slice()
        .reverse()
        .map(([a, b]): P3 => [a, b, z1]),
    ];
    return `<path class="face" d="${d3(wall)}"/><path class="face top" d="${d3(ring.map(([a, b]): P3 => [a, b, z1]))}"/>`;
  };
  const box = (x: number, y: number, z: number, w: number, d: number, h: number, r = 0) => {
    track(W(x, y, z), W(x + w, y + d, z));
    return r > 0
      ? rounded(x, y, z, w, d, h, r)
      : rect(SIDE(x + w, y + d, z + h), d, h) +
          rect(FRONT(x, y + d, z + h), w, h) +
          rect(TOP(x, y, z + h), w, d, 0, 'face top');
  };
  const path = (pts: P3[]) => 'M' + pts.map((p) => P(...p).join(' ')).join('L');
  const lines = (a0: number, a1: number, step: number, b0: number, b1: number) => {
    let out = '';
    for (let a = a0; a <= a1 + 1e-6; a += step)
      out += `<line class="detail" x1="${a}" y1="${b0}" x2="${a}" y2="${b1}"/>`;
    return out;
  };
  return { P, TOP, FRONT, SIDE, box, path, lines };
}

/** A material: the boxes inside take its colours (the stylesheet has one rule per material). */
export const mat = (name: string, svg: string) => `<g class="mat mat-${name}">${svg}</g>`;
const pairs = (list: number[][]) => list as [number, number][];
const prop = (id: string, svg: string, bounds?: [number, number, number, number]) => {
  const b = bounds ?? footprint;
  footprint = null;
  const occ = b && !FIXED.has(id) ? ` data-occ="${b.map((v) => +v.toFixed(1)).join(',')}"` : '';
  return `<g class="ig" data-ig="${id}"${occ}>${svg}</g>`;
};

/** The fireplace: a slate hearth with a rug, a stone body with an opening and a layered fire, an oak mantel with
 * candles, and a stone chimney with brick joints. Click it: the fire goes out, and the candles with it. */
export function fireplaceIg(pt: Project, vec: Delta, z: number, ceiling: number) {
  const K = 0.15;
  const { TOP, FRONT, SIDE, box } = igKernel(pt, vec, 58.75, -4.9, z - 6 * K, K);
  const [BX, BY, BD, BW, BZ, BH] = [34, 40, 40, 160, 16, 84];
  const BT = BZ + BH;
  const HC = Math.round((ceiling - 4 - BT * K) / K);
  let s = mat('slate', box(40, 30, 6, 96, 190, 10, 4));
  s += `<g transform="${TOP(40, 30, 16)}"><rect class="rug" x="34" y="36" width="52" height="128" rx="6"/><rect class="rugline" x="39" y="41" width="42" height="118" rx="4"/></g>`;
  s += mat('stone', box(BX, BY, BZ, BD, BW, BH, 3));
  s += `<g transform="${SIDE(BX + BD, BY + BW, BT)}"><rect class="face recess" x="28" y="26" width="104" height="${BH - 26}" rx="6"/><rect class="fireglow" x="38" y="38" width="84" height="${BH - 38}" rx="8"/>
    <rect class="face" x="38" y="${BH - 7}" width="84" height="7" rx="2"/>
    <g class="fire"><path class="fl1" d="M50 ${BH - 7} C42 ${BH - 30} 56 ${BH - 40} 52 ${BH - 58} C66 ${BH - 44} 74 ${BH - 30} 68 ${BH - 7} Z"/>
    <path class="fl2" d="M68 ${BH - 7} C60 ${BH - 40} 80 ${BH - 50} 78 ${BH - 68} C94 ${BH - 50} 100 ${BH - 34} 92 ${BH - 7} Z"/>
    <path class="fl1" d="M92 ${BH - 7} C86 ${BH - 28} 98 ${BH - 36} 96 ${BH - 48} C108 ${BH - 36} 112 ${BH - 24} 108 ${BH - 7} Z"/>
    <path class="fl3" d="M70 ${BH - 7} C68 ${BH - 26} 78 ${BH - 32} 78 ${BH - 42} C86 ${BH - 30} 90 ${BH - 20} 88 ${BH - 7} Z"/>
    <path class="fl4" d="M73 ${BH - 7} C72 ${BH - 18} 78 ${BH - 22} 78 ${BH - 29} C83 ${BH - 21} 85 ${BH - 14} 84 ${BH - 7} Z"/></g></g>`;
  let vents = '';
  for (let a = 6; a <= BD - 6; a += 4)
    vents += `<line class="detail" x1="${a}" y1="8" x2="${a}" y2="${BH - 8}"/>`;
  s += `<g transform="${FRONT(BX, BY + BW, BT)}">${vents}</g>`;
  s += mat('stone', box(38, 80, BT, 24, 80, HC, 2));
  let bricks = '';
  for (let v = 8; v < HC - 6; v += 16) {
    bricks += `<line class="detail" x1="0" y1="${v}" x2="80" y2="${v}"/>`;
    for (let u = 10 + ((v / 16) % 2) * 10; u < 80; u += 20)
      bricks += `<line class="detail" x1="${u}" y1="${v}" x2="${u}" y2="${v + 16}"/>`;
  }
  s += `<g transform="${SIDE(62, 160, BT + HC)}">${bricks}</g>`;
  s += mat('wood', box(28, 30, BT, 48, 180, 6, 3));
  s +=
    mat('cream', box(44, 52, BT + 6, 9, 9, 18, 2)) +
    `<g transform="${TOP(44, 52, BT + 24)}"><circle class="cdl" cx="4.5" cy="4.5" r="2.2"/></g>`;
  s +=
    mat('cream', box(44, 168, BT + 6, 9, 9, 12, 2)) +
    `<g transform="${TOP(44, 168, BT + 18)}"><circle class="cdl" cx="4.5" cy="4.5" r="2"/></g>`;
  s += mat('terra', box(46, 120, BT + 6, 14, 16, 20, 4));
  return prop('fire', s);
}

/** The record player: a walnut plinth, a record with grooves and glints, a tonearm, level bars, and a speaker.
 * Click it: the record spins, the arm lowers, the bars dance and the speaker pulses. */
export function recordPlayerIg(pt: Project, vec: Delta, z: number) {
  const K = 0.12;
  const { TOP, FRONT, box } = igKernel(pt, vec, 76, 66, z - 6 * K, K);
  const [PX, PY, PW, PD, PZ, PH] = [30, 40, 150, 120, 6, 18];
  const PT = PZ + PH;
  const [CX, CY] = [62, 60];
  const PIV: [number, number] = [136, 16];
  const L = 84;
  let s = mat('walnut', box(PX, PY, PZ, PW, PD, PH, 8));
  s += `<g transform="${FRONT(PX, PY + PD, PT)}"><rect class="face recess" x="10" y="3" width="62" height="12" rx="4"/>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect class="vu" style="--i:${i}" x="${14 + i * 7}" y="9.5" width="4" height="9" rx="1"/>`).join('')}<circle class="lit" cx="${PW - 14}" cy="9.5" r="1.8"/></g>`;
  s += `<g transform="${TOP(PX, PY, PT)}"><circle class="face recess" cx="${CX}" cy="${CY}" r="50"/>
    <g class="rec-spin"><circle class="face vinyl" cx="${CX}" cy="${CY}" r="45"/>${[39, 33, 27, 21].map((r) => `<circle class="detail" cx="${CX}" cy="${CY}" r="${r}"/>`).join('')}
      <path class="detail glint" d="M${CX - 36} ${CY - 12} A38 38 0 0 1 ${CX - 12} ${CY - 36}"/><path class="detail glint" d="M${CX + 36} ${CY + 12} A38 38 0 0 1 ${CX + 12} ${CY + 36}"/>
      <circle class="face lit" cx="${CX}" cy="${CY}" r="13"/><line class="detail" x1="${CX}" y1="${CY - 13}" x2="${CX}" y2="${CY - 5}"/></g>
    <circle class="face recess" cx="${CX}" cy="${CY}" r="2.4"/></g>`;
  s += `<g transform="${TOP(PX, PY, PT + 2)}"><circle class="face recess" cx="${PIV[0]}" cy="${PIV[1]}" r="8"/><g class="rec-arm"><line class="detail arm" x1="${PIV[0]}" y1="${PIV[1]}" x2="${PIV[0] - L}" y2="${PIV[1]}"/><rect class="face" x="${PIV[0] - L - 8}" y="${PIV[1] - 3.4}" width="12" height="6.8" rx="2"/><circle class="face recess" cx="${PIV[0] + 6}" cy="${PIV[1]}" r="5"/></g></g>`;
  s += mat('indigo', box(200, 50, PZ, 46, 46, 70, 4));
  s += `<g transform="${FRONT(200, 96, PZ + 70)}"><rect class="face recess" x="5" y="5" width="36" height="60" rx="3"/><circle class="face recess" cx="23" cy="20" r="7"/><circle class="face lit" cx="23" cy="20" r="4.4"/><g class="rec-cone"><circle class="face recess" cx="23" cy="44" r="16"/><circle class="face lit" cx="23" cy="44" r="11"/><circle class="detail" cx="23" cy="44" r="6"/></g></g>`;
  return prop('record', s);
}

/** The study shelf: an oak case with four rows of books drawn flat on its front. Click a row: its books light, one
 * after another, and the others go dark. */
export function shelfIg(pt: Project, vec: Delta, z: number) {
  const K = 0.14;
  const { TOP, FRONT, SIDE, box, lines } = igKernel(pt, vec, 101.4, -3.2, z - 6 * K, K, true);
  const [SX, SY, SW, SD, SH, SZ] = [40, 30, 270, 50, 150, 6];
  let s = mat('wood', box(SX, SY, SZ, SW, SD, SH, 4));
  s += `<g transform="${TOP(SX, SY, SZ + SH)}"><rect class="detail" x="8" y="6" width="${SW - 16}" height="${SD - 12}" rx="3"/></g>`;
  s += `<g transform="${SIDE(SX + SW, SY + SD, SZ + SH)}">${lines(8, SD - 8, 4, 10, SH - 10)}</g>`;
  const rnd = (i: number) => {
    const x = Math.sin(i * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  let rows = '';
  for (let r = 0; r < 4; r++) {
    const v0 = 8 + r * 35;
    let books = '';
    let x = 11;
    let n = 0;
    while (x < SW - 16) {
      const w = 5 + Math.floor(rnd(r * 31 + n) * 5);
      const h = 17 + Math.floor(rnd(r * 17 + n * 3) * 11);
      const lean = rnd(r * 7 + n) > 0.86;
      books += `<rect class="face book bk${Math.floor(rnd(r * 13 + n * 5) * 5)}" style="--i:${n}" x="${x}" y="${v0 + 28 - h}" width="${w}" height="${h}" rx="1"${lean ? ` transform="rotate(-11 ${x} ${v0 + 28})"` : ''}/><line class="detail" x1="${x + 1.6}" y1="${v0 + 28 - h + 4}" x2="${x + w - 1.6}" y2="${v0 + 28 - h + 4}"/>`;
      x += w + (lean ? 8 : 1.6);
      n++;
    }
    rows += `<g class="row row${r}" data-row="${r}"><rect class="face recess" x="6" y="${v0}" width="${SW - 12}" height="30" rx="2"/>${books}</g>`;
  }
  s += `<g transform="${FRONT(SX, SY + SD, SZ + SH)}">${rows}</g>`;
  return prop('shelf', s);
}

/** The armchair: a framed chair with a back cushion, a seat cushion, padded arms, a throw and a footstool, and its floor
 * lamp. Click it: the lamp steps through off, dim, medium and bright. */
export function armchairIg(pt: Project, vec: Delta, z: number) {
  const K = 0.12;
  const { TOP, FRONT, box, path } = igKernel(pt, vec, 91, 8, z - 6 * K, K);
  let s = `<g transform="${TOP(0, 0, 6)}"><ellipse class="lamppool" cx="44" cy="176" rx="76" ry="50"/></g>`;
  s +=
    mat('dark', box(32, 164, 6, 24, 24, 4, 10)) +
    `<path class="detail pole" d="${path([
      [44, 176, 10],
      [44, 176, 132],
    ])}"/>` +
    mat('terra', box(28, 160, 130, 32, 32, 22, 8)) +
    `<g transform="${FRONT(28, 192, 152)}"><rect class="face lampg" x="3" y="2" width="26" height="6" rx="3"/></g>`;
  for (const [x, y] of pairs([
    [52, 66],
    [134, 66],
    [52, 134],
    [134, 134],
  ]))
    s += mat('wood2', box(x, y, 6, 7, 7, 10, 2));
  s += mat('fabric', box(48, 62, 16, 98, 84, 14, 9)) + mat('fabric', box(48, 62, 30, 98, 16, 54, 8));
  s +=
    mat('fabric2', box(58, 76, 30, 78, 14, 42, 8)) +
    `<g transform="${FRONT(58, 90, 72)}"><rect class="detail" x="5" y="5" width="68" height="32" rx="6"/><circle class="face" cx="39" cy="21" r="2"/></g>`;
  s += mat('fabric', box(48, 62, 30, 20, 84, 28, 8)) + mat('fabric2', box(46, 60, 58, 24, 88, 6, 5));
  s +=
    mat('fabric2', box(70, 94, 30, 58, 52, 12, 8)) +
    `<g transform="${TOP(70, 94, 42)}"><rect class="detail" x="5" y="5" width="48" height="42" rx="6"/><circle class="face" cx="29" cy="26" r="2"/></g>`;
  s += mat('cream', box(88, 98, 42, 26, 12, 22, 6));
  s += mat('fabric', box(126, 62, 30, 20, 84, 28, 8)) + mat('fabric2', box(124, 60, 58, 24, 88, 6, 5));
  s +=
    mat('terra', box(116, 80, 58, 34, 60, 4, 2)) +
    `<g transform="${TOP(116, 80, 62)}">${[8, 16, 24, 32, 40, 48].map((y) => `<line class="detail" x1="3" y1="${y + 4}" x2="31" y2="${y + 4}"/>`).join('')}</g>`;
  for (const [x, y] of pairs([
    [66, 160],
    [102, 160],
    [66, 182],
    [102, 182],
  ]))
    s += mat('wood2', box(x, y, 6, 6, 6, 8, 2));
  s +=
    mat('fabric', box(62, 156, 14, 52, 36, 8, 6)) +
    mat('fabric2', box(64, 158, 22, 48, 32, 6, 6)) +
    `<g transform="${TOP(64, 158, 28)}"><rect class="detail" x="4" y="4" width="40" height="24" rx="5"/></g>`;
  return prop('chair', s);
}

/** The sofa: a framed sofa on legs, three back cushions, two seat cushions, pillows and a throw, and a side table with a
 * lamp. Click it: the lamp switches. */
export function sofaIg(pt: Project, vec: Delta, z: number) {
  const K = 0.12;
  const { TOP, FRONT, box, path } = igKernel(pt, vec, 35.1, 57, z - 6 * K, K, true);
  let s = '';
  s += mat('wood', box(-52, 56, 6, 38, 38, 42, 5));
  s += `<g transform="${TOP(-52, 56, 48)}"><ellipse class="lamppool" cx="19" cy="19" rx="46" ry="32"/></g>${mat('brass', box(-40, 68, 48, 14, 14, 4, 6))}<path class="detail pole" d="${path(
    [
      [-33, 75, 52],
      [-33, 75, 82],
    ],
  )}"/>${mat('cream', box(-45, 68, 82, 24, 18, 18, 6))}<g transform="${FRONT(-45, 86, 100)}"><rect class="face lampg" x="3" y="3" width="18" height="12" rx="4"/></g>`;
  for (const [x, y] of pairs([
    [36, 74],
    [206, 74],
    [36, 152],
    [206, 152],
  ]))
    s += mat('wood2', box(x, y, 6, 8, 8, 10, 2));
  s +=
    mat('fabric', box(30, 70, 16, 196, 92, 14, 8)) +
    `<g transform="${FRONT(30, 162, 30)}"><line class="detail" x1="6" y1="3" x2="190" y2="3"/><line class="detail" x1="6" y1="11" x2="190" y2="11"/></g>`;
  s += mat('fabric', box(52, 70, 30, 152, 14, 38, 6));
  [0, 1, 2].forEach((i) => {
    const x = 56 + i * 50;
    s +=
      mat('fabric2', box(x, 84, 30, 46, 14, 34, 7)) +
      `<g transform="${FRONT(x, 98, 64)}"><rect class="detail" x="4" y="4" width="38" height="24" rx="5"/><circle class="face" cx="23" cy="16" r="1.8"/></g>`;
  });
  s += mat('fabric', box(30, 70, 30, 24, 92, 26, 9)) + mat('fabric2', box(28, 68, 56, 28, 96, 6, 5));
  [0, 1].forEach((i) => {
    const x = 56 + i * 74;
    s +=
      mat('fabric2', box(x, 98, 30, 72, 60, 12, 8)) +
      `<g transform="${TOP(x, 98, 42)}"><rect class="detail" x="5" y="5" width="62" height="50" rx="7"/><circle class="face" cx="36" cy="30" r="2"/></g><g transform="${FRONT(x, 158, 42)}"><line class="detail" x1="4" y1="3" x2="68" y2="3"/></g>`;
  });
  s += mat('cream', box(62, 102, 42, 24, 12, 26, 6));
  s +=
    mat('terra', box(136, 106, 42, 50, 44, 3, 2)) +
    `<g transform="${TOP(136, 106, 45)}">${[8, 16, 24, 32, 40].map((x) => `<line class="detail" x1="${x + 4}" y1="3" x2="${x + 4}" y2="41"/>`).join('')}</g>`;
  s += mat('terra', box(178, 102, 42, 22, 12, 26, 6));
  s += mat('fabric', box(200, 70, 30, 26, 92, 26, 9)) + mat('fabric2', box(198, 68, 56, 30, 96, 6, 5));
  return prop('sofa', s);
}

/** The guitar on its tripod: a waisted body with a rim, a sound hole with a rosette, a fretted neck, a head with
 * tuners, and six strings. Click it: the strings blur and light, a note floats up, and a chord sounds. */
export function guitarIg(pt: Project, vec: Delta, z: number, at: [number, number]) {
  const K = 0.12;
  const { P } = igKernel(pt, vec, at[0], at[1], z - 6 * K, K);
  const yoke = P(0, 0, 46);
  const feet = [
    [-30, -22],
    [30, -26],
    [0, 42],
  ].map(([x, y]) => P(x!, y!, 6));
  let s = feet.map((f) => `<path class="tripod" d="M${yoke[0]} ${yoke[1]}L${f[0]} ${f[1]}"/>`).join('');
  const BODY =
    'M0 -56 C14 -56 24 -50 24 -38 C24 -28 19 -24 19 -16 C19 -8 32 -2 32 12 C32 34 18 44 0 44 C-18 44 -32 34 -32 12 C-32 -2 -19 -8 -19 -16 C-19 -24 -24 -28 -24 -38 C-24 -50 -14 -56 0 -56 Z';
  let strings = '';
  let frets = '';
  let tuners = '';
  for (let i = 0; i < 6; i++)
    strings += `<path class="str" style="--i:${i}" d="M${(-6 + i * 2.4).toFixed(2)} 24.5 L${(-3.6 + i * 1.44).toFixed(2)} -151"/>`;
  for (let f = 0; f < 10; f++)
    frets += `<line class="fret" x1="-5.5" x2="5.5" y1="${(-140 + f * 8.6).toFixed(1)}" y2="${(-140 + f * 8.6).toFixed(1)}"/>`;
  for (let t = 0; t < 3; t++)
    tuners += `<circle class="peg" cx="-11" cy="${-160 - t * 8}" r="2.6"/><circle class="peg" cx="11" cy="${-160 - t * 8}" r="2.6"/>`;
  s += `<g transform="translate(${yoke[0]} ${yoke[1] - 47 * 0.4}) rotate(-5) scale(0.4)">
    <path class="gbody rim" d="${BODY}" transform="translate(7 5)"/><path class="gbody" d="${BODY}"/><path class="gbind" d="${BODY}" transform="scale(.93)"/>
    <circle class="ghole" cx="0" cy="-6" r="9.6"/><circle class="gring" cx="0" cy="-6" r="12.2"/><circle class="gglow" cx="0" cy="-6" r="18"/>
    <rect class="gbridge" x="-13" y="22" width="26" height="5.4" rx="1.6"/><rect class="gneck" x="-5.8" y="-152" width="11.6" height="100" rx="1.5"/>${frets}
    <path class="ghead" d="M-8 -152 h16 l2 -26 q0 -7 -7 -7 h-6 q-7 0 -7 7 z"/>${tuners}${strings}
    ${[0, 1, 2].map((i) => `<text data-keep class="note" style="--i:${i}" x="${[-30, 28, -6][i]}" y="-26" font-size="16">${['♪', '♫', '♪'][i]}</text>`).join('')}</g>`;
  return prop('guitar', s, [at[0] - 3.7, at[1] - 3.7, at[0] + 3.7, at[1] + 3.7]);
}

/** The bed: a walnut frame with a headboard, a cream mattress, a terracotta blanket, two pillows, and a nightstand with a
 * lamp. Click it: the bedside lamp switches. */
export function bedIg(pt: Project, vec: Delta, z: number) {
  const K = 0.14;
  const { TOP, FRONT, box, path } = igKernel(pt, vec, 30.6, 48, z - 6 * K, K);
  const [nx, ny] = [210, 50];
  let s = mat('walnut', box(40, 36, 6, 150, 164, 14, 6)) + mat('walnut', box(36, 30, 6, 158, 10, 66, 4));
  s +=
    mat('cream', box(46, 46, 20, 138, 148, 14, 8)) +
    `<g transform="${TOP(46, 46, 34)}"><rect class="detail" x="6" y="6" width="126" height="136" rx="6"/></g>`;
  s +=
    mat('terra', box(46, 100, 34, 138, 94, 5, 6)) +
    `<g transform="${TOP(46, 100, 39)}">${[14, 30, 46, 62, 78].map((y) => `<line class="detail" x1="8" y1="${y}" x2="130" y2="${y}"/>`).join('')}</g>`;
  for (const x of [56, 122])
    s +=
      mat('cream', box(x, 52, 34, 56, 34, 10, 7)) +
      `<g transform="${TOP(x, 52, 44)}"><rect class="detail" x="6" y="6" width="44" height="22" rx="5"/></g>`;
  s +=
    `<g transform="${TOP(0, 0, 6)}"><ellipse class="lamppool" cx="${nx + 26}" cy="${ny + 23}" rx="70" ry="48"/></g>` +
    mat('wood', box(nx, ny, 6, 52, 46, 50, 4)) +
    `<g transform="${FRONT(nx, ny + 46, 56)}"><rect class="face recess" x="6" y="6" width="40" height="18" rx="3"/><circle class="face" cx="26" cy="15" r="2.4"/><rect class="face recess" x="6" y="28" width="40" height="16" rx="3"/><circle class="face" cx="26" cy="36" r="2.4"/></g>` +
    mat('brass', box(226, 66, 56, 20, 20, 5, 8)) +
    `<path class="detail pole" d="${path([
      [236, 76, 61],
      [236, 76, 88],
    ])}"/>` +
    mat('terra', box(222, 70, 88, 28, 22, 20, 6)) +
    `<g transform="${FRONT(222, 92, 108)}"><rect class="face lampg" x="3" y="3" width="22" height="14" rx="4"/></g>`;
  return prop('bed', s);
}

/** The lounge: a coffee table with two candles and a cup, a beanbag, and an arc lamp leaning over the table. Click the
 * candles to blow them out; click anything else to switch the arc lamp. */
export function loungeIg(pt: Project, vec: Delta, z: number) {
  const K = 0.2;
  const { TOP, FRONT, box, path } = igKernel(pt, vec, 80.6, 32.4, z - 6 * K, K);
  let s = `<g transform="${TOP(0, 0, 6)}"><ellipse class="lamppool" cx="150" cy="106" rx="84" ry="64"/></g>`;
  s += mat('dark', box(26, 168, 6, 18, 18, 4, 8));
  const arc: P3[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    arc.push([
      34 + t * 86,
      176 - t * 70,
      10 + Math.sin(Math.min(1, t * 1.15) * (Math.PI / 2)) * 112 - t * t * 12,
    ]);
  }
  s += `<path class="detail pole" d="${path(arc)}"/>`;
  const tip = arc[12]!;
  s +=
    mat('terra', box(tip[0] - 14, tip[1] - 12, tip[2] - 10, 28, 24, 10, 6)) +
    `<g transform="${FRONT(tip[0] - 14, tip[1] + 12, tip[2])}"><rect class="face lampg" x="3" y="2" width="22" height="5" rx="2.5"/></g>`;
  s +=
    mat('wood', box(110, 80, 6, 56, 56, 18, 8)) +
    `<g transform="${TOP(110, 80, 24)}"><circle class="detail" cx="28" cy="28" r="22"/></g>`;
  s +=
    `<g class="candles">` +
    mat('cream', box(122, 92, 24, 8, 8, 14, 2)) +
    mat('cream', box(144, 100, 24, 8, 8, 10, 2)) +
    `<g transform="${TOP(122, 92, 38)}"><circle class="cdl" cx="4" cy="4" r="2.4"/></g><g transform="${TOP(144, 100, 34)}"><circle class="cdl" cx="4" cy="4" r="2.4"/></g></g>`;
  s += mat('terra', box(130, 112, 24, 12, 12, 8, 4));
  s +=
    mat('indigo', box(190, 150, 6, 62, 54, 30, 22)) +
    `<g transform="${TOP(190, 150, 36)}"><ellipse class="face recess" cx="31" cy="27" rx="18" ry="14"/></g>`;
  return prop('lounge', s);
}

/** The trophy case: a wooden case with a glass front, two shelves, a trophy and four medals. The station's beats and a
 * click both light the case; the cup keeps its own class, so the station can lift it. */
export function trophyIg(pt: Project, vec: Delta, z: number, stand: [number, number]) {
  const K = 0.19;
  const { TOP, FRONT, SIDE, box, lines, P } = igKernel(pt, vec, 137.2, 6.5, z - 6 * K, K);
  const [cx, cy] = P(105, 90, 76);
  const lift = `--lx:${+(stand[0] - cx).toFixed(1)}px;--ly:${+(stand[1] - 112 - cy).toFixed(1)}px`;
  let s = mat('wood', box(50, 40, 6, 110, 50, 120, 4));
  s += `<g transform="${TOP(50, 40, 126)}"><rect class="detail" x="8" y="8" width="94" height="34" rx="3"/></g><g transform="${SIDE(160, 90, 126)}">${lines(6, 44, 4, 8, 112)}</g>`;
  s += `<g transform="${FRONT(50, 90, 126)}"><rect class="face recess" x="8" y="8" width="94" height="104" rx="4"/><rect class="tr-halo" x="10" y="10" width="90" height="100" rx="3"/><rect class="face glass" x="10" y="10" width="90" height="100" rx="3"/>
    <line class="detail" x1="10" y1="64" x2="100" y2="64"/><line class="detail" x1="10" y1="108" x2="100" y2="108"/>
    ${[18, 30, 78, 90].map((x) => `<circle class="face tr2" cx="${x}" cy="97" r="4"/>`).join('')}</g>`;
  s += `<g class="trophy" style="${lift}"><g transform="${FRONT(50, 90, 126)}"><g class="cup"><path class="face tr" d="M38 30 h34 c0 20 -7 30 -17 32 c-10 -2 -17 -12 -17 -32 Z"/><path class="detail" d="M38 34 c-14 0 -14 18 2 20 M72 34 c14 0 14 18 -2 20"/><path class="detail" d="M55 38 l2 5 5 .4 -4 3.4 1.3 5 -4.3 -2.8 -4.3 2.8 1.3 -5 -4 -3.4 5 -.4z"/><rect class="face tr" x="51.5" y="62" width="7" height="8"/><rect class="face tr" x="43" y="70" width="24" height="5" rx="1.5"/><rect class="face tr" x="39" y="75" width="32" height="4" rx="1.5"/></g></g>`;
  return prop('trophy', s);
}

type Kind = 'monstera' | 'snake' | 'succulent';
const LEAF = 'M0 0 C-16 -4 -22 -24 -12 -42 C-8 -50 -3 -54 0 -56 C3 -54 8 -50 12 -42 C22 -24 16 -4 0 0 Z';

/** A potted plant, drawn as the gallery draws it: a rounded pot with soil, and leaves as flat sprites on stems. Click it:
 * it is watered, the leaves brighten and sway, and drops fall. `s` scales the whole plant, `at` is where its pot stands. */
export function plantIg(
  pt: Project,
  vec: Delta,
  kind: Kind,
  at: [number, number, number],
  s: number,
  id = 0,
) {
  const w = kind === 'monstera' ? 48 : kind === 'snake' ? 44 : 28;
  const h = kind === 'monstera' ? 40 : kind === 'snake' ? 30 : 20;
  const K = 0.085 * s;
  const { TOP, box, P } = igKernel(pt, vec, at[0] + (w / 2) * K, at[1] - (w / 2) * K, at[2] - 6 * K, K);
  const potMat = kind === 'monstera' ? 'terra' : kind === 'snake' ? 'cream' : 'brass';
  let out =
    mat(potMat, box(0, 0, 6, w, w, h, w / 2 - 3) + box(-2, -2, 6 + h - 6, w + 4, w + 4, 6, (w + 4) / 2 - 3)) +
    `<g transform="${TOP(-2, -2, 6 + h)}"><circle class="face soil" cx="${(w + 4) / 2}" cy="${(w + 4) / 2}" r="${w / 2 - 2}"/></g>`;
  const [bx, by] = P(w / 2, w / 2, 6 + h);
  const sc = +(K * 5.6).toFixed(3);
  const sprite = (inner: string, i: number, rot = 0, pre = '') =>
    `<g transform="translate(${bx} ${by}) scale(${sc})${pre} rotate(${rot})"><g class="sway" style="--i:${i}">${inner}</g></g>`;
  if (kind === 'monstera')
    out += (
      [
        [-28, -44, -40, 1],
        [-6, -70, -10, 1.08],
        [18, -64, 14, 1.04],
        [34, -38, 42, 0.94],
        [-38, -16, -66, 0.78],
        [40, -10, 68, 0.78],
      ] as [number, number, number, number][]
    )
      .map(([sx, sy, a, sz], i) =>
        sprite(
          `<path class="stem" d="M0 0 Q${sx * 0.15} ${sy * 0.65} ${sx} ${sy}"/><g transform="translate(${sx} ${sy}) rotate(${a}) scale(${sz})"><path class="face leaf" d="${LEAF}"/><path class="vein" d="M0 0 L0 -54 M0 -14 L-12 -26 M0 -14 L12 -26 M0 -30 L-12 -40 M0 -30 L12 -40"/></g>`,
          i + id,
        ),
      )
      .join('');
  else if (kind === 'snake')
    out += (
      [
        [-24, 56],
        [-15, 72],
        [-7, 64],
        [0, 86],
        [8, 66],
        [16, 76],
        [25, 58],
      ] as [number, number][]
    )
      .map(([dx, hh], i) =>
        sprite(
          `<path class="face leaf2" d="M-6 0 L-4 -${hh - 8} Q0 -${hh + 6} 4 -${hh - 8} L6 0 Z"/><path class="band" d="M-5 -${(hh * 0.3).toFixed(1)} L5 -${(hh * 0.3).toFixed(1)} M-4 -${(hh * 0.62).toFixed(1)} L4 -${(hh * 0.62).toFixed(1)}"/>`,
          i + id,
          dx * 0.55,
        ),
      )
      .join('');
  else
    out += Array.from({ length: 9 }, (_, i) =>
      sprite(
        `<path class="face leaf2" d="M0 0 C-7 -5 -7 -18 0 -26 C7 -18 7 -5 0 0 Z"/>`,
        i + id,
        i * 40,
        ' scale(1 .62)',
      ),
    ).join('');
  const drops = [0, 1, 2]
    .map(
      (i) =>
        `<rect class="drop" style="--i:${i}" x="${+(bx + (i - 1) * 9 * sc * 1.6).toFixed(1)}" y="${+(by - 70 * sc).toFixed(1)}" width="1.8" height="4" rx="0.9"/>`,
    )
    .join('');
  return prop('plant', out + drops, [at[0] - 2.5 * s, at[1] - 2.5 * s, at[0] + 2.5 * s, at[1] + 2.5 * s]);
}

/** Station 02, the conveyor and the critic arch. The belt and its back post go behind the cards, and the arch's front
 * post and beam in front, so the cards pass through. Click it to pause or run the belt. */
export function beltIg(pt: Project, vec: Delta) {
  const K = 0.1;
  const { TOP, SIDE, box, lines } = igKernel(pt, vec, 69.5, 1.5, 6.4, K, true);
  const ZH = 150;
  let back = mat('dark', box(20, 44, 6, 290, 6, 20, 2)) + mat('dark', box(20, 50, 6, 290, 50, 10, 5));
  back += `<g transform="${TOP(20, 50, 16)}"><rect class="face recess" x="4" y="4" width="282" height="42" rx="3"/>${lines(14, 276, 12, 6, 44)}</g>`;
  back += mat('wood2', box(156, 34, 6, 12, 14, ZH, 2));
  let front = mat('dark', box(20, 100, 6, 290, 6, 20, 2)) + mat('wood2', box(156, 102, 6, 12, 14, ZH, 2));
  front += mat('wood', box(156, 34, 6 + ZH - 8, 12, 82, 8, 3));
  front += `<g transform="${SIDE(168, 116, 6 + ZH)}"><rect class="face recess" x="6" y="1" width="70" height="6" rx="3"/><rect class="face lampg" x="8" y="1.4" width="66" height="5.2" rx="2.6"/></g>`;
  return [prop('belt', back), prop('belt', front)];
}

/** Station 04, the server rack and the cloud shelf. Click it and the rack's lights come on and the pipeline reads
 * green. */
export function rackIg(pt: Project, vec: Delta) {
  const K = 0.1;
  const rk = igKernel(pt, vec, 134.6, 24, -6 * K, K);
  let s = mat('dark', rk.box(0, 50, 6, 70, 50, 340, 3));
  let units = '';
  for (let i = 0; i < 14; i++) {
    const y = 6 + i * 23;
    units += `<rect class="face recess" x="6" y="${y}" width="58" height="19" rx="2"/>${[0, 1, 2, 3].map((k) => `<circle class="face lampg" cx="${14 + k * 7}" cy="${y + 9.5}" r="2"/>`).join('')}<line class="detail" x1="42" y1="${y + 9.5}" x2="58" y2="${y + 9.5}"/>`;
  }
  s += `<g transform="${rk.FRONT(0, 100, 346)}">${units}</g><g transform="${rk.SIDE(70, 100, 346)}">${rk.lines(6, 44, 4, 6, 330)}</g>`;
  const sh = igKernel(pt, vec, 129.6, 36, -6 * K, K);
  for (const [x, y] of [
    [4, 4],
    [86, 4],
    [4, 112],
    [86, 112],
  ] as [number, number][])
    s += mat('wood2', sh.box(x, y, 6, 10, 10, 220, 1));
  s += mat('wood', sh.box(0, 0, 100, 100, 126, 12, 2)) + mat('wood', sh.box(0, 0, 226, 100, 126, 15, 2));
  return prop('rack', s);
}

/** A tree: a trunk and a canopy of three rounded boxes. Click it and it rustles. */
export function treeIg(pt: Project, vec: Delta, x: number, y: number, z: number, k = 1) {
  const K = 0.15 * k;
  const { box } = igKernel(pt, vec, x + 4 * K, y - 4 * K, z - 6 * K, K);
  const can =
    mat('leaf', box(-14, -14, 40, 36, 36, 14, 13)) +
    mat('leaf2', box(-10, -10, 54, 28, 28, 13, 11)) +
    mat('leaf', box(-5, -5, 67, 18, 18, 10, 8));
  return prop('tree', mat('wood2', box(0, 0, 6, 8, 8, 36, 3)) + `<g class="can">${can}</g>`);
}

/** A street lamp: a base, a pole and a shade. `extra` is the lamp's own light (its pool, glow and bulb), which goes out
 * with it when it is clicked. */
export function streetLampIg(pt: Project, vec: Delta, x: number, y: number, z: number, extra: string) {
  const K = 0.19;
  const { box, path, FRONT } = igKernel(pt, vec, x + 6 * K, y - 6 * K, z - 6 * K, K);
  const s =
    mat('dark', box(0, 0, 6, 12, 12, 4, 5)) +
    `<path class="detail pole" d="${path([
      [6, 6, 10],
      [6, 6, 96],
    ])}"/>` +
    mat('terra', box(-5, -2, 94, 22, 16, 8, 4)) +
    `<g transform="${FRONT(-5, 14, 102)}"><rect class="face lampg" x="3" y="1.4" width="16" height="4.4" rx="2.2"/></g>`;
  return prop('lamp', s + extra);
}

/** A car body: wheels, a coloured body and a cabin, running along the room's x or y. Click it and it honks (its lights
 * flare). */
export function carBodyIg(
  pt: Project,
  vec: Delta,
  alongX: boolean,
  lane: number,
  a0: number,
  a1: number,
  z: number,
  tone: 'l' | 'a' | 'n',
) {
  const K = (a1 - a0) / 56;
  const w = 24 * K;
  const { box } = alongX
    ? igKernel(pt, vec, a1, lane - w / 2, z - 6 * K, K, true)
    : igKernel(pt, vec, lane + w / 2, a0, z - 6 * K, K);
  const body = tone === 'a' ? 'terra' : tone === 'l' ? 'indigo' : 'dark';
  return prop(
    'car',
    mat('dark', box(8, 18, 6, 12, 6, 9, 3) + box(38, 18, 6, 12, 6, 9, 3)) +
      mat(body, box(0, 0, 9, 56, 24, 11, 6)) +
      mat('cream', box(12, 3, 20, 32, 18, 10, 5)),
  );
}

const pad = (list: [number, number][]) => list;

/** Station 01, the dev desk, as the gallery draws it: a walnut-topped desk with two monitors (code on the left, a terminal
 * on the right), a felt mat, a keyboard, a mug with steam and a desk lamp. The left screen shows the station's fifteen
 * tiles while the station plays. Click the lamp to switch it; click anywhere else (or type, once it has been clicked) and
 * the terminal takes the keys. */
export function deskIg(pt: Project, vec: Delta) {
  const K = 0.11;
  const { TOP, FRONT, box, path } = igKernel(pt, vec, 35.76, -4.2, -6 * K, K, true);
  const TZ = 130;
  const SZ = TZ + 6;
  let s = '';
  for (const [x, y] of pad([
    [26, 50],
    [262, 50],
    [26, 128],
    [262, 128],
  ]))
    s += mat('wood2', box(x, y, 6, 10, 10, TZ - 6, 2));
  s += mat('wood', box(16, 40, TZ, 268, 120, 6, 5));
  s += `<g transform="${TOP(16, 40, SZ)}"><rect class="detail" x="6" y="6" width="256" height="108" rx="4"/><rect class="face recess" x="34" y="48" width="150" height="56" rx="4"/><ellipse class="lamppool" cx="214" cy="40" rx="46" ry="28"/></g>`;
  const tiles = Array.from({ length: 15 }, (_, i) => {
    const row = Math.floor(i / 5);
    const col = i % 5;
    return `<g class="tile" style="--d:${(((i * 7) % 11) / 100).toFixed(2)}s"><rect class="q" x="${6 + col * 13.6}" y="${5 + row * 12.4}" width="12" height="11" rx="1.4"/></g>`;
  }).join('');
  const monitor = (mx: number, my: number, content: string) =>
    mat(
      'dark',
      box(mx + 26, my + 2, SZ, 26, 16, 3, 2) +
        box(mx + 36, my + 7, SZ + 3, 6, 6, 8, 1) +
        box(mx, my + 6, SZ + 11, 78, 5, 48, 2),
    ) +
    `<g transform="${FRONT(mx, my + 11, SZ + 11 + 48)}"><rect class="face recess" x="2" y="2" width="74" height="44" rx="3"/><rect class="mhalo" x="4" y="4" width="70" height="40" rx="2"/><rect class="face glass" x="4" y="4" width="70" height="40" rx="2"/>${content}</g>`;
  const code = [
    'def check(req):',
    '  facts = len(req.facts)',
    '  if facts < 1:',
    '    return ask()',
    '  return act(req)',
  ];
  s += monitor(
    36,
    62,
    `<g class="dcode">${code.map((l, i) => `<text data-keep class="${i === 3 ? 'gscr-a' : 'gscr'}" x="8" y="${13 + i * 6.4}" font-size="4.2" xml:space="preserve">${l}</text>`).join('')}</g><g class="dtiles">${tiles}</g>`,
  );
  s += monitor(
    130,
    62,
    `<text data-keep class="gscr" x="8" y="12" font-size="4">terminal</text><text data-keep class="gscr" x="8" y="20" font-size="4.2">$ run checks</text><text data-keep class="gscr-a" x="8" y="27" font-size="4.2">ok</text><text data-keep class="gscr-a term" x="8" y="38" font-size="4.4">&gt; </text><rect class="gscr-a cur" x="14" y="34" width="2.4" height="5"/>`,
  );
  s += `<g class="lampbtn">${mat('brass', box(246, 52, SZ, 24, 24, 4, 8))}<path class="detail pole" d="${path(
    [
      [258, 64, SZ + 4],
      [258, 64, SZ + 46],
      [236, 80, SZ + 62],
    ],
  )}"/>${mat('terra', box(222, 72, SZ + 58, 28, 20, 8, 3))}<g transform="${FRONT(222, 92, SZ + 66)}"><rect class="face recess" x="3" y="2" width="22" height="4" rx="2"/><rect class="face lampg" x="3.5" y="2.4" width="21" height="3.2" rx="1.6"/></g></g>`;
  s += mat('dark', box(78, 118, SZ, 100, 34, 3, 2));
  let keys = '';
  [12, 12, 11, 8].forEach((n, r) => {
    for (let c = 0; c < n; c++)
      keys += `<rect class="face key" x="${5 + c * 7.7 + (r === 3 && c > 1 ? 14 : 0)}" y="${4.5 + r * 7}" width="${r === 3 && c === 2 ? 38 : 6.3}" height="5.8" rx="1.2"/>`;
  });
  s += `<g transform="${TOP(78, 118, SZ + 3)}"><rect class="face recess" x="2" y="2" width="96" height="30" rx="2"/>${keys}</g>`;
  s +=
    mat('terra', box(236, 118, SZ, 16, 16, 18, 5)) +
    `<g transform="${TOP(236, 118, SZ + 18)}"><rect class="face recess" x="2.5" y="2.5" width="11" height="11" rx="5.5"/></g>`;
  for (const dx of [0, 6]) {
    const wisp: P3[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      wisp.push([241 + dx + Math.sin(t * 7 + dx) * 2.2, 125, SZ + 22 + t * 24]);
    }
    s += `<path class="detail steam" d="${path(wisp)}"/>`;
  }
  return prop('desk', s);
}

/** Station 03, the whiteboard, as the gallery draws it: a cream frame on two legs with seven records as bars, a pen tray
 * and a stool. The bars sort into a ranking and the top one is marked, while the station plays or when it is clicked. */
export function boardIg(pt: Project, vec: Delta) {
  const K = 0.17;
  const { TOP, FRONT, box } = igKernel(pt, vec, 109.8, -8.6, -6 * K, K, true);
  const raw = [5, 11, 3, 9, 13, 6, 8];
  const [BW, GAP, X0, BASE, UNIT] = [18, 6, 14, 76, 5.2];
  const order = raw.map((_, i) => i).sort((a, b) => raw[b]! - raw[a]!);
  const top = order[0]!;
  let bars = '';
  raw.forEach((v, i) => {
    const dx = (order.indexOf(i) - i) * (BW + GAP);
    bars += `<rect class="face gbar${i === top ? ' top' : ''}" style="--dx:${dx}px;--i:${i}" x="${X0 + i * (BW + GAP)}" y="${BASE - v * UNIT}" width="${BW}" height="${v * UNIT}" rx="1.5"/>`;
  });
  let s = mat('dark', box(52, 56, 6, 6, 6, 52, 2)) + mat('dark', box(196, 56, 6, 6, 6, 52, 2));
  s += mat('cream', box(40, 52, 56, 180, 5, 88, 3));
  s += `<g transform="${FRONT(40, 57, 144)}"><rect class="face bd" x="4" y="4" width="172" height="80" rx="2"/><rect class="bhalo" x="4" y="4" width="172" height="80" rx="2"/>
    <text data-keep class="bdl" x="10" y="12" font-size="6">PRECISION@50</text><text data-keep class="bdl sm" x="10" y="19" font-size="4.4">held-out · 30K</text>
    <line class="bdd" x1="10" y1="${BASE + 1}" x2="170" y2="${BASE + 1}"/>${bars}
    <path class="bmark" style="--dx:${(0 - top) * (BW + GAP)}px" d="M${X0 + 2 + top * (BW + GAP)} ${BASE - 13 * UNIT - 6} l${BW / 2 - 1} -6 l${BW / 2 - 1} 6"/></g>`;
  s +=
    mat('wood', box(80, 58, 50, 70, 7, 4, 1.5)) +
    mat('terra', box(86, 61, 54, 5, 3, 3, 1)) +
    mat('indigo', box(98, 61, 54, 5, 3, 3, 1)) +
    mat('cream', box(110, 61, 54, 5, 3, 3, 1));
  s +=
    mat('terra', box(120, 96, 6, 22, 22, 24, 9)) +
    `<g transform="${TOP(120, 96, 30)}"><circle class="detail" cx="11" cy="11" r="6"/></g>`;
  return prop('board', s);
}

/** Station 05, the standing desk with two agents, as the gallery draws it: a standing desk with a plan notepad and two
 * laptops, one for each agent. The plan ticks off, code is typed on both screens and the row of tests lights, while the
 * station plays or when it is clicked. */
export function agentsIg(pt: Project, vec: Delta) {
  const K = 0.095;
  const { TOP, FRONT, box } = igKernel(pt, vec, 133.8, 46.7, -6 * K, K);
  const TZ = 110;
  let s = mat('wood2', box(30, 50, 6, 8, 70, TZ - 6, 2)) + mat('wood2', box(262, 50, 6, 8, 70, TZ - 6, 2));
  s += mat('wood', box(24, 44, TZ, 252, 82, 6, 4));
  const LINES = ['plan = read(task)', 'edit(plan.files)', 'run(tests)'];
  const laptop = (x: number, label: string) =>
    mat('dark', box(x, 78, TZ + 6, 56, 38, 3, 2) + box(x + 2, 76, TZ + 9, 52, 4, 36, 2)) +
    `<g transform="${FRONT(x + 2, 80, TZ + 9 + 36)}"><rect class="face recess" x="2" y="2" width="48" height="32" rx="2"/><rect class="mhalo" x="3.4" y="3.4" width="45" height="29" rx="1.6"/><rect class="face glass" x="3.4" y="3.4" width="45" height="29" rx="1.6"/>
      <text data-keep class="gscr" x="6" y="9" font-size="3.6">${label}</text>${LINES.map((l, i) => `<text data-keep class="${i === 2 ? 'gscr-a' : 'gscr'} agline" style="--i:${i}" x="6" y="${14 + i * 4.2}" font-size="3.3">${l}</text>`).join('')}${[0, 1, 2, 3, 4].map((i) => `<rect class="face tst" style="--i:${i}" x="${6 + i * 8.4}" y="27" width="6.4" height="3.6" rx="1"/>`).join('')}</g>`;
  s += laptop(54, 'claude code') + laptop(150, 'codex');
  s +=
    mat('cream', box(222, 70, TZ + 6, 38, 46, 2, 2)) +
    `<g transform="${TOP(222, 70, TZ + 8)}"><text data-keep class="bdl" x="4" y="9" font-size="4.6">plan</text>${[0, 1, 2].map((i) => `<rect class="face chk" style="--i:${i}" x="5" y="${14 + i * 10}" width="6" height="6" rx="1.2"/><line class="detail" x1="15" y1="${17 + i * 10}" x2="32" y2="${17 + i * 10}"/>`).join('')}</g>`;
  return prop('agents', s);
}

/** The portal's pad, as the gallery draws it: a slate disc with a ring, a recessed well with a glowing core and a running
 * ring of dashes. Click it and the column of light comes on and the motes rise. */
export function portalPadIg(pt: Project, vec: Delta, cx: number, cy: number, z: number) {
  const K = 0.083;
  const { box, TOP } = igKernel(pt, vec, cx + 58 * K, cy - 58 * K, z - 6 * K, K);
  return prop(
    'portal',
    mat('slate', box(0, 0, 6, 116, 116, 10, 58)) +
      `<g transform="${TOP(0, 0, 16)}"><circle class="detail" cx="58" cy="58" r="50"/><circle class="face recess" cx="58" cy="58" r="38"/><circle class="pglow" cx="58" cy="58" r="34"/><circle class="prune" cx="58" cy="58" r="44"/><circle class="pcore" cx="58" cy="58" r="26"/></g>`,
  );
}

/** A window, as the gallery draws it: a wooden frame with glass, blinds, curtains, a sill with a plant, and a mullion;
 * and the light that always seeps through the blinds in slanted beams, with dust drifting in them. `frame` goes where
 * the window is, `beams` in the light layer (over the floor, under the furniture). Click the window and the blinds
 * open wide; click it again and they tilt nearly shut. */
export function windowIg(
  pt: Project,
  vec: Delta,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  floor: number,
) {
  const K = (x1 - x0) / 100;
  const H = (z1 - z0) / K;
  const { P, FRONT, box } = igKernel(pt, vec, x1, 0.2, floor - 6 * K, K, true);
  const zt = 6 + (z0 - floor) / K + H;
  const sy = H / 114;
  const n = Math.round(H / 9);
  const gap = (H - 20) / n;
  const slats = Array.from(
    { length: n },
    (_, i) =>
      `<rect class="wslat" x="0" y="${+(i * gap).toFixed(1)}" width="84" height="${+(gap * 0.78).toFixed(1)}" rx="1"/>`,
  ).join('');
  let frame = `<g transform="${FRONT(0, 2, zt)}"><rect class="face wframe" x="0" y="0" width="100" height="${H}" rx="3"/><rect class="face recess" x="6" y="6" width="88" height="${H - 12}" rx="2"/><rect class="mhalo" x="8" y="8" width="84" height="${H - 16}"/><rect class="face glass" x="8" y="8" width="84" height="${H - 16}" rx="2"/>
    <g class="wslats" transform="translate(8 10)">${slats}</g>
    <line class="wmull" x1="92" y1="10" x2="92" y2="${+(H * 0.7).toFixed(1)}"/><circle class="wknob" cx="92" cy="${+(H * 0.72).toFixed(1)}" r="2"/>
    <g transform="scale(0.78 ${(sy * 0.82).toFixed(3)})"><path class="wcl" d="M8 6 C22 28 18 72 12 128 H38 C34 82 34 36 42 6 Z"/><path class="wcr" d="M138 6 C124 28 128 72 134 128 H108 C112 82 112 36 104 6 Z"/></g></g>`;
  frame += mat('wood', box(-8, 0, 6 - 10 + (z0 - floor) / K, 116, 30, 12, 2));
  // beams: one for each gap between the slats; a ray leaves the glass at height z and lands on the floor at (z - 6) / SLOPE
  const ZT = zt - 14;
  const ZB = 6 + (z0 - floor) / K + 14;
  const [N, XS, STEP, SLOPE, DRIFT] = [7, 14, 12, 0.62, -0.37];
  const land = (x: number, z: number): P3 => {
    const L = (z - 6) / SLOPE;
    return [x + DRIFT * L, 2 + L, 6];
  };
  const hull = (pts: [number, number][]) => {
    const srt = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o: [number, number], a: [number, number], b: [number, number]) =>
      (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo: [number, number][] = [];
    const up: [number, number][] = [];
    for (const p of srt) {
      while (lo.length > 1 && cr(lo[lo.length - 2]!, lo[lo.length - 1]!, p) <= 0) lo.pop();
      lo.push(p);
    }
    for (const p of srt.reverse()) {
      while (up.length > 1 && cr(up[up.length - 2]!, up[up.length - 1]!, p) <= 0) up.pop();
      up.push(p);
    }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  };
  let patches = '';
  let air = '';
  for (let i = 0; i < N; i++) {
    const [a, b] = [XS + i * STEP, XS + i * STEP + 6];
    const [fa1, fa2, fb1, fb2] = [land(a, ZT), land(b, ZT), land(a, ZB), land(b, ZB)];
    patches += `<polygon class="wpatch" points="${[fb1, fb2, fa2, fa1].map((p) => P(...p).join(',')).join(' ')}"/>`;
    const pts = ([[a, 2, ZT], [b, 2, ZT], [a, 2, ZB], [b, 2, ZB], fa1, fa2, fb1, fb2] as P3[]).map((p) =>
      P(...p),
    );
    air += `<polygon class="wbeam" points="${hull(pts)
      .map((p) => p.join(','))
      .join(' ')}"/>`;
  }
  let dust = '';
  for (let i = 0; i < 12; i++) {
    const gi = i % N;
    const z = ZB + (ZT - ZB) * (((i * 37) % 10) / 10);
    const [sx, sy2] = P(XS + gi * STEP + 3, 2, z);
    const [ex, ey] = P(...land(XS + gi * STEP + 3, z));
    dust += `<rect class="wdust" style="--dx:${+(ex - sx).toFixed(1)}px;--dy:${+(ey - sy2).toFixed(1)}px;--i:${i}" x="${sx}" y="${sy2}" width="1.6" height="1.6"/>`;
  }
  return {
    frame: prop('window', frame),
    beams: `<g class="wlight">${patches}${air}${dust}</g>`,
  };
}

/** Station 08, the Redis stack, drawn as the props gallery draws its props: a dark server plinth with a status strip,
 * and on it the Redis mark as three red slabs with the star on top; three keys float over it inside a TTL ring. While
 * the station plays the keys are written, their TTL ring runs down, one key expires and the stack glows. Click it
 * (PING): the slabs lift apart, the strip lights and the keys light up (PONG). It stands against the right-hand wall. */
export function redisIg(pt: Project, vec: Delta, z: number) {
  const K = 0.12;
  const { TOP, FRONT, box } = igKernel(pt, vec, 129.6, 58, z - 6 * K, K);
  let s = `<g transform="${TOP(0, 0, 42)}"><ellipse class="rglow" cx="70" cy="50" rx="66" ry="44"/></g>`;
  s +=
    mat('dark', box(10, 10, 6, 120, 80, 36, 6)) +
    `<g transform="${FRONT(10, 90, 42)}"><rect class="face recess" x="8" y="6" width="104" height="8" rx="3"/><rect class="face lampg" x="10" y="7.5" width="100" height="5" rx="2.5"/><text data-keep class="gscr" x="12" y="27" font-size="7">redis-server :6379</text></g>`;
  for (let i = 0; i < 3; i++)
    s += `<g class="lay" style="--i:${i}">${mat('redis', box(28, 22, 46 + i * 18, 84, 56, 12, 8))}</g>`;
  // the star on the top slab
  const star = Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3;
    return `M42 28L${+(42 + Math.cos(a) * 11).toFixed(1)} ${+(28 + Math.sin(a) * 11).toFixed(1)}`;
  }).join('');
  s += `<g class="lay" style="--i:2"><g transform="${TOP(28, 22, 94)}"><path class="rstar" d="${star}"/><circle class="rstar-c" cx="42" cy="28" r="3.2"/></g></g>`;
  // the TTL ring and the keys over the stack
  s += `<g transform="${TOP(0, 0, 100)}"><ellipse class="rttl" cx="70" cy="50" rx="58" ry="40"/></g>`;
  (
    [
      [24, 20],
      [62, 6],
      [100, 26],
    ] as [number, number][]
  ).forEach(([x, y], i) => {
    s += `<g class="rkey k${i}" style="--i:${i}">${mat('cream', box(x, y, 108, 16, 16, 6, 3))}<g transform="${TOP(x, y, 114)}"><rect class="face rkt" x="3" y="3" width="10" height="10" rx="2"/></g></g>`;
  });
  return prop('redis', s);
}
