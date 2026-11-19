import type { VisionAnalysisOutcome } from './visionAnalysis';
import { infer } from '../local/model';
import { validateGarment } from '../local/validation';
export async function analyzeGarmentImageMobile(
  photo: string,
  _mime?: string,
  hint?: string
): Promise<VisionAnalysisOutcome> {
  try {
    if (!photo.startsWith('file://')) throw new Error('Choose a local garment photograph.');
    const prompt =
      'Describe this garment as JSON: name, category (tops/bottoms/outerwear/shoes/accessories), subcategory, primaryColor, secondaryColors (array), hexColor, pattern, style, formality (casual/smart_casual/formal/evening), pairingNotes. A saree or dress is a one-piece top. Use unknown for unclear details. No brand, price or textile guesses.' +
      (hint ? ' User category hint: ' + hint : '');
    return { ok: true, data: validateGarment(await infer(prompt, photo)) };
  } catch (error) {
    return {
      ok: false,
      reason: 'ai_unavailable',
      message: error instanceof Error ? error.message : 'Local photo analysis failed.'
    };
  }
}
