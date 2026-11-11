/**
 * Request validation for /api/ai/*. Every function returns
 * { ok: true, value } or { ok: false, error } — never throws.
 */
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // decoded
export const MAX_PROMPT_CHARS = 500;
export const MAX_WARDROBE_ITEMS = 300;
export const MAX_FIELD_CHARS = 120;
export const MAX_TAGS = 15;
export const ID_PATTERN = /^[\w.:-]{1,80}$/;
export const CATEGORIES = ['tops', 'bottoms', 'outerwear', 'shoes', 'accessories'];
const MIME_ALLOWLIST = ['image/jpeg', 'image/png', 'image/webp'];

const bad = (error) => ({ ok: false, error });

export function isValidGarmentId(id) {
  return typeof id === 'string' && ID_PATTERN.test(id);
}

/** True when the leading bytes match the declared mime type. */
export function magicBytesMatch(buf, mimeType) {
  if (!buf || buf.length < 12) return false;
  if (mimeType === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mimeType === 'image/png') return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (mimeType === 'image/webp') {
    return buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP';
  }
  return false;
}

/** Detects the mime type from magic bytes alone (null when unknown). */
export function sniffMime(buf) {
  return MIME_ALLOWLIST.find((m) => magicBytesMatch(buf, m)) || null;
}

/** Strips an optional data-URI prefix; returns { base64, dataUriMime }. */
function splitDataUri(raw) {
  const m = /^data:([^;,]+)?;base64,/i.exec(raw);
  if (!m) return { base64: raw, dataUriMime: null };
  return { base64: raw.slice(m[0].length), dataUriMime: (m[1] || '').toLowerCase() || null };
}

/**
 * Validates an uploaded image. `mimeType` is optional: when absent it is
 * taken from the data URI or sniffed. Returns { value: { base64, mimeType, buffer } }.
 */
export function validateImage(imageData, mimeType) {
  if (typeof imageData !== 'string' || imageData.length === 0) return bad('imageData is required');
  // Cheap upper bound before decoding (base64 is ~4/3 of binary).
  if (imageData.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 200) return bad('Image is too large');
  const { base64, dataUriMime } = splitDataUri(imageData);
  if (!base64 || !/^[A-Za-z0-9+/=\s_-]+$/.test(base64)) return bad('imageData is not valid base64');
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0) return bad('imageData is empty');
  if (buffer.length > MAX_IMAGE_BYTES) return bad('Image is too large');

  const declared = (typeof mimeType === 'string' && mimeType ? mimeType : dataUriMime || '').toLowerCase();
  const effective = declared === 'image/jpg' ? 'image/jpeg' : declared;
  if (effective && MIME_ALLOWLIST.includes(effective) && magicBytesMatch(buffer, effective)) {
    return { ok: true, value: { base64, mimeType: effective, buffer } };
  }
  // A declared type that doesn't match the bytes (e.g. a client that labels
  // every non-JPEG as PNG) is corrected from the bytes themselves; anything
  // that isn't actually JPEG/PNG/WebP is still rejected.
  const sniffed = sniffMime(buffer);
  if (!sniffed) return bad('Unsupported image type');
  return { ok: true, value: { base64, mimeType: sniffed, buffer } };
}

export function validatePrompt(prompt, { required = false } = {}) {
  if (prompt === undefined || prompt === null || prompt === '') {
    return required ? bad('prompt is required') : { ok: true, value: '' };
  }
  if (typeof prompt !== 'string') return bad('prompt must be a string');
  if (prompt.length > MAX_PROMPT_CHARS) return bad(`prompt must be at most ${MAX_PROMPT_CHARS} characters`);
  return { ok: true, value: prompt.trim() };
}

function cleanString(v) {
  return typeof v === 'string' ? v.trim().slice(0, MAX_FIELD_CHARS) : v;
}

/**
 * The clients send each piece's id as `garmentId` (the field the prompt and
 * the model's answer use); `id` is accepted too for older/other callers.
 */
