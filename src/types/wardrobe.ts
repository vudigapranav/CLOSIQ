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
  layeringRole?: LayeringRole;
  /** Set only on items auto-seeded from the men's/women's generated catalog.
   *  Absent for anything the user photographed/uploaded/hand-picked themselves,
   *  so their own wardrobe is never hidden or deleted by a profile switch. */
  profile?: WardrobeProfile;
  /** True only for items auto-populated at onboarding/profile-switch time —
   *  distinguishes the swappable starter set from deliberate user additions. */
  isSeedItem?: boolean;
}

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
  temperature: number;
  items: GarmentItem[];
  styleScore: number;
  explanation: OutfitExplanation;
  saved: boolean;
  dateCreated: string;
  wornToday?: boolean;
  /** Core categories (tops/bottoms/shoes) the wardrobe had nothing to fill — lets the UI explain a sparse outfit instead of looking broken. */
  missingCategories?: GarmentCategory[];
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
