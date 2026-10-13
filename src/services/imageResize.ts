/**
 * Shrinks a picked photo to at most 1024px on its long edge and re-encodes
 * it as JPEG (quality 0.8) in the browser — the same budget the mobile app
 * uses (mobile/src/services/imageOptimizer.ts). Keeps uploads, the AI scan
 * and the studio cut-out fast, and well under the hosting body-size limit.
 */
const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.8;

export async function fileToOptimizedJpegDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available');
  // JPEG has no alpha: paint white first so transparent PNGs don't go black.
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}
