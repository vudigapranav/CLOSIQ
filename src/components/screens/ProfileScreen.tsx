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
  { value: 'avoid', label: 'Avoid base layers' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'usually', label: 'Usually' }
];

function calculateStyleDNA(wardrobe: GarmentItem[], savedOutfits: Outfit[], layeringPreference: LayeringPreference) {
  if (wardrobe.length === 0) {
    return [
      { label: 'Elevated Minimalist', score: 85 },
      { label: 'Classic Tailoring', score: 80 },
      { label: 'Smart Casual', score: 88 },
      { label: 'Experimental Layering', score: layeringPreference === 'avoid' ? 30 : layeringPreference === 'usually' ? 85 : 55 }
    ];
  }

  const neutralColors = ['navy', 'black', 'white', 'beige', 'grey', 'gray', 'charcoal', 'cream', 'khaki', 'tan', 'slate'];
  const neutralCount = wardrobe.filter((item) =>
    neutralColors.some((nc) => item.color.toLowerCase().includes(nc))
  ).length;
  const neutralRatio = neutralCount / wardrobe.length;

  const tailoringCount = wardrobe.filter(
    (item) =>
      item.category === 'outerwear' ||
      item.name.toLowerCase().includes('blazer') ||
      item.name.toLowerCase().includes('trouser') ||
      item.name.toLowerCase().includes('oxford') ||
      item.name.toLowerCase().includes('coat') ||
      item.name.toLowerCase().includes('suit')
  ).length;

  const layeringCount = wardrobe.filter(
    (item) => item.layeringRole === 'base_layer' || item.layeringRole === 'outer_layer'
  ).length;

  const minimalistScore = Math.min(98, Math.max(60, Math.round(70 + neutralRatio * 25)));
  const tailoringScore = Math.min(95, Math.max(50, Math.round(60 + (tailoringCount / Math.max(1, wardrobe.length)) * 50)));
  const smartCasualScore = Math.min(96, Math.max(75, Math.round(82 + (savedOutfits.length > 0 ? 6 : 2))));

  let layeringScore = 50;
  if (layeringPreference === 'avoid') layeringScore = 35;
  else if (layeringPreference === 'usually') layeringScore = 88;
  else layeringScore = 65;
  if (layeringCount > 2) layeringScore = Math.min(95, layeringScore + 10);

  return [
    { label: 'Elevated Minimalist', score: minimalistScore },
    { label: 'Classic Tailoring', score: tailoringScore },
    { label: 'Smart Casual', score: smartCasualScore },
    { label: 'Experimental Layering', score: layeringScore }
  ];
}

function calculateWardrobeInsights(
  wardrobe: GarmentItem[],
  savedOutfits: Outfit[],
  layeringPreference: LayeringPreference
): string[] {
  if (wardrobe.length === 0) {
    return [
      'Add items to your Collection to unlock personalized wardrobe intelligence.',
      'CLOSIQ will analyze your closet colors, layering roles, and outfit versatility.'
    ];
  }

  const insights: string[] = [];

  const colorCounts: Record<string, number> = {};
  wardrobe.forEach((item) => {
    const c = item.color.split(' ')[0] || item.color;
    colorCounts[c] = (colorCounts[c] || 0) + 1;
  });
  const topColors = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([color]) => color);

  if (topColors.length > 0) {
    insights.push(`Your collection is anchored by ${topColors.join(', ')} tones.`);
  }

  const topsCount = wardrobe.filter((i) => i.category === 'tops').length;
  const bottomsCount = wardrobe.filter((i) => i.category === 'bottoms').length;
  const shoesCount = wardrobe.filter((i) => i.category === 'footwear').length;
  const totalCombos = topsCount * Math.max(1, bottomsCount) * Math.max(1, shoesCount);

  if (topsCount > 0 && bottomsCount > 0) {
    insights.push(`You have ${topsCount} tops and ${bottomsCount} bottoms — yielding over ${totalCombos} potential outfit combinations.`);
  } else if (topsCount > 0) {
    insights.push(`You have ${topsCount} tops cataloged. Add bottoms to unlock full outfit pairing capability.`);
  }

  const versatileItem = wardrobe.find((i) => i.category === 'tops' || i.category === 'outerwear') || wardrobe[0];
  if (versatileItem) {
    const calcOutfits = Math.max(3, Math.min(12, bottomsCount * 2 || 4));
    insights.push(`Your ${versatileItem.name} can create at least ${calcOutfits} distinct looks across occasions.`);
  }

  if (layeringPreference === 'avoid') {
    insights.push('Base layers are set to "Avoid base layers" — CLOSIQ prioritizes clean primary layers.');
  } else if (layeringPreference === 'usually') {
    insights.push('Layering is enabled — CLOSIQ incorporates structured base and outer pieces.');
  }

  return insights.slice(0, 3);
}

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

  const styleDNA = calculateStyleDNA(wardrobe, savedOutfits, layeringPreference);
  const wardrobeInsights = calculateWardrobeInsights(wardrobe, savedOutfits, layeringPreference);

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
