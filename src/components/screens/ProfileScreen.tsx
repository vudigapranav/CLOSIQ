import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, Heart, Moon, Sun, Trash2, Shirt, CalendarDays, Eye, LogOut, UserCircle } from 'lucide-react';
import { SectionHeader } from '../ui/SectionHeader';
import { GarmentImage } from '../ui/GarmentImage';
import { SegmentedControl } from '../ui/SegmentedControl';
import { computeStyleDna, styleArchetype, stylePreferenceLabel } from '../../data/styleDna';
import { OutfitBrain, tasteGarments } from '../../services/outfitBrain';
import { GarmentItem, Outfit, WardrobeProfile, LayeringPreference } from '../../types/wardrobe';
import { computeWardrobeAnalytics, Distribution, WardrobeAnalytics } from '../../services/intelligence/wardrobeAnalytics';
import { deleteMyAccount, downloadMyData, isAiPhotoConsentGiven, loadAiPhotoConsent, setAiPhotoConsent } from '../../services/cloud/account';
import { SavedOutfitDetailModal } from '../modals/SavedOutfitDetailModal';

interface ProfileScreenProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  wardrobe?: GarmentItem[];
  savedOutfits?: Outfit[];
  onRemoveSavedOutfit?: (id: string) => void;
  onWearAgainOutfit?: (outfit: Outfit) => void;
  wardrobeProfile: WardrobeProfile;
  onChangeWardrobeProfile: (profile: WardrobeProfile) => void;
  layeringPreference: LayeringPreference;
  onChangeLayeringPreference: (preference: LayeringPreference) => void;
  onNavigateToCollection?: () => void;
  onNavigateToPlanner?: () => void;
  /** Signed-in account shown in Settings, with a Sign out action. */
  userEmail?: string;
  onSignOut?: () => void;
  /** From profiles.name / style_preferences (asked at onboarding). */
  userName?: string;
  stylePreferences?: string[];
  /** The outfit brain: liked/worn looks teach Style DNA. */
  brain?: OutfitBrain;
  /** Needed for Privacy & account (consent, data download, deletion). */
  userId?: string;
}

const LAYERING_OPTIONS: { value: LayeringPreference; label: string }[] = [
  { value: 'avoid', label: 'Avoid base layers' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'usually', label: 'Usually' }
];

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border)',
  boxShadow: 'var(--shadow-sm)',
  padding: 16
};

const subHeading: React.CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 700,
  color: 'var(--color-primary)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  marginBottom: 8
};

