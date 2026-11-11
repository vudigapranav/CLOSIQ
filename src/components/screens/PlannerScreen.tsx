import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus, X, Sparkles, Pencil, Trash2, CalendarPlus, Clock, CloudSun } from 'lucide-react';
import { GarmentImage } from '../ui/GarmentImage';
import { SecondaryButton } from '../ui/SecondaryButton';
import { PrimaryButton } from '../ui/PrimaryButton';
import { EmptyState } from '../ui/EmptyState';
import { EventModal } from '../modals/EventModal';
import { GarmentItem, LayeringPreference, Outfit, WeekDay, WeeklyPlanEntry, matchLabel } from '../../types/wardrobe';
import {
  PlannerEvent,
  PlannerEventInput,
  addPlannerEvent,
  deletePlannerEvent,
  listPlannerEvents,
  todayLocal,
  updatePlannerEvent
} from '../../services/cloud/plannerCloud';
import { buildIcs, hasRealTime, icsFileName } from '../../services/calendarExport';
import { generateAIOutfitWithGemini } from '../../services/ai/outfitStylist';
import { formatTemperature, isRainy, snapshotForDate, WeatherSnapshot } from '../../services/weather/weatherCore';
import type { WebWeatherState } from '../../services/weather/webWeather';
import type { OutfitBrain } from '../../services/outfitBrain';

interface PlannerScreenProps {
  weeklyPlan: WeeklyPlanEntry[];
  savedOutfits: Outfit[];
  onUpdateLabel: (day: WeekDay, label: string) => void;
  onAssignOutfit: (day: WeekDay, outfit: Outfit) => void;
  onClearOutfit: (day: WeekDay) => void;
  onNavigateToStylist?: () => void;
  /** Signed-in user — dated events live in their account (shared with the phone app). */
  userId: string;
  wardrobe?: GarmentItem[];
  layeringPreference?: LayeringPreference;
  brain?: OutfitBrain;
  /** Held once in App; used for each event's forecast and the outfit suggestion. */
  weather?: WebWeatherState;
}

interface Suggestion {
  loading: boolean;
  outfit?: Outfit;
  error?: string;
  seed: number;
}

function localDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function dateLabel(date: string): string {
  return localDate(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function timeLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return new Date(2000, 0, 1, h || 0, m || 0).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function weatherLine(w: WeatherSnapshot, unit: 'celsius' | 'fahrenheit'): string {
  const range =
    w.maxC !== undefined && w.minC !== undefined
      ? `${formatTemperature(w.minC, unit)}–${formatTemperature(w.maxC, unit)}`
      : formatTemperature(w.temperatureC, unit);
  const rain = isRainy(w) && w.precipitationProbability !== undefined ? ` · ${Math.round(w.precipitationProbability)}% rain` : '';
  return `${range} · ${w.condition}${rain}`;
}

function downloadIcs(event: PlannerEvent) {
  const ics = buildIcs([
    {
      id: event.id,
      title: event.title,
      date: event.date,
      time: hasRealTime(event.time) ? event.time : null,
      occasion: event.occasion,
      notes: event.notes,
      outfit: event.outfit ? { title: event.outfit.title, items: event.outfit.items.map((i) => ({ name: i.name })) } : null
    }
  ]);
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = icsFileName(event.title);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const PlannerScreen: React.FC<PlannerScreenProps> = ({
  weeklyPlan,
  savedOutfits,
  onUpdateLabel,
  onAssignOutfit,
  onClearOutfit,
  onNavigateToStylist,
  userId,
  wardrobe = [],
  layeringPreference = 'sometimes',
  brain,
  weather
}) => {
  const [pickerDay, setPickerDay] = useState<WeekDay | null>(null);

  // ---- dated events (shared with the mobile app via planner_events) ----
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ event?: PlannerEvent } | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>({});
  const [showPast, setShowPast] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      setEvents(await listPlannerEvents(userId));
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : 'Couldn’t load your events.');
    } finally {
      setEventsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const today = todayLocal();
  const { upcoming, past } = useMemo(() => {
    const sorted = [...events].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    return { upcoming: sorted.filter((e) => e.date >= today), past: sorted.filter((e) => e.date < today).reverse() };
  }, [events, today]);

  const saveEvent = async (input: PlannerEventInput) => {
    if (modal?.event) {
      await updatePlannerEvent(userId, modal.event.id, input);
      setEvents((prev) => prev.map((e) => (e.id === modal.event!.id ? { ...e, ...input } : e)));
    } else {
      const created = await addPlannerEvent(userId, input);
      setEvents((prev) => [...prev, created]);
    }
  };

  const removeEvent = async (event: PlannerEvent) => {
    if (!window.confirm(`Remove “${event.title}” from your planner?`)) return;
    setActionError(null);
    try {
      await deletePlannerEvent(userId, event.id);
      setEvents((prev) => prev.filter((e) => e.id !== event.id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Couldn’t remove that event.');
    }
  };

  const weatherFor = (event: PlannerEvent): WeatherSnapshot | null =>
    weather?.bundle ? snapshotForDate(weather.bundle, event.date) : null;

  const suggest = async (event: PlannerEvent, nextSeed?: number) => {
    const seed = nextSeed ?? (suggestions[event.id]?.seed ?? 0);
    setSuggestions((prev) => ({ ...prev, [event.id]: { loading: true, seed } }));
    const snapshot = weatherFor(event);
    const prompt = [
      `${event.occasion} — ${event.title}`,
      event.notes ? `Dress notes: ${event.notes}` : '',
      snapshot ? `Weather: ${weatherLine(snapshot, 'celsius')}` : ''
    ]
      .filter(Boolean)
      .join('. ');
    try {
      const outfit = await generateAIOutfitWithGemini(wardrobe, { prompt, layeringPreference, brain, weather: snapshot }, seed);
      setSuggestions((prev) => ({ ...prev, [event.id]: { loading: false, outfit, seed } }));
    } catch (err) {
      setSuggestions((prev) => ({
        ...prev,
        [event.id]: { loading: false, seed, error: err instanceof Error ? err.message : 'Couldn’t suggest an outfit.' }
      }));
    }
  };

  const applySuggestion = async (event: PlannerEvent, outfit: Outfit) => {
    setActionError(null);
    try {
      await updatePlannerEvent(userId, event.id, { outfit });
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, outfit } : e)));
      setSuggestions((prev) => {
        const { [event.id]: _done, ...rest } = prev;
        return rest;
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Couldn’t save that outfit to the event.');
    }
  };

  const clearEventOutfit = async (event: PlannerEvent) => {
    setActionError(null);
    try {
      await updatePlannerEvent(userId, event.id, { outfit: undefined });
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, outfit: undefined } : e)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Couldn’t update that event.');
    }
  };

  const renderEvent = (event: PlannerEvent) => {
    const snapshot = weatherFor(event);
    const sug = suggestions[event.id];
    const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', padding: 4 };
    return (
      <div
        key={event.id}
        className="animate-card-enter"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'var(--color-primary)',
                  backgroundColor: 'var(--color-surface-subtle)',
                  padding: '3px 9px',
                  borderRadius: 'var(--radius-pill)'
                }}
              >
                {event.occasion.toUpperCase()}
              </span>
              <span className="text-caption">
                {dateLabel(event.date)}
                {hasRealTime(event.time) && (
                  <>
                    {' · '}
                    <Clock size={11} style={{ verticalAlign: '-1px' }} /> {timeLabel(event.time)}
                  </>
                )}
              </span>
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{event.title}</div>
            {event.notes && <p className="text-caption" style={{ marginTop: 2 }}>{event.notes}</p>}
            {snapshot ? (
              <p className="text-caption" style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <CloudSun size={13} /> {weatherLine(snapshot, weather?.unit ?? 'celsius')}
              </p>
            ) : weather?.bundle ? (
              <p className="text-caption" style={{ marginTop: 4 }}>No forecast for this date yet.</p>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            <button style={iconBtn} onClick={() => downloadIcs(event)} aria-label="Add to calendar" title="Add to calendar">
              <CalendarPlus size={17} />
            </button>
            <button style={iconBtn} onClick={() => setModal({ event })} aria-label="Edit event" title="Edit">
              <Pencil size={16} />
            </button>
            <button style={iconBtn} onClick={() => removeEvent(event)} aria-label="Delete event" title="Delete">
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {event.outfit && event.outfit.items.length > 0 ? (
          <div style={{ padding: 8, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-surface-subtle)' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, overflowX: 'auto' }} className="hide-scrollbar">
              {event.outfit.items.slice(0, 5).map((item) => (
                <div key={item.id} style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                  <GarmentImage src={item.imageUrl} alt={item.name} category={item.category} hexColor={item.hexColor} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.outfit.title}</div>
                <div className="text-caption" style={{ fontSize: '0.7rem' }}>
                  {event.outfit.items.length} pieces · {matchLabel(event.outfit)}
                </div>
              </div>
              <SecondaryButton style={{ padding: '6px 10px', fontSize: '0.7rem' }} onClick={() => suggest(event, (sug?.seed ?? 0) + 1)}>
                Suggest another
              </SecondaryButton>
              <button style={iconBtn} onClick={() => clearEventOutfit(event)} aria-label="Remove outfit from event" title="Remove outfit">
                <X size={16} />
              </button>
            </div>
          </div>
        ) : !sug ? (
          <SecondaryButton
            fullWidth
            icon={<Sparkles size={15} />}
            style={{ padding: '9px 12px', fontSize: '0.8rem' }}
            disabled={wardrobe.length === 0}
            onClick={() => suggest(event)}
          >
            {wardrobe.length === 0 ? 'Add clothes to get a suggestion' : 'Suggest an outfit'}
          </SecondaryButton>
        ) : null}

        {sug && (
          <div className="animate-fade-in" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
            {sug.loading ? (
              <p className="text-caption">Styling this event from your wardrobe…</p>
            ) : sug.error ? (
              <p role="alert" className="text-caption" style={{ color: 'var(--color-danger)' }}>{sug.error}</p>
            ) : sug.outfit ? (
              <div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, overflowX: 'auto' }} className="hide-scrollbar">
                  {sug.outfit.items.map((item) => (
                    <div key={item.id} style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                      <GarmentImage src={item.imageUrl} alt={item.name} category={item.category} hexColor={item.hexColor} />
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>{sug.outfit.title}</div>
                <div className="text-caption" style={{ marginBottom: 4 }}>{matchLabel(sug.outfit)}</div>
                {sug.outfit.explanation?.summary && <p className="text-caption" style={{ marginBottom: 8 }}>{sug.outfit.explanation.summary}</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <PrimaryButton style={{ padding: '8px 14px', fontSize: '0.78rem' }} onClick={() => applySuggestion(event, sug.outfit!)}>
                    Use this
                  </PrimaryButton>
                  <SecondaryButton style={{ padding: '8px 14px', fontSize: '0.78rem' }} onClick={() => suggest(event, sug.seed + 1)}>
                    Try another
                  </SecondaryButton>
                  <SecondaryButton
                    style={{ padding: '8px 14px', fontSize: '0.78rem' }}
                    onClick={() => setSuggestions((prev) => { const { [event.id]: _x, ...rest } = prev; return rest; })}
                  >
                    Dismiss
                  </SecondaryButton>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  const handleAssign = (day: WeekDay, outfit: Outfit) => {
    onAssignOutfit(day, outfit);
    setPickerDay(null);
  };

  return (
    <div style={{ padding: '20px 20px 32px' }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 className="text-screen-heading">Outfit Planner</h1>
        <p className="text-body" style={{ marginTop: 2 }}>Plan your looks for the week ahead.</p>
      </div>

      {/* Upcoming events — dated, synced with the phone app */}
      <section style={{ marginBottom: 28 }} aria-label="Upcoming events">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h2 className="text-section-heading" style={{ margin: 0 }}>Upcoming events</h2>
          <SecondaryButton icon={<Plus size={14} />} style={{ padding: '7px 12px', fontSize: '0.75rem' }} onClick={() => setModal({})}>
            Add event
          </SecondaryButton>
        </div>
        {actionError && <p role="alert" className="text-caption" style={{ color: 'var(--color-danger)', marginBottom: 8 }}>{actionError}</p>}
        {eventsLoading ? (
          <p className="text-caption">Loading your events…</p>
        ) : eventsError ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <p role="alert" className="text-caption" style={{ color: 'var(--color-danger)', flex: 1 }}>{eventsError}</p>
            <SecondaryButton style={{ padding: '6px 10px', fontSize: '0.72rem' }} onClick={() => void loadEvents()}>Retry</SecondaryButton>
          </div>
        ) : upcoming.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={26} color="var(--color-primary)" />}
            title="No upcoming events."
            description="Add a wedding, interview or trip and CLOSIQ will style it from your own wardrobe."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{upcoming.map(renderEvent)}</div>
        )}
        {!eventsLoading && !eventsError && past.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => setShowPast((v) => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '0.78rem', fontWeight: 600, padding: 0 }}
            >
              {showPast ? 'Hide' : 'Show'} past events ({past.length})
            </button>
            {showPast && <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>{past.map(renderEvent)}</div>}
          </div>
        )}
      </section>

      <h2 className="text-section-heading" style={{ margin: '0 0 10px' }}>This week’s plan</h2>

      {/* Weekly Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {weeklyPlan.map((entry) => {
          const isPicking = pickerDay === entry.day;
          return (
            <div
              key={entry.day}
              className="animate-card-enter"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-sm)',
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Day badge */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-surface-subtle)',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    flexShrink: 0
                  }}
                >
                  {entry.day.toUpperCase()}
                </div>

                {/* Occasion label input */}
                <input
                  type="text"
                  value={entry.label}
                  onChange={(e) => onUpdateLabel(entry.day, e.target.value)}
                  placeholder="Add an occasion…"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface-subtle)',
                    color: 'var(--color-text-primary)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none'
                  }}
                />
              </div>

              {/* Assigned outfit preview */}
              {entry.outfit ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: 8,
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-surface-subtle)'
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                    <GarmentImage
                      src={entry.outfit.items[0].imageUrl}
                      alt={entry.outfit.title}
                      category={entry.outfit.items[0].category}
                      hexColor={entry.outfit.items[0].hexColor}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.outfit.title}
                    </div>
                    <div className="text-caption" style={{ fontSize: '0.7rem' }}>{entry.outfit.items.length} pieces planned</div>
                  </div>
                  <button
                    onClick={() => onClearOutfit(entry.day)}
                    aria-label="Remove planned outfit"
                    title="Remove planned outfit"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', flexShrink: 0 }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <SecondaryButton
                  fullWidth
                  icon={<Plus size={15} />}
                  style={{ padding: '9px 12px', fontSize: '0.8rem' }}
                  onClick={() => setPickerDay(isPicking ? null : entry.day)}
                >
                  {isPicking ? 'Choose a look below' : 'Plan an outfit'}
                </SecondaryButton>
              )}

              {/* Saved-outfit picker strip */}
              {isPicking && (
                <div className="animate-fade-in" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
                  {savedOutfits.length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 2px' }}>
                      <Sparkles size={16} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
                      <p className="text-caption" style={{ flex: 1 }}>
                        No saved looks yet. Save one from Today or the AI Stylist first.
                      </p>
                      {onNavigateToStylist && (
                        <SecondaryButton style={{ padding: '6px 10px', fontSize: '0.7rem', flexShrink: 0 }} onClick={onNavigateToStylist}>
                          Open Stylist
                        </SecondaryButton>
                      )}
                    </div>
                  ) : (
                    <div className="hide-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
                      {savedOutfits.map((look) => (
                        <button
                          key={look.id}
                          onClick={() => handleAssign(entry.day, look)}
                          title={`Plan ${look.title} for ${entry.day}`}
                          style={{
                            flexShrink: 0,
                            width: 78,
                            padding: 0,
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--color-surface-elevated)',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textAlign: 'left'
                          }}
                        >
                          <div style={{ width: '100%', height: 78 }}>
                            <GarmentImage
                              src={look.items[0].imageUrl}
                              alt={look.title}
                              category={look.items[0].category}
                              hexColor={look.items[0].hexColor}
                            />
                          </div>
                          <div style={{ padding: '5px 7px' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {look.title}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {savedOutfits.length === 0 && (
        <div style={{ marginTop: 20 }}>
          <EmptyState
            icon={<CalendarDays size={26} color="var(--color-primary)" />}
            title="Nothing planned yet."
            description="Save a few looks from Today or the AI Stylist, then assign them to your week here."
          />
        </div>
      )}

      {modal && <EventModal event={modal.event} onClose={() => setModal(null)} onSave={saveEvent} />}
    </div>
  );
};
