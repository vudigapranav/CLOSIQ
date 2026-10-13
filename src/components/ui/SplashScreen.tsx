import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ClosiqLogo } from './ClosiqLogo';

interface SplashScreenProps {
  /** Called once the exit transition has fully finished. */
  onFinish: () => void;
}

type Variant = 'full' | 'lite' | 'reduced';

// Full film: letterbox → light through the door seam → almirah doors swing
// open → logo focus-pull → tagline → bars retract. Timings match index.css.
const FULL_HOLD_MS = 3600;
const LITE_HOLD_MS = 1300;
const REDUCED_HOLD_MS = 700;
const EXIT_MS = 600;
const REDUCED_EXIT_MS = 200;

const FULL_INTRO_KEY = 'closiq_intro_full_date';

/** Full cinematic intro once per day per browser; a short version otherwise. */
function pickVariant(): Variant {
  if (typeof window === 'undefined') return 'lite';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'reduced';
  const today = new Date().toDateString();
  try {
    if (localStorage.getItem(FULL_INTRO_KEY) === today) return 'lite';
    localStorage.setItem(FULL_INTRO_KEY, today);
  } catch {
    // Storage blocked: play the full film every launch rather than never.
  }
  return 'full';
}

/**
 * Launch intro (cinematic since 2026-10-13). Shown on every mount of <App>
 * (initial load and every reload) — never on in-app tab navigation, since
 * those don't remount App. Tap anywhere to skip. Uses only the official
 * logo asset via ClosiqLogo; the doors, light and bars are plain shapes.
 */
export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [variant] = useState<Variant>(pickVariant);
  const [exiting, setExiting] = useState(false);
  const finished = useRef(false);

  const exit = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    setExiting(true);
    window.setTimeout(onFinish, variant === 'reduced' ? REDUCED_EXIT_MS : EXIT_MS);
  }, [onFinish, variant]);

  useEffect(() => {
    const hold = variant === 'full' ? FULL_HOLD_MS : variant === 'lite' ? LITE_HOLD_MS : REDUCED_HOLD_MS;
    const timer = window.setTimeout(exit, hold);
    return () => window.clearTimeout(timer);
  }, [exit, variant]);

  return (
    <div
      className={`intro intro--${variant}${exiting ? ' is-exiting' : ''}`}
      onClick={exit}
      role="presentation"
      aria-hidden="true"
    >
      <div className="intro__stage">
        <div className="intro__logo">
          <ClosiqLogo width={220} />
        </div>
        <p className="intro__tagline">Style what you already own</p>
        <span className="intro__rule" />
      </div>

      {variant === 'full' && (
        <>
          <span className="intro__seam" />
          <div className="intro__door intro__door--left">
            <span className="intro__panel intro__panel--upper" />
            <span className="intro__panel intro__panel--lower" />
          </div>
          <div className="intro__door intro__door--right">
            <span className="intro__panel intro__panel--upper" />
            <span className="intro__panel intro__panel--lower" />
          </div>
        </>
      )}

      {variant !== 'reduced' && (
        <>
          <div className="intro__bar intro__bar--top" />
          <div className="intro__bar intro__bar--bottom">
            <span className="intro__skip">Tap to skip</span>
          </div>
        </>
      )}
    </div>
  );
};
