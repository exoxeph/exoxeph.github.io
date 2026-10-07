import { committedSeats, evaluateAccept, type State } from './tesla';

type Frame = {
  state: State;
  seats: number;
  decision: 200 | 409;
  lastBefore: number;
  lastSeats: number;
  stale: boolean;
  limit: boolean;
  simultaneous: boolean;
  noGuard?: boolean;
  selected: string | null;
};
const escape = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');

/**
 * The server-rendered stage is shown before (and without) the controller, so its controls must not claim to work:
 * strip the button and slider semantics, focusability and value attributes from them. The controller renders the
 * interactive version over it as soon as it loads.
 */
export const staticControls = (html: string): string =>
  html.replace(/<g\b[^>]*\brole="(?:button|slider)"[^>]*>/g, (tag) =>
    tag.replace(/\s(?:role|tabindex|aria-[a-z]+)="[^"]*"/g, ''),
  );

export function renderTesla(frame: Frame, mobile: boolean): string {
  const { state, seats, decision, lastBefore, lastSeats, stale, limit, selected } = frame;
  const noGuard = frame.noGuard ?? false;
  const simultaneous = frame.simultaneous || noGuard;
  const U = mobile ? 48 : 110,
    x0 = mobile ? 36 : 70,
    wall = x0 + 3 * U;
  const base = mobile ? 262 : 320,
    top = mobile ? 180 : 190,
    height = mobile ? 82 : 130;
  const domain = x0 + 6 * U,
    committed = committedSeats(state);
  const overCapacity = simultaneous && committed > state.capacity;
  const pending = evaluateAccept(state, seats);
  const refused = 'decision' in pending && pending.decision === 'refused';
  const active = state.pools.filter((pool) => pool.status === 'OPEN');
  let cursor = x0;
  const blocks = active
    .map((pool) => {
      const x = cursor,
        width = pool.seats * U;
      cursor += width;
      const cx = x + width / 2;
      const overflowX = Math.max(x, wall);
      const normalWidth = Math.max(0, Math.min(x + width, wall) - x);
      const overflowWidth = Math.max(0, x + width - overflowX);
      const surface = overCapacity
        ? `${normalWidth ? `<rect class="surf" x="${x}" y="${top}" width="${normalWidth}" height="${height}"/>` : ''}${overflowWidth ? `<rect class="surf over" x="${overflowX}" y="${top}" width="${overflowWidth}" height="${height}"/>` : ''}`
        : `<rect class="surf" x="${x}" y="${top}" width="${width}" height="${height}"/>`;
      const dividers = Array.from(
        { length: pool.seats - 1 },
        (_, i) => `<path class="hair" d="M${x + (i + 1) * U} ${top}V${base}" style="opacity:.25"/>`,
      ).join('');
      const cancelled = pool.riderCancelled
        ? `<path d="M${x + 10} ${top + 10}L${x + width - 10} ${base - 10}" stroke="var(--invalid)" stroke-width="2"/><text x="${cx}" y="${base - 12}" class="tin" text-anchor="middle">cancelled</text>`
        : '';
      return `<g data-pool="${pool.id}" role="button" tabindex="0" aria-label="Pool ${pool.id}, ${pool.seats} ${pool.seats === 1 ? 'seat' : 'seats'}${pool.riderCancelled ? ', rider cancelled' : ''}" class="${selected === pool.id ? 'selected-pool' : ''}">
      ${surface}${dividers}
      <text x="${cx}" y="${top + (mobile ? 48 : 72)}" text-anchor="middle" class="hi pool-letter" style="font:500 ${mobile ? 20 : 26}px var(--mono)">${pool.id}</text>
      ${cancelled}<rect class="hit" x="${x}" y="${top}" width="${Math.max(width, 44)}" height="${height}"/>
    </g>`;
    })
    .join('');
  const pendingX = x0 + committed * U,
    pendingWidth = Math.max(0, Math.min(seats * U, domain - pendingX));
  const pendingCenter = pendingX + pendingWidth / 2;
  const pendingBlock = simultaneous
    ? ''
    : `<g data-pending class="${refused ? 'refused' : 'accepted'}">
    <rect class="pending" x="${pendingX}" y="${top}" width="${pendingWidth}" height="${height}"/>
    ${pendingWidth < seats * U ? `<path class="notch" d="M${domain - 7} ${top}l7 7 -7 7"/>` : ''}
    <text x="${pendingCenter}" y="${top + (mobile ? 42 : 65)}" text-anchor="middle" class="pending-letter" style="font:500 ${mobile ? 20 : 26}px var(--mono)">${String.fromCharCode(65 + Math.min(state.nextLetter, 25))}</text>
    <text x="${pendingCenter}" y="${top + (mobile ? 58 : 85)}" text-anchor="middle" class="pending-label">${pendingWidth < 70 ? seats : `${seats} ${seats === 1 ? 'seat' : 'seats'}`}</text>
  </g>`;
  const handleX = Math.min(domain - 12, pendingX + pendingWidth - (mobile ? 6 : 8));
  const handle = simultaneous
    ? ''
    : `<g role="slider" tabindex="0" data-handle aria-label="Requested seats" aria-valuemin="1" aria-valuemax="6" aria-valuenow="${seats}" aria-valuetext="${seats} ${seats === 1 ? 'seat' : 'seats'}, would be ${refused ? 'refused' : 'accepted'}">
    <rect class="grip" x="${handleX}" y="${top + (height - (mobile ? 46 : 66)) / 2}" width="${mobile ? 14 : 18}" height="${mobile ? 46 : 66}"/>
    <path class="grip-lines" d="M${handleX + 6} ${top + 28}v${mobile ? 26 : 38}M${handleX + 12} ${top + 28}v${mobile ? 26 : 38}"/>
    <rect class="hit" x="${handleX - 18}" y="${top + (height - 52) / 2}" width="52" height="52"/>
  </g>`;
  const sendX = Math.min(domain - 16, handleX + (mobile ? 37 : 60));
  const send = simultaneous
    ? ''
    : `<g role="button" tabindex="0" data-send aria-label="Send request"><circle cx="${sendX}" cy="${top + height / 2}" r="${mobile ? 16 : 19}" class="send-circle"/><path d="M${sendX - 8} ${top + height / 2}h16m-7 -7 7 7 -7 7" class="send-arrow"/><text x="${sendX}" y="${top + height / 2 + (mobile ? 32 : 37)}" text-anchor="middle">send</text><circle class="hit" cx="${sendX}" cy="${top + height / 2}" r="26"/></g>`;
  const ruler =
    Array.from(
      { length: 7 },
      (_, i) =>
        `<path class="ln" d="M${x0 + i * U} ${base}v${mobile ? 10 : 12}"/><text x="${x0 + i * U}" y="${mobile ? 288 : 352}" text-anchor="middle" class="${overCapacity && i >= state.capacity ? 'tin' : ''}" style="font-size:${mobile ? 10.5 : 11.5}px">${i}</text>`,
    ).join('') +
    Array.from({ length: 6 }, (_, i) => `<path class="mu" d="M${x0 + (i + 0.5) * U} ${base}v6"/>`).join('');
  const hair = Array.from(
    { length: 7 },
    (_, i) => `<path class="hair" d="M${x0 + i * U} ${mobile ? 88 : 70}V${base}"/>`,
  ).join('');
  const code = overCapacity ? `${committed} of ${state.capacity}` : String(decision),
    word = overCapacity
      ? noGuard
        ? 'no guard'
        : 'over capacity'
      : decision === 409
        ? 'refused'
        : 'accepted';
  const equation = noGuard
    ? mobile
      ? 'before the guard commit'
      : 'recorded before the guard commit'
    : simultaneous
      ? 'both read 1 of 3'
      : decision === 409
        ? `${lastBefore} + ${lastSeats} > 3`
        : `${lastBefore} + ${lastSeats} ≤ 3`;
  const note = !overCapacity
    ? ''
    : mobile
      ? `<text class="annotation" x="170" y="391">${noGuard ? 'Only each pool was checked.' : 'Both passed the same check.'}</text>`
      : noGuard
        ? `<text class="annotation" x="${wall + 222}" y="178">Only each pool was checked,</text><text class="annotation" x="${wall + 222}" y="196">not the whole vehicle.</text>`
        : `<text class="annotation" x="${wall + 222}" y="178">Check and write are separate steps,</text><text class="annotation" x="${wall + 222}" y="196">so two requests pass the same check.</text>`;
  const preview =
    stale && !simultaneous
      ? `<text class="preview" x="${mobile ? 170 : wall + 220}" y="${mobile ? 398 : 174}">if sent: would be ${refused ? 'refused' : 'accepted'}</text>`
      : '';
  const readout = mobile
    ? `<g class="readout ${stale ? 'stale' : ''}"><text x="34" y="384" class="code ${overCapacity ? 'over-code' : ''} ${overCapacity || decision === 409 ? 'tin' : 'hi'}">${code}</text><text x="170" y="358" class="word">${word}</text><text x="170" y="380" class="equation">${escape(equation)}</text></g>${preview}`
    : `<g class="readout ${stale ? 'stale' : ''}"><text x="${wall + 24}" y="158" class="code ${overCapacity ? 'over-code' : ''} ${overCapacity || decision === 409 ? 'tin' : 'hi'}">${code}</text><text x="${wall + 220}" y="124" class="word">${word}</text><text x="${wall + 222}" y="150" class="equation">${escape(equation)}</text></g>${preview}`;
  const controls =
    selected && !simultaneous
      ? (() => {
          const pool = active.find((item) => item.id === selected);
          if (!pool) return '';
          const before = active.slice(0, active.indexOf(pool)).reduce((sum, item) => sum + item.seats, 0);
          const x = Math.min(x0 + before * U, domain - 170);
          return `<g class="pool-actions"><foreignObject x="${x}" y="${top - 62}" width="180" height="54"><div xmlns="http://www.w3.org/1999/xhtml"><button type="button" data-complete="${selected}">complete</button><button type="button" data-cancel="${selected}">cancel rider</button></div></foreignObject></g>`;
        })()
      : '';
  return `<svg class="${mobile ? 'm' : 'd'}" viewBox="0 0 ${mobile ? 360 : 900} 400" role="group" aria-label="Ride pooling capacity guard: ${committed} of 3 seats committed, ${code} ${word}">
    <rect x="${wall}" y="${mobile ? 88 : 70}" width="${domain - wall}" height="${base - (mobile ? 88 : 70)}" fill="url(#bench-hatch-soft)"/>
    ${hair}<path class="ln" d="M${x0} ${base}H${domain}"/>${ruler}${blocks}${pendingBlock}${handle}${send}
    ${overCapacity ? `<path class="ac wall" d="M${wall} ${mobile ? 60 : 36}V${top}" style="stroke-width:${mobile ? 3.5 : 4}"/><path class="wall-breach" d="M${wall} ${top}V${base}"/>` : `<path class="ac wall" d="M${wall} ${mobile ? 60 : 36}V${base}" style="stroke-width:${mobile ? 3.5 : 4}"/>`}
    <g role="button" tabindex="0" data-guard aria-label="Inspect the capacity guard"><circle cx="${wall}" cy="${mobile ? 60 : 36}" r="${mobile ? 10 : 11}" class="acf"/><circle cx="${wall}" cy="${mobile ? 60 : 36}" r="18" class="wall-ring"/><circle class="hit" cx="${wall}" cy="${mobile ? 60 : 36}" r="26"/></g>
    <text x="${wall + (mobile ? 18 : 24)}" y="${mobile ? 64 : 41}" class="tac capacity">capacity 3</text>
    ${limit ? `<path d="M${wall + 24} ${mobile ? 74 : 54}l5 5 -5 5 -5 -5Z" fill="var(--accent)"/><text x="${wall + 36}" y="${mobile ? 83 : 63}" class="tac limit-found">limit found</text>` : ''}
    <text x="${x0}" y="${mobile ? 316 : 384}" class="committed">committed ${committed} of 3</text>${readout}${note}${controls}
  </svg>`;
}
