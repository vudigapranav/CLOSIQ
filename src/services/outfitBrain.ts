import { GarmentItem, LayeringPreference, Outfit, OutfitRating } from '../types/wardrobe';
import { generateAIOutfit } from './aiStylist';

/**
 * The outfit "brain" (2026-10-14) — shared by the web app and the mobile app.
 *
 * It remembers how the user reacted to each outfit COMBINATION (the exact
 * set of garments) and uses that everywhere suggestions are made:
 *   - "I disliked it"  → that combination is never suggested again.
 *   - "It's okay"      → suggested less.
 *   - "It's nice", and looks the user actually wore → their taste: the AI
 *     leans toward similar pieces, and Style DNA learns from them.
 *   - Combinations shown recently aren't repeated, so regenerating for the
 *     same occasion days later doesn't hand back the first outfit again.
 *
 * Rules travel to the AI as context (server/geminiServer.js rule 12) AND are
 * enforced on whatever comes back (`isFreshCombination`), so a disliked look
 * can't slip through even if the model ignores the instruction.
 */

export const OUTFIT_RATING_OPTIONS: { value: OutfitRating; label: string; emoji: string }[] = [
  { value: 'dislike', label: 'I disliked it', emoji: '👎' },
  { value: 'okay', label: "It's okay", emoji: '🙂' },
  { value: 'nice', label: "It's nice", emoji: '😍' }
];

export interface OutfitFeedback {
  signature: string;
  garmentIds: string[];
  rating: OutfitRating;
  occasion?: string;
  updatedAt: string;
}

/** The exact garment combination, order-independent (same format as outfit_history). */
export function comboSignature(garmentIds: string[]): string {
  return [...new Set(garmentIds)].sort().join('|');
}

const RECENT_WINDOW = 6;

export interface OutfitBrain {
  disliked: Set<string>;
  okay: Set<string>;
  /** Combinations the user rated "nice" or marked as worn. */
  liked: Set<string>;
  /** Most recently shown first. */
  recent: string[];
  /** Every garment that appears in a liked combination. */
  likedGarmentIds: Set<string>;
  /** How many outfits the user has reacted to — "the brain has learned from N looks". */
  learnedFrom: number;
}

export function buildOutfitBrain(
  feedback: OutfitFeedback[],
  recentSignatures: string[] = [],
  savedOutfits: Outfit[] = []
): OutfitBrain {
  const disliked = new Set<string>();
  const okay = new Set<string>();
  const liked = new Set<string>();
  for (const entry of feedback) {
    if (entry.rating === 'dislike') disliked.add(entry.signature);
    else if (entry.rating === 'okay') okay.add(entry.signature);
    else liked.add(entry.signature);
  }
  for (const look of savedOutfits) {
    if (look.status === 'worn') liked.add(comboSignature(look.items.map((i) => i.id)));
  }
  // A combination the user disliked can't also count as liked.
  for (const sig of disliked) liked.delete(sig);

  const likedGarmentIds = new Set<string>();
  for (const sig of liked) for (const id of sig.split('|')) if (id) likedGarmentIds.add(id);

  const reacted = new Set([...disliked, ...okay, ...liked]);
  return {
    disliked,
    okay,
    liked,
    recent: recentSignatures.slice(0, RECENT_WINDOW),
    likedGarmentIds,
    learnedFrom: reacted.size
  };
}

/** Not disliked, and not one of the last few combinations already shown. */
export function isFreshCombination(garmentIds: string[], brain: OutfitBrain | undefined): boolean {
  if (!brain) return true;
  const sig = comboSignature(garmentIds);
  return !brain.disliked.has(sig) && !brain.recent.includes(sig);
}

export interface BrainAIContext {
  /** HARD: never return exactly any of these combinations. */
  dislikedCombinations: string[][];
  /** Don't return exactly these (shown recently, or rated just "okay"). */
  avoidRepeatingCombinations: string[][];
  /** The user's taste: favour similar pieces and styling (not exact repeats). */
  likedCombinations: string[][];
}

const toIds = (sig: string) => sig.split('|').filter(Boolean);

export function brainContextForAI(brain: OutfitBrain): BrainAIContext {
  return {
    dislikedCombinations: [...brain.disliked].slice(0, 40).map(toIds),
    avoidRepeatingCombinations: [...new Set([...brain.recent, ...brain.okay])].slice(0, 12).map(toIds),
    likedCombinations: [...brain.liked].slice(0, 8).map(toIds)
  };
}

/**
 * The local (no-AI) stylist, made brain-aware: tries the occasion-ranked
 * combinations from generateAIOutfit, never returns a disliked one, prefers
 * one not shown recently or rated "okay", and leans toward pieces from liked
 * looks. Returns null only when every combination it can make is disliked.
 */
export function pickLocalOutfit(
  wardrobe: GarmentItem[],
  request: { prompt: string; layeringPreference?: LayeringPreference },
  brain?: OutfitBrain,
  maxTries = 24
): Outfit | null {
  const seen = new Set<string>();
  let best: { outfit: Outfit; score: number } | null = null;

  for (let seed = 0; seed < maxTries; seed += 1) {
    const outfit = generateAIOutfit(wardrobe, { prompt: request.prompt, layeringPreference: request.layeringPreference }, seed);
    const ids = outfit.items.map((i) => i.id);
    if (ids.length === 0) continue;
    const sig = comboSignature(ids);
    if (seen.has(sig)) continue;
    seen.add(sig);
    if (brain?.disliked.has(sig)) continue;

    let score = -seed * 0.01; // earlier seeds fit the occasion better
    if (brain) {
      const recentIndex = brain.recent.indexOf(sig);
      if (recentIndex !== -1) score -= 10 - recentIndex;
      if (brain.okay.has(sig)) score -= 3;
      score += ids.filter((id) => brain.likedGarmentIds.has(id)).length * 0.5;
    }
    if (!best || score > best.score) best = { outfit, score };
  }
  return best?.outfit ?? null;
}

/** Garments from looks the user liked or wore — Style DNA's "taste" input. */
export function tasteGarments(brain: OutfitBrain, wardrobe: GarmentItem[]): GarmentItem[] {
  const out: GarmentItem[] = [];
  for (const sig of brain.liked) {
    for (const id of toIds(sig)) {
      const item = wardrobe.find((g) => g.id === id);
      if (item) out.push(item);
    }
  }
  return out;
}
