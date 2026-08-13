import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Shirt, Sparkles, CalendarDays } from 'lucide-react';
import { PrimaryButton } from '../ui/PrimaryButton';
import { ClosiqLogo } from '../ui/ClosiqLogo';
import { WardrobeProfile, LayeringPreference } from '../../types/wardrobe';

interface OnboardingScreenProps {
  onComplete: (profile: WardrobeProfile, layering: LayeringPreference) => void;
}

type OnboardingStep = 'welcome' | 'setup';

const LAYERING_OPTIONS: { value: LayeringPreference; label: string; description: string }[] = [
  { value: 'avoid', label: 'Avoid', description: 'Skip base layers unless I ask' },
  { value: 'sometimes', label: 'Sometimes', description: "Use them when they fit the look" },
  { value: 'usually', label: 'Usually', description: 'I like a layered base most days' }
];

const WELCOME_POINTS = [
  { icon: <Shirt size={18} />, text: 'Digitize the clothes you already own' },
  { icon: <Sparkles size={18} />, text: 'Get AI styling recommendations built from your wardrobe' },
  { icon: <CalendarDays size={18} />, text: 'Plan what to wear, day by day' }
];

function ProgressDots({ step }: { step: OnboardingStep }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 28 }}>
      {(['welcome', 'setup'] as OnboardingStep[]).map((s) => (
        <span
          key={s}
          style={{
            width: s === step ? 20 : 6,
            height: 6,
            borderRadius: 'var(--radius-pill)',
            backgroundColor: s === step ? 'var(--color-primary)' : 'var(--color-border-medium)',
            transition: 'all 0.25s ease'
          }}
        />
      ))}
    </div>
  );
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [profile, setProfile] = useState<WardrobeProfile | null>(null);
  const [layering, setLayering] = useState<LayeringPreference>('sometimes');

  if (step === 'welcome') {
    return (
      <div
        className="animate-fade-in"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 24px 32px'
        }}
      >
        <ProgressDots step={step} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <ClosiqLogo width={190} />

          <h1 className="text-display" style={{ marginTop: 32, fontSize: '2rem' }}>
            Your wardrobe.
            <br />
            Understood.
          </h1>
          <p className="text-body" style={{ marginTop: 12, maxWidth: 320 }}>
            CLOSIQ turns the clothes you already own into outfits you'd actually wear — no shopping required.
          </p>

          <div style={{ marginTop: 36, width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {WELCOME_POINTS.map((point, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  textAlign: 'left'
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-primary-alpha)',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  {point.icon}
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>{point.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 32 }}>
          <PrimaryButton fullWidth icon={<ArrowRight size={18} />} onClick={() => setStep('setup')}>
            Get Started
          </PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div
      className="animate-fade-in"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 24px 32px'
      }}
    >
      <ProgressDots step={step} />

      <div style={{ marginBottom: 8 }}>
        <button
          onClick={() => setStep('welcome')}
          aria-label="Back"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
            fontSize: '0.78rem',
            fontWeight: 600,
            padding: 0,
            marginBottom: 20
          }}
        >
          <ArrowLeft size={14} /> Back
        </button>
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
