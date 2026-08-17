/**
 * Mobile-only weather model. Deliberately small (per M14 brief) and
 * deliberately NOT added to the shared web types file — the web app has no
 * weather feature to share this with.
 *
 * `temperatureCelsius` is the ONE canonical value ever stored or fetched.
 * °F is derived at render time only (see weatherService.ts /
 * TodayScreen.tsx) — never fetched or cached as a second unit, so there is
 * only ever one number that can drift from reality.
 */
export type WeatherSource = 'live' | 'cached';

export interface WeatherData {
  temperatureCelsius: number;
  feelsLikeCelsius?: number;
  condition: string;
  conditionCode?: number;
  humidity?: number;
  locationName?: string;
  /** ISO timestamp of when this reading was fetched (not when it's displayed). */
  timestamp: string;
  source: WeatherSource;
}

/** Every real outcome a caller needs to react to distinctly — see
 *  weatherService.ts's fetchCurrentWeather() for how each one is reached. */
export type WeatherFetchStatus =
  | 'success'
  | 'permission-denied'
  | 'location-unavailable'
  | 'network-error'
  | 'error';

export interface WeatherFetchResult {
  status: WeatherFetchStatus;
  /** Live data on success; a cached fallback on failure if one exists;
   *  null only when there is truly nothing to show ("Weather unavailable"). */
  weather: WeatherData | null;
}
