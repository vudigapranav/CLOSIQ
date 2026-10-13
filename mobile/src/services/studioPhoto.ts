import { File, Paths } from 'expo-file-system';
import { postApi } from './apiRequest';

/**
 * Asks the backend for a white-background "studio" version of a garment
 * photo (server/studioPhoto.js — a local open-source cut-out model, no
 * Gemini call) and saves it to the cache directory.
 *
 * Returns a file:// URI, which saveUserGarment() treats exactly like a
 * picked photo (uploaded to the user's bucket), or null when the cut-out
 * didn't work — the caller then simply keeps the original photo.
 */
const STUDIO_TIMEOUT_MS = 30_000;

export async function makeStudioPhotoMobile(base64Jpeg: string): Promise<string | null> {
  const result = await postApi(
    '/api/ai/studio-photo',
    { imageData: base64Jpeg, mimeType: 'image/jpeg' },
    STUDIO_TIMEOUT_MS
  );
  if (!result.ok) return null;

  const data = result.json.data as { imageData?: unknown } | undefined;
  if (!data || typeof data.imageData !== 'string' || !data.imageData) return null;

  try {
    const file = new File(Paths.cache, `studio-${Date.now()}.jpg`);
    file.write(data.imageData, { encoding: 'base64' });
    return file.uri;
  } catch (err) {
    console.warn('Could not save studio photo:', err);
    return null;
  }
}
