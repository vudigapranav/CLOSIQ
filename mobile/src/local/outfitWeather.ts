import type { WeatherContext } from '../services/personalizationContext';
import type { WeatherSnapshot } from '../../../src/services/weather/weatherCore';
/** The phone's weather context as the shared engine's snapshot (no invented numbers). */
export function weatherSnapshotFromContext(ctx?: WeatherContext): WeatherSnapshot | null {
  if (!ctx || !Number.isFinite(ctx.temperatureCelsius)) return null;
  const c = (ctx.condition || '').toLowerCase();
  // Only the condition text is known here; map wet conditions to a WMO rain code so isRainy() sees them.
  const conditionCode = /thunder/.test(c)
    ? 95
    : /(rain|shower)/.test(c)
    ? 61
    : /drizzle/.test(c)
    ? 51
    : undefined;
  const extra = ctx;
  return {
    temperatureC: ctx.temperatureCelsius,
    feelsLikeC: Number.isFinite(extra.feelsLikeCelsius) ? extra.feelsLikeCelsius : undefined,
    precipitationProbability: Number.isFinite(extra.precipitationProbability)
      ? extra.precipitationProbability
      : undefined,
    maxC: Number.isFinite(extra.maxC) ? extra.maxC : undefined,
    minC: Number.isFinite(extra.minC) ? extra.minC : undefined,
    condition: ctx.condition,
    conditionCode
  };
}
