import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import * as ort from 'onnxruntime-node';

/**
 * Studio photo (2026-10-13): cuts the garment out of a user's photo and puts
 * it on a white square "studio" backdrop with a soft floor shadow.
 *
 * Free and local — no Gemini call. The cut-out is a salient-object mask from
 * an open-source U²-Net model (Apache-2.0, weights from the rembg project)
 * run with onnxruntime-node; the ORIGINAL pixels are composited through that
 * mask with sharp, so the garment itself is never redrawn or altered. The
 * client still shows original vs studio and lets the user choose, because a
 * mask can clip an edge on a busy background.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Model specs mirror rembg's sessions (input size + normalisation).
const MODELS = {
  u2netp: { file: 'u2netp.onnx', size: 320, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] },
  'isnet-general-use': { file: 'isnet-general-use.onnx', size: 1024, mean: [0.5, 0.5, 0.5], std: [1, 1, 1] }
};

const MODEL_NAME = process.env.STUDIO_MODEL || 'u2netp';
const MODEL_DIR = process.env.STUDIO_MODEL_DIR || path.join(__dirname, 'models');

const OUTPUT_SIZE = 1024; // square output, px
const PADDING = 0.1; // margin around the garment, as a fraction of the canvas
const MIN_GARMENT_FRACTION = 0.02; // a mask smaller than this means nothing was found

let sessionPromise = null;
function getSession(spec) {
  // Created once per process; warm serverless invocations reuse it.
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(path.join(MODEL_DIR, spec.file)).catch((err) => {
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise;
}

async function predictMask(rgb, width, height, spec) {
  const session = await getSession(spec);
  const data = await sharp(rgb, { raw: { width, height, channels: 3 } })
    .resize(spec.size, spec.size, { fit: 'fill' })
    .raw()
    .toBuffer();

  // rembg normalises by the image's own max value, then mean/std, CHW layout.
  let max = 1;
  for (let i = 0; i < data.length; i += 1) if (data[i] > max) max = data[i];
  const plane = spec.size * spec.size;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i += 1) {
    for (let c = 0; c < 3; c += 1) {
      input[c * plane + i] = (data[i * 3 + c] / max - spec.mean[c]) / spec.std[c];
    }
  }

  const feeds = { [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, spec.size, spec.size]) };
  const output = (await session.run(feeds))[session.outputNames[0]].data;

  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < plane; i += 1) {
    if (output[i] < lo) lo = output[i];
    if (output[i] > hi) hi = output[i];
  }
  const range = hi - lo || 1;
  const mask = Buffer.alloc(plane);
  for (let i = 0; i < plane; i += 1) mask[i] = Math.round(((output[i] - lo) / range) * 255);
  cleanMask(mask, spec.size);

  // Back to the photo's size; a light contrast curve firms up soft edges.
  return sharp(mask, { raw: { width: spec.size, height: spec.size, channels: 1 } })
    .resize(width, height, { fit: 'fill' })
    .linear(1.25, -20)
    // sharp widens a 1-channel image to sRGB on output; keep it a 1-channel mask.
    .extractChannel(0)
    .raw()
    .toBuffer();
}

/**
 * At model resolution: keep only the largest connected shape (drops specks
 * of background the model half-picked) and fill holes inside it (a white
 * print or a button the model read as background). In place.
 */
function cleanMask(mask, size) {
  const n = size * size;
  const label = new Int32Array(n);
  const queue = new Int32Array(n);
  let best = 0;
  let bestSize = 0;
  let next = 0;

  for (let start = 0; start < n; start += 1) {
    if (mask[start] <= 127 || label[start]) continue;
    next += 1;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    label[start] = next;
    while (head < tail) {
      const p = queue[head++];
      const x = p % size;
      const neighbours = [x > 0 ? p - 1 : -1, x < size - 1 ? p + 1 : -1, p - size, p + size];
      for (const q of neighbours) {
        if (q >= 0 && q < n && !label[q] && mask[q] > 127) {
          label[q] = next;
          queue[tail++] = q;
        }
      }
    }
    if (tail > bestSize) {
      bestSize = tail;
      best = next;
    }
  }
  if (!best) return;

  // Background reachable from the border stays background; anything else
  // outside the kept shape is either a stray speck (cleared) or a hole (filled).
  const outside = new Uint8Array(n);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < size; i += 1) {
    for (const p of [i, n - size + i, i * size, i * size + size - 1]) {
      if (label[p] !== best && !outside[p]) {
        outside[p] = 1;
        queue[tail++] = p;
      }
    }
  }
  while (head < tail) {
    const p = queue[head++];
    const x = p % size;
    const neighbours = [x > 0 ? p - 1 : -1, x < size - 1 ? p + 1 : -1, p - size, p + size];
    for (const q of neighbours) {
      if (q >= 0 && q < n && !outside[q] && label[q] !== best) {
        outside[q] = 1;
        queue[tail++] = q;
      }
    }
  }
  // Soft edge pixels are kept only right next to the garment's outline, so
  // faint halos of background objects don't survive as ghost specks.
  const near = new Uint8Array(n);
  const RADIUS = 3;
  for (let p = 0; p < n; p += 1) {
    if (label[p] !== best) continue;
    const x = p % size;
    const y = (p - x) / size;
    for (let dy = -RADIUS; dy <= RADIUS; dy += 1) {
      const yy = y + dy;
      if (yy < 0 || yy >= size) continue;
      for (let dx = -RADIUS; dx <= RADIUS; dx += 1) {
        const xx = x + dx;
        if (xx >= 0 && xx < size) near[yy * size + xx] = 1;
      }
    }
  }

  for (let p = 0; p < n; p += 1) {
    if (label[p] === best) continue;
    if (!outside[p]) mask[p] = 255; // a hole inside the garment
    else if (label[p] || !near[p]) mask[p] = 0; // a separate speck, or halo away from the edge
  }
}

