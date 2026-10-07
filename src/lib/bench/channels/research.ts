import { add } from '../engine';
import { NAMES, fmt, merge } from '../research';

const bench = document.querySelector<HTMLElement>('.bench')!;
const stage = bench.querySelector<HTMLElement>('.research-stage')!;
const alpha = stage.querySelector<HTMLInputElement>('[data-research-alpha]')!;
const alphaValue = stage.querySelector<HTMLElement>('[data-research-alpha-value]')!;
const masks = [...stage.querySelectorAll<HTMLInputElement>('[data-research-mask]')];
const merged = [...stage.querySelectorAll<HTMLElement>('[data-research-merged]')];
const liveRegion = bench.querySelector<HTMLElement>('[data-bench-live]')!;
let timer: number | undefined;
let lastTitle = '';

function render() {
  const a = Number(alpha.value);
  const mask = masks.map((box) => box.checked);
  const out = merge(a, mask);
  alphaValue.textContent = a.toFixed(2);
  merged.forEach((cell, i) => {
    cell.textContent = fmt(out[i]!);
    cell.closest('.research-tr')!.classList.toggle('is-off', !mask[i]);
  });
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    const count = mask.filter(Boolean).length;
    const title = `Synthetic merge at ${a.toFixed(2)}`;
    const detail = `${count} of ${NAMES.length} weights merged`;
    if (`${title}|${detail}` === lastTitle) return;
    lastTitle = `${title}|${detail}`;
    add({ channel: 'research', title, detail, provenance: 'model' });
    liveRegion.textContent = `${title}, ${detail}`;
  }, 800);
}
alpha.addEventListener('input', render);
masks.forEach((box) => box.addEventListener('change', render));
