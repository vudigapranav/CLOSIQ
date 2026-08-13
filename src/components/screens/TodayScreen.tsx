import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, RefreshCw, Heart, Eye, Plus, AlertTriangle } from 'lucide-react';
import { PrimaryButton } from '../ui/PrimaryButton';
import { SecondaryButton } from '../ui/SecondaryButton';
import { EmptyState } from '../ui/EmptyState';
import { GarmentImage } from '../ui/GarmentImage';
import { GarmentItem, Outfit, LayeringPreference } from '../../types/wardrobe';
import { generateAIOutfit, isSameOutfit, formatCategoryList } from '../../services/aiStylist';

interface TodayScreenProps {
  wardrobe: GarmentItem[];
  savedOutfits: Outfit[];
  layeringPreference: LayeringPreference;
  onSaveOutfit: (outfit: Outfit) => void;
  onUnsaveOutfit: (outfit: Outfit) => void;
  onOpenUpload?: () => void;
  onNavigateToCollection?: () => void;
}

const OCCASIONS = ['College', 'Work', 'Date', 'Party', 'Casual', 'Travel'];

const GENERATE_DELAY_MS = 550;

export const TodayScreen: React.FC<TodayScreenProps> = ({
  wardrobe,
  savedOutfits,
  layeringPreference,
  onSaveOutfit,
  onUnsaveOutfit,
  onOpenUpload
}) => {
  const [selectedOccasion, setSelectedOccasion] = useState('College');
  const [customInput, setCustomInput] = useState('');
  const [variationSeed, setVariationSeed] = useState(0);
  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activePrompt = customInput.trim() || selectedOccasion;
  const generationToken = useRef(0);

  const runGeneration = (promptText: string, seed: number) => {
    if (wardrobe.length === 0) return;
    const token = ++generationToken.current;
    setIsGenerating(true);
    setErrorMessage(null);
    setShowBreakdown(false);
    window.setTimeout(() => {
      if (token !== generationToken.current) return;
      try {
        setOutfit(generateAIOutfit(wardrobe, { prompt: promptText, layeringPreference }, seed));
      } catch {
        setErrorMessage("We couldn't put together a look just now. Please try again.");
      } finally {
        setIsGenerating(false);
      }
    }, GENERATE_DELAY_MS);
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

  const handleToggleSave = () => {
    if (!outfit) return;
    if (isSaved) {
      onUnsaveOutfit(outfit);
    } else {
      onSaveOutfit(outfit);
    }
  };

  if (wardrobe.length === 0) {
    return (
      <div style={{ padding: '20px 20px 32px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 className="text-screen-heading">Good afternoon, Pranav.</h1>
          <p className="text-body" style={{ marginTop: 2 }}>Let's find your look.</p>
        </div>

        <EmptyState
          icon={<Sparkles size={28} color="var(--color-primary)" />}
          title="Your wardrobe is waiting."
          description="Add a few pieces and CLOSIQ will start styling personalized looks from what you own."
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
      <div style={{ marginBottom: 20 }}>
        <h1 className="text-screen-heading">Good afternoon, Pranav.</h1>
        <p className="text-body" style={{ marginTop: 2, fontSize: '1rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>
          What's the occasion?
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
          placeholder="Tell CLOSIQ what you're dressing for, then press Enter..."
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
            borderLeft: '3px solid #D9534F',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}
        >
          <AlertTriangle size={18} color="#D9534F" style={{ flexShrink: 0 }} />
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
            marginBottom: 24,
            opacity: isGenerating ? 0.55 : 1,
            transition: 'opacity 0.2s ease'
          }}
        >
          {/* Card Header & Match Badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16 }}>
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
                style={{ fontSize: '1.4rem', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {outfit.title}
              </h2>
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

          {/* Visual Garment Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
            {outfit.items.map((piece, idx) => (
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
                  animationDelay: `${idx * 60}ms`
                }}
              >
                <div style={{ width: '100%', height: 130 }}>
                  <GarmentImage src={piece.imageUrl} alt={piece.name} category={piece.category} hexColor={piece.hexColor} />
                </div>
                <div style={{ padding: 10 }}>
                  <span className="text-metadata" style={{ fontSize: '0.65rem' }}>{piece.category}</span>
                  <div
                    style={{
                      fontSize: '0.82rem',
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
                    <span className="text-caption" style={{ fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {piece.color}
                    </span>
                  </div>
                </div>
              </div>
            ))}
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

          {/* Action Buttons: stacked so nothing wraps at 375px */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <PrimaryButton
              fullWidth
              icon={<Eye size={16} />}
              onClick={() => setShowBreakdown(!showBreakdown)}
            >
              {showBreakdown ? 'Hide Breakdown' : 'View Outfit'}
            </PrimaryButton>

            <div style={{ display: 'flex', gap: 10 }}>
              <SecondaryButton
                style={{ flex: 1, whiteSpace: 'nowrap' }}
                icon={<RefreshCw size={16} />}
                onClick={handleSwapLook}
                title="Generate an alternative outfit combination"
              >
                Swap
              </SecondaryButton>

              <SecondaryButton
                style={{ flex: 1, whiteSpace: 'nowrap', color: isSaved ? '#D9534F' : 'var(--color-text-primary)' }}
                icon={<Heart size={16} fill={isSaved ? '#D9534F' : 'none'} />}
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
    </div>
  );
};
