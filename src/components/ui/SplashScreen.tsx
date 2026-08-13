import React, { useEffect, useState } from 'react';
import { ClosiqLogo } from './ClosiqLogo';

interface SplashScreenProps {
  /** Called once the exit transition has fully finished. */
  onFinish: () => void;
}

const HOLD_MS = 650;
const EXIT_MS = 350;
const REDUCED_HOLD_MS = 150;
const REDUCED_EXIT_MS = 150;

/**
 * Full-shell launch splash: logo fades/scales in, holds briefly, then fades
 * out to reveal the app already rendered underneath. Shown on every mount of
 * <App> (initial load and every reload) — never on in-app tab navigation,
 * since those don't remount App.
 */
export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [phase, setPhase] = useState<'enter' | 'exit'>('enter');
  const [reducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase('exit'), reducedMotion ? REDUCED_HOLD_MS : HOLD_MS);
    return () => clearTimeout(holdTimer);
  }, [reducedMotion]);

  useEffect(() => {
    if (phase !== 'exit') return;
    const exitTimer = setTimeout(onFinish, reducedMotion ? REDUCED_EXIT_MS : EXIT_MS);
    return () => clearTimeout(exitTimer);
  }, [phase, onFinish, reducedMotion]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg)',
        opacity: phase === 'exit' ? 0 : 1,
        transition: `opacity ${reducedMotion ? REDUCED_EXIT_MS : EXIT_MS}ms ease`,
        pointerEvents: phase === 'exit' ? 'none' : 'auto'
      }}
    >
      <div className={reducedMotion ? undefined : 'animate-splash-enter'}>
        <ClosiqLogo width={200} />
      </div>
    </div>
  );
};
