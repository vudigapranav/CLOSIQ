import * as Location from 'expo-location';
import { buildForecastUrl, parseForecast, DailyForecast, WeatherSnapshot } from '../../../src/services/weather/weatherCore';
import { WeatherData, WeatherFetchResult, WeatherFetchStatus } from '../types/weather';
import { loadCachedWeather, saveCachedWeather } from './weatherCacheStorage';

/**
 * Real device-aware weather, via Open-Meteo (https://open-meteo.com).
 *
 * Chosen specifically because its current-weather endpoint requires NO API
 * key/signup — there is no secret to protect, so (unlike Gemini) this never
 * needs to be proxied through server/apiRouter.js. A plain client-side
 * fetch() is exactly as safe as any other public weather widget request.
 * Location -> place name uses expo-location's own on-device
 * reverseGeocodeAsync (OS geocoding) rather than a second network API, so
 * this feature adds zero new dependencies beyond the already-installed
 * expo-location.
 */

const WEATHER_CACHE_FRESH_MS = 30 * 60 * 1000; // 30 minutes — avoids re-fetching on every tab visit
const FETCH_TIMEOUT_MS = 8000;
const LOCATION_TIMEOUT_MS = 8000;
const GEOCODE_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function isFresh(data: WeatherData): boolean {
  return Date.now() - new Date(data.timestamp).getTime() < WEATHER_CACHE_FRESH_MS;
}

/** Checks the CURRENT OS permission state — never trusts a remembered flag
 *  from onboarding, since the user can change location permission in system
 *  Settings at any time. Only requests the native prompt when the state is
 *  genuinely undetermined; an already-'denied' status is never re-prompted,
 *  per the brief's "don't repeatedly trigger the native permission dialog." */
async function resolvePermission(): Promise<'granted' | 'denied'> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.status === 'granted') return 'granted';
    if (current.status !== 'undetermined') return 'denied';

    const requested = await Location.requestForegroundPermissionsAsync();
    return requested.status === 'granted' ? 'granted' : 'denied';
  } catch (err) {
    console.warn('Location permission check failed:', err);
    return 'denied';
  }
}

async function getCoords(): Promise<{ latitude: number; longitude: number }> {
  const position = await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    LOCATION_TIMEOUT_MS
  );
  return { latitude: position.coords.latitude, longitude: position.coords.longitude };
}

async function fetchOpenMeteo(coords: { latitude: number; longitude: number }): Promise<{
  temperatureCelsius: number;
  feelsLikeCelsius?: number;
  condition: string;
  conditionCode: number;
  maxC?: number;
  minC?: number;
  precipitationProbability?: number;
  daily: DailyForecast[];
}> {
  const response = await withTimeout(fetch(buildForecastUrl(coords.latitude, coords.longitude)), FETCH_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed: ${response.status}`);
  }
  const bundle = parseForecast(await response.json());
  const c = bundle.current;
  return {
    temperatureCelsius: c.temperatureC,
    feelsLikeCelsius: c.feelsLikeC,
    condition: c.condition,
    conditionCode: c.conditionCode ?? -1,
    maxC: c.maxC,
    minC: c.minC,
    precipitationProbability: c.precipitationProbability,
    daily: bundle.daily
  };
}

/** WeatherData -> the shared WeatherSnapshot the outfit engines take. */
export function toWeatherSnapshot(data: WeatherData | null): WeatherSnapshot | null {
  if (!data || !Number.isFinite(data.temperatureCelsius)) return null;
  return {
    temperatureC: data.temperatureCelsius,
    feelsLikeC: data.feelsLikeCelsius,
    precipitationProbability: data.precipitationProbability,
    condition: data.condition,
    conditionCode: data.conditionCode,
    maxC: data.maxC,
    minC: data.minC
  };
}

/** Best-effort only — a failed/empty reverse geocode should never fail the
 *  whole weather fetch, it just means no location name is shown. */
async function tryGetLocationName(coords: { latitude: number; longitude: number }): Promise<string | undefined> {
  try {
    const results = await withTimeout(Location.reverseGeocodeAsync(coords), GEOCODE_TIMEOUT_MS);
    const first = results[0];
    return first?.city || first?.subregion || first?.region || undefined;
  } catch (err) {
    console.warn('Reverse geocode failed (non-fatal):', err);
    return undefined;
  }
}

function withCachedFallback(cached: WeatherData | null, status: WeatherFetchStatus): WeatherFetchResult {
  if (!cached) return { status, weather: null };
  return { status, weather: { ...cached, source: 'cached' } };
}

/**
 * Single entry point covering every case in the brief's location/weather UX
 * matrix: permission granted/denied/previously-denied, location temporarily
 * unavailable, weather API unavailable, cached-vs-no-cache. Never throws —
 * every failure path resolves to a status + either cached data or null.
 *
 * `forceRefresh` bypasses the freshness short-circuit (manual refresh);
 * normal calls (e.g. on screen mount) get cache-throttled automatically so
 * revisiting the Today tab doesn't re-hit the network every time.
 */
export async function fetchCurrentWeather(forceRefresh = false): Promise<WeatherFetchResult> {
  const cached = await loadCachedWeather();

  if (!forceRefresh && cached && isFresh(cached)) {
    return { status: 'success', weather: cached };
  }

  const permission = await resolvePermission();
  if (permission !== 'granted') {
    return withCachedFallback(cached, 'permission-denied');
  }

  let coords: { latitude: number; longitude: number };
  try {
    coords = await getCoords();
  } catch (err) {
    console.warn('Failed to get current location:', err);
    return withCachedFallback(cached, 'location-unavailable');
  }

  let live: Awaited<ReturnType<typeof fetchOpenMeteo>>;
  try {
    live = await fetchOpenMeteo(coords);
  } catch (err) {
    console.warn('Failed to fetch weather:', err);
    return withCachedFallback(cached, 'network-error');
  }

  const locationName = await tryGetLocationName(coords);

  const weather: WeatherData = {
    ...live,
    locationName,
    timestamp: new Date().toISOString(),
    source: 'live'
  };

  await saveCachedWeather(weather);
  return { status: 'success', weather };
}

export function celsiusToFahrenheit(celsius: number): number {
  return Math.round((celsius * 9) / 5 + 32);
}