const BarList: React.FC<{ rows: Distribution[]; max?: number }> = ({ rows, max = 6 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {rows.slice(0, max).map((row) => (
      <div key={row.key}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 3 }}>
          <span style={{ textTransform: 'capitalize', color: 'var(--color-text-primary)' }}>{row.label}</span>
          <span className="text-caption">{row.count} · {row.percent}%</span>
        </div>
        <div style={{ height: 6, backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
          <div style={{ width: `${row.percent}%`, height: '100%', backgroundColor: 'var(--color-primary)' }} />
        </div>
      </div>
    ))}
  </div>
);

/** Wardrobe insights — every figure comes from wardrobeAnalytics (the user's own data). */
const InsightsSection: React.FC<{ stats: WardrobeAnalytics }> = ({ stats }) => {
  if (stats.totalItems === 0) {
    return (
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <p className="text-body" style={{ fontSize: '0.85rem' }}>
          Add clothes to your wardrobe and CLOSIQ will show what you wear most, what you have forgotten and how your colours balance.
        </p>
      </div>
    );
  }
  const piece = (name: string, note: string) => (
    <div key={name + note} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: '0.8rem', padding: '4px 0' }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-primary)' }}>{name}</span>
      <span className="text-caption" style={{ flexShrink: 0 }}>{note}</span>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ ...cardStyle, flex: 1 }}>
          <div style={subHeading}>Worn in 30 days</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700 }}>
            {stats.utilisation30d === null ? '—' : `${stats.utilisation30d}%`}
          </div>
          <div className="text-caption">of your {stats.totalItems} pieces</div>
        </div>
        <div style={{ ...cardStyle, flex: 1 }}>
          <div style={subHeading}>Ever worn</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700 }}>
            {stats.utilisationEver === null ? '—' : `${stats.utilisationEver}%`}
          </div>
          <div className="text-caption">
            {stats.availability.laundry + stats.availability.unavailable > 0
              ? `${stats.availability.laundry} in laundry, ${stats.availability.unavailable} unavailable`
              : 'all pieces ready to wear'}
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={subHeading}>Most worn</div>
        {stats.mostWorn.length === 0 ? (
          <p className="text-caption">Nothing logged yet. Tap “Wear this” on a look and your most-worn pieces will appear here.</p>
        ) : (
          stats.mostWorn.map((m) => piece(m.item.name, `${m.wearCount}×`))
        )}
      </div>

      <div style={cardStyle}>
        <div style={subHeading}>Forgotten pieces</div>
        {stats.leastUsed.length === 0 ? (
          <p className="text-caption">Everything you own has been worn in the last 60 days.</p>
        ) : (
          stats.leastUsed.map((l) => piece(l.item.name, l.daysSinceWorn === null ? 'never worn' : `${l.daysSinceWorn} days ago`))
        )}
      </div>

      <div style={cardStyle}>
        <div style={subHeading}>Pairs you repeat</div>
        {stats.frequentPairs.length === 0 ? (
          <p className="text-caption">
            {stats.wornLooks === 0 ? 'Mark looks as worn and CLOSIQ will spot the pairs you reach for.' : 'No pair has appeared in more than one worn look yet.'}
          </p>
        ) : (
          stats.frequentPairs.map((p) => piece(`${p.a.name} + ${p.b.name}`, `${p.count} looks`))
        )}
        {stats.repetition && (
          <p className="text-caption" style={{ marginTop: 8 }}>
            {stats.repetition.repeatedLooks === 0
              ? `All ${stats.repetition.wornLooks} worn look${stats.repetition.wornLooks === 1 ? ' is' : 's are'} different combinations.`
              : `${stats.repetition.repeatedLooks} of ${stats.repetition.wornLooks} worn looks repeated an earlier combination.`}
          </p>
        )}
      </div>

      <div style={cardStyle}>
        <div style={subHeading}>By category</div>
        <BarList rows={stats.categoryDistribution} />
      </div>

      <div style={cardStyle}>
        <div style={subHeading}>By colour</div>
        <BarList rows={stats.colourDistribution} />
      </div>
    </div>
  );
};

