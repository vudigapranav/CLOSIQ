import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, ImageStyle, StyleProp, ImageResizeMode } from 'react-native';
import { Shirt } from 'lucide-react-native';
import { COLORS } from '../theme';
import { resignImageUrl, storagePathFromUrl } from '../services/garmentImages';

interface GarmentImageProps {
  uri: string | undefined;
  style: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  iconSize?: number;
}

/**
 * Shared remote-image wrapper for every garment/outfit-piece thumbnail in
 * the app. Every call site previously rendered a raw `<Image>` with no
 * `onError` handler at all — a broken URI (e.g. the image pipeline audit's
 * "backend not running" case) just showed a silent blank space with
 * nothing logged. This adds exactly that: a same-size placeholder on
 * failure (matching the look every screen already used for a genuinely
 * missing `imageUrl`, e.g. ProfileScreen's `savedThumbMissing`/
 * SavedLookDetailModal's `missingImgBox`) and a dev-only console warning
 * naming the failed URI. No layout/size change — `style` is applied
 * identically whether the image loads or not.
 *
 * Sprint M20: an uploaded photo's signed URL expires (1 hour). Every load
 * path re-signs, but a screen left open past the expiry — or a durable
 * reference that couldn't be signed while offline — still fails here. So a
 * failing storage-backed URL is re-signed from its object path ONCE before
 * falling back to the placeholder. One attempt per URI: no retry loop.
 */
export const GarmentImage: React.FC<GarmentImageProps> = ({
  uri,
  style,
  resizeMode = 'cover',
  iconSize = 16
}) => {
  const [failed, setFailed] = useState(false);
  const [currentUri, setCurrentUri] = useState(uri);
  const [resignAttempted, setResignAttempted] = useState(false);

  // A new garment/URI starts fresh.
  useEffect(() => {
    setCurrentUri(uri);
    setFailed(false);
    setResignAttempted(false);
  }, [uri]);

  const handleError = async (detail?: unknown) => {
    if (!resignAttempted && storagePathFromUrl(currentUri)) {
      setResignAttempted(true);
      const fresh = currentUri ? await resignImageUrl(currentUri) : null;
      if (fresh) {
        setCurrentUri(fresh);
        return;
      }
    }
    if (__DEV__) {
      console.warn('[CLOSIQ] Garment image failed to load:', currentUri, detail);
    }
    setFailed(true);
  };

  if (!currentUri || failed) {
    return (
      <View style={[style, styles.fallback]}>
        <Shirt size={iconSize} color={COLORS.textMuted} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: currentUri }}
      style={style}
      resizeMode={resizeMode}
      onError={(event) => {
        void handleError(event.nativeEvent?.error);
      }}
    />
  );
};

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center'
  }
});