function maskBounds(mask, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] > 127) {
        count += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (count < width * height * MIN_GARMENT_FRACTION) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * @param {Buffer} imageBuffer JPEG/PNG/WebP bytes (EXIF orientation honoured)
 * @returns {Promise<Buffer|null>} studio JPEG, or null when no garment was found
 */
export async function makeStudioPhoto(imageBuffer) {
  const spec = MODELS[MODEL_NAME] || MODELS.u2netp;

  const { data: rgb, info } = await sharp(imageBuffer)
    .rotate()
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  const mask = await predictMask(rgb, width, height, spec);
  const box = maskBounds(mask, width, height);
  if (!box) return null;

  // The garment with the mask as its alpha channel, cropped to the garment.
  // Two pipelines on purpose: sharp runs extract() before joinChannel()
  // whatever the call order, which would join a full-size mask to a crop.
  const withAlpha = await sharp(rgb, { raw: { width, height, channels: 3 } })
    .joinChannel(mask, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
  const cutout = await sharp(withAlpha).extract(box).png().toBuffer();

  // Fit the garment inside the padded square.
  const inner = Math.round(OUTPUT_SIZE * (1 - 2 * PADDING));
  const scale = Math.min(inner / box.width, inner / box.height);
  const w = Math.max(1, Math.round(box.width * scale));
  const h = Math.max(1, Math.round(box.height * scale));
  const left = Math.round((OUTPUT_SIZE - w) / 2);
  const top = Math.round((OUTPUT_SIZE - h) / 2);
  const garment = await sharp(cutout).resize(w, h, { fit: 'fill' }).png().toBuffer();

  // Soft floor shadow: a flattened grey ellipse under the garment, blurred.
  const shadowW = Math.round(w * 0.8);
  const shadowH = Math.max(12, Math.round(h * 0.06));
  const pad = shadowH * 2;
  const sw = shadowW + pad * 2;
  const shh = shadowH + pad * 2;
  const ellipse = Buffer.alloc(sw * shh * 4);
  for (let y = 0; y < shh; y += 1) {
    for (let x = 0; x < sw; x += 1) {
      const dx = (x - sw / 2) / (shadowW / 2);
      const dy = (y - shh / 2) / (shadowH / 2);
      if (dx * dx + dy * dy <= 1) ellipse[(y * sw + x) * 4 + 3] = 40; // ~16% black
    }
  }
  const shadow = await sharp(ellipse, { raw: { width: sw, height: shh, channels: 4 } })
    .blur(Math.max(1, shadowH / 2))
    .png()
    .toBuffer();
  const shadowLeft = Math.round((OUTPUT_SIZE - sw) / 2);
  const shadowTop = Math.min(OUTPUT_SIZE - shh, Math.round(top + h - shh / 2));

  return sharp({ create: { width: OUTPUT_SIZE, height: OUTPUT_SIZE, channels: 3, background: '#FFFFFF' } })
    .composite([
      { input: shadow, left: shadowLeft, top: shadowTop },
      { input: garment, left, top }
    ])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

const MAX_BASE64_LENGTH = 8 * 1024 * 1024; // ~6 MB image; clients send ~1024px JPEGs

/**
 * POST /api/ai/studio-photo — { imageData: base64 or data URL }
 * → { ok: true, data: { imageData, mimeType: 'image/jpeg' } }
 * Same response shape as the Gemini endpoints so clients share one parser.
 */
export async function handleStudioPhotoServer(body) {
  const raw = typeof body.imageData === 'string' ? body.imageData : '';
  const base64 = raw.includes(';base64,') ? raw.split(';base64,')[1] : raw;
  if (!base64) return { ok: false, mode: 'local', errorKind: 'bad_request', error: 'imageData is required' };
  if (base64.length > MAX_BASE64_LENGTH) {
    return { ok: false, mode: 'local', errorKind: 'too_large', error: 'Image is too large' };
  }

  try {
    const studio = await makeStudioPhoto(Buffer.from(base64, 'base64'));
    if (!studio) return { ok: false, mode: 'local', errorKind: 'no_garment', error: 'No garment found in the photo' };
    return { ok: true, mode: 'local', data: { imageData: studio.toString('base64'), mimeType: 'image/jpeg' } };
  } catch (err) {
    console.error('[Studio Photo Error]:', err?.message || err);
    return { ok: false, mode: 'local', errorKind: 'unavailable', error: 'Studio photo failed' };
  }
}
