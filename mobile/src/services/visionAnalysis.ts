import { GarmentCategory, FormalityLevel, LayeringRole } from '../../../src/types/wardrobe';
import { postApi, describeApiFailure, ApiFailureReason } from './apiRequest';

export interface VisionAnalysisResult {
  name: string;
  category: GarmentCategory;
  subcategory: string;
  color: string;
  hexColor: string;
  fabric: string;
  fit: string;
  formality: FormalityLevel;
  layeringRole?: LayeringRole;
  style: string;
  tags: string[];
  pairingNotes: string;
  /** Present ONLY when the model itself returned a numeric confidence. */
  aiConfidence?: number;
}

/**
 * Sprint M20: an analysis either genuinely happened, or it didn't.
 *
 * Previously every failure (offline, 401, Gemini 429/quota, no server)
 * returned `ok: true` with a fabricated result — "Charcoal", "Cotton
 * Blend", "Modern Minimalist", a canned stylist note and `aiConfidence: 88`
 * — rendered on the same "analysis complete" screen as a real Gemini scan
 * and saved to the account as if the AI had said it. Now a failure is
 * reported as a failure, with the reason, and the caller offers manual
 * entry instead. Nothing is invented on either path: a successful scan
 * with a missing field gets a neutral placeholder, never a made-up
 * pairing note or confidence score.
 */
export type VisionAnalysisOutcome =
  | { ok: true; data: VisionAnalysisResult }
  | { ok: false; reason: ApiFailureReason; message: string };

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

const RETRYABLE_SCAN_FAILURES: ApiFailureReason[] = ['ai_unavailable', 'rate_limited', 'server_error'];
const RETRY_ONLY_IF_FAILED_WITHIN_MS = 15_000;
// 3 s gives a busy model a moment. Mutable only so tests can shorten it.
export const scanRetry = { delayMs: 3_000 };

export async function analyzeGarmentImageMobile(
  base64Data: string,
  mimeType = 'image/jpeg',
  categoryHint?: string
): Promise<VisionAnalysisOutcome> {
  const body = { imageData: base64Data, mimeType, categoryHint };
  const startedAt = Date.now();
  let result = await postApi('/api/ai/analyze-garment', body);

  // Free-tier Gemini often refuses for a moment when Google is busy. Retry
  // ONCE, after a short pause, but only when the first try failed fast (a
  // refusal, not a long timeout — the user is already waiting) and only for
  // failures a retry can fix (never offline / signed out). 2026-10-14.
  if (
    !result.ok &&
    RETRYABLE_SCAN_FAILURES.includes(result.reason) &&
    Date.now() - startedAt < RETRY_ONLY_IF_FAILED_WITHIN_MS
  ) {
    await new Promise((resolve) => setTimeout(resolve, scanRetry.delayMs));
    result = await postApi('/api/ai/analyze-garment', body);
  }

  if (!result.ok) {
    return { ok: false, reason: result.reason, message: describeApiFailure(result.reason) };
  }

  const d = (result.json.data || {}) as Record<string, unknown>;
  if (!result.json.data) {
    return { ok: false, reason: 'ai_unavailable', message: describeApiFailure('ai_unavailable') };
  }

  return {
    ok: true,
    data: {
      name: str(d.name, 'Uploaded Garment'),
      category: str(d.category, categoryHint || 'tops') as GarmentCategory,
      subcategory: str(d.subcategory, 'Garment'),
      color: str(d.color, 'Unspecified'),
      hexColor: str(d.hexColor, '#9E9E9E'),
      fabric: str(d.fabric, 'Unspecified'),
      fit: str(d.fit, 'Regular'),
      formality: str(d.formality, 'casual') as FormalityLevel,
      layeringRole: d.layeringRole as LayeringRole | undefined,
      style: str(d.style, ''),
      tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
      pairingNotes: str(d.pairingNotes, ''),
      aiConfidence: typeof d.aiConfidence === 'number' ? d.aiConfidence : undefined
    }
  };
}
