import React from 'react';
import { Sparkles, Sun, RefreshCw, ChevronRight } from 'lucide-react';
import { PrimaryButton } from './PrimaryButton';

interface AIRecommendationCardProps {
  weatherText?: string;
  recommendationTitle?: string;
  recommendationVibe?: string;
  explanationSnippet?: string;
  heroImageUrl?: string;
  onRefresh?: () => void;
  onViewDetails?: () => void;
}

export const AIRecommendationCard: React.FC<AIRecommendationCardProps> = ({
  weatherText = '68°F • Clear SoHo Afternoon',
  recommendationTitle = 'The SoHo Monolith',
  recommendationVibe = 'Elevated Architectural Minimalist',
  explanationSnippet = 'Designed specifically for today’s mild weather. Anchored by your Over-sized Camel Trench Coat over fluid off-white silk crepe, creating an authoritative yet calm profile.',
  heroImageUrl = 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=800&q=80',
  onRefresh,
  onViewDetails
}) => {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-md)',
        marginBottom: 24
      }}
    >
      {/* Weather Pill */}
      <div style={{ padding: '16px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          <Sun size={15} color="var(--color-primary)" />
          <span>{weatherText}</span>
        </div>

        <button
          onClick={onRefresh}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}
        >
          <RefreshCw size={13} />
          <span>Re-generate</span>
        </button>
      </div>

      {/* Hero Editorial Image Preview */}
      <div style={{ position: 'relative', width: '100%', height: 280, backgroundColor: 'var(--color-surface-subtle)' }}>
        <img src={heroImageUrl} alt={recommendationTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 20,
            background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 100%)',
            color: '#FFFFFF'
          }}
        >
          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#C5A880', fontWeight: 600 }}>
            {recommendationVibe}
          </span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.45rem', color: '#FFFFFF', marginTop: 2 }}>
            {recommendationTitle}
          </h2>
        </div>
      </div>

      {/* Rationale & Action */}
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-primary)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          <Sparkles size={14} />
          Why CLOSIQ Chose This Outfit
        </div>

        <p className="text-body" style={{ fontSize: '0.86rem', lineHeight: 1.5, marginBottom: 16 }}>
          {explanationSnippet}
        </p>

        <PrimaryButton fullWidth icon={<ChevronRight size={18} />} onClick={onViewDetails}>
          View Outfit Breakdown
        </PrimaryButton>
      </div>
    </div>
  );
};