export const garmentIdOf = (item) => (item && (item.garmentId ?? item.id)) || undefined;

/** Short string-array fields worth keeping for the model. */
const STRING_ARRAY_FIELDS = new Set(['tags', 'seasons', 'secondaryColors', 'collections']);

/** Sanitises one wardrobe item: trims/caps string fields and short string arrays, keeps scalars. */
function sanitizeItem(item) {
  const out = {};
  for (const [key, val] of Object.entries(item)) {
    if (STRING_ARRAY_FIELDS.has(key)) {
      out[key] = Array.isArray(val)
        ? val.filter((t) => typeof t === 'string').slice(0, MAX_TAGS).map(cleanString)
        : [];
    } else if (typeof val === 'string') {
      out[key] = cleanString(val);
    } else if (typeof val === 'number' || typeof val === 'boolean' || val === null) {
      out[key] = val;
    } // nested objects/arrays other than tags are dropped
  }
  return out;
}

export function validateWardrobe(wardrobe, { required = true } = {}) {
  if (wardrobe === undefined || wardrobe === null) {
    return required ? bad('wardrobe is required') : { ok: true, value: [] };
  }
  if (!Array.isArray(wardrobe)) return bad('wardrobe must be an array');
  if (wardrobe.length > MAX_WARDROBE_ITEMS) return bad(`wardrobe may have at most ${MAX_WARDROBE_ITEMS} items`);
  const out = [];
  for (const item of wardrobe) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return bad('wardrobe items must be objects');
    if (!isValidGarmentId(garmentIdOf(item))) return bad('wardrobe item has an invalid id');
    if (item.category !== undefined && !CATEGORIES.includes(item.category)) {
      return bad('wardrobe item has an invalid category');
    }
    const clean = sanitizeItem(item);
    // One canonical key for the model and for the output filters.
    clean.garmentId = garmentIdOf(item);
    delete clean.id;
    out.push(clean);
  }
  return { ok: true, value: out };
}

export function validateIdList(ids, label, max = MAX_WARDROBE_ITEMS) {
  if (ids === undefined || ids === null) return { ok: true, value: [] };
  if (!Array.isArray(ids) || ids.length > max) return bad(`${label} must be an array of at most ${max} ids`);
  for (const id of ids) if (!isValidGarmentId(id)) return bad(`${label} contains an invalid id`);
  return { ok: true, value: ids };
}

/**
 * Keeps only ids that exist in `wardrobe`, are not excluded, and de-duplicates
 * (order preserved). Used on model output so it can never name an unowned piece.
 */
export function filterOutfitIds(ids, wardrobe, excludeIds = []) {
  if (!Array.isArray(ids)) return [];
  const owned = new Set(wardrobe.map(garmentIdOf));
  const excluded = new Set(excludeIds);
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    if (typeof id !== 'string' || !owned.has(id) || excluded.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** A swap replacement must exist, match the target category, and not already be in the outfit. */
export function isValidReplacement(replacementId, { wardrobe, category, currentOutfitIds = [], targetId }) {
  if (typeof replacementId !== 'string' || replacementId === targetId) return false;
  if (currentOutfitIds.includes(replacementId)) return false;
  const item = wardrobe.find((g) => garmentIdOf(g) === replacementId);
  if (!item) return false;
  return !item.category || !category || item.category === category;
}

/** Bounded, plain-data weather context (supports web and mobile shapes). */
export function sanitizeWeatherContext(w) {
  if (!w || typeof w !== 'object') return null;
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : undefined);
  const temp = num(w.temperatureC) ?? num(w.temperatureCelsius);
  const out = {
    temperatureC: temp,
    feelsLikeC: num(w.feelsLikeC),
    condition: typeof w.condition === 'string' ? w.condition.trim().slice(0, 60) : undefined,
    precipitationProbability: num(w.precipitationProbability),
    maxC: num(w.maxC),
    minC: num(w.minC)
  };
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return Object.keys(out).length ? out : null;
}