/** Privacy & account: AI photo consent, data download, account deletion. */
const PrivacyAccount: React.FC<{ userId: string; userEmail?: string; onSignedOut?: () => void }> = ({ userId, userEmail }) => {
  const [consent, setConsent] = useState<boolean>(isAiPhotoConsentGiven());
  const [consentNote, setConsentNote] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadAiPhotoConsent(userId).then((v) => live && setConsent(v));
    return () => {
      live = false;
    };
  }, [userId]);

  const toggleConsent = async () => {
    const next = !consent;
    setConsent(next);
    const { cloud } = await setAiPhotoConsent(userId, next);
    setConsentNote(cloud ? null : 'Saved on this browser.');
  };

  const download = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await downloadMyData(userId, userEmail);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Couldn’t prepare your data.');
    } finally {
      setExporting(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteMyAccount();
    if (!result.ok) {
      setDeleteError(result.message ?? 'Couldn’t delete your account.');
      setDeleting(false);
    }
    // On success the session ends and App returns to the sign-in screen.
  };

  const row: React.CSSProperties = { padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 };
  const pill: React.CSSProperties = {
    padding: '6px 14px',
    borderRadius: 'var(--radius-pill)',
    fontSize: '0.78rem',
    fontWeight: 600,
    backgroundColor: 'var(--color-surface-subtle)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border)',
    cursor: 'pointer',
    flexShrink: 0
  };

  return (
    <>
      <div style={{ marginTop: 24 }}>
        <SectionHeader title="Privacy & account" />
      </div>
      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <div style={{ ...row, borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>Use AI photo analysis</div>
            <div className="text-caption">
              {consent
                ? 'Photos you add are read by AI to fill in colour, fabric and style.'
                : 'Off: photos are never sent to AI. You describe each piece yourself.'}
              {consentNote ? ` ${consentNote}` : ''}
            </div>
          </div>
          <button role="switch" aria-checked={consent} onClick={toggleConsent} style={{ ...pill, ...(consent ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-text-on-primary)', borderColor: 'var(--color-primary)' } : {}) }}>
            {consent ? 'On' : 'Off'}
          </button>
        </div>

        <div style={{ ...row, borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>Download my data</div>
            <div className="text-caption">Your wardrobe, looks, events and feedback as a JSON file.</div>
            {exportError && <div role="alert" className="text-caption" style={{ color: 'var(--color-danger)' }}>{exportError}</div>}
          </div>
          <button onClick={download} disabled={exporting} style={pill}>{exporting ? 'Preparing…' : 'Download'}</button>
        </div>

        <div style={row}>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-danger)' }}>Delete account</div>
            <div className="text-caption">Permanently removes your account and everything in it.</div>
          </div>
          <button onClick={() => setConfirmOpen((v) => !v)} style={{ ...pill, color: 'var(--color-danger)', borderColor: 'rgba(168,73,59,0.3)' }}>
            {confirmOpen ? 'Cancel' : 'Delete'}
          </button>
        </div>

        {confirmOpen && (
          <div style={{ padding: '0 16px 16px' }}>
            <p className="text-caption" style={{ marginBottom: 8 }}>
              This cannot be undone. Type DELETE to confirm.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                aria-label="Type DELETE to confirm"
                placeholder="DELETE"
                style={{ flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-subtle)', color: 'var(--color-text-primary)', outline: 'none' }}
              />
              <button
                onClick={remove}
                disabled={typed !== 'DELETE' || deleting}
                style={{ ...pill, backgroundColor: 'var(--color-danger)', color: 'var(--color-text-on-primary)', borderColor: 'var(--color-danger)', opacity: typed !== 'DELETE' || deleting ? 0.5 : 1 }}
              >
                {deleting ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
            {deleteError && <p role="alert" className="text-caption" style={{ color: 'var(--color-danger)', marginTop: 8 }}>{deleteError}</p>}
          </div>
        )}
      </div>
    </>
  );
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  isDarkMode,
  onToggleTheme,
  wardrobe = [],
  savedOutfits = [],
  onRemoveSavedOutfit,
  onWearAgainOutfit,
  wardrobeProfile,
  onChangeWardrobeProfile,
  layeringPreference,
  onChangeLayeringPreference,
  onNavigateToCollection,
  onNavigateToPlanner,
  userEmail,
  onSignOut,
  userName = '',
  stylePreferences = [],
  brain,
  userId
}) => {
  const [selectedSavedOutfit, setSelectedSavedOutfit] = useState<Outfit | null>(null);

  const handleRemoveSaved = (id: string) => {
    if (onRemoveSavedOutfit) onRemoveSavedOutfit(id);
  };

  // Honest Style DNA (src/data/styleDna.ts): 0 until the user adds clothes.
  // Style DNA = what you own, blended with what you liked and wore (the brain).
  const taste = brain ? tasteGarments(brain, wardrobe) : [];
  const styleDNA = computeStyleDna(wardrobe, taste);
  const archetype = styleArchetype(wardrobe, stylePreferences, taste);
  const learnedFrom = brain?.learnedFrom ?? 0;

  // Saved Looks: what you're wearing / wore vs. what to try next time.
  const [lookTab, setLookTab] = useState<'worn' | 'try_later'>('worn');
  const wornLooks = savedOutfits.filter((o) => o.status === 'worn');
  const laterLooks = savedOutfits.filter((o) => o.status !== 'worn');
  const shownLooks = lookTab === 'worn' ? wornLooks : laterLooks;
  const displayName = userName || (userEmail ? userEmail.split('@')[0] : 'You');
  const analytics = useMemo(() => computeWardrobeAnalytics(wardrobe, savedOutfits), [wardrobe, savedOutfits]);

  return (
    <div style={{ padding: '20px 20px 32px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 className="text-screen-heading">Your Style</h1>
        <p className="text-body" style={{ marginTop: 2 }}>What CLOSIQ knows about your aesthetic.</p>
      </div>

      {/* Style Archetype Card */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          padding: 20,
          boxShadow: 'var(--shadow-sm)',
          marginBottom: 24
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              border: '2px solid var(--color-primary)',
              backgroundColor: 'var(--color-primary-alpha)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: '1.3rem',
              fontWeight: 600,
              flexShrink: 0
            }}
            aria-label={displayName}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-section-heading">{displayName}</h2>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 4,
                padding: '3px 10px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--color-primary-alpha)',
                color: 'var(--color-primary)',
                fontSize: '0.75rem',
                fontWeight: 600
              }}
            >
              <Sparkles size={12} />
              <span>{archetype.name}</span>
            </div>
          </div>
        </div>

        <p className="text-body" style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
          {archetype.description}
        </p>
        <p className="text-caption" style={{ marginTop: 6, color: 'var(--color-primary)', fontWeight: 600 }}>
          {learnedFrom === 0
            ? 'Rate suggestions and tap "Wear today" — your Style DNA learns from every look.'
            : `Learning from ${learnedFrom} look${learnedFrom === 1 ? '' : 's'} you rated or wore.`}
        </p>
        {stylePreferences.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {stylePreferences.map((style) => (
              <span
                key={style}
                style={{
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  border: '1px solid var(--color-border-medium)',
                  color: 'var(--color-text-secondary)'
                }}
              >
                {stylePreferenceLabel(style)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 24 }}>
        <button
          onClick={onNavigateToCollection}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 8,
            padding: 16,
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
            cursor: onNavigateToCollection ? 'pointer' : 'default',
            textAlign: 'left'
          }}
        >
          <Shirt size={18} color="var(--color-primary)" />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>My Wardrobe</div>
            <div className="text-caption" style={{ fontSize: '0.72rem' }}>{wardrobe.length} items</div>
          </div>
        </button>

        <button
          onClick={onNavigateToPlanner}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 8,
            padding: 16,
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
            cursor: onNavigateToPlanner ? 'pointer' : 'default',
            textAlign: 'left'
          }}
        >
          <CalendarDays size={18} color="var(--color-primary)" />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Outfit Planner</div>
            <div className="text-caption" style={{ fontSize: '0.72rem' }}>Plan your week</div>
          </div>
        </button>
      </div>

      {/* 1. Style DNA Section */}
      <SectionHeader
        title="Style DNA"
        subtitle={wardrobe.length === 0 ? 'Starts at zero — add your clothes to build it' : 'Share of your wardrobe showing each trait'}
      />

      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          padding: 20,
          marginBottom: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        {styleDNA.map((dna, idx) => (
          <div key={idx}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>
              <span>{dna.label}</span>
              <span style={{ color: 'var(--color-primary)' }}>{dna.score}%</span>
            </div>
            <div style={{ width: '100%', height: 6, backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
              <div style={{ width: `${dna.score}%`, height: '100%', backgroundColor: 'var(--color-primary)' }} />
            </div>
          </div>
        ))}
      </div>

      {/* 2. Intelligent Wardrobe Insights */}
      <SectionHeader title="Wardrobe insights" subtitle="Computed from what you actually wear" />

      <InsightsSection stats={analytics} />

      {/* 3. Saved Looks Section */}
      <SectionHeader title="Saved Looks" subtitle="What you wore, and what to try next time" />

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {([
          { key: 'worn', label: `Wearing / worn (${wornLooks.length})` },
          { key: 'try_later', label: `Try next time (${laterLooks.length})` }
        ] as const).map((tab) => {
          const active = lookTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              aria-pressed={active}
              onClick={() => setLookTab(tab.key)}
              style={{
                padding: '7px 14px',
                borderRadius: 'var(--radius-pill)',
                border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border-medium)'}`,
                backgroundColor: active ? 'var(--color-primary)' : 'var(--color-surface)',
                color: active ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {shownLooks.length === 0 ? (
        <div
          style={{
            padding: '24px 20px',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: 24,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: 'var(--color-surface-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 4
            }}
          >
            <Heart size={20} color="var(--color-text-muted)" />
          </div>
          <p className="text-body" style={{ fontSize: '0.86rem', color: 'var(--color-text-primary)', fontWeight: 600 }}>
            {lookTab === 'worn' ? 'Nothing worn yet' : 'Nothing saved for later'}
          </p>
          <p className="text-caption" style={{ fontSize: '0.78rem', maxWidth: 280, lineHeight: 1.4 }}>
            {lookTab === 'worn'
              ? 'Tap "Wear this" on a suggestion — it shows up here and teaches your Style DNA.'
              : 'Tap "Later" on a suggestion you want to wear another day.'}
          </p>
        </div>
      ) : (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
          {shownLooks.map((look) => (
            <button
              key={look.id}
              onClick={() => setSelectedSavedOutfit(look)}
              title={`Open ${look.title}`}
              aria-label={`Saved outfit: ${look.title} for ${look.occasion}. Tap to open details and wear again.`}
              aria-expanded={selectedSavedOutfit?.id === look.id}
              style={{
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                boxShadow: 'var(--shadow-sm)',
                outline: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                e.currentTarget.style.borderColor = 'var(--color-border-medium)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                e.currentTarget.style.borderColor = 'var(--color-border)';
              }}
            >
              {/* Card Header & Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span className="text-metadata" style={{ color: 'var(--color-primary)' }}>{look.occasion}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>•</span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', fontFamily: 'var(--font-display)' }}>
                      {look.vibe}
                    </span>
                  </div>
                  <h3 className="text-section-heading" style={{ fontSize: '1.1rem', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {look.title}
                  </h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: 'var(--color-primary)',
                      backgroundColor: 'var(--color-primary-alpha)',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-pill)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Eye size={12} />
                    <span>Open</span>
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveSaved(look.id);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text-muted)',
                      padding: 4,
                      borderRadius: 'var(--radius-pill)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.15s ease'
                    }}
                    title="Remove Saved Look"
                    aria-label={`Remove saved look ${look.title}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Items Thumbnails Row */}
              <div className="hide-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
                {look.items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      position: 'relative',
                      width: 48,
                      height: 48,
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      flexShrink: 0,
                      backgroundColor: 'var(--color-surface-subtle)',
                      border: '1px solid var(--color-border)'
                    }}
                  >
                    <GarmentImage src={item.imageUrl} alt={item.name} category={item.category} hexColor={item.hexColor} />
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 2,
                        left: 2,
                        backgroundColor: 'rgba(0,0,0,0.65)',
                        backdropFilter: 'blur(4px)',
                        color: '#FFF',
                        fontSize: '0.54rem',
                        fontWeight: 600,
                        padding: '1px 3px',
                        borderRadius: 3,
                        lineHeight: 1,
                        textTransform: 'capitalize'
                      }}
                    >
                      {item.category.slice(0, 4)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Rationale Quote & Micro CTA Footer */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  paddingTop: 8,
                  borderTop: '1px solid var(--color-border)'
                }}
              >
                <p
                  className="text-body"
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--color-text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1
                  }}
                >
                  "{look.explanation.summary}"
                </p>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: 'var(--color-primary)',
                    flexShrink: 0
                  }}
                >
                  Wear Again →
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Saved Outfit Detail Modal */}
      <SavedOutfitDetailModal
        outfit={selectedSavedOutfit}
        wardrobe={wardrobe}
        onClose={() => setSelectedSavedOutfit(null)}
        onWearAgain={(outfit) => {
          if (onWearAgainOutfit) onWearAgainOutfit(outfit);
          setSelectedSavedOutfit(null);
        }}
        onRemoveSaved={(id) => {
          handleRemoveSaved(id);
          setSelectedSavedOutfit(null);
        }}
      />

      {/* 4. Style Preferences — Wardrobe Profile + Layering grouped together */}
      <SectionHeader title="Style Preferences" subtitle="How CLOSIQ tailors recommendations to you" />

      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          padding: 16,
          marginBottom: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}
      >
        <div>
          <div className="text-metadata" style={{ marginBottom: 8 }}>Wardrobe Profile</div>
          <SegmentedControl
            options={[
              { value: 'men', label: 'Men' },
              { value: 'women', label: 'Women' }
            ]}
            value={wardrobeProfile}
            onChange={onChangeWardrobeProfile}
          />
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
          <div className="text-metadata" style={{ marginBottom: 8 }}>Layering</div>
          <SegmentedControl options={LAYERING_OPTIONS} value={layeringPreference} onChange={onChangeLayeringPreference} />
        </div>
      </div>

      {/* 5. Settings — Appearance toggle + account */}
      <SectionHeader title="Settings" />

      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: onSignOut ? '1px solid var(--color-border)' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isDarkMode ? <Moon size={18} color="var(--color-primary)" /> : <Sun size={18} color="var(--color-primary-light)" />}
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Appearance Theme</div>
              <div className="text-caption">Toggle light and dark mode</div>
            </div>
          </div>

          <button
            onClick={onToggleTheme}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.78rem',
              fontWeight: 500,
              backgroundColor: 'var(--color-surface-subtle)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer'
            }}
          >
            {isDarkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>

        {onSignOut && (
          <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <UserCircle size={18} color="var(--color-text-muted)" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Account</div>
                <div className="text-caption" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userEmail || 'Signed in'}
                </div>
              </div>
            </div>
            <button
              onClick={onSignOut}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.78rem',
                fontWeight: 600,
                backgroundColor: 'var(--color-surface-subtle)',
                color: 'var(--color-danger)',
                border: '1px solid rgba(168,73,59,0.3)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0
              }}
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}
      </div>

      {userId && <PrivacyAccount userId={userId} userEmail={userEmail} />}
    </div>
  );
};
