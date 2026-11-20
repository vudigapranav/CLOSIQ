/**
 * Generates every HeyHanger brand export from the two editable vector masters:
 *
 *   public/brand/heyhanger-mark.svg      the "HH" monogram with the small hanger hook
 *   public/brand/heyhanger-wordmark.svg  the monoline "HeyHanger" lettering
 *
 *   node scripts/generate-app-icons.mjs
 *
 * Edit only the two masters; everything below is derived from them, so re-run
 * this script after any change and commit the outputs. Rendering uses sharp
 * (librsvg), already a project dependency. No fonts are involved, so the
 * output is identical on every machine.
 *
 * Writes (SVG variants, all derived):
 *   public/brand/heyhanger-mark-mono.svg            charcoal mark (single colour, light surfaces)
 *   public/brand/heyhanger-mark-reversed.svg        ivory mark (dark surfaces)
 *   public/brand/heyhanger-lockup.svg               olive mark + charcoal wordmark (light surfaces)
 *   public/brand/heyhanger-lockup-reversed.svg      gold mark + off-white wordmark (dark surfaces)
 *   public/brand/heyhanger-lockup-mono.svg          all charcoal
 *   public/brand/heyhanger-lockup-mono-reversed.svg all off-white
 *   public/brand/heyhanger-app-icon.svg             1024 square tile (olive-brown, ivory mark)
 * Writes (PNG exports):
 *   mobile/assets/app-icon.png                      1024 opaque tile (Expo/iOS icon, legacy Android)
 *   mobile/assets/adaptive-icon-foreground.png      1024 transparent, ivory mark inside the 66/108 safe zone
 *   mobile/assets/adaptive-icon-monochrome.png      1024 white mark (Android 13+ themed icons)
 *   mobile/assets/heyhanger-logo.png                1200x334 transparent lockup (splash, sign-in, Home header)
 *   public/apple-touch-icon.png                     180  (iPhone "Add to Home Screen")
 *   public/favicon-32.png                           32   (browser tab)
 *   public/brand/heyhanger-app-icon-512.png         512  (sharing)
 *   public/brand/heyhanger-linkedin-square.png      1254x1254 social image
 *   public/brand/heyhanger-linkedin-3x4.png         1086x1448 social image
 *   docs/brand/heyhanger-preview.png                review sheet built from the exported files
 *                                                   (16/32/48 px, circle + rounded-square masks, themed icon)
 * The adaptive icon's background colour lives in mobile/app.json
 * (android.adaptiveIcon.backgroundColor) and must stay equal to TILE below.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = (...p) => path.join(ROOT, ...p);

// Palette (src/index.css tokens).
const OLIVE = '#6B5A3D'; // --color-primary (light)
const CHARCOAL = '#2B2723'; // --color-text-primary (light)
const IVORY = '#F7F2E9'; // --color-bg (light)
const GOLD = '#C6A876'; // --color-primary (dark)
const OFF_WHITE = '#F5EFE4'; // --color-text-primary (dark)
const DARK_BG = '#1C1815'; // --color-bg (dark)
const TILE = OLIVE; // app icon / adaptive background
const ICON_MARK = IVORY;

// Colours used inside the masters, swapped for the variants.
const MASTER_MARK = '#6B5A3D';
const MASTER_WORD = '#2B2723';

function readMaster(file) {
  const src = fs.readFileSync(out('public', 'brand', file), 'utf8');
  const vb = /viewBox="([\d.\s-]+)"/.exec(src);
  if (!vb) throw new Error(`${file}: missing viewBox`);
  const [x, y, w, h] = vb[1].trim().split(/\s+/).map(Number);
  const inner = src.slice(src.indexOf('>', src.indexOf('<svg')) + 1, src.lastIndexOf('</svg>')).replace(/<title>.*?<\/title>/s, '');
  return { x, y, w, h, inner };
}

const MARK = readMaster('heyhanger-mark.svg');
const WORD = readMaster('heyhanger-wordmark.svg');
if (!MARK.inner.includes(MASTER_MARK)) throw new Error(`heyhanger-mark.svg must use ${MASTER_MARK}`);
if (!WORD.inner.includes(MASTER_WORD)) throw new Error(`heyhanger-wordmark.svg must use ${MASTER_WORD}`);

const recolour = (inner, from, to) => inner.split(from).join(to);
const markIn = (fill) => recolour(MARK.inner, MASTER_MARK, fill);
const wordIn = (stroke) => recolour(WORD.inner, MASTER_WORD, stroke);

/** Places the mark (scaled) with its bounding box centred at (cx, cy). */
const placeMark = (fill, scale, cx, cy) =>
  `<g transform="translate(${cx - (MARK.w * scale) / 2} ${cy - (MARK.h * scale) / 2}) scale(${scale}) translate(${-MARK.x} ${-MARK.y})">${markIn(fill)}</g>`;

