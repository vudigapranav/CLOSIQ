import React, { useRef, useState } from 'react';
import { Sparkles, RefreshCw, Heart, Eye, AlertTriangle } from 'lucide-react';
import { PrimaryButton } from '../ui/PrimaryButton';
import { SecondaryButton } from '../ui/SecondaryButton';
import { EmptyState } from '../ui/EmptyState';
import { GarmentImage } from '../ui/GarmentImage';
import { GarmentItem, Outfit, GarmentCategory, LayeringPreference } from '../../types/wardrobe';
import {
  STYLIST_SUGGESTION_CHIPS,
  generateAIOutfit,
  swapGarmentInOutfit,
  isSameOutfit,
  formatCategoryList
} from '../../services/aiStylist';

interface StylistScreenProps {
  wardrobe: GarmentItem[];
  savedOutfits: Outfit[];
  layeringPreference: LayeringPreference;
  onSaveOutfit: (outfit: Outfit) => void;
  onUnsaveOutfit: (outfit: Outfit) => void;
  onSelectItemDetail?: (item: GarmentItem) => void;
}

export const StylistScreen: React.FC<StylistScreenProps> = ({
  wardrobe,
  savedOutfits,
  layeringPreference,
  onSaveOutfit,
  onUnsaveOutfit,
  onSelectItemDetail
}) => {
  const [prompt, setPrompt] = useState('I have a college presentation tomorrow');
  const [selectedChip, setSelectedChip] = useState('College');
  const [isGenerating, setIsGenerating] = useState(false);
  const [variationSeed, setVariationSeed] = useState(0);
  const [outfit, setOutfit] = useState<Outfit | null>(() => {
    if (wardrobe.length === 0) return null;
    try {
      return generateAIOutfit(wardrobe, { prompt: 'College presentation tomorrow', layeringPreference }, 0);
    } catch {
      return null;
    }
  });
  const [showDetails, setShowDetails] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const generationToken = useRef(0);

  const runGeneration = (seed: number) => {
    if (wardrobe.length === 0) return;
    const token = ++generationToken.current;
    setIsGenerating(true);
    setErrorMessage(null);
    window.setTimeout(() => {
      if (token !== generationToken.current) return;
      try {
        setOutfit(generateAIOutfit(wardrobe, { prompt: prompt || selectedChip, layeringPreference }, seed));
      } catch {
        setErrorMessage("We couldn't put together a look just now. Please try again.");
      } finally {
        setIsGenerating(false);
      }
    }, 600);
  };

  const handleGenerate = () => {
    setVariationSeed(0);
    runGeneration(0);
  };

  const handleRegenerate = () => {
    const nextSeed = variationSeed + 1;
    setVariationSeed(nextSeed);
    runGeneration(nextSeed);
  };

  const handleSwapPiece = (category: GarmentCategory) => {
    if (!outfit) return;
    try {
      const updated = swapGarmentInOutfit(outfit, category, wardrobe);
      setOutfit(updated);
    } catch {
      setErrorMessage("That swap didn't work — please try again.");
    }
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
        <div style={{ marginBottom: 20 }}>
          <h1 className="text-screen-heading">Your AI Stylist</h1>
          <p className="text-body" style={{ marginTop: 2 }}>Tell me where you're going.</p>
        </div>

        <EmptyState
          icon={<Sparkles size={28} color="var(--color-primary)" />}
          title="Nothing to style yet."
          description="Add a few pieces to your Collection and CLOSIQ can start building outfits from what you actually own."
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 20px 32px' }}>
      {/* 1. Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 className="text-screen-heading">Your AI Stylist</h1>
        <p className="text-body" style={{ marginTop: 2 }}>Tell me where you're going.</p>
      </div>

      {/* 2. Natural Language Input & Chips Box */}
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
        {/* Large Natural Language Input */}
        <div style={{ marginBottom: 16 }}>
          <textarea
            placeholder="e.g. I have a college presentation tomorrow..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-medium)',
              backgroundColor: 'var(--color-surface-subtle)',
              color: 'var(--color-text-primary)',
              fontSize: '0.9rem',
              fontFamily: 'var(--font-family)',
              outline: 'none',
              resize: 'none',
              lineHeight: 1.4
            }}
          />
        </div>

        {/* Contextual Suggestion Chips */}
        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 8 }}>
          Contextual Suggestions
        </div>
        <div className="hide-scrollbar" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
          {STYLIST_SUGGESTION_CHIPS.map((chip) => {
            const isActive = selectedChip === chip;
            return (
              <button
                key={chip}
                onClick={() => {
                  setSelectedChip(chip);
                  setVariationSeed(0);
                  setPrompt(`I'm styling for a ${chip.toLowerCase()} event tomorrow`);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  backgroundColor: isActive ? 'var(--color-primary)' : 'var(--color-surface-subtle)',
                  color: isActive ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
                  border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease'
                }}
              >
                {chip}
              </button>
            );
          })}
        </div>

        {/* Generate Button */}
        <PrimaryButton fullWidth icon={<Sparkles size={18} />} onClick={handleGenerate} disabled={isGenerating}>
          {isGenerating ? 'Styling Your Wardrobe...' : 'Generate Outfit'}
        </PrimaryButton>
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
          <SecondaryButton style={{ flexShrink: 0, padding: '8px 14px', fontSize: '0.78rem' }} onClick={() => runGeneration(variationSeed)}>
            Retry
          </SecondaryButton>
        </div>
      )}

      {/* 3. Output Card */}
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
          {/* Outfit Name & Match Score */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ minWidth: 0 }}>
              <span
                className="text-metadata"
                style={{ color: 'var(--color-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
              >
                {outfit.occasion}
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

          {/* Garment Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
            {outfit.items.map((item, idx) => (
              <div
                key={item.id}
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
                <div
                  style={{ width: '100%', height: 130, cursor: onSelectItemDetail ? 'pointer' : undefined }}
                  onClick={() => onSelectItemDetail && onSelectItemDetail(item)}
                >
                  <GarmentImage src={item.imageUrl} alt={item.name} category={item.category} hexColor={item.hexColor} />
                </div>
                <div style={{ padding: 10 }}>
                  <span className="text-metadata" style={{ fontSize: '0.65rem' }}>{item.category}</span>
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
                    {item.name}
                  </div>
                  <button
                    onClick={() => handleSwapPiece(item.category)}
                    style={{
                      marginTop: 8,
                      width: '100%',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-primary)',
                      border: '1px solid var(--color-border)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <RefreshCw size={11} /> Swap
                  </button>
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

          {/* Why It Works Rationale */}
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
              Why It Works
            </div>
            <p className="text-body" style={{ fontSize: '0.85rem', lineHeight: 1.45, color: 'var(--color-text-primary)' }}>
              "{outfit.explanation.summary}"
            </p>
          </div>

          {/* Actions: Save | Regenerate | Details — 3 columns so labels never wrap at 375px */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <SecondaryButton
              style={{ padding: '10px 4px', fontSize: '0.75rem', whiteSpace: 'nowrap', color: isSaved ? '#D9534F' : 'var(--color-text-primary)' }}
              icon={<Heart size={14} fill={isSaved ? '#D9534F' : 'none'} />}
              onClick={handleToggleSave}
            >
              {isSaved ? 'Saved' : 'Save'}
            </SecondaryButton>

            <SecondaryButton
              style={{ padding: '10px 4px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
              icon={<Sparkles size={14} />}
              onClick={handleRegenerate}
            >
              Regen
            </SecondaryButton>

            <SecondaryButton
              style={{ padding: '10px 4px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
              icon={<Eye size={14} />}
              onClick={() => setShowDetails(!showDetails)}
            >
              Details
            </SecondaryButton>
          </div>

          {/* Expanded View Details */}
          {showDetails && (
            <div className="animate-fade-in" style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--color-border)', fontSize: '0.82rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--color-primary)', marginBottom: 6 }}>Garments Selected:</div>
              {outfit.items.map((i) => (
                <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</span>
                  <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>{i.color}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
