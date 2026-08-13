import React, { useState } from 'react';
import { Shirt } from 'lucide-react';

interface GarmentImageProps {
  src: string;
  alt: string;
  category?: string;
  hexColor?: string;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
}

/**
 * Drop-in replacement for <img> across garment renders. Catalog items point at
 * /wardrobe/<profile>/<category>/<id>.png before the hackathon team has generated
 * the asset, so this renders an on-brand placeholder instead of a broken image
 * icon until the real file lands (see public/wardrobe/README.md).
 */
export const GarmentImage: React.FC<GarmentImageProps> = ({
  src,
  alt,
  category,
  hexColor,
  style,
  className,
  onClick
}) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        onClick={onClick}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          background: `linear-gradient(160deg, ${hexColor ? `${hexColor}26` : 'var(--color-primary-alpha)'}, var(--color-surface-subtle))`,
          color: 'var(--color-text-muted)',
          cursor: onClick ? 'pointer' : undefined,
          ...style
        }}
      >
        <Shirt size={24} strokeWidth={1.4} />
        {category && (
          <span className="text-metadata" style={{ fontSize: '0.6rem' }}>
            {category}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onClick={onClick}
      onError={() => setFailed(true)}
      className={className}
      style={{ width: '100%', height: '100%', objectFit: 'cover', ...style }}
    />
  );
};
