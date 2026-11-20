import { Image } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * A modern phone camera photo is routinely 3000-4000px on the long edge —
 * several MB even after the image picker's own JPEG quality setting, and
 * every consumer of that data (a ~160pt wardrobe-grid thumbnail, a ~220pt
 * detail-view frame, or Gemini Vision reading color/fabric/style) needs
 * nowhere near that resolution. Storing and re-decoding the untouched
 * original everywhere it's displayed — and base64-encoding the untouched
 * original for every Gemini Vision request — was pure waste, not a real
 * quality requirement.
 *
 * This resizes (only if actually larger — a smaller source photo is never
 * upscaled) and JPEG-compresses in ONE pass, producing exactly what both
 * storage/display and the Vision upload need. It writes a NEW file to the
 * app's cache directory; it never touches, moves, or deletes the user's
 * original photo library asset, so nothing about the user's own photos is
 * destroyed by this — see expo-image-manipulator's own docs, which document
 * "each invocation results in a new file."
 */

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.75;

export interface OptimizedImage {
  uri: string;
  base64: string;
  width: number;
  height: number;
}

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

export async function optimizeGarmentImage(uri: string): Promise<OptimizedImage> {
  const { width, height } = await getImageSize(uri);
  const context = ImageManipulator.manipulate(uri);
  const needsResize = Math.max(width, height) > MAX_DIMENSION;
  const rendered = await (needsResize ? context.resize({ width: MAX_DIMENSION }) : context).renderAsync();
  const result = await rendered.saveAsync({
    compress: JPEG_QUALITY,
    format: SaveFormat.JPEG,
    base64: true
  });

  return {
    uri: result.uri,
    base64: result.base64 || '',
    width: result.width,
    height: result.height
  };
}
