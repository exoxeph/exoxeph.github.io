export type Seg = { s: number; n: number; label: string; kind?: 'ok' | 'bad' | 'ghost' };
export const bar = (segs: Seg[], note?: string) => {
  const cells = segs
    .map((g) => `<i class="sbar-seg ${g.kind ?? 'ok'}" style="--s:${g.s};--n:${g.n}"><b>${g.label}</b></i>`)
    .join('');
  const ticks = [0, 1, 2, 3, 4, 5, 6].map((n) => `<span style="--s:${n}">${n}</span>`).join('');
  return `<div class="sbar"><div class="sbar-track">${cells}<i class="sbar-wall" style="--at:3"><b>capacity 3</b></i></div><div class="sbar-ticks">${ticks}</div>${note ? `<p class="sbar-note">${note}</p>` : ''}</div>`;
};
