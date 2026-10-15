import { camera } from './iso';
import { DEFAULT_CONFIG, finalDecision } from './rag';

export const recorded = [
  { id: 'q1', query: 'What is transfer learning?', score: 0.82, accepted: true, repaired: false },
  {
    id: 'q5',
    query: 'Summarize the key concepts in neural network training',
    score: 0.72,
    accepted: true,
    repaired: false,
  },
  { id: 'q3', query: 'Compare CNNs and Transformers', score: 0.67, accepted: false, repaired: true },
  {
    id: 'q4',
    query: 'How do I fine-tune a pretrained model?',
    score: 0.655,
    accepted: false,
    repaired: true,
  },
] as const;
export type RagFrame = {
  mode: 'replay' | 'live';
  chip: string;
  draft: number;
  threshold: number;
  after: number;
  limit: boolean;
};
export const defaultRagFrame: RagFrame = {
  mode: 'replay',
  chip: 'q3',
  draft: 0.67,
  threshold: 0.72,
  after: 0.67,
  limit: false,
};
const fmt = (n: number) => n.toFixed(2);
const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// The scale runs along world x (0 to 1 is 0 to L), depth is y and height is z. One camera per layout.
const L = 100;
const LAYOUT = {
  desktop: {
    cam: { ox: 95, oy: 214, s: 6.2, az: -18 },
    depth: 20,
    wallH: 14,
    lift: 6,
    post: [8, 5],
    width: 800,
  },
  mobile: {
    cam: { ox: 18, oy: 152, s: 3.2, az: -18 },
    depth: 18,
    wallH: 14,
    lift: 6,
    post: [8, 5],
    width: 360,
  },
} as const;

/** Where the scale sits on screen (viewBox units), so a pointer's x can be turned back into a value. */
export function ragAxis(mobile = false) {
  const { cam, depth, width } = LAYOUT[mobile ? 'mobile' : 'desktop'];
  const { at } = camera(cam);
  const x0 = at(0, depth / 2)[0];
  return { x0, span: at(L, depth / 2)[0] - x0, width };
}

