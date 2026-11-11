export type GarmentCategory = 'tops' | 'bottoms' | 'outerwear' | 'shoes' | 'accessories';

export type FormalityLevel = 'casual' | 'smart_casual' | 'formal' | 'evening';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** Which wardrobe profile a piece belongs to. */
export type WardrobeProfile = 'men' | 'women';

/** How willing the user is to have base layers (tank tops etc.) recommended under another garment. */
export type LayeringPreference = 'avoid' | 'sometimes' | 'usually';

/** Where a top/outerwear piece sits in a layered outfit. Not applicable to bottoms/shoes/accessories. */
export type LayeringRole = 'base_layer' | 'primary_layer' | 'outer_layer';

export interface GarmentItem {
  id: string;
  name: string;
  category: GarmentCategory;
  subcategory: string;
  color: string;
  hexColor: string;
  secondaryColors?: string[];
  fabric: string;
  seasons: Season[];
  formality: FormalityLevel;
  imageUrl: string;
  brand?: string;
  favorite: boolean;
  wearCount: number;
  lastWornDate?: string;
  dateAdded: string;
  tags: string[];
  aiConfidence?: number;
  pairingNotes?: string;
  /** Cut/silhouette, e.g. "Oversized", "Slim", "Relaxed". */
  fit?: string;
  /** Short style descriptor, e.g. "Streetwear Essential", "Tailored Modern". Optional — older stored items and demo-fallback-scanned uploads may not have one. */
  style?: string;
  layeringRole?: LayeringRole;
  /** Set only on items auto-seeded from the men's/women's generated catalog.
   *  Absent for anything the user photographed/uploaded/hand-picked themselves,
   *  so their own wardrobe is never hidden or deleted by a profile switch. */
  profile?: WardrobeProfile;
  /** True only for items auto-populated at onboarding/profile-switch time —
   *  distinguishes the swappable starter set from deliberate user additions. */
  isSeedItem?: boolean;
  /** Where this piece is kept at home — a preset from
   *  `src/data/storageLocations.ts` or the user's own custom place. */
  storageLocation?: string;
  /** Size as the user entered it — a preset from `src/data/garmentSizes.ts`
   *  (e.g. "M", "40", "UK 8", "Free size") or free text. */
  size?: string;
  /** 'available' (default) | 'laundry' | 'unavailable' (lent out, needs repair…).
   *  Every recommender skips pieces that aren't available. */
  availability?: GarmentAvailability;
  /** When the user bought it — 'YYYY-MM' or 'YYYY-MM-DD', user-entered only. */
  purchaseDate?: string;
  /** Visible pattern (Solid, Striped, Checked…) — suggested by the scan, confirmed by the user. */
  pattern?: string;
  /** User-named collections ("Office", "Goa trip"). */
  collections?: string[];
}

export type GarmentAvailability = 'available' | 'laundry' | 'unavailable';

export const AVAILABILITY_OPTIONS: { value: GarmentAvailability; label: string; description: string }[] = [
  { value: 'available', label: 'Ready to wear', description: 'In the wardrobe' },
  { value: 'laundry', label: 'In the laundry', description: 'Washing, ironing or with the dhobi' },
  { value: 'unavailable', label: 'Unavailable', description: 'Lent out, being altered or repaired' }
];

/** Missing availability = available (rows saved before 2026-11-11). */
export function isGarmentAvailable(item: Pick<GarmentItem, 'availability'>): boolean {
  return !item.availability || item.availability === 'available';
}

/** The fields a user can edit on an item after it's saved. */
export type GarmentDetailsPatch = Partial<
  Pick<
    GarmentItem,
    | 'storageLocation'
    | 'size'
    | 'name'
    | 'category'
    | 'subcategory'
    | 'color'
    | 'hexColor'
    | 'secondaryColors'
    | 'fabric'
    | 'seasons'
    | 'formality'
    | 'brand'
    | 'fit'
    | 'style'
    | 'tags'
    | 'favorite'
    | 'layeringRole'
    | 'availability'
    | 'purchaseDate'
    | 'pattern'
    | 'collections'
  >
>;

export interface OutfitExplanation {
  summary: string;
  colorHarmony: string;
  silhouette: string;
  weatherSuitability: string;
  versatilityNote: string;
}

export interface Outfit {
  id: string;
  title: string;
  occasion: string;
  vibe: string;
  /** Human-readable formality tier, e.g. "Smart Casual" — shown as the outfit's "Style" label. */
  formalityLabel: string;
  /** °C the outfit was planned for — only when real weather was known. */
  temperature?: number;
  items: GarmentItem[];
  styleScore: number;
  explanation: OutfitExplanation;
  saved: boolean;
  dateCreated: string;
  wornToday?: boolean;
  /** Core categories (tops/bottoms/shoes) the wardrobe had nothing to fill — lets the UI explain a sparse outfit instead of looking broken. */
  missingCategories?: GarmentCategory[];
  /** 'ai' = chosen by the AI stylist; 'local' = CLOSIQ's on-device fallback
   *  (no AI evaluated it, so it carries no match score). */
  source?: 'ai' | 'local';
  /** Saved Looks only: 'try_later' = "I'll try this next time";
   *  'worn' = "I'm wearing / wore this". */
  status?: SavedLookStatus;
  /** CLOSIQ's own explainable rule-based fit score (0–100) — computed by
   *  src/services/intelligence/outfitEngine.ts for every outfit, AI or local. */
  ruleScore?: number;
  /** Per-factor breakdown behind `ruleScore` ("why this works"). */
  scoreBreakdown?: OutfitScoreFactor[];
}

export type OutfitScoreFactorKey =
  | 'formality'
  | 'color'
  | 'weather'
  | 'season'
  | 'style'
  | 'feedback'
  | 'rotation'
  | 'completeness';

export interface OutfitScoreFactor {
  key: OutfitScoreFactorKey;
  label: string;
  /** 0–1: how well the outfit does on this factor. */
  score: number;
  /** Relative importance used in the total (0 = not considered, e.g. no weather data). */
  weight: number;
  /** One plain-English line on what drove the score. */
  note: string;
}

export type SavedLookStatus = 'try_later' | 'worn';

/** How the user rated a suggested outfit (stored per garment combination). */
export type OutfitRating = 'dislike' | 'okay' | 'nice';

/** "96% Match" only for an AI-scored outfit; a local pick says it is
 *  rule-based and shows CLOSIQ's own explainable score — never an invented number. */
export function matchLabel(outfit: Pick<Outfit, 'source' | 'styleScore' | 'ruleScore'>): string {
  if (outfit.source === 'local' || !outfit.styleScore) {
    return typeof outfit.ruleScore === 'number' ? `Rule-based · ${outfit.ruleScore}/100` : 'Rule-based pick';
  }
  return `AI · ${outfit.styleScore}% Match`;
}

export interface UserProfile {
  name: string;
  styleArchetype: string;
  archetypeDescription: string;
  dominantPalette: { name: string; hex: string; percentage: number }[];
  versatilityScore: number;
  totalItemsCount: number;
  formalityBias: number; // 1 (Relaxed) to 5 (Tailored)
  isDarkMode: boolean;
}

export interface OccasionPreset {
  id: string;
  label: string;
  icon: string;
  defaultVibe: string;
  targetFormality: FormalityLevel;
  tempRange: [number, number];
}

export type WeekDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

/** One row of the Outfit Planner — a day's occasion label plus an optional
 *  outfit assigned to it (chosen from the user's saved looks). */
export interface WeeklyPlanEntry {
  day: WeekDay;
  label: string;
  outfit?: Outfit;
}
