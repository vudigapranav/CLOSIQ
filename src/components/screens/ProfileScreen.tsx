import React from 'react';
import { Sparkles, Heart, Moon, Sun, Lightbulb, Trash2 } from 'lucide-react';
import { SectionHeader } from '../ui/SectionHeader';
import { GarmentImage } from '../ui/GarmentImage';
import { INITIAL_PROFILE } from '../../data/initialWardrobe';
import { GarmentItem, Outfit, WardrobeProfile, LayeringPreference } from '../../types/wardrobe';

interface ProfileScreenProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  wardrobe?: GarmentItem[];
  savedOutfits?: Outfit[];
  onRemoveSavedOutfit?: (id: string) => void;
  wardrobeProfile: WardrobeProfile;
  onChangeWardrobeProfile: (profile: WardrobeProfile) => void;
  layeringPreference: LayeringPreference;
  onChangeLayeringPreference: (preference: LayeringPreference) => void;
}

const LAYERING_OPTIONS: { value: LayeringPreference; label: string }[] = [
  { value: 'avoid', label: 'Avoid' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'usually', label: 'Usually' }
];

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  isDarkMode,
  onToggleTheme,
  wardrobe = [],
  savedOutfits = [],
  onRemoveSavedOutfit,
  wardrobeProfile,
  onChangeWardrobeProfile,
  layeringPreference,
  onChangeLayeringPreference
}) => {
  const handleRemoveSaved = (id: string) => {
    if (onRemoveSavedOutfit) onRemoveSavedOutfit(id);
  };

  const styleDNA = [
    { label: 'Elevated Minimalist', score: 92 },
    { label: 'Classic Tailoring', score: 86 },
    { label: 'Smart Casual', score: 88 },
    { label: 'Experimental Layering', score: 45 }
  ];

  const wardrobeInsights = [
    'Your wardrobe works best with neutral colors.',
    `You have ${wardrobe.filter(i => i.category === 'tops').length || 6} versatile tops but only ${wardrobe.filter(i => i.category === 'bottoms').length || 3} everyday bottoms.`,
    'Your Navy Oxford Shirt can create 6 different outfits.'
  ];

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
            aria-label={INITIAL_PROFILE.name}
          >
            {INITIAL_PROFILE.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-section-heading">{INITIAL_PROFILE.name}</h2>
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
              <span>{INITIAL_PROFILE.styleArchetype}</span>
            </div>
          </div>
        </div>

        <p className="text-body" style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
          {INITIAL_PROFILE.archetypeDescription}
        </p>
      </div>

      {/* 1. Style DNA Section */}
      <SectionHeader title="Style DNA" subtitle="Inferred aesthetic tendencies" />

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
      <SectionHeader title="Wardrobe Insights" subtitle="AI intelligence on your collection" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {wardrobeInsights.map((insight, i) => (
          <div
            key={i}
            style={{
              padding: 14,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderLeft: '3px solid var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}
          >
            <Lightbulb size={18} color="var(--color-primary)" style={{ flexShrink: 0 }} />
            <p className="text-body" style={{ fontSize: '0.84rem', color: 'var(--color-text-primary)' }}>
              "{insight}"
            </p>
          </div>
        ))}
      </div>

      {/* 3. Saved Looks Section */}
      <SectionHeader title="Saved Looks" subtitle="Outfits pinned to your rotation" />

      {savedOutfits.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--color-border)', marginBottom: 24 }}>
          <Heart size={28} color="var(--color-text-muted)" style={{ marginBottom: 6 }} />
          <p className="text-body" style={{ fontSize: '0.85rem' }}>No saved outfits yet. Tap "Save" on any look from Today or the AI Stylist.</p>
        </div>
      ) : (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {savedOutfits.map((look) => (
            <div
              key={look.id}
              style={{
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className="text-metadata" style={{ color: 'var(--color-primary)' }}>{look.occasion}</span>
                  <h3 className="text-section-heading" style={{ fontSize: '1.05rem', marginTop: 2 }}>{look.title}</h3>
                </div>

                <button
                  onClick={() => handleRemoveSaved(look.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                  title="Remove Saved Look"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Items Thumbnails */}
              <div className="hide-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                {look.items.map((item) => (
                  <div key={item.id} style={{ width: 44, height: 44, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                    <GarmentImage src={item.imageUrl} alt={item.name} category={item.category} hexColor={item.hexColor} />
                  </div>
                ))}
              </div>

              <p className="text-body" style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                "{look.explanation.summary}"
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 4. Wardrobe Profile */}
      <SectionHeader title="Wardrobe Profile" subtitle="Which generated wardrobe CLOSIQ shows you" />

      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          padding: 16,
          marginBottom: 24,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10
        }}
      >
        {(['men', 'women'] as WardrobeProfile[]).map((option) => {
          const isActive = wardrobeProfile === option;
          return (
            <button
              key={option}
              onClick={() => onChangeWardrobeProfile(option)}
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                backgroundColor: isActive ? 'var(--color-primary)' : 'var(--color-surface-subtle)',
                color: isActive ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
                fontSize: '0.85rem',
                fontWeight: 600,
                textTransform: 'capitalize',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {option}
            </button>
          );
        })}
      </div>

      {/* 5. Layering Preference */}
      <SectionHeader title="Layering" subtitle="How CLOSIQ styles base layers under other pieces" />

      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          padding: 16,
          marginBottom: 24,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8
        }}
      >
        {LAYERING_OPTIONS.map((option) => {
          const isActive = layeringPreference === option.value;
          return (
            <button
              key={option.value}
              onClick={() => onChangeLayeringPreference(option.value)}
              style={{
                padding: '10px 6px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                backgroundColor: isActive ? 'var(--color-primary-alpha)' : 'var(--color-surface-subtle)',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* 6. Appearance & Preferences */}
      <SectionHeader title="Preferences" />

      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          padding: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isDarkMode ? <Moon size={18} color="var(--color-primary)" /> : <Sun size={18} color="#C5A880" />}
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
    </div>
  );
};
