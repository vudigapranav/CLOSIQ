import { postJsonToApi } from './geminiClient';
import { VisionAnalysisResult, analyzeUploadedPhoto as demoAnalyzePhoto } from '../aiVisionScanner';
import { GarmentCategory, FormalityLevel, LayeringRole } from '../../types/wardrobe';

/**
 * Client-side Vision Scanner:
 * Sends image data to server endpoint `POST /api/ai/analyze-garment`.
 * If server is unconfigured or fails, falls back cleanly to deterministic scanner.
 */
export async function analyzeGarmentImageWithGemini(
  imageUrl: string,
  categoryHint: GarmentCategory = 'tops'
): Promise<VisionAnalysisResult> {
  const mimeType = imageUrl.startsWith('data:image/jpeg')
    ? 'image/jpeg'
    : imageUrl.startsWith('data:image/webp')
    ? 'image/webp'
    : 'image/png';

  const body = { imageData: imageUrl, mimeType, categoryHint };
  const startedAt = Date.now();
  let res = await postJsonToApi<any>('/api/ai/analyze-garment', body);

  // Same rule as the phone app (mobile/src/services/visionAnalysis.ts): a busy
  // free-tier AI is retried once after 3 s, only if it failed fast, and never
  // when signed out or offline.
  const error = String(res.error || '');
  const retryable = !/HTTP 40[13]|Failed to fetch|NetworkError|Load failed/i.test(error);
  if (!res.ok && retryable && Date.now() - startedAt < 15_000) {
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    res = await postJsonToApi<any>('/api/ai/analyze-garment', body);
  }

  if (!res.ok || !res.data) {
    // Honest fallback: keep the pixel-colour guess as a pre-fill, but never
    // label it as AI (no "AI Analyzed" tag, no invented confidence).
    const guess = await demoAnalyzePhoto(imageUrl, categoryHint);
    return {
      ...guess,
      aiAnalyzed: false,
      aiConfidence: 0,
      tags: guess.tags.filter((tag) => tag !== 'AI Analyzed')
    };
  }

  const json = res.data;

  // Sanitize and format
  const category: GarmentCategory = ['tops', 'bottoms', 'outerwear', 'shoes', 'accessories'].includes(json.category)
    ? json.category
    : categoryHint;

  const formality: FormalityLevel = ['casual', 'smart_casual', 'formal', 'evening'].includes(json.formality)
    ? json.formality
    : 'smart_casual';

  const layeringRole: LayeringRole | undefined = ['base_layer', 'primary_layer', 'outer_layer'].includes(json.layeringRole)
    ? json.layeringRole
    : undefined;

  return {
    name: json.name || `${json.color || 'Custom'} ${category}`,
    category,
    subcategory: json.subcategory || category,
    color: json.color || 'Neutral',
    hexColor: json.hexColor && /^#[0-9A-Fa-f]{6}$/.test(json.hexColor) ? json.hexColor : '#3A3F47',
    fabric: json.fabric || 'Cotton Blend',
    formality,
    fit: json.fit || 'Regular',
    style: typeof json.style === 'string' && json.style.trim() ? json.style.trim() : undefined,
    layeringRole,
    tags: Array.isArray(json.tags) ? json.tags : ['Custom Upload', json.color || 'Garment'],
    aiConfidence: typeof json.aiConfidence === 'number' ? json.aiConfidence : 0.95,
    pairingNotes: json.pairingNotes || '',
    aiAnalyzed: true
  };
}
