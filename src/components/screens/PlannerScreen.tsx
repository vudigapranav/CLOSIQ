import React, { useState } from 'react';
import { CalendarDays, Plus, X, Sparkles } from 'lucide-react';
import { GarmentImage } from '../ui/GarmentImage';
import { SecondaryButton } from '../ui/SecondaryButton';
import { EmptyState } from '../ui/EmptyState';
import { Outfit, WeekDay, WeeklyPlanEntry } from '../../types/wardrobe';

interface PlannerScreenProps {
  weeklyPlan: WeeklyPlanEntry[];
  savedOutfits: Outfit[];
  onUpdateLabel: (day: WeekDay, label: string) => void;
  onAssignOutfit: (day: WeekDay, outfit: Outfit) => void;
  onClearOutfit: (day: WeekDay) => void;
  onNavigateToStylist?: () => void;
}

export const PlannerScreen: React.FC<PlannerScreenProps> = ({
  weeklyPlan,
  savedOutfits,
  onUpdateLabel,
  onAssignOutfit,
  onClearOutfit,
  onNavigateToStylist
}) => {
  const [pickerDay, setPickerDay] = useState<WeekDay | null>(null);

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
    </div>
  );
};