export function renderRag(frame: RagFrame, mobile = false) {
  const item = recorded.find((row) => row.id === frame.chip) ?? recorded[2];
  const live = frame.mode === 'live';
  const outcome = live
    ? finalDecision(frame.draft, frame.after, { ...DEFAULT_CONFIG, acceptThreshold: frame.threshold })
    : { repaired: item.repaired, finalScore: item.score, accepted: item.accepted };
  const score = outcome.finalScore;
  const wall = frame.threshold;
  const layout = LAYOUT[mobile ? 'mobile' : 'desktop'];
  const { at, points, prism, puck } = camera(layout.cam);
  const D = layout.depth;
  const mid = D / 2;
  const vx = (n: number) => n * L;
  const xy = (x: number, y: number, z = 0): [number, number] => {
    const [px, py] = at(x, y, z);
    return [+px.toFixed(1), +py.toFixed(1)];
  };
  const seg = (a: [number, number, number], b: [number, number, number]) =>
    `M${xy(...a).join(' ')}L${xy(...b).join(' ')}`;
  const hatchId = `rag-hatch-${mobile ? 'm' : 'd'}`;
  // the plate, the zone under the requirement, faint cross lines and the ruler hanging from the front edge
  const plate = prism(-3, 0, -3, L + 3, D, 0, 'n');
  const zone = `<polygon points="${points([
    [0, 0, 0],
    [vx(wall), 0, 0],
    [vx(wall), D, 0],
    [0, D, 0],
  ])}" fill="url(#${hatchId})"/>`;
  const hair = Array.from(
    { length: 11 },
    (_, i) => `<path d="${seg([vx(i / 10), 0, 0], [vx(i / 10), D, 0])}" stroke="var(--text)" opacity=".1"/>`,
  ).join('');
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const [tx, ty] = xy(vx(i / 10), D, -3);
    return `<path d="${seg([vx(i / 10), D, 0], [vx(i / 10), D, -3])}" stroke="var(--text)" stroke-width="1.2"/><text x="${tx}" y="${+(ty + (mobile ? 12 : 14)).toFixed(1)}" text-anchor="middle" class="rag-tick">${i === 0 ? '0' : i === 10 ? '1.0' : '.' + i}</text>`;
  }).join('');
  const needle = (value: number, kind: 'draft' | 'after') => {
    const x = vx(value);
    const ghost = kind === 'after';
    const h = layout.post[ghost ? 1 : 0];
    const top = h + 3;
    // The repair ghost gets its own lane at the back, so it never crowds the draft needle or the wall.
    const lane = ghost ? 5 : D - 5;
    const label = ghost ? 'Score after repair' : live ? 'Draft verify score' : 'Recorded final score';
    const text = `${fmt(value)}, ${value < wall ? 'below the threshold, repair would run' : 'at or above the threshold, accepted'}`;
    const [gx, gy] = xy(x, lane, top);
    const grooves = [-1.5, 1.5]
      .map(
        (dx) =>
          `<path d="${seg([x + dx, lane + 4.5, h + 0.8], [x + dx, lane + 4.5, top - 0.8])}" stroke="${ghost ? 'var(--accent)' : 'var(--text)'}"/>`,
      )
      .join('');
    return `<g class="rag-needle ${kind}" data-rag-slider="${kind}" role="slider" tabindex="0" aria-label="${label}" aria-valuemin="0" aria-valuemax="1" aria-valuenow="${value}" aria-valuetext="${text}">
      ${prism(x - 2, lane - 2, 0, x + 2, lane + 2, h, ghost ? 'g' : 'l')}${prism(x - 3.5, lane - 4.5, h, x + 3.5, lane + 4.5, top, ghost ? 'g' : 'n')}${grooves}
      <rect x="${+(gx - 28).toFixed(1)}" y="${+(gy - 28).toFixed(1)}" width="56" height="56" fill="transparent" class="rag-hit"/>
    </g>`;
  };
  const wx = vx(wall);
  const head = xy(wx, mid, layout.wallH + layout.lift);
  const threshold = `<g data-rag-slider="threshold" role="slider" tabindex="0" aria-label="Acceptance threshold" aria-valuemin="0.05" aria-valuemax="0.95" aria-valuenow="${wall}" aria-valuetext="${fmt(wall)} acceptance threshold">
    ${prism(wx - 1.2, 0, 0, wx + 1.2, D, layout.wallH, 'w')}
    <path d="${seg([wx, mid, layout.wallH], [wx, mid, layout.wallH + layout.lift])}" stroke="var(--accent)" stroke-width="3"/>
    <circle cx="${head[0]}" cy="${head[1]}" r="11" fill="var(--accent)"/>
    <circle cx="${head[0]}" cy="${head[1]}" r="18" fill="none" stroke="var(--accent)" opacity=".5"/>
    <circle cx="${head[0]}" cy="${head[1]}" r="28" fill="transparent" class="rag-hit"/>
  </g>`;
  // Further along x is further from the viewer, so it is drawn first.
  const things = [
    { x: wx, svg: threshold },
    { x: vx(frame.draft), svg: needle(frame.draft, 'draft') },
    ...(live && outcome.repaired ? [{ x: vx(frame.after), svg: needle(frame.after, 'after') }] : []),
  ]
    .sort((a, b) => b.x - a.x)
    .map((thing) => thing.svg)
    .join('');
  // The phrase is the meaning; the number and the equation beside it are the evidence.
  const readWord = outcome.accepted
    ? outcome.repaired
      ? 'good enough after a retry'
      : 'good enough'
    : outcome.repaired
      ? 'still below the requirement'
      : 'below the requirement';
  const equation = live
    ? outcome.repaired
      ? `${fmt(frame.draft)}, then ${fmt(frame.after)} ${outcome.accepted ? '≥' : '<'} ${fmt(wall)}`
      : `${fmt(frame.draft)} ≥ ${fmt(wall)}`
    : `${fmt(score)} ${outcome.accepted ? '≥' : '<'} ${fmt(wall)}${outcome.repaired ? ', after one repair' : ''}`;
  const repairColor = outcome.repaired ? 'var(--accent)' : 'var(--muted)';
  const repairOpacity = outcome.repaired ? '1' : '.4';
  // Plain words on the stage; the engineering names (retrieve, rerank, prune, contextualize, generate, verify and the
  // repair weights) live in the deck's engineering route and the inspector.
  const stages = ['find sources', 'rank them', 'trim', 'set context', 'write draft', 'check quality'];
  const last = stages.length - 1;
  const route = mobile
    ? stages
        .map(
          (name, i) =>
            `<g>${puck(36, 297 + i * 17, i === last ? 6 : 4, i === last ? 4 : 3, i === last ? 'a' : 'n')}<text x="50" y="${299 + i * 17}" class="rag-route-label">${name}</text></g>`,
        )
        .join('') +
      `<g opacity="${repairOpacity}">${puck(190, 382, 6, 3, 'g')}<text x="202" y="384" fill="${repairColor}" class="rag-route-label">one retry</text></g>`
    : stages
        .map(
          (name, i) =>
            `<g>${puck(70 + i * 120, 322, i === last ? 11 : 8, i === last ? 7 : 5, i === last ? 'a' : 'n')}<text x="${70 + i * 120}" y="346" text-anchor="middle" class="rag-route-label">${name}</text>${i < 5 ? `<path d="M${84 + i * 120} 319H${56 + (i + 1) * 120}" stroke="var(--muted)"/>` : ''}</g>`,
        )
        .join('') +
      `<g opacity="${repairOpacity}"><path d="M690 319H744" stroke="${repairColor}" stroke-width="2"/>${puck(760, 322, 8, 4, 'g')}<text x="760" y="346" text-anchor="middle" fill="${repairColor}" class="rag-route-label">one retry</text></g>`;
  const repairCopy = outcome.repaired
    ? mobile
      ? `<text x="24" y="406" class="rag-repair-copy">one retry: more weight on exact keywords,</text><text x="24" y="418" class="rag-repair-copy">stricter trimming, a tighter template</text>`
      : `<text x="60" y="372" class="rag-repair-copy">one retry: more weight on exact keyword matches, stricter trimming,</text><text x="60" y="390" class="rag-repair-copy">a tighter answer template and less randomness, then check again</text>`
    : '';
  const readout = mobile
    ? `<text x="30" y="260" class="rag-score ${outcome.accepted ? 'accepted' : ''}">${fmt(score)}</text><text x="145" y="248" class="rag-word mobile-word">${readWord}</text><text x="145" y="268" class="rag-equation">${esc(equation)}</text><text x="24" y="286" class="rag-route-title">steps</text>`
    : `<text x="70" y="112" class="rag-score ${outcome.accepted ? 'accepted' : ''}">${fmt(score)}</text><text x="74" y="146" class="rag-word">${readWord}</text><text x="76" y="168" class="rag-equation">${esc(equation)}</text><text x="60" y="300" class="rag-route-title">steps</text>`;
  const query = live
    ? ''
    : `<text x="${mobile ? 24 : 72}" y="${mobile ? 24 : 36}" class="rag-query">recorded run, query ${item.id}: ${esc(item.query)}</text>`;
  const marker = frame.limit
    ? `<text x="${mobile ? 230 : Math.min(720, head[0] + 24)}" y="${mobile ? 52 : Math.max(24, head[1] + 18)}" class="rag-limit">◆ limit found</text>`
    : '';
  return `<svg class="rag-svg ${mobile ? 'mobile' : 'desktop'}" viewBox="0 0 ${mobile ? '360 420' : '800 400'}" role="group" aria-label="Retrieval verify score against the acceptance threshold">
    <defs><pattern id="${hatchId}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V7" stroke="var(--partial)" stroke-width="1.5" opacity=".28"/></pattern></defs>
    ${plate}${zone}${hair}${ticks}
    <text x="${mobile && wall > 0.4 ? head[0] - 15 : Math.min(head[0] + (mobile ? 15 : 24), mobile ? 265 : 680)}" y="${head[1] + 4}" text-anchor="${mobile && wall > 0.4 ? 'end' : 'start'}" class="rag-threshold">required quality ${fmt(wall)}</text>${marker}
    ${query}${things}${readout}${route}${repairCopy}
  </svg>`;
}
