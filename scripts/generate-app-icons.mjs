/**
 * Generates every CLOSIQ app icon from the master symbol
 * public/brand/closiq-symbol.svg ("Spark hanger", chosen 2026-10-14).
 *
 *   node scripts/generate-app-icons.mjs
 *
 * Writes:
 *   mobile/assets/app-icon.png                  1024, opaque ivory tile (iOS + Expo icon)
 *   mobile/assets/adaptive-icon-foreground.png  1024, transparent, symbol in the safe zone (Android)
 *   mobile/assets/adaptive-icon-monochrome.png  1024, white symbol (Android 13 themed icons)
 *   public/apple-touch-icon.png                 180  (iPhone "Add to Home Screen")
 *   public/brand/closiq-app-icon-512.png        512  (sharing / manifest)
 *   public/favicon-32.png                       32   (browser tab)
 * Uses sharp (already a project dependency) to render the SVG.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SYMBOL = fs.readFileSync(path.join(ROOT, 'public', 'brand', 'closiq-symbol.svg'), 'utf8');
const IVORY = '#F7F2E9'; // --color-bg; also app.json android.adaptiveIcon.backgroundColor
const SIZE = 1024;
const out = (...p) => path.join(ROOT, ...p);

/** The symbol scaled to `scale` of the tile, centred, on `background`. */
function tile({ scale = 1, background = null, monochrome = null }) {
  let inner = SYMBOL.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  if (monochrome) inner = inner.replace(/#(?:2A2F35|6B5A3D)/g, monochrome);
  const offset = (SIZE * (1 - scale)) / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
      (background ? `<rect width="${SIZE}" height="${SIZE}" fill="${background}"/>` : '') +
      `<g transform="translate(${offset} ${offset}) scale(${scale})">${inner}</g></svg>`
  );
}

const render = (svg, size) => sharp(svg, { density: 300 }).resize(size, size);

// iOS / Expo: opaque (Apple rejects transparency); 86% leaves room for the
// rounded corners iOS applies.
const icon = tile({ scale: 0.86, background: IVORY });
await render(icon, SIZE).flatten({ background: IVORY }).png().toFile(out('mobile', 'assets', 'app-icon.png'));

// Android adaptive: keep the symbol inside the ~66% safe zone; the launcher
// supplies the ivory background colour and the mask shape.
await render(tile({ scale: 0.68 }), SIZE).png().toFile(out('mobile', 'assets', 'adaptive-icon-foreground.png'));
await render(tile({ scale: 0.68, monochrome: '#FFFFFF' }), SIZE).png().toFile(out('mobile', 'assets', 'adaptive-icon-monochrome.png'));

// Web.
await render(icon, 180).flatten({ background: IVORY }).png().toFile(out('public', 'apple-touch-icon.png'));
await render(icon, 512).flatten({ background: IVORY }).png().toFile(out('public', 'brand', 'closiq-app-icon-512.png'));
await render(icon, 32).flatten({ background: IVORY }).png().toFile(out('public', 'favicon-32.png'));

console.log('App icons written from public/brand/closiq-symbol.svg');
