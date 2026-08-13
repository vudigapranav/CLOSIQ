import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { PrimaryButton } from '../ui/PrimaryButton';
import { WardrobeProfile, LayeringPreference } from '../../types/wardrobe';

interface OnboardingScreenProps {
  onComplete: (profile: WardrobeProfile, layering: LayeringPreference) => void;
}

const LAYERING_OPTIONS: { value: LayeringPreference; label: string; description: string }[] = [
  { value: 'avoid', label: 'Avoid', description: 'Skip base layers unless I ask' },
  { value: 'sometimes', label: 'Sometimes', description: "Use them when they fit the look" },
  { value: 'usually', label: 'Usually', description: 'I like a layered base most days' }
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [profile, setProfile] = useState<WardrobeProfile | null>(null);
  const [layering, setLayering] = useState<LayeringPreference>('sometimes');

  return (
    <div
      className="animate-fade-in"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '48px 24px 32px'
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.4rem',
            fontWeight: 600,
            letterSpacing: '0.18em',
            color: 'var(--color-primary)',
            textTransform: 'uppercase'
          }}
        >
          CLOSIQ
        </div>
        <p className="text-body" style={{ marginTop: 6 }}>Your wardrobe, understood.</p>
      </div>

      <div style={{ flex: 1 }}>
        {/* 1. Wardrobe Profile */}
        <div style={{ marginBottom: 40 }}>
          <h1 className="text-screen-heading" style={{ fontSize: '1.5rem', marginBottom: 4 }}>
            Who are we styling for?
          </h1>
          <p className="text-body" style={{ marginBottom: 20 }}>
            This sets which generated wardrobe CLOSIQ shows you.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {(['men', 'women'] as WardrobeProfile[]).map((option) => {
              const isActive = profile === option;
              return (
                <button
                  key={option}
                  onClick={() => setProfile(option)}
                  style={{
                    padding: '28px 16px',
                    borderRadius: 'var(--radius-lg)',
                    border: `1.5px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border-medium)'}`,
                    backgroundColor: isActive ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: isActive ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.15rem',
                    fontWeight: 500,
                    textTransform: 'capitalize',
                    boxShadow: isActive ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Layering Preference */}
        <div>
          <h2 className="text-screen-heading" style={{ fontSize: '1.5rem', marginBottom: 4 }}>
            Tell CLOSIQ how you like to dress.
          </h2>
          <p className="text-body" style={{ marginBottom: 20 }}>
            Layering preference
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {LAYERING_OPTIONS.map((option) => {
              const isActive = layering === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setLayering(option.value)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    backgroundColor: isActive ? 'var(--color-primary-alpha)' : 'var(--color-surface)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: isActive ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>
                      {option.label}
                    </div>
                    <div className="text-caption" style={{ marginTop: 2 }}>{option.description}</div>
                  </div>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      border: `1.5px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border-medium)'}`,
                      backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                      flexShrink: 0
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <PrimaryButton
          fullWidth
          icon={<ArrowRight size={18} />}
          disabled={!profile}
          style={{ opacity: profile ? 1 : 0.5, cursor: profile ? 'pointer' : 'not-allowed' }}
          onClick={() => profile && onComplete(profile, layering)}
        >
          Enter CLOSIQ
        </PrimaryButton>
      </div>
    </div>
  );
};
