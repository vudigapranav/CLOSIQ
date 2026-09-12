import { API_BASE_URL } from '../config';
import { supabase, SUPABASE_URL } from './supabaseClient';

/**
 * Sprint M20 — resolving garment images from DURABLE references.
 *
 * Two kinds of garment image exist, and before this both could go stale:
 *
 * 1. User uploads live in the private `garment-images` bucket and are shown
 *    through signed URLs that expire after SIGNED_URL_TTL_SECONDS. The
 *    wardrobe re-signed on every load, but Saved Looks and Planner events
 *    store full garment objects — signed URL included — inside their own
 *    `items`/`outfit` JSON, so every look or planned outfit showed broken
 *    images an hour after it was saved, permanently. Every signed URL
 *    carries its object path (`/storage/v1/object/sign/garment-images/<path>`),
 *    and that path IS the durable reference: re-signing from it needs no
 *    schema change, no data rewrite, and never regenerates an outfit.
 *
 * 2. Seed/catalog images are static files served by the CLOSIQ backend at
 *    `/wardrobe/...`. The demo seed stored them as ABSOLUTE URLs built from
 *    whatever `EXPO_PUBLIC_API_URL` was at seed time (a LAN IP like
 *    `http://192.168.31.215:3000`), so they broke as soon as the network or
 *    host changed. The `/wardrobe/...` path is the durable reference; the
 *    host is re-applied from the CURRENT configuration at read time.
 *
 * Stored data is never rewritten here — only the URL handed to <Image>.
 */

export const GARMENT_IMAGES_BUCKET = 'garment-images';
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

const SIGNED_PATH_MARKER = `/storage/v1/object/sign/${GARMENT_IMAGES_BUCKET}/`;

/**
 * A durable, NOT-yet-signed reference URL for a bucket object. It does not
 * load by itself (no token), but it carries the object path — so when
 * signing fails at load time (offline), the item still holds something
 * GarmentImage can re-sign later, instead of an empty string that nothing
 * can ever recover from.
 */
export function storageReferenceUrl(path: string): string {
  return `${SUPABASE_URL}${SIGNED_PATH_MARKER}${encodeURI(path)}`;
}

/** The bucket object path inside a signed garment-image URL, or null. */
export function storagePathFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const at = url.indexOf(SIGNED_PATH_MARKER);
  if (at === -1) return null;
  const rest = url.slice(at + SIGNED_PATH_MARKER.length).split('?')[0];
  if (!rest) return null;
  try {
    return decodeURIComponent(rest);
  } catch {
    return rest;
  }
}

/**
 * Re-hosts a seed/catalog `/wardrobe/...` image on the CURRENT API host.
 * Accepts the relative path or an absolute URL on any http(s) host (the
 * obsolete-LAN-address case). Anything else passes through unchanged.
 */
export function resolveStaticImageUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('/wardrobe/')) return `${API_BASE_URL}${url}`;
  const match = /^https?:\/\/[^/]+(\/wardrobe\/[^?#]*)/i.exec(url);
  if (match) return `${API_BASE_URL}${match[1]}`;
  return url;
}

/**
 * Returns a copy of `items` whose images will actually load now: static
 * seed paths re-hosted, and storage-backed uploads freshly signed in ONE
 * batch call. If signing fails (offline, bucket missing), the original URL
 * is kept — GarmentImage's placeholder covers it, and nothing is lost.
 */
export async function refreshGarmentImages<T extends { imageUrl: string }>(items: T[]): Promise<T[]> {
  const resolved = items.map((item) => ({ ...item, imageUrl: resolveStaticImageUrl(item.imageUrl) }));

  const paths = Array.from(
    new Set(resolved.map((item) => storagePathFromUrl(item.imageUrl)).filter((p): p is string => !!p))
  );
  if (paths.length === 0) return resolved;

  try {
    const { data, error } = await supabase.storage
      .from(GARMENT_IMAGES_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    if (error) throw error;
    const fresh = new Map<string, string>();
    (data || []).forEach((entry, i) => {
      if (entry.signedUrl) fresh.set(paths[i], entry.signedUrl);
    });
    return resolved.map((item) => {
      const path = storagePathFromUrl(item.imageUrl);
      const url = path ? fresh.get(path) : undefined;
      return url ? { ...item, imageUrl: url } : item;
    });
  } catch (err) {
    console.warn('Could not re-sign garment images; keeping existing URLs:', err);
    return resolved;
  }
}

/** Re-signs a single storage-backed image. Null if not one, or on failure. */
export async function resignImageUrl(url: string): Promise<string | null> {
  const path = storagePathFromUrl(url);
  if (!path) return null;
  try {
    const { data, error } = await supabase.storage
      .from(GARMENT_IMAGES_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Refreshes the garment images inside a list of outfit-shaped records
 * (Saved Looks' `items`, or a Planner event's `outfit.items`) with a single
 * batch signing call across all of them.
 */
export async function refreshNestedGarmentImages<R>(
  records: R[],
  getItems: (record: R) => { imageUrl: string }[] | undefined,
  setItems: (record: R, items: { imageUrl: string }[]) => R
): Promise<R[]> {
  const counts = records.map((r) => getItems(r)?.length ?? 0);
  const flat = records.flatMap((r) => getItems(r) ?? []);
  if (flat.length === 0) return records;
  const refreshed = await refreshGarmentImages(flat);
  let offset = 0;
  return records.map((record, i) => {
    const n = counts[i];
    if (n === 0) return record;
    const slice = refreshed.slice(offset, offset + n);
    offset += n;
    return setItems(record, slice);
  });
}
