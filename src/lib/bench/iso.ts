// A tiny isometric helper for the Bench stages: one fixed camera and prisms drawn in three tones (top, front, end),
// the way the Anatomy skill draws its solids, without its 30 KB kit. The azimuth must stay negative: the viewer then
// sees the top, the front (+y) and the left end (-x) of every box, and objects further along x are drawn first.
export type Camera = { ox: number; oy: number; s: number; az: number };
// The résumé room adds three of its own: k (a dark screen), r (a wall) and fl (the floor).
export type Tone = 'n' | 'l' | 'a' | 'g' | 'w' | 'k' | 'r' | 'fl';

const ELEVATION = Math.PI / 6;
const f = (n: number) => +n.toFixed(1);

export function camera({ ox, oy, s, az }: Camera) {
  const a = (az * Math.PI) / 180;
  const [ca, sa, se, ce] = [Math.cos(a), Math.sin(a), Math.sin(ELEVATION), Math.cos(ELEVATION)];
  /** World to screen: x along the scale, y toward the viewer, z up. */
  const at = (x: number, y: number, z = 0): [number, number] => [
    ox + s * (x * ca - y * sa),
    oy + s * se * (x * sa + y * ca) - s * ce * z,
  ];
  const points = (list: [number, number, number][]) =>
    list.map(([x, y, z]) => at(x, y, z).map(f).join(',')).join(' ');
  const poly = (cls: string, list: [number, number, number][]) =>
    `<polygon class="${cls}" points="${points(list)}"/>`;
  /** A box in three tones: n neutral, l lit, a accent, w glass (translucent accent), g ghost (dashed outline only). */
  const prism = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, tone: Tone) =>
    `<g class="${tone}">${poly('e', [
      [x0, y0, z0],
      [x0, y1, z0],
      [x0, y1, z1],
      [x0, y0, z1],
    ])}${poly('f', [
      [x0, y1, z0],
      [x1, y1, z0],
      [x1, y1, z1],
      [x0, y1, z1],
    ])}${poly('t', [
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
    ])}</g>`;
  /** A short cylinder, drawn upright: an ellipse top over a body, in the same three-tone family. */
  const puck = (cx: number, cy: number, r: number, h: number, tone: Tone) =>
    `<g class="${tone}"><path class="f" d="M${f(cx - r)} ${f(cy - h)}v${h}a${r} ${f(r / 2)} 0 0 0 ${2 * r} 0v${-h}z"/><ellipse class="t" cx="${f(cx)}" cy="${f(cy - h)}" rx="${r}" ry="${f(r / 2)}"/></g>`;
  return { at, points, poly, prism, puck };
}
