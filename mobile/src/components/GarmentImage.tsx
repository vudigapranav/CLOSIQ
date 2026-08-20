import React, { useState } from 'react';
import { View, Image, StyleSheet, ImageStyle, StyleProp, ImageResizeMode } from 'react-native';
import { Shirt } from 'lucide-react-native';
import { COLORS } from '../theme';

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
 */
export const GarmentImage: React.FC<GarmentImageProps> = ({
  uri,
  style,
  resizeMode = 'cover',
  iconSize = 16
}) => {
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View style={[style, styles.fallback]}>
        <Shirt size={iconSize} color={COLORS.textMuted} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode={resizeMode}
      onError={(event) => {
        if (__DEV__) {
          console.warn('[CLOSIQ] Garment image failed to load:', uri, event.nativeEvent?.error);
        }
        setFailed(true);
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