// ---- Lockup geometry: the HH letters stand on the wordmark baseline and are
// 1.45x the wordmark cap height; the hook rises above. Wordmark master units:
// cap height 100, baseline at y = 100, descender to y = 131.
const LOCK_SCALE = 0.52; // mark units -> wordmark units
const MARK_CAP = 280; // HH letter height in mark units
const MARK_LETTER_TOP = 92; // y of the HH letter tops in mark units
const LOCK_GAP = 58;
const markW = MARK.w * LOCK_SCALE;
const markTop = 100 - (MARK_LETTER_TOP + MARK_CAP) * LOCK_SCALE; // negative: hook above cap line
const LOCK = {
  x: 0,
  y: Math.floor(markTop),
  w: Math.ceil(markW + LOCK_GAP + WORD.w),
  h: Math.ceil(WORD.h - Math.floor(markTop))
};
const lockupInner = (markFill, wordStroke) =>
  `<g transform="translate(0 ${markTop}) scale(${LOCK_SCALE})">${markIn(markFill)}</g>` +
  `<g transform="translate(${markW + LOCK_GAP} 0)">${wordIn(wordStroke)}</g>`;
const lockupSvg = (markFill, wordStroke, comment) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!-- ${comment} Generated by scripts/generate-app-icons.mjs from heyhanger-mark.svg + heyhanger-wordmark.svg; do not edit by hand. -->\n` +
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOCK.x} ${LOCK.y} ${LOCK.w} ${LOCK.h}" width="${LOCK.w}" height="${LOCK.h}"><title>HeyHanger</title>${lockupInner(markFill, wordStroke)}</svg>\n`;
const markSvg = (fill, comment) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!-- ${comment} Generated by scripts/generate-app-icons.mjs from heyhanger-mark.svg; do not edit by hand. -->\n` +
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK.x} ${MARK.y} ${MARK.w} ${MARK.h}" width="${MARK.w}" height="${MARK.h}"><title>HeyHanger</title>${markIn(fill)}</svg>\n`;

// ---- Icon tiles (1024 canvas). Adaptive icons: Android shows the central
// 72/108 of the canvas and guarantees only a 66/108 circle, so the mark's
// bounding-box diagonal is kept inside a 0.29 x 1024 radius.
const SIZE = 1024;
const halfDiag = Math.hypot(MARK.w, MARK.h) / 2;
const ADAPTIVE_SCALE = (0.29 * SIZE) / halfDiag;
const TILE_SCALE = (0.56 * SIZE) / MARK.w; // opaque tile: mark spans 56% of the width
const FAVICON_SCALE = (0.8 * SIZE) / MARK.w; // tiny sizes: as large as the tile allows
const cy = SIZE / 2;
const tileSvg = (scale = TILE_SCALE, radius = 0) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" rx="${radius}" fill="${TILE}"/>${placeMark(ICON_MARK, scale, SIZE / 2, cy)}</svg>`;
const layerSvg = (fill) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">${placeMark(fill, ADAPTIVE_SCALE, SIZE / 2, cy)}</svg>`;

