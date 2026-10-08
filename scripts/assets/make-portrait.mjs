// Usage: node scripts/assets/make-portrait.mjs <source-photo> <output.webp> [size=956] [line-pitch=6.8]
// Turns the CV portrait (239 px, circular, greyscale) into a fine line engraving that suits the site:
// 4x Lanczos upscale, gentle smoothing, then horizontal lines whose thickness follows brightness, drawn in the
// site's warm off-white on transparency, over a faint accent-tinted tone layer for depth. Output: WebP with alpha.
import sharp from 'sharp';

const src = process.argv[2];
const out = process.argv[3];
const OUT = Number(process.argv[4] ?? 956); // output size in px (render at the size it will be shown, at 2x)
const PERIOD = Number(process.argv[5] ?? 6.8); // line pitch in output pixels
const base = sharp(src).ensureAlpha();
const W = OUT;
const H = OUT;

const grey = await base
  .clone()
  .flatten({ background: '#000' })
  .greyscale()
  .resize(W, H, { kernel: 'lanczos3' })
  .blur(1.6)
  .normalise({ lower: 3, upper: 99 })
  .raw()
  .toBuffer();
const alpha = await base.clone().extractChannel(3).resize(W, H, { kernel: 'lanczos3' }).raw().toBuffer();

const lum = (x, y) => grey[Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))] / 255;
const curve = (l) => Math.pow(Math.min(1, Math.max(0, (l - 0.1) / 0.78)), 0.95);
const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const rgba = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  const band = Math.floor(y / PERIOD);
  const yc = (band + 0.5) * PERIOD;
  const dy = Math.abs(y - yc);
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const a = alpha[i] / 255;
    if (a === 0) continue;
    // Brightness of the band at this column (sampled on the line's centre row, averaged a little).
    // Subject weight: lines are strongest on the head and shoulders and fall away on the busy wall behind.
    const ex = (x / W - 0.5) / 0.3;
    const ey = (y / H - 0.47) / 0.5;
    const subject = smooth(1.15, 0.55, Math.hypot(ex, ey));
    const l =
      curve((lum(x, Math.round(yc)) * 2 + lum(x - 2, Math.round(yc)) + lum(x + 2, Math.round(yc))) / 4) *
      (0.14 + 0.86 * subject);
    const half = (PERIOD / 2) * Math.pow(l, 1.05) * 0.9;
    const line = half > 0.15 ? smooth(half + 0.9, half - 0.9, dy) : 0;
    const tone = curve(lum(x, y)) * 0.15 * (0.3 + 0.7 * subject);
    // Lines in warm off-white; tone layer in the site accent.
    const la = line;
    const ta = tone * (1 - la);
    const alphaOut = Math.min(1, la + ta) * a;
    if (alphaOut <= 0) continue;
    const r = (236 * la + 156 * ta) / (la + ta);
    const g = (233 * la + 169 * ta) / (la + ta);
    const b = (225 * la + 255 * ta) / (la + ta);
    const o = i * 4;
    rgba[o] = r;
    rgba[o + 1] = g;
    rgba[o + 2] = b;
    rgba[o + 3] = Math.round(alphaOut * 255);
  }
}
await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
  .webp({ quality: 88, alphaQuality: 92, effort: 5 })
  .toFile(out);
console.log('wrote', out, W + 'x' + H);
