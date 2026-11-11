import React, { useState } from 'react';
import { X } from 'lucide-react';
import { PrimaryButton } from '../ui/PrimaryButton';
import { PlannerEvent, PlannerEventInput, todayLocal } from '../../services/cloud/plannerCloud';

const EVENT_OCCASIONS = ['College', 'Work', 'Date', 'Party', 'Casual', 'Travel'];

interface EventModalProps {
  /** Present when editing; absent when adding. */
  event?: PlannerEvent;
  onClose: () => void;
  /** Resolves when saved; throws to show the error inside the dialog. */
  onSave: (input: PlannerEventInput) => Promise<void>;
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 12px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-surface-subtle)',
  color: 'var(--color-text-primary)',
  fontSize: '0.88rem',
  outline: 'none',
  boxSizing: 'border-box'
};

const labelStyle: React.CSSProperties = { fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6, display: 'block' };

/** Add / edit a dated event (title, date, optional time, occasion, dress notes). */
export const EventModal: React.FC<EventModalProps> = ({ event, onClose, onSave }) => {
  const [title, setTitle] = useState(event?.title ?? '');
  const [date, setDate] = useState(event?.date ?? todayLocal());
  // '00:00' is how "no time" is stored (the column is NOT NULL).
  const [time, setTime] = useState(event && event.time !== '00:00' ? event.time : '');
  const [occasion, setOccasion] = useState(event?.occasion ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = title.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date) && !saving;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        date,
        time: time || '00:00',
        occasion: occasion.trim() || 'Casual',
        notes: notes.trim() || undefined,
        outfit: event?.outfit
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t save this event.');
      setSaving(false);
    }
  };

  return (
    <div
      className="animate-fade-in sheet-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center'
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={event ? 'Edit event' : 'Add event'}
        className="animate-slide-up sheet"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: 'var(--color-surface)',
          borderTopLeftRadius: 'var(--radius-xl)',
          borderTopRightRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border)',
          padding: '20px 22px 24px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 className="text-section-heading" style={{ margin: 0 }}>{event ? 'Edit event' : 'Add an event'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}
          >
            <X size={22} />
          </button>
        </div>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={labelStyle}>What is it?</span>
          <input style={fieldStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cousin’s engagement, team offsite…" maxLength={80} autoFocus />
        </label>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <label style={{ flex: 1 }}>
            <span style={labelStyle}>Date</span>
            <input style={fieldStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label style={{ flex: 1 }}>
            <span style={labelStyle}>Time (optional)</span>
            <input style={fieldStyle} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>

        <div style={{ marginBottom: 14 }}>
          <span style={labelStyle}>Occasion</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {EVENT_OCCASIONS.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOccasion(o)}
                aria-pressed={occasion === o}
                style={{
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  backgroundColor: occasion === o ? 'var(--color-primary)' : 'var(--color-surface-subtle)',
                  color: occasion === o ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
                  border: `1px solid ${occasion === o ? 'var(--color-primary)' : 'var(--color-border)'}`
                }}
              >
                {o}
              </button>
            ))}
          </div>
          <input style={fieldStyle} value={occasion} onChange={(e) => setOccasion(e.target.value)} placeholder="Or type your own — Wedding, Interview…" maxLength={40} />
        </div>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={labelStyle}>Dress notes (optional)</span>
          <textarea
            style={{ ...fieldStyle, minHeight: 64, resize: 'vertical', fontFamily: 'inherit' }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Dress code, venue, anything to keep in mind"
            maxLength={400}
          />
        </label>

        {error && (
          <p role="alert" className="text-caption" style={{ color: 'var(--color-danger)', marginBottom: 12 }}>{error}</p>
        )}

        <PrimaryButton type="submit" fullWidth disabled={!canSave}>
          {saving ? 'Saving…' : event ? 'Save changes' : 'Add event'}
        </PrimaryButton>
      </form>
    </div>
  );
};
