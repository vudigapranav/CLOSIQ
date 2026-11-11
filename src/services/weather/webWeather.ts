/**
 * Web weather (2026-11-11). Location comes from a city the user picked (saved
 * in localStorage, best-effort mirrored to profiles.weather_city) or — only
 * after they tap "Use my location" — the browser's geolocation. We never
 * auto-prompt. Everything is advisory: failures return a status, never throw.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ForecastBundle,
  GeoPlace,
  buildForecastUrl,
  buildGeocodeUrl,
  parseForecast,
  parseGeocode,
  WeatherSnapshot
} from './weatherCore';
import {
  TempUnit,
  parseStoredForecast,
  parseStoredPlace,
  parseTempUnit,
  pickCachedBundle,
  placeKey
} from './webWeatherHelpers';

export type { TempUnit } from './webWeatherHelpers';

export type WeatherStatus = 'ok' | 'cached' | 'no-location' | 'error';

export interface WeatherResult {
  status: WeatherStatus;
  bundle?: ForecastBundle;
  place?: GeoPlace;
}

const PLACE_KEY = 'closiq_weather_place';
const CACHE_KEY = 'closiq_weather_cache';
const UNIT_KEY = 'closiq_temp_unit';
const FETCH_TIMEOUT_MS = 8000;

const ls = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode / quota: weather still works for this session */
    }
  }
};

export const getTempUnit = (): TempUnit => parseTempUnit(ls.get(UNIT_KEY));
export const setTempUnit = (unit: TempUnit) => ls.set(UNIT_KEY, unit);
export const getSavedPlace = (): GeoPlace | null => parseStoredPlace(ls.get(PLACE_KEY));

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Saves the chosen city locally and (best-effort) on the profile. */
export async function savePlace(place: GeoPlace, userId?: string): Promise<void> {
  ls.set(PLACE_KEY, JSON.stringify(place));
  if (!userId) return;
  try {
    const { supabase, isCloudConfigured } = await import('../cloud/supabase');
    if (!isCloudConfigured) return;
    await supabase.from('profiles').upsert({ id: userId, weather_city: JSON.stringify(place) }, { onConflict: 'id' });
  } catch {
    /* column may not exist yet — ignore */
  }
}

/** Reads the profile's saved city into localStorage when this device has none. */
async function hydratePlaceFromProfile(userId?: string): Promise<GeoPlace | null> {
  if (!userId) return null;
  try {
    const { supabase, isCloudConfigured } = await import('../cloud/supabase');
    if (!isCloudConfigured) return null;
    const { data, error } = await supabase.from('profiles').select('weather_city').eq('id', userId).maybeSingle();
    if (error) return null;
    const place = parseStoredPlace((data as { weather_city?: string | null } | null)?.weather_city);
    if (place) ls.set(PLACE_KEY, JSON.stringify(place));
    return place;
  } catch {
    return null;
  }
}

export async function searchCities(query: string): Promise<GeoPlace[]> {
  try {
    return parseGeocode(await fetchJson(buildGeocodeUrl(query)));
  } catch {
    return [];
  }
}

/** Browser geolocation → a GeoPlace. Call ONLY from a user tap. */
export function locateMe(): Promise<GeoPlace | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ name: 'Your location', latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 10 * 60 * 1000 }
    );
  });
}

export async function getWeather(opts: { force?: boolean; place?: GeoPlace | null; userId?: string } = {}): Promise<WeatherResult> {
  try {
    let place = opts.place ?? getSavedPlace();
    if (!place) place = await hydratePlaceFromProfile(opts.userId);
    if (!place) return { status: 'no-location' };

    const stored = parseStoredForecast(ls.get(CACHE_KEY));
    if (!opts.force) {
      const fresh = pickCachedBundle(stored, place, false);
      if (fresh) return { status: 'ok', bundle: fresh, place };
    }
    try {
      const bundle = parseForecast(await fetchJson(buildForecastUrl(place.latitude, place.longitude)));
      ls.set(CACHE_KEY, JSON.stringify({ key: placeKey(place), bundle }));
      return { status: 'ok', bundle, place };
    } catch {
      const stale = pickCachedBundle(stored, place, true);
      return stale ? { status: 'cached', bundle: stale, place } : { status: 'error', place };
    }
  } catch {
    return { status: 'error' };
  }
}

export interface WebWeatherState {
  status: WeatherStatus | 'loading';
  bundle: ForecastBundle | null;
  /** Convenience: today's snapshot to hand to the outfit services. */
  current: WeatherSnapshot | null;
  place: GeoPlace | null;
  unit: TempUnit;
  refresh: () => void;
  choosePlace: (place: GeoPlace) => void;
  locateAndUse: () => Promise<boolean>;
  setUnit: (unit: TempUnit) => void;
}

/** Hold this ONCE (App) and pass the state down; screens never fetch on their own. */
export function useWebWeather(userId?: string): WebWeatherState {
  const [result, setResult] = useState<WeatherResult | null>(null);
  const [unit, setUnitState] = useState<TempUnit>(getTempUnit);
  const seq = useRef(0);

  const load = useCallback(
    async (opts: { force?: boolean; place?: GeoPlace | null } = {}) => {
      const mine = ++seq.current;
      const r = await getWeather({ ...opts, userId });
      if (mine === seq.current) setResult(r);
    },
    [userId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const choosePlace = useCallback(
    (place: GeoPlace) => {
      void savePlace(place, userId);
      setResult(null);
      load({ force: true, place });
    },
    [load, userId]
  );

  const locateAndUse = useCallback(async () => {
    const place = await locateMe();
    if (!place) return false;
    choosePlace(place);
    return true;
  }, [choosePlace]);

  const setUnit = useCallback((u: TempUnit) => {
    setTempUnit(u);
    setUnitState(u);
  }, []);

  return {
    status: result ? result.status : 'loading',
    bundle: result?.bundle ?? null,
    current: result?.bundle?.current ?? null,
    place: result?.place ?? null,
    unit,
    refresh: () => {
      load({ force: true });
    },
    choosePlace,
    locateAndUse,
    setUnit
  };
}
