import { postJsonToApi } from './geminiClient';

/**
 * White-background "studio" version of a garment photo, from the backend's
 * local cut-out model (server/studioPhoto.js — no Gemini call). Returns a
 * JPEG data URL, or null when it couldn't be made; the caller then keeps the
 * original photo.
 */
export async function makeStudioPhoto(jpegDataUrl: string): Promise<string | null> {
  const res = await postJsonToApi<{ imageData?: string; mimeType?: string }>('/api/ai/studio-photo', {
    imageData: jpegDataUrl,
    mimeType: 'image/jpeg'
  });
  if (!res.ok || !res.data?.imageData) return null;
  return `data:${res.data.mimeType || 'image/jpeg'};base64,${res.data.imageData}`;
}
