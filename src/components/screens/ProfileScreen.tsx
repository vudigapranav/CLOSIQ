import React, { useState } from 'react';
import { Sparkles, Heart, Moon, Sun, Lightbulb, Trash2, Shirt, CalendarDays, Bell, Eye, Palette, Layers, ShieldAlert, TrendingUp, PieChart } from 'lucide-react';
import { SectionHeader } from '../ui/SectionHeader';
import { GarmentImage } from '../ui/GarmentImage';
import { SegmentedControl } from '../ui/SegmentedControl';
import { INITIAL_PROFILE } from '../../data/initialWardrobe';
import { GarmentItem, Outfit, WardrobeProfile, LayeringPreference } from '../../types/wardrobe';
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

export interface WardrobeInsightCard {
  id: string;
  badge: string;
  text: string;
  icon: React.ReactNode;
}

function calculateWardrobeInsights(
  wardrobe: GarmentItem[],
  savedOutfits: Outfit[],
  layeringPreference: LayeringPreference
): WardrobeInsightCard[] {
  if (wardrobe.length === 0) {
    return [
      {
        id: 'empty-insights',
        badge: 'Wardrobe Intelligence',
        text: 'Add items to your collection to unlock personalized closet insights and styling intelligence.',
        icon: <Lightbulb size={18} color="var(--color-primary)" />
      }
    ];
  }

  const insights: WardrobeInsightCard[] = [];

  // 1. Formality Coverage & Truthful Wardrobe Gap Logic
  const casualCount = wardrobe.filter((i) => i.formality === 'casual').length;
  const smartCasualCount = wardrobe.filter((i) => i.formality === 'smart_casual').length;
  const formalCount = wardrobe.filter((i) => i.formality === 'formal').length;
  const eveningCount = wardrobe.filter((i) => i.formality === 'evening').length;

  if (casualCount + smartCasualCount > 0 && formalCount + eveningCount === 0) {
    insights.push({
      id: 'formality-gap',
      badge: 'Formality Balance',
      text: 'Your wardrobe is strongest in casual and smart-casual pieces. Formal options are currently limited.',
      icon: <ShieldAlert size={18} color="var(--color-primary)" />
    });
  } else if (formalCount + eveningCount > 0) {
    insights.push({
      id: 'formality-range',
      badge: 'Formality Balance',
      text: `Formality spans casual basics to tailored formal pieces (${formalCount + eveningCount} formal piece${formalCount + eveningCount > 1 ? 's' : ''}).`,
      icon: <PieChart size={18} color="var(--color-primary)" />
    });
  }

  // 2. Color Spectrum & Diversity
  const colorCounts: Record<string, number> = {};
  wardrobe.forEach((item) => {
    const c = item.color.split(' ')[0] || item.color;
    colorCounts[c] = (colorCounts[c] || 0) + 1;
  });
  const topColors = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([color]) => color);
  const uniqueColorsCount = new Set(wardrobe.map((item) => item.color.trim().toLowerCase())).size;

  if (topColors.length > 0) {
    insights.push({
      id: 'color-palette',
      badge: 'Color Spectrum',
      text: `Anchored by ${topColors.join(', ')} tones across ${uniqueColorsCount} distinct color shade${uniqueColorsCount > 1 ? 's' : ''}.`,
      icon: <Palette size={18} color="var(--color-primary)" />
    });
  }

  // 3. Category Ratio & Outfit Combination Math
  const topsCount = wardrobe.filter((i) => i.category === 'tops').length;
  const bottomsCount = wardrobe.filter((i) => i.category === 'bottoms').length;
  const shoesCount = wardrobe.filter((i) => i.category === 'footwear').length;
  const totalCombos = topsCount * Math.max(1, bottomsCount) * Math.max(1, shoesCount);

  if (topsCount > 0 && bottomsCount > 0) {
    insights.push({
      id: 'combos',
      badge: 'Combination Potential',
      text: `You have ${topsCount} tops and ${bottomsCount} bottoms — yielding over ${totalCombos} potential outfit pairings.`,
      icon: <TrendingUp size={18} color="var(--color-primary)" />
    });
  }

  // 4. Layering Architecture
  const outerwearCount = wardrobe.filter((i) => i.category === 'outerwear').length;
  if (layeringPreference === 'avoid') {
    insights.push({
      id: 'layering-pref',
      badge: 'Layering Architecture',
      text: 'Layering preference is set to "Avoid base layers" — CLOSIQ prioritizes clean primary layers.',
      icon: <Layers size={18} color="var(--color-primary)" />
    });
  } else if (outerwearCount > 0) {
    insights.push({
      id: 'layering-availability',
      badge: 'Layering Architecture',
      text: `You have ${outerwearCount} outerwear piece${outerwearCount > 1 ? 's' : ''} cataloged for temperature-adaptive layering.`,
      icon: <Layers size={18} color="var(--color-primary)" />
    });
  }

  // 5. Wear History OR Versatile Hero Piece
  const wornItems = wardrobe.filter((i) => (i.wearCount || 0) > 0).sort((a, b) => (b.wearCount || 0) - (a.wearCount || 0));
  if (wornItems.length > 0) {
    insights.push({
      id: 'wear-history',
      badge: 'Wear History',
      text: `Your most-worn piece is the ${wornItems[0].name} (worn ${wornItems[0].wearCount} time${wornItems[0].wearCount! > 1 ? 's' : ''}).`,
      icon: <Shirt size={18} color="var(--color-primary)" />
    });
  } else {
    const versatileItem = wardrobe.find((i) => i.category === 'tops' || i.category === 'outerwear') || wardrobe[0];
    if (versatileItem) {
      const calcOutfits = Math.max(3, Math.min(12, bottomsCount * 2 || 4));
      insights.push({
        id: 'versatility',
        badge: 'Hero Versatility',
        text: `Your ${versatileItem.name} can create at least ${calcOutfits} distinct looks across occasions.`,
        icon: <Sparkles size={18} color="var(--color-primary)" />
      });
    }
  }

  return insights.slice(0, 4);
}

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
  onNavigateToPlanner
}) => {
  const [selectedSavedOutfit, setSelectedSavedOutfit] = useState<Outfit | null>(null);

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {wardrobeInsights.map((insight) => (
          <div
            key={insight.id}
            style={{
              padding: 16,
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderLeft: '3px solid var(--color-primary)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary-alpha)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {insight.icon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--color-primary)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  marginBottom: 3
                }}
              >
                {insight.badge}
              </div>
              <p className="text-body" style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)', lineHeight: 1.45 }}>
                {insight.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Saved Looks Section */}
      <SectionHeader title="Saved Looks" subtitle="Outfits pinned to your rotation" />

      {savedOutfits.length === 0 ? (
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
            No saved outfits yet
          </p>
          <p className="text-caption" style={{ fontSize: '0.78rem', maxWidth: 280, lineHeight: 1.4 }}>
            Tap "Save" on any outfit from Today or the AI Stylist to pin it to your personal rotation.
          </p>
        </div>
      ) : (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
          {savedOutfits.map((look) => (
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

      {/* 5. Settings — Notifications (informational) + working Appearance toggle */}
      <SectionHeader title="Settings" />

      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bell size={18} color="var(--color-text-muted)" />
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Notifications</div>
              <div className="text-caption">Wardrobe reminders and outfit suggestions</div>
            </div>
          </div>
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              backgroundColor: 'var(--color-surface-subtle)',
              padding: '3px 9px',
              borderRadius: 'var(--radius-pill)',
              flexShrink: 0
            }}
          >
            Coming soon
          </span>
        </div>

        <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
      </div>
    </div>
  );
};
