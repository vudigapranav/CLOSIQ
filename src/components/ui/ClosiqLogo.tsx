import React from 'react';

interface ClosiqLogoProps {
  /** Rendered width in px; height follows the asset's own aspect ratio. */
  width?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The official CLOSIQ wordmark (public/brand/closiq-logo.png) — brain motif
 * integrated into the Q, baked onto an opaque warm-ivory swatch by the source
 * asset itself. The plate below matches that exact swatch so the mark reads
 * cleanly with zero seam in both light and dark mode, without altering the
 * artwork. Do not replace this asset or redraw the mark elsewhere.
 */
export const ClosiqLogo: React.FC<ClosiqLogoProps> = ({ width = 180, className, style }) => (
  <div
    className={className}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px 18px',
      borderRadius: 'var(--radius-lg)',
      backgroundColor: '#F5F6F2',
      boxShadow: 'var(--shadow-md)',
      ...style
    }}
  >
    <img
      src="/brand/closiq-logo.png"
      alt="CLOSIQ"
      style={{ width, height: 'auto', display: 'block' }}
    />
  </div>
);