/** Rasterises an SVG string at exactly width x height (vector, not upscaled). */
const render = (svg, width, height = width) =>
  sharp(Buffer.from(svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${width}" height="${height}"`))).png();

const writeText = (rel, text) => fs.writeFileSync(out(...rel.split('/')), text);

// 1. Derived SVG variants.
writeText('public/brand/heyhanger-mark-mono.svg', markSvg(CHARCOAL, 'HeyHanger mark, single colour (charcoal) for light surfaces.'));
writeText('public/brand/heyhanger-mark-reversed.svg', markSvg(OFF_WHITE, 'HeyHanger mark, reversed (off-white) for dark surfaces.'));
writeText('public/brand/heyhanger-lockup.svg', lockupSvg(OLIVE, CHARCOAL, 'HeyHanger lockup for light surfaces.'));
writeText('public/brand/heyhanger-lockup-reversed.svg', lockupSvg(GOLD, OFF_WHITE, 'HeyHanger lockup for dark surfaces.'));
writeText('public/brand/heyhanger-lockup-mono.svg', lockupSvg(CHARCOAL, CHARCOAL, 'HeyHanger lockup, single colour (charcoal).'));
writeText('public/brand/heyhanger-lockup-mono-reversed.svg', lockupSvg(OFF_WHITE, OFF_WHITE, 'HeyHanger lockup, single colour reversed (off-white).'));
writeText(
  'public/brand/heyhanger-app-icon.svg',
  `<?xml version="1.0" encoding="UTF-8"?>\n<!-- HeyHanger app icon tile. Generated by scripts/generate-app-icons.mjs; do not edit by hand. -->\n${tileSvg()}\n`
);

// 2. App icons.
await render(tileSvg(), SIZE).flatten({ background: TILE }).toFile(out('mobile', 'assets', 'app-icon.png'));
await render(layerSvg(ICON_MARK), SIZE).toFile(out('mobile', 'assets', 'adaptive-icon-foreground.png'));
await render(layerSvg('#FFFFFF'), SIZE).toFile(out('mobile', 'assets', 'adaptive-icon-monochrome.png'));
await render(tileSvg(), 180).flatten({ background: TILE }).toFile(out('public', 'apple-touch-icon.png'));
await render(tileSvg(), 512).flatten({ background: TILE }).toFile(out('public', 'brand', 'heyhanger-app-icon-512.png'));
await render(tileSvg(FAVICON_SCALE, SIZE * 0.22), 32).toFile(out('public', 'favicon-32.png'));

// 3. Lockup PNG for the phone (3.6:1 box the screens already reserve), transparent.
const LOGO_W = 1200;
const LOGO_H = 334;
const lockupBox = (markFill, wordStroke, w, h, bg) => {
  const s = Math.min((w * 0.94) / LOCK.w, (h * 0.86) / LOCK.h);
  const tx = (w - LOCK.w * s) / 2;
  const ty = (h - LOCK.h * s) / 2 - LOCK.y * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ''}<g transform="translate(${tx} ${ty}) scale(${s})">${lockupInner(markFill, wordStroke)}</g></svg>`;
};
await render(lockupBox(OLIVE, CHARCOAL, LOGO_W, LOGO_H), LOGO_W, LOGO_H).toFile(out('mobile', 'assets', 'heyhanger-logo.png'));

// 4. Social images (lockup centred on ivory, same sizes as before).
for (const [file, w, h] of [
  ['heyhanger-linkedin-square.png', 1254, 1254],
  ['heyhanger-linkedin-3x4.png', 1086, 1448]
]) {
  const bw = Math.round(w * 0.78);
  const bh = Math.round(bw / 3.6);
  const inner = await render(lockupBox(OLIVE, CHARCOAL, bw, bh, null), bw, bh).toBuffer();
  const meta = await sharp(inner).metadata();
  await sharp({ create: { width: w, height: h, channels: 3, background: IVORY } })
    .composite([{ input: inner, left: Math.round((w - meta.width) / 2), top: Math.round((h - meta.height) / 2) }])
    .png()
    .toFile(out('public', 'brand', file));
}

// 5. Review sheet built from the files just written.
const PREVIEW = out('docs', 'brand', 'heyhanger-preview.png');
fs.mkdirSync(path.dirname(PREVIEW), { recursive: true });
const icon = fs.readFileSync(out('mobile', 'assets', 'app-icon.png'));
const fg = fs.readFileSync(out('mobile', 'assets', 'adaptive-icon-foreground.png'));
const mono = fs.readFileSync(out('mobile', 'assets', 'adaptive-icon-monochrome.png'));
const crop = Math.round((SIZE * 18) / 108); // launchers show the central 72/108
const visible = SIZE - 2 * crop;
const adaptive = async (layer, bg) =>
  sharp(await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: bg } }).composite([{ input: layer }]).png().toBuffer())
    .extract({ left: crop, top: crop, width: visible, height: visible })
    .png()
    .toBuffer();
const masked = async (buf, size, shape) => {
  const m =
    shape === 'circle'
      ? `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`
      : `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * 0.22}"/></svg>`;
  return sharp(await sharp(buf).resize(size, size, { kernel: 'lanczos3' }).png().toBuffer())
    .composite([{ input: Buffer.from(m), blend: 'dest-in' }])
    .png()
    .toBuffer();
};
const full = await adaptive(fg, TILE);
const themed = await sharp(await adaptive(mono, '#3A4A5C')).png().toBuffer();
const tiles = [];
const row = (y) => ({ y, x: 24 });
let r = row(24);
const put = (input, w, gapAfter = 24) => {
  tiles.push({ input, left: r.x, top: r.y });
  r.x += w + gapAfter;
};
// Row 1: launcher masks at 192 px.
for (const [buf, shape] of [
  [full, 'circle'],
  [full, 'square'],
  [themed, 'circle'],
  [icon, 'square']
]) put(await masked(buf, 192, shape), 192);
// Row 2: small sizes, each also shown 4x nearest-neighbour.
r = row(248);
for (const s of [48, 32, 16]) {
  const small = await sharp(await masked(full, s, 'circle')).png().toBuffer();
  put(small, s, 12);
  put(await sharp(small).resize(s * 4, s * 4, { kernel: 'nearest' }).png().toBuffer(), s * 4);
}
const fav = fs.readFileSync(out('public', 'favicon-32.png'));
put(fav, 32, 12);
put(await sharp(fav).resize(128, 128, { kernel: 'nearest' }).png().toBuffer(), 128);
const fav16 = await sharp(fav).resize(16, 16, { kernel: 'lanczos3' }).png().toBuffer();
put(fav16, 16, 12);
put(await sharp(fav16).resize(64, 64, { kernel: 'nearest' }).png().toBuffer(), 64);
// Row 3/4: lockups on light and dark.
const lockLight = await render(lockupBox(OLIVE, CHARCOAL, 760, 211, IVORY), 760, 211).toBuffer();
const lockDark = await render(lockupBox(GOLD, OFF_WHITE, 760, 211, DARK_BG), 760, 211).toBuffer();
const monoLight = await render(lockupBox(CHARCOAL, CHARCOAL, 380, 106, '#FFFFFF'), 380, 106).toBuffer();
const monoDark = await render(lockupBox(OFF_WHITE, OFF_WHITE, 380, 106, '#000000'), 380, 106).toBuffer();
r = row(480);
put(lockLight, 760);
put(monoLight, 380);
r = row(715);
put(lockDark, 760);
put(monoDark, 380);
await sharp({ create: { width: 1240, height: 950, channels: 3, background: '#D9D4CB' } })
  .composite(tiles)
  .png()
  .toFile(PREVIEW);

console.log('HeyHanger brand exports written from public/brand/heyhanger-mark.svg + heyhanger-wordmark.svg');
