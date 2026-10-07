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

export function renderRag(frame: RagFrame, mobile = false) {
  const item = recorded.find((row) => row.id === frame.chip) ?? recorded[2];
  const live = frame.mode === 'live';
  const outcome = live
    ? finalDecision(frame.draft, frame.after, { ...DEFAULT_CONFIG, acceptThreshold: frame.threshold })
    : { repaired: item.repaired, finalScore: item.score, accepted: item.accepted };
  const score = outcome.finalScore;
  const wall = frame.threshold;
  const x0 = mobile ? 24 : 60;
  const span = mobile ? 312 : 680;
  const xx = (n: number) => x0 + n * span;
  const base = mobile ? 182 : 230;
  const hatchTop = mobile ? 58 : 70;
  const tickText = mobile ? 211 : 262;
  const ticks = Array.from(
    { length: 11 },
    (_, i) =>
      `<path d="M${xx(i / 10)} ${base}v10" stroke="var(--text)" stroke-width="1.2"/><text x="${xx(i / 10)}" y="${tickText}" text-anchor="middle" class="rag-tick">${i === 0 ? '0' : i === 10 ? '1.0' : '.' + i}</text>`,
  ).join('');
  const hair = Array.from(
    { length: 11 },
    (_, i) => `<path d="M${xx(i / 10)} ${hatchTop}V${base}" stroke="var(--text)" opacity=".07"/>`,
  ).join('');
  const needle = (value: number, kind: 'draft' | 'after') => {
    const x = xx(value);
    const top = kind === 'after' ? (mobile ? 112 : 142) : mobile ? 78 : 104;
    const grip = top - 20;
    const label =
      kind === 'after' ? 'Score after repair' : live ? 'Draft verify score' : 'Recorded final score';
    const text = `${fmt(value)}, ${value < wall ? 'below the threshold, repair would run' : 'at or above the threshold, accepted'}`;
    return `<g class="rag-needle ${kind}" data-rag-slider="${kind}" role="slider" tabindex="0" aria-label="${label}" aria-valuemin="0" aria-valuemax="1" aria-valuenow="${value}" aria-valuetext="${text}">
      <rect x="${x - 7}" y="${top}" width="14" height="${base - top}" fill="${kind === 'after' ? 'none' : 'var(--text)'}" stroke="${kind === 'after' ? 'var(--accent)' : 'none'}" stroke-dasharray="${kind === 'after' ? '4 3' : 'none'}"/>
      <rect x="${x - 15}" y="${grip}" width="30" height="24" fill="var(--surface)" stroke="${kind === 'after' ? 'var(--accent)' : 'var(--text)'}" stroke-width="1.5"/>
      <path d="M${x - 4} ${grip + 6}v12M${x + 4} ${grip + 6}v12" stroke="${kind === 'after' ? 'var(--accent)' : 'var(--text)'}"/>
      <rect x="${x - 28}" y="${grip - 16}" width="56" height="56" fill="transparent" class="rag-hit"/>
    </g>`;
  };
  const threshold = `<g data-rag-slider="threshold" role="slider" tabindex="0" aria-label="Acceptance threshold" aria-valuemin="0.05" aria-valuemax="0.95" aria-valuenow="${wall}" aria-valuetext="${fmt(wall)} acceptance threshold">
    <path d="M${xx(wall)} ${mobile ? 28 : 36}V${base}" stroke="var(--accent)" stroke-width="4"/>
    <circle cx="${xx(wall)}" cy="${mobile ? 28 : 36}" r="11" fill="var(--accent)"/>
    <circle cx="${xx(wall)}" cy="${mobile ? 28 : 36}" r="18" fill="none" stroke="var(--accent)" opacity=".5"/>
    <circle cx="${xx(wall)}" cy="${mobile ? 28 : 36}" r="28" fill="transparent" class="rag-hit"/>
  </g>`;
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
            `<g><circle cx="36" cy="${295 + i * 17}" r="${i === last ? 5 : 3}" fill="${i === last ? 'var(--accent)' : 'none'}" stroke="${i === last ? 'var(--accent)' : 'var(--text)'}"/><text x="50" y="${299 + i * 17}" class="rag-route-label">${name}</text></g>`,
        )
        .join('') +
      `<g opacity="${repairOpacity}"><circle cx="190" cy="380" r="5" fill="none" stroke="${repairColor}"/><text x="202" y="384" fill="${repairColor}" class="rag-route-label">one retry</text></g>`
    : stages
        .map(
          (name, i) =>
            `<g><circle cx="${70 + i * 120}" cy="318" r="${i === last ? 8 : 5}" fill="${i === last ? 'var(--accent)' : 'none'}" stroke="${i === last ? 'var(--accent)' : 'var(--text)'}" stroke-width="1.5"/><text x="${70 + i * 120}" y="342" text-anchor="middle" class="rag-route-label">${name}</text>${i < 5 ? `<path d="M${78 + i * 120} 318H${62 + (i + 1) * 120}" stroke="var(--muted)"/>` : ''}</g>`,
        )
        .join('') +
      `<g opacity="${repairOpacity}"><path d="M678 318H748" stroke="${repairColor}" stroke-width="2"/><circle cx="760" cy="318" r="5" fill="none" stroke="${repairColor}"/><text x="760" y="342" text-anchor="middle" fill="${repairColor}" class="rag-route-label">one retry</text></g>`;
  const repairCopy = outcome.repaired
    ? mobile
      ? `<text x="24" y="406" class="rag-repair-copy">one retry: more weight on exact keywords,</text><text x="24" y="418" class="rag-repair-copy">stricter trimming, a tighter template</text>`
      : `<text x="60" y="372" class="rag-repair-copy">one retry: more weight on exact keyword matches, stricter trimming,</text><text x="60" y="390" class="rag-repair-copy">a tighter answer template and less randomness, then check again</text>`
    : '';
  const readout = mobile
    ? `<text x="30" y="260" class="rag-score ${outcome.accepted ? 'accepted' : ''}">${fmt(score)}</text><text x="145" y="248" class="rag-word mobile-word">${readWord}</text><text x="145" y="268" class="rag-equation">${esc(equation)}</text><text x="24" y="286" class="rag-route-title">steps</text>`
    : `<text x="86" y="162" class="rag-score ${outcome.accepted ? 'accepted' : ''}">${fmt(score)}</text><text x="90" y="196" class="rag-word">${readWord}</text><text x="92" y="220" class="rag-equation">${esc(equation)}</text><text x="60" y="292" class="rag-route-title">steps</text>`;
  const query = live
    ? ''
    : `<text x="${mobile ? 24 : 86}" y="${mobile ? 65 : 58}" class="rag-query">recorded run, query ${item.id}: ${esc(item.query)}</text>`;
  const marker = frame.limit
    ? `<text x="${mobile ? 230 : Math.min(720, xx(wall) + 24)}" y="${mobile ? 52 : 60}" class="rag-limit">◆ limit found</text>`
    : '';
  return `<svg class="rag-svg ${mobile ? 'mobile' : 'desktop'}" viewBox="0 0 ${mobile ? '360 420' : '800 400'}" role="group" aria-label="Retrieval verify score against the acceptance threshold">
    <defs><pattern id="rag-hatch-${mobile ? 'm' : 'd'}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V7" stroke="var(--partial)" stroke-width="1.5" opacity=".16"/></pattern></defs>
    <rect x="${x0}" y="${hatchTop}" width="${xx(wall) - x0}" height="${base - hatchTop}" fill="url(#rag-hatch-${mobile ? 'm' : 'd'})"/>${hair}
    <path d="M${x0} ${base}H${xx(1)}" stroke="var(--text)" stroke-width="1.5"/>${ticks}${threshold}
    <text x="${mobile && wall > 0.4 ? xx(wall) - 15 : Math.min(xx(wall) + (mobile ? 15 : 24), mobile ? 265 : 680)}" y="${mobile ? 31 : 41}" text-anchor="${mobile && wall > 0.4 ? 'end' : 'start'}" class="rag-threshold">required quality ${fmt(wall)}</text>${marker}
    ${query}${needle(frame.draft, 'draft')}${live && outcome.repaired ? needle(frame.after, 'after') : ''}${readout}${route}${repairCopy}
  </svg>`;
}
