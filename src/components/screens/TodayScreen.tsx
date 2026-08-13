import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, RefreshCw, Heart, Eye, Plus, AlertTriangle, ArrowRight, Check, Sun, ChevronRight } from 'lucide-react';
import { PrimaryButton } from '../ui/PrimaryButton';
import { SecondaryButton } from '../ui/SecondaryButton';
import { EmptyState } from '../ui/EmptyState';
import { GarmentImage } from '../ui/GarmentImage';
import { GarmentItem, Outfit, LayeringPreference } from '../../types/wardrobe';
import { isSameOutfit, formatCategoryList } from '../../services/aiStylist';
import { generateAIOutfitWithGemini } from '../../services/ai';

interface TodayScreenProps {
  wardrobe: GarmentItem[];
  savedOutfits: Outfit[];
  layeringPreference: LayeringPreference;
  onSaveOutfit: (outfit: Outfit) => void;
  onUnsaveOutfit: (outfit: Outfit) => void;
  onWearOutfit?: (outfit: Outfit) => void;
  onOpenUpload?: () => void;
  onNavigateToCollection?: () => void;
  onSelectItemDetail?: (item: GarmentItem) => void;
  onNavigateToProfile?: () => void;
}

const OCCASIONS = ['College', 'Work', 'Date', 'Party', 'Casual', 'Travel'];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export const TodayScreen: React.FC<TodayScreenProps> = ({
  wardrobe,
  savedOutfits,
  layeringPreference,
  onSaveOutfit,
  onUnsaveOutfit,
  onWearOutfit,
  onOpenUpload,
  onSelectItemDetail,
  onNavigateToProfile
}) => {
  const [selectedOccasion, setSelectedOccasion] = useState('College');
  const [customInput, setCustomInput] = useState('');
  const [variationSeed, setVariationSeed] = useState(0);
  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [wornOutfitId, setWornOutfitId] = useState<string | null>(null);

  const activePrompt = customInput.trim() || selectedOccasion;
  const generationToken = useRef(0);

  const runGeneration = async (promptText: string, seed: number) => {
    if (wardrobe.length === 0) return;
    const token = ++generationToken.current;
    setIsGenerating(true);
    setErrorMessage(null);
    setShowBreakdown(false);
    try {
      const generated = await generateAIOutfitWithGemini(wardrobe, { prompt: promptText, layeringPreference }, seed);
      if (token !== generationToken.current) return;
      setOutfit(generated);
    } catch {
      if (token !== generationToken.current) return;
      setErrorMessage("We couldn't put together a look just now. Please try again.");
    } finally {
      if (token === generationToken.current) {
        setIsGenerating(false);
      }
    }
  };

  // Cover the case where the wardrobe was empty on first mount (Empty State)
  // and the user adds their first item without leaving Today.
  useEffect(() => {
    if (wardrobe.length > 0 && !outfit && !isGenerating) {
      runGeneration(activePrompt, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wardrobe.length]);

  const handleSelectOccasion = (occ: string) => {
    setSelectedOccasion(occ);
    setCustomInput('');
    setVariationSeed(0);
    runGeneration(occ, 0);
  };

  const handleCustomSubmit = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    setVariationSeed(0);
    runGeneration(trimmed, 0);
  };

  const handleSwapLook = () => {
    const nextSeed = variationSeed + 1;
    setVariationSeed(nextSeed);
    runGeneration(activePrompt, nextSeed);
  };

  const isSaved = outfit ? savedOutfits.some((o) => isSameOutfit(o, outfit)) : false;
  const isWorn = outfit ? wornOutfitId === outfit.id : false;

  const handleToggleSave = () => {
    if (!outfit) return;
    if (isSaved) {
      onUnsaveOutfit(outfit);
    } else {
      onSaveOutfit(outfit);
    }
  };

  const handleWearThis = () => {
    if (!outfit || isWorn) return;
    onWearOutfit?.(outfit);
    setWornOutfitId(outfit.id);
  };

  const recentlyAdded = [...wardrobe]
    .sort((a, b) => b.dateAdded.localeCompare(a.dateAdded))
    .slice(0, 8);

  const otherOccasions = OCCASIONS.filter((occ) => occ !== activePrompt);

  const colorTally: Record<string, number> = {};
  wardrobe.forEach((item) => {
    const c = item.color.split(' ')[0] || item.color;
    colorTally[c] = (colorTally[c] || 0) + 1;
  });
  const topColor = Object.entries(colorTally).sort((a, b) => b[1] - a[1])[0]?.[0];

  if (wardrobe.length === 0) {
    return (
      <div style={{ padding: '20px 20px 32px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 className="text-screen-heading">{getGreeting()}, Pranav.</h1>
          <p className="text-body" style={{ marginTop: 2 }}>Let's find your look.</p>
        </div>

        <EmptyState
          icon={<Sparkles size={28} color="var(--color-primary)" />}
          title="Your wardrobe is waiting."
          description="Add a few pieces and CLOSIQ will start styling you."
          action={
            <PrimaryButton icon={<Plus size={18} />} onClick={onOpenUpload}>
              Add Your First Item
            </PrimaryButton>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 20px 32px' }}>
      {/* 1. Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <h1 className="text-screen-heading">{getGreeting()}, Pranav.</h1>
            <p className="text-body" style={{ marginTop: 2 }}>Let's find your look.</p>
          </div>
          {outfit && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                flexShrink: 0,
                whiteSpace: 'nowrap'
              }}
            >
              <Sun size={13} color="var(--color-primary)" />
              <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{outfit.temperature}°</span>
            </div>
          )}
        </div>
        <p
          className="text-section-heading"
          style={{ fontSize: '1.1rem', marginTop: 18 }}
        >
          What are you dressing for?
        </p>
      </div>

      {/* 2. Contextual Occasion Chips */}
      <div className="hide-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 16 }}>
        {OCCASIONS.map((occ) => {
          const isActive = selectedOccasion === occ && !customInput;
          return (
            <button
              key={occ}
              onClick={() => handleSelectOccasion(occ)}
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.82rem',
                fontWeight: 500,
                backgroundColor: isActive ? 'var(--color-primary)' : 'var(--color-surface-subtle)',
                color: isActive ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
                border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.2s ease'
              }}
            >
              {occ}
            </button>
          );
        })}
      </div>

      {/* 3. Free-Form Occasion Input */}
      <div style={{ marginBottom: 24, position: 'relative' }}>
        <input
          type="text"
          placeholder="Tell CLOSIQ what you're dressing for..."
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCustomSubmit();
            }
          }}
          style={{
            width: '100%',
            padding: '14px 18px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-medium)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            fontSize: '0.88rem',
            outline: 'none',
            boxShadow: 'var(--shadow-sm)'
          }}
        />
      </div>

      {/* Generation error state — never leave the screen silently blank */}
      {errorMessage && !isGenerating && (
        <div
          className="animate-fade-in"
          style={{
            padding: 16,
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderLeft: '3px solid var(--color-danger)',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}
        >
          <AlertTriangle size={18} color="var(--color-danger)" style={{ flexShrink: 0 }} />
          <p className="text-body" style={{ fontSize: '0.85rem', flex: 1 }}>{errorMessage}</p>
          <SecondaryButton style={{ flexShrink: 0, padding: '8px 14px', fontSize: '0.78rem' }} onClick={() => runGeneration(activePrompt, variationSeed)}>
            Retry
          </SecondaryButton>
        </div>
      )}

      {/* 4. AI Recommendation Card */}
      {outfit && (
        <div
          key={isGenerating ? 'loading' : outfit.id}
          className="animate-fade-in"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            padding: 24,
            boxShadow: 'var(--shadow-md)',
            marginBottom: 20,
            opacity: isGenerating ? 0.55 : 1,
            transition: 'opacity 0.2s ease'
          }}
        >
          {/* Card Header & Match Badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 20 }}>
            <div style={{ minWidth: 0 }}>
              <span
                className="text-metadata"
                style={{
                  color: 'var(--color-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%'
                }}
              >
                <Sparkles size={13} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Today's Look • {activePrompt}</span>
              </span>
              <h2
                className="text-section-heading"
                style={{ fontSize: '1.6rem', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {outfit.title}
              </h2>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                  fontSize: '0.88rem',
                  color: 'var(--color-text-secondary)',
                  marginTop: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {outfit.vibe}
              </p>
            </div>

            <div
              style={{
                backgroundColor: 'var(--color-primary-alpha)',
                color: 'var(--color-primary)',
                padding: '6px 14px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.78rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              {outfit.styleScore}% Match
            </div>
          </div>

          {/* Editorial Hero + Supporting Garment Imagery — the outfit's first
              item is always its top (see generateAIOutfit's item ordering),
              so it doubles as the natural hero piece; remaining pieces read
              as a supporting row underneath, per the brief's hero-first
              outfit composition. */}
          <div style={{ marginBottom: 24 }}>
            <div
              className="animate-card-enter"
              style={{
                position: 'relative',
                width: '100%',
                height: 300,
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface-subtle)',
                marginBottom: outfit.items.length > 1 ? 10 : 0
              }}
            >
              <GarmentImage
                src={outfit.items[0].imageUrl}
                alt={outfit.items[0].name}
                category={outfit.items[0].category}
                hexColor={outfit.items[0].hexColor}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '32px 16px 14px',
                  background: 'linear-gradient(180deg, transparent, rgba(43, 39, 35, 0.78))'
                }}
              >
                <span className="text-metadata" style={{ color: 'rgba(251, 247, 239, 0.85)' }}>{outfit.items[0].category}</span>
                <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#FFFFFF', marginTop: 2 }}>{outfit.items[0].name}</div>
              </div>
            </div>

            {outfit.items.length > 1 && (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(outfit.items.length - 1, 3)}, 1fr)`, gap: 10 }}>
                {outfit.items.slice(1).map((piece, idx) => (
                  <div
                    key={piece.id}
                    className="animate-card-enter"
                    style={{
                      backgroundColor: 'var(--color-surface-subtle)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      animationDelay: `${(idx + 1) * 60}ms`
                    }}
                  >
                    <div style={{ width: '100%', height: 122 }}>
                      <GarmentImage src={piece.imageUrl} alt={piece.name} category={piece.category} hexColor={piece.hexColor} />
                    </div>
                    <div style={{ padding: 10 }}>
                      <div
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          color: 'var(--color-text-primary)',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {piece.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            backgroundColor: piece.hexColor,
                            display: 'inline-block',
                            border: '1px solid rgba(0,0,0,0.15)',
                            flexShrink: 0
                          }}
                        />
                        <span className="text-caption" style={{ fontSize: '0.68rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {piece.color}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sparse-wardrobe note — shown when a core category had nothing to draw from */}
          {outfit.missingCategories && outfit.missingCategories.length > 0 && (
            <div
              style={{
                padding: 12,
                backgroundColor: 'var(--color-surface-subtle)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}
            >
              <AlertTriangle size={15} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
              <p className="text-caption" style={{ fontSize: '0.78rem' }}>
                Add {formatCategoryList(outfit.missingCategories)} to your Collection for a more complete look.
              </p>
            </div>
          )}

          {/* "Why It Works" Editorial Rationale */}
          <div
            style={{
              padding: 16,
              backgroundColor: 'var(--color-surface-subtle)',
              borderRadius: 'var(--radius-md)',
              borderLeft: '3px solid var(--color-primary)',
              marginBottom: 20
            }}
          >
            <div className="text-metadata" style={{ color: 'var(--color-primary)', marginBottom: 4 }}>
              Why it works
            </div>
            <p className="text-body" style={{ fontSize: '0.85rem', lineHeight: 1.45, color: 'var(--color-text-primary)' }}>
              "{outfit.explanation.summary}"
            </p>
          </div>

          {/* Action Buttons: "Wear this" is the hero action; View/Swap/Save
              share a secondary row so nothing wraps at 375px. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <PrimaryButton
              fullWidth
              icon={isWorn ? <Check size={16} /> : <ArrowRight size={16} />}
              onClick={handleWearThis}
              style={isWorn ? { backgroundColor: 'var(--color-success)' } : undefined}
            >
              {isWorn ? 'Worn Today' : 'Wear this'}
            </PrimaryButton>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <SecondaryButton
                style={{ padding: '10px 4px', fontSize: '0.76rem', whiteSpace: 'nowrap' }}
                icon={<Eye size={14} />}
                onClick={() => setShowBreakdown(!showBreakdown)}
              >
                {showBreakdown ? 'Hide' : 'View'}
              </SecondaryButton>

              <SecondaryButton
                style={{ padding: '10px 4px', fontSize: '0.76rem', whiteSpace: 'nowrap' }}
                icon={<RefreshCw size={14} />}
                onClick={handleSwapLook}
                title="Generate an alternative outfit combination"
              >
                Swap
              </SecondaryButton>

              <SecondaryButton
                style={{ padding: '10px 4px', fontSize: '0.76rem', whiteSpace: 'nowrap', color: isSaved ? 'var(--color-danger)' : 'var(--color-text-primary)' }}
                icon={<Heart size={14} fill={isSaved ? 'var(--color-danger)' : 'none'} />}
                onClick={handleToggleSave}
                title="Save Look"
              >
                {isSaved ? 'Saved' : 'Save'}
              </SecondaryButton>
            </div>
          </div>

          {/* Expanded View Breakdown drawer if toggled */}
          {showBreakdown && (
            <div className="animate-fade-in" style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
              <h4 className="text-section-heading" style={{ fontSize: '1rem', marginBottom: 8 }}>
                Complete Ensemble Breakdown
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {outfit.items.map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', gap: 12 }}>
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>{p.color}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Outfit Suggestions — quick shortcuts to other occasions */}
      {otherOccasions.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="text-metadata" style={{ marginBottom: 10 }}>Try a different look</div>
          <div className="hide-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {otherOccasions.map((occ) => (
              <button
                key={occ}
                onClick={() => handleSelectOccasion(occ)}
                style={{
                  flexShrink: 0,
                  padding: '9px 16px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                For {occ}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 6. Recently Added */}
      {recentlyAdded.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="text-metadata" style={{ marginBottom: 10 }}>Recently added</div>
          <div className="hide-scrollbar" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
            {recentlyAdded.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectItemDetail?.(item)}
                title={item.name}
                style={{
                  flexShrink: 0,
                  width: 72,
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  cursor: onSelectItemDetail ? 'pointer' : 'default',
                  textAlign: 'left'
                }}
              >
                <div style={{ width: 72, height: 72, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                  <GarmentImage src={item.imageUrl} alt={item.name} category={item.category} hexColor={item.hexColor} />
                </div>
                <div
                  className="text-caption"
                  style={{ marginTop: 6, fontSize: '0.68rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {item.name}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 7. Wardrobe Insights teaser */}
      <button
        onClick={onNavigateToProfile}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          cursor: onNavigateToProfile ? 'pointer' : 'default',
          textAlign: 'left'
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: 'var(--color-primary-alpha)',
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <Sparkles size={17} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {wardrobe.length} {wardrobe.length === 1 ? 'piece' : 'pieces'} in your wardrobe
          </div>
          {topColor && (
            <div className="text-caption" style={{ fontSize: '0.75rem', marginTop: 1 }}>
              {topColor} is your most common tone — see full insights
            </div>
          )}
        </div>
        {onNavigateToProfile && <ChevronRight size={18} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />}
      </button>
    </div>
  );
};
