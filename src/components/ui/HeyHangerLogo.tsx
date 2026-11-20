import React from 'react';

interface HeyHangerLogoProps {
  /** Rendered width in px; height follows the lockup's own aspect ratio. */
  width?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The HeyHanger lockup: the "HH" mark with its small hanger hook plus the
 * "HeyHanger" wordmark (public/brand/heyhanger-lockup.svg, generated from the
 * masters by scripts/generate-app-icons.mjs). It sits on a warm-ivory plate so
 * it reads the same on the light app, the dark theme and the charcoal launch
 * intro. Do not redraw the mark here; edit the SVG masters and regenerate.
 */
export const HeyHangerLogo: React.FC<HeyHangerLogoProps> = ({ width = 180, className, style }) => (
  <div
    className={className}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px 18px',
      borderRadius: 'var(--radius-lg)',
      backgroundColor: '#F7F2E9',
      boxShadow: 'var(--shadow-md)',
      ...style
    }}
  >
    <img
      src="/brand/heyhanger-lockup.svg"
      alt="HeyHanger"
      style={{ width, height: 'auto', display: 'block' }}
    />
  </div>
);
