import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildForecastUrl,
  buildGeocodeUrl,
  formatTemperature,
  isForecastFresh,
  isRainy,
  mapWeatherCode,
  parseForecast,
  parseGeocode,
  snapshotForDate,
  weatherAdvice,
  weatherBand
} from '../../src/services/weather/weatherCore';
import {
  parseStoredForecast,
  parseStoredPlace,
  parseTempUnit,
  pickCachedBundle,
  placeKey
} from '../../src/services/weather/webWeatherHelpers';

const sample = {
  current: { temperature_2m: 27.4, apparent_temperature: 29, weather_code: 2 },
  daily: {
    time: ['2026-11-11', '2026-11-12', 'bad-date'],
    temperature_2m_max: [31, 30, 20],
    temperature_2m_min: [21, 20, 10],
    precipitation_probability_max: [10, 70, 0],
    weather_code: [2, 63, 0]
  }
};

test('parseForecast: happy path', () => {
  const b = parseForecast(sample, new Date('2026-11-11T05:00:00Z'));
  assert.equal(b.current.temperatureC, 27.4);
  assert.equal(b.current.condition, 'Partly Cloudy');
  assert.equal(b.current.maxC, 31);
  assert.equal(b.current.precipitationProbability, 10);
  assert.equal(b.daily.length, 2); // invalid date dropped
  assert.equal(b.fetchedAt, '2026-11-11T05:00:00.000Z');
});

test('parseForecast: malformed throws', () => {
  assert.throws(() => parseForecast(null));
  assert.throws(() => parseForecast({}));
  assert.throws(() => parseForecast({ current: { temperature_2m: 'x', weather_code: 1 } }));
  assert.doesNotThrow(() => parseForecast({ current: { temperature_2m: 20, weather_code: 0 } }));
});

test('mapWeatherCode: unknown is not Clear', () => {
  assert.equal(mapWeatherCode(0), 'Clear');
  assert.equal(mapWeatherCode(63), 'Rain');
  assert.equal(mapWeatherCode(95), 'Thunderstorm');
  assert.equal(mapWeatherCode(42), 'Unknown');
  assert.equal(mapWeatherCode(-1), 'Unknown');
  assert.equal(mapWeatherCode(120), 'Unknown');
});

test('weatherBand edges', () => {
  const t = (temperatureC: number) => weatherBand({ temperatureC, condition: 'x' });
  assert.equal(t(4.9), 'freezing');
  assert.equal(t(5), 'cold');
  assert.equal(t(12), 'cool');
  assert.equal(t(18), 'mild');
  assert.equal(t(25), 'warm');
  assert.equal(t(31), 'hot');
  assert.equal(weatherBand({ temperatureC: 30, feelsLikeC: 3, condition: 'x' }), 'freezing');
});

test('isRainy', () => {
  assert.equal(isRainy({ temperatureC: 20, condition: 'Rain', conditionCode: 63 }), true);
  assert.equal(isRainy({ temperatureC: 20, condition: 'Clear', conditionCode: 0, precipitationProbability: 50 }), true);
  assert.equal(isRainy({ temperatureC: 20, condition: 'Clear', conditionCode: 0, precipitationProbability: 49 }), false);
  assert.equal(isRainy({ temperatureC: 20, condition: 'Snow', conditionCode: 73 }), false);
});

test('snapshotForDate', () => {
  const b = parseForecast(sample);
  const s = snapshotForDate(b, '2026-11-12');
  assert.equal(s?.condition, 'Rain');
  assert.equal(s?.temperatureC, 25);
  assert.equal(snapshotForDate(b, '2030-01-01'), null);
});

test('isForecastFresh', () => {
  const now = Date.parse('2026-11-11T12:00:00Z');
  assert.equal(isForecastFresh({ fetchedAt: '2026-11-11T11:45:00Z' }, undefined, now), true);
  assert.equal(isForecastFresh({ fetchedAt: '2026-11-11T11:29:00Z' }, undefined, now), false);
  assert.equal(isForecastFresh({ fetchedAt: '2026-11-11T12:10:00Z' }, undefined, now), false); // future
  assert.equal(isForecastFresh({ fetchedAt: 'garbage' }, undefined, now), false);
});

test('buildForecastUrl rounds coordinates and rejects invalid ones', () => {
  const u = buildForecastUrl(17.38501, 78.48667);
  assert.match(u, /latitude=17\.39&longitude=78\.49/);
  assert.match(u, /forecast_days=7/);
  assert.match(buildForecastUrl(1, 1, 99), /forecast_days=16/);
  assert.throws(() => buildForecastUrl(91, 0));
  assert.throws(() => buildForecastUrl(0, 181));
  assert.throws(() => buildForecastUrl(NaN, 0));
});

test('geocode helpers', () => {
  assert.throws(() => buildGeocodeUrl(' a '));
  assert.match(buildGeocodeUrl('New Delhi'), /name=New%20Delhi/);
  const places = parseGeocode({ results: [{ name: 'Hyderabad', latitude: 17.4, longitude: 78.5, admin1: 'Telangana', country: 'India' }, { name: 'bad' }] });
  assert.equal(places.length, 1);
  assert.equal(places[0].region, 'Telangana, India');
  assert.deepEqual(parseGeocode(null), []);
});

test('formatTemperature and advice', () => {
  assert.equal(formatTemperature(20), '20°C');
  assert.equal(formatTemperature(20, 'fahrenheit'), '68°F');
  assert.ok(weatherAdvice({ temperatureC: 3, condition: 'Snow' }).length > 0);
});

test('web helpers: stored place / unit / cache', () => {
  assert.equal(parseTempUnit('fahrenheit'), 'fahrenheit');
  assert.equal(parseTempUnit('nonsense'), 'celsius');
  assert.equal(parseTempUnit(null), 'celsius');
  assert.equal(parseStoredPlace('{bad'), null);
  assert.equal(parseStoredPlace(JSON.stringify({ name: 'X', latitude: 200, longitude: 0 })), null);
  const place = parseStoredPlace(JSON.stringify({ name: 'Hyderabad', latitude: 17.38, longitude: 78.48 }));
  assert.ok(place);
  assert.equal(placeKey(place!), '17.38,78.48');

  const bundle = parseForecast(sample, new Date('2026-11-11T11:50:00Z'));
  const stored = parseStoredForecast(JSON.stringify({ key: placeKey(place!), bundle }));
  assert.ok(stored);
  const now = Date.parse('2026-11-11T12:00:00Z');
  assert.ok(pickCachedBundle(stored, place!, false, now));
  assert.equal(pickCachedBundle(stored, place!, false, now + 3600_000), null);
  assert.ok(pickCachedBundle(stored, place!, true, now + 3600_000));
  assert.equal(pickCachedBundle(stored, { name: 'Elsewhere', latitude: 10, longitude: 10 }, true, now), null);
  assert.equal(parseStoredForecast('{"key":1}'), null);
});
