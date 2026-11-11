/**
 * Weather core (2026-11-11) — shared by web and mobile, no I/O.
 *
 * Provider: Open-Meteo (https://open-meteo.com) — free, no API key, CORS
 * enabled, so there is no secret to proxy. Each platform does its own fetch,
 * location and caching (mobile: expo-location + AsyncStorage; web: a city the
 * user typed or browser geolocation + localStorage); everything that
 * interprets the response lives here so both read the weather identically.
 *
 * Weather is advisory: when it's unavailable the wardrobe and the rule-based
 * engine keep working and simply say "no weather data" instead of guessing.
 */

export interface WeatherSnapshot {
  temperatureC: number;
  feelsLikeC?: number;
  /** 0–100, chance of rain today (daily max from Open-Meteo). */
  precipitationProbability?: number;
  condition: string;
  conditionCode?: number;
  /** Day high / low when known. */
  maxC?: number;
  minC?: number;
}

export interface DailyForecast {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  maxC: number;
  minC: number;
  precipitationProbability?: number;
  condition: string;
  conditionCode: number;
}

export interface ForecastBundle {
  current: WeatherSnapshot;
  daily: DailyForecast[];
  /** ISO time of the fetch. */
  fetchedAt: string;
}

export interface GeoPlace {
  name: string;
  latitude: number;
  longitude: number;
  /** "Telangana, India" etc. — display only. */
  region?: string;
}

const API = 'https://api.open-meteo.com/v1/forecast';
const GEO_API = 'https://geocoding-api.open-meteo.com/v1/search';

/** Coordinates are rounded to ~1 km: enough for weather, less precise location data on the wire. */
const coord = (n: number) => Math.round(n * 100) / 100;

export function buildForecastUrl(latitude: number, longitude: number, days = 7): string {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new Error('Invalid coordinates');
  }
  return (
    `${API}?latitude=${coord(latitude)}&longitude=${coord(longitude)}` +
    '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code' +
    `&forecast_days=${Math.min(Math.max(days, 1), 16)}&timezone=auto`
  );
}

export function buildGeocodeUrl(query: string): string {
  const name = query.trim().slice(0, 80);
  if (name.length < 2) throw new Error('Type at least 2 letters');
  return `${GEO_API}?name=${encodeURIComponent(name)}&count=5&language=en&format=json`;
}

/** WMO weather codes (used by Open-Meteo), collapsed into readable buckets. */
export function mapWeatherCode(code: number): string {
  if (code === 0) return 'Clear';
  if (code === 1) return 'Mostly Clear';
  if (code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain Showers';
  if (code === 85 || code === 86) return 'Snow Showers';
  if (code >= 95 && code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Validates and normalises an Open-Meteo forecast response. Throws on anything malformed. */
export function parseForecast(json: unknown, now: Date = new Date()): ForecastBundle {
  const root = json as Record<string, any> | null;
  const current = root?.current;
  if (!current || !isNum(current.temperature_2m) || !isNum(current.weather_code)) {
    throw new Error('Malformed Open-Meteo response');
  }
  const daily: DailyForecast[] = [];
  const d = root?.daily;
  if (d && Array.isArray(d.time)) {
    d.time.forEach((date: unknown, i: number) => {
      const maxC = d.temperature_2m_max?.[i];
      const minC = d.temperature_2m_min?.[i];
      const code = d.weather_code?.[i];
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !isNum(maxC) || !isNum(minC) || !isNum(code)) return;
      const rain = d.precipitation_probability_max?.[i];
      daily.push({
        date,
        maxC,
        minC,
        precipitationProbability: isNum(rain) ? rain : undefined,
        condition: mapWeatherCode(code),
        conditionCode: code
      });
    });
  }
  const today = daily[0];
  return {
    current: {
      temperatureC: current.temperature_2m,
      feelsLikeC: isNum(current.apparent_temperature) ? current.apparent_temperature : undefined,
      precipitationProbability: today?.precipitationProbability,
      condition: mapWeatherCode(current.weather_code),
      conditionCode: current.weather_code,
      maxC: today?.maxC,
      minC: today?.minC
    },
    daily,
    fetchedAt: now.toISOString()
  };
}

export function parseGeocode(json: unknown): GeoPlace[] {
  const results = (json as { results?: unknown[] } | null)?.results;
  if (!Array.isArray(results)) return [];
  const places: GeoPlace[] = [];
  for (const r of results as Record<string, unknown>[]) {
    if (typeof r?.name !== 'string' || !isNum(r.latitude) || !isNum(r.longitude)) continue;
    const region = [r.admin1, r.country].filter((x): x is string => typeof x === 'string' && x.length > 0).join(', ');
    places.push({ name: r.name, latitude: r.latitude, longitude: r.longitude, region: region || undefined });
  }
  return places;
}

/** A forecast day as a snapshot — used to plan an event's outfit. Null when the date is outside the forecast. */
export function snapshotForDate(bundle: ForecastBundle, date: string): WeatherSnapshot | null {
  const day = bundle.daily.find((d) => d.date === date);
  if (!day) return null;
  return {
    temperatureC: Math.round((day.maxC + day.minC) / 2),
    maxC: day.maxC,
    minC: day.minC,
    precipitationProbability: day.precipitationProbability,
    condition: day.condition,
    conditionCode: day.conditionCode
  };
}

export type WeatherBand = 'freezing' | 'cold' | 'cool' | 'mild' | 'warm' | 'hot';

/** Uses "feels like" when known — that's what the body dresses for. */
export function weatherBand(w: WeatherSnapshot): WeatherBand {
  const t = isNum(w.feelsLikeC) ? w.feelsLikeC : w.temperatureC;
  if (t < 5) return 'freezing';
  if (t < 12) return 'cold';
  if (t < 18) return 'cool';
  if (t < 25) return 'mild';
  if (t < 31) return 'warm';
  return 'hot';
}

export function isRainy(w: WeatherSnapshot): boolean {
  const code = w.conditionCode ?? -1;
  const wetCode = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
  return wetCode || (w.precipitationProbability ?? 0) >= 50;
}

export function formatTemperature(celsius: number, unit: 'celsius' | 'fahrenheit' = 'celsius'): string {
  return unit === 'fahrenheit' ? `${Math.round((celsius * 9) / 5 + 32)}°F` : `${Math.round(celsius)}°C`;
}

/** One or two short, honest dressing tips for the day. */
export function weatherAdvice(w: WeatherSnapshot): string[] {
  const tips: string[] = [];
  const band = weatherBand(w);
  if (band === 'freezing' || band === 'cold') tips.push('Layer up — a warm outer layer is a must.');
  else if (band === 'cool') tips.push('Bring a light layer for the cooler hours.');
  else if (band === 'hot') tips.push('Breathable fabrics and light colours keep you cooler.');
  else if (band === 'warm') tips.push('Light layers work best today.');
  if (isRainy(w)) tips.push(`Rain likely${isNum(w.precipitationProbability) ? ` (${w.precipitationProbability}%)` : ''} — skip suede and light canvas shoes.`);
  return tips;
}

/** Cache freshness check shared by both platforms' caches. */
export function isForecastFresh(bundle: Pick<ForecastBundle, 'fetchedAt'>, maxAgeMs = 30 * 60 * 1000, now = Date.now()): boolean {
  const t = new Date(bundle.fetchedAt).getTime();
  return Number.isFinite(t) && now - t >= 0 && now - t < maxAgeMs;
}
