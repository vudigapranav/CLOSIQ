/**
 * Generates every CLOSIQ app icon from the OFFICIAL logo
 * public/brand/closiq-logo.png — the brain-Q mark (the user's choice on
 * 2026-11-01, replacing the "Spark hanger" symbol of 2026-10-14).
 *
 *   node scripts/generate-app-icons.mjs
 *
 * The wide wordmark can't be an app icon (Apple/Google need a square), so the
 * icon is the Q with the brain inside, CROPPED from that same artwork — never
 * redrawn. The mark is flat two-tone, so it enlarges cleanly: its ink
 * coverage is upsampled and the edge re-sharpened with a smoothstep, giving
 * crisp anti-aliased edges at 1024 px without changing the shape.
 *
 * Writes:
 *   mobile/assets/app-icon.png                  1024, opaque ivory tile (iOS + Expo icon)
 *   mobile/assets/adaptive-icon-foreground.png  1024, transparent, mark in the safe zone (Android)
 *   mobile/assets/adaptive-icon-monochrome.png  1024, white mark (Android 13 themed icons)
 *   public/apple-touch-icon.png                 180  (iPhone "Add to Home Screen")
 *   public/brand/closiq-app-icon-512.png        512  (sharing / manifest)
 *   public/favicon-32.png                       32   (browser tab)
 * Uses sharp (already a project dependency).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOGO = path.join(ROOT, 'public', 'brand', 'closiq-logo.png');
const INK = { r: 42, g: 47, b: 53 }; // the logo's own charcoal
const IVORY = { r: 247, g: 242, b: 233 }; // --color-bg #F7F2E9; also app.json adaptiveIcon.backgroundColor
const SIZE = 1024;
const out = (...p) => path.join(ROOT, ...p);

/** Bounding box of the last ink glyph (the Q) in the wordmark. */
function findQBox(px, w, h) {
  const isInk = (x, y) => px[y * w + x] < 120;
  const cols = [];
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) if (isInk(x, y)) { cols.push(x); break; }
  }
  const runs = [];
  let start = cols[0];
  let prev = cols[0];
  for (const x of cols.slice(1)) {
    if (x !== prev + 1) { runs.push([start, prev]); start = x; }
    prev = x;
  }
  runs.push([start, prev]);
  const [x0, x1] = runs[runs.length - 1];
  let y0 = h;
  let y1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = x0; x <= x1; x++) if (isInk(x, y)) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); break; }
  }
  return { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

/** 0–255 ink coverage of the Q, from the logo's own background/ink levels. */
async function qCoverage() {
  // One 8-bit grey channel per pixel (flatten drops any alpha first).
  const { data, info } = await sharp(LOGO)
    .flatten({ background: '#FFFFFF' })
    .greyscale()
    .toColourspace('b-w')
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 1) throw new Error(`expected 1 grey channel, got ${info.channels}`);
  const box = findQBox(data, info.width, info.height);
  const pad = 6;
  const left = box.x0 - pad;
  const top = box.y0 - pad;
  const width = box.x1 - box.x0 + pad * 2;
  const height = box.y1 - box.y0 + pad * 2;
  const mask = Buffer.alloc(width * height);
  const BG = 244;
  const INK_LEVEL = 45;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = data[(top + y) * info.width + (left + x)];
      mask[y * width + x] = Math.round(Math.max(0, Math.min(1, (BG - v) / (BG - INK_LEVEL))) * 255);
    }
  }
  return { mask, width, height };
}

/** Upsample the coverage to `targetHeight` and re-sharpen the edge (smoothstep 0.4–0.6). */
async function enlarge(cov, targetHeight) {
  const targetWidth = Math.round((cov.width * targetHeight) / cov.height);
  const { data: big, info } = await sharp(cov.mask, { raw: { width: cov.width, height: cov.height, channels: 1 } })
    .resize(targetWidth, targetHeight, { kernel: 'lanczos3' })
    .toColourspace('b-w')
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 1 || info.width !== targetWidth || info.height !== targetHeight) {
    throw new Error(`unexpected resize output ${info.width}x${info.height}x${info.channels}`);
  }
  for (let i = 0; i < big.length; i++) {
    const t = Math.max(0, Math.min(1, (big[i] / 255 - 0.4) / 0.2));
    big[i] = Math.round(t * t * (3 - 2 * t) * 255);
  }
  return { mask: big, width: targetWidth, height: targetHeight };
}

/** The mark in `fill`, centred on a SIZE×SIZE tile (transparent when no background). */
async function place(mark, fill, background) {
  const rgba = Buffer.alloc(mark.width * mark.height * 4);
  for (let i = 0; i < mark.width * mark.height; i++) {
    rgba[i * 4] = fill.r;
    rgba[i * 4 + 1] = fill.g;
    rgba[i * 4 + 2] = fill.b;
    rgba[i * 4 + 3] = mark.mask[i];
  }
  const layer = await sharp(rgba, { raw: { width: mark.width, height: mark.height, channels: 4 } }).png().toBuffer();
  return sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: background ? { ...background, alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 } }
  }).composite([{ input: layer, left: Math.round((SIZE - mark.width) / 2), top: Math.round((SIZE - mark.height) / 2) }]);
}

const coverage = await qCoverage();

// iOS / Expo icon: opaque (Apple rejects transparency), mark at ~60% of the
// tile so it survives the rounded corners.
const iconPng = await (await place(await enlarge(coverage, 620), INK, IVORY)).flatten({ background: IVORY }).png().toBuffer();
await sharp(iconPng).toFile(out('mobile', 'assets', 'app-icon.png'));

// Android adaptive: keep the mark inside the ~66% safe zone; the launcher
// supplies the ivory background colour and the mask shape.
const fg = await enlarge(coverage, 470);
await (await place(fg, INK, null)).png().toFile(out('mobile', 'assets', 'adaptive-icon-foreground.png'));
await (await place(fg, { r: 255, g: 255, b: 255 }, null)).png().toFile(out('mobile', 'assets', 'adaptive-icon-monochrome.png'));

// Web.
await sharp(iconPng).resize(180, 180, { kernel: 'lanczos3' }).png().toFile(out('public', 'apple-touch-icon.png'));
await sharp(iconPng).resize(512, 512, { kernel: 'lanczos3' }).png().toFile(out('public', 'brand', 'closiq-app-icon-512.png'));
await sharp(iconPng).resize(32, 32, { kernel: 'lanczos3' }).png().toFile(out('public', 'favicon-32.png'));

console.log('App icons written from the brain-Q of public/brand/closiq-logo.png');
