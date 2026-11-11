/**
 * Pure helpers for the web weather layer (no DOM, no network) so they can be
 * unit-tested under node. The I/O lives in webWeather.ts.
 */
import { ForecastBundle, GeoPlace, isForecastFresh } from './weatherCore';

export type TempUnit = 'celsius' | 'fahrenheit';

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function parseTempUnit(raw: string | null | undefined): TempUnit {
  return raw === 'fahrenheit' ? 'fahrenheit' : 'celsius';
}

/** Validates a stored place; returns null for anything malformed. */
export function parseStoredPlace(raw: string | null | undefined): GeoPlace | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<GeoPlace> | null;
    if (!p || typeof p.name !== 'string' || !p.name || !isNum(p.latitude) || !isNum(p.longitude)) return null;
    if (Math.abs(p.latitude) > 90 || Math.abs(p.longitude) > 180) return null;
    return {
      name: p.name.slice(0, 80),
      latitude: p.latitude,
      longitude: p.longitude,
      region: typeof p.region === 'string' ? p.region.slice(0, 80) : undefined
    };
  } catch {
    return null;
  }
}

/** Same ~1 km rounding as the forecast URL, so a cache is keyed by what is actually fetched. */
export function placeKey(place: Pick<GeoPlace, 'latitude' | 'longitude'>): string {
  return `${(Math.round(place.latitude * 100) / 100).toFixed(2)},${(Math.round(place.longitude * 100) / 100).toFixed(2)}`;
}

export interface StoredForecast {
  key: string;
  bundle: ForecastBundle;
}

export function parseStoredForecast(raw: string | null | undefined): StoredForecast | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredForecast> | null;
    const b = v?.bundle;
    if (!v || typeof v.key !== 'string' || !b || !b.current || !isNum(b.current.temperatureC) || !Array.isArray(b.daily) || typeof b.fetchedAt !== 'string') {
      return null;
    }
    return { key: v.key, bundle: b };
  } catch {
    return null;
  }
}

/** A cached bundle for this place, fresh or (when allowStale) stale; else null. */
export function pickCachedBundle(stored: StoredForecast | null, place: GeoPlace, allowStale: boolean, now = Date.now()): ForecastBundle | null {
  if (!stored || stored.key !== placeKey(place)) return null;
  if (allowStale || isForecastFresh(stored.bundle, undefined, now)) return stored.bundle;
  return null;
}

/** "Hyderabad, Telangana, India" style single line for display. */
export function placeLabel(place: GeoPlace): string {
  return place.region ? `${place.name}, ${place.region}` : place.name;
}
