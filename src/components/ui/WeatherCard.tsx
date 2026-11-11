import React, { useState } from 'react';
import { CloudSun, RefreshCw, MapPin, Search } from 'lucide-react';
import { GeoPlace, formatTemperature, weatherAdvice } from '../../services/weather/weatherCore';
import { WebWeatherState, searchCities } from '../../services/weather/webWeather';
import { placeLabel } from '../../services/weather/webWeatherHelpers';

interface WeatherCardProps {
  weather: WebWeatherState;
}

const linkBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  color: 'var(--color-primary)',
  fontSize: '0.78rem',
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4
};

export const WeatherCard: React.FC<WeatherCardProps> = ({ weather }) => {
  const { status, bundle, place, unit, refresh, choosePlace, locateAndUse } = weather;
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoPlace[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [locError, setLocError] = useState(false);

  const showPicker = picking || status === 'no-location';
  const cur = bundle?.current;

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setResults(await searchCities(query));
    setSearching(false);
  };

  const pick = (p: GeoPlace) => {
    setPicking(false);
    setResults(null);
    setQuery('');
    choosePlace(p);
  };

  const locate = async () => {
    setLocError(false);
    const ok = await locateAndUse();
    if (ok) setPicking(false);
    else setLocError(true);
  };

  return (
    <section
      aria-label="Weather"
      style={{
        marginTop: 14,
        padding: '12px 14px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)'
      }}
    >
      {status === 'loading' && (
        <div aria-busy="true" aria-label="Loading weather" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ height: 14, width: '40%', borderRadius: 7, backgroundColor: 'var(--color-surface-subtle)' }} />
          <div style={{ height: 22, width: '65%', borderRadius: 7, backgroundColor: 'var(--color-surface-subtle)' }} />
        </div>
      )}

      {cur && status !== 'loading' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CloudSun size={22} color="var(--color-primary)" aria-hidden="true" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                {place ? placeLabel(place) : 'Weather'}
                {status === 'cached' ? ' · last known' : ''}
              </p>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {formatTemperature(cur.temperatureC, unit)} · {cur.condition}
              </p>
              <p style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                {typeof cur.maxC === 'number' && typeof cur.minC === 'number'
                  ? `H ${formatTemperature(cur.maxC, unit)} · L ${formatTemperature(cur.minC, unit)}`
                  : ''}
                {typeof cur.precipitationProbability === 'number' ? ` · Rain ${cur.precipitationProbability}%` : ''}
              </p>
            </div>
            <button type="button" onClick={refresh} aria-label="Refresh weather" style={{ ...linkBtn, padding: 6 }}>
              <RefreshCw size={16} />
            </button>
          </div>
          {weatherAdvice(cur).map((tip) => (
            <p key={tip} style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 6, lineHeight: 1.4 }}>
              {tip}
            </p>
          ))}
        </div>
      )}

      {status === 'error' && !cur && (
        <p role="status" style={{ fontSize: '0.8rem', color: 'var(--color-danger)' }}>
          Couldn’t load the weather right now. Your outfits still work.{' '}
          <button type="button" onClick={refresh} style={linkBtn} aria-label="Retry loading weather">
            Retry
          </button>
        </p>
      )}

      {status === 'no-location' && (
        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8 }}>
          Add your city to get weather-aware outfits
        </p>
      )}

      {showPicker && (
        <div style={{ marginTop: status === 'no-location' ? 0 : 10 }}>
          <form onSubmit={runSearch} style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search city"
              aria-label="Search for your city"
              style={{
                flex: 1,
                minWidth: 0,
                padding: '8px 12px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface-elevated)',
                color: 'var(--color-text-primary)',
                fontSize: '0.85rem'
              }}
            />
            <button type="submit" aria-label="Search city" disabled={searching} style={{ ...linkBtn, padding: '0 6px' }}>
              <Search size={16} />
            </button>
          </form>
          {searching && <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 6 }}>Searching…</p>}
          {results && !searching && results.length === 0 && (
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 6 }}>No matching city found.</p>
          )}
          {results && results.length > 0 && (
            <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }} aria-label="City results">
              {results.map((r) => (
                <li key={`${r.latitude},${r.longitude}`}>
                  <button
                    type="button"
                    onClick={() => pick(r)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 4px',
                      background: 'none',
                      border: 'none',
                      borderBottom: '1px solid var(--color-border)',
                      cursor: 'pointer',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.82rem'
                    }}
                  >
                    {placeLabel(r)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {locError && (
        <p role="status" style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: 6 }}>
          Couldn’t get your location. Search for your city instead.
        </p>
      )}

      {status !== 'loading' && (
        <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
          {status !== 'no-location' && (
            <button type="button" style={linkBtn} onClick={() => setPicking((v) => !v)} aria-label="Change city">
              <Search size={13} /> Change city
            </button>
          )}
          <button type="button" style={linkBtn} onClick={locate} aria-label="Use my location">
            <MapPin size={13} /> Use my location
          </button>
          <button
            type="button"
            style={{ ...linkBtn, marginLeft: 'auto', color: 'var(--color-text-secondary)' }}
            onClick={() => weather.setUnit(unit === 'celsius' ? 'fahrenheit' : 'celsius')}
            aria-label={`Show temperatures in ${unit === 'celsius' ? 'Fahrenheit' : 'Celsius'}`}
          >
            {unit === 'celsius' ? '°C' : '°F'}
          </button>
        </div>
      )}
    </section>
  );
};
