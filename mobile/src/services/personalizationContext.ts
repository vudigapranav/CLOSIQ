import { WardrobeProfile, LayeringPreference, Outfit } from '../../../src/types/wardrobe';
import { UserProfileData, TemperatureUnit } from '../types/onboarding';
import { WeatherData } from '../types/weather';
import { PlannerEvent } from '../types/planner';
import { loadRecentOutfitSignatures } from './outfitHistoryStorage';

/**
 * Composes the personalization context sent alongside an outfit-generation
 * request. Every field here is read from data CLOSIQ already collects and
 * stores elsewhere (onboarding profile, M14's weather service, M13's
 * planner events, M10's outfit history) — this module introduces NO new
 * storage, it only shapes existing data into the small request-context
 * objects generateOutfitMobile() forwards to the server.
 */

export interface UserStyleContext {
  profile: WardrobeProfile;
  bodyType?: string;
  skinTone?: string;
  stylePreferences?: string[];
  layeringPreference: LayeringPreference;
}

/** Only includes a field when it carries an actual signal — "prefer not to
 *  say" and an empty style-preference selection are real, valid answers,
 *  but there is nothing useful in them to forward to the AI. */
export function buildUserStyleContext(
  profile: WardrobeProfile,
  layeringPreference: LayeringPreference,
  userProfile?: UserProfileData | null
): UserStyleContext {
  const context: UserStyleContext = { profile, layeringPreference };
  if (userProfile?.bodyType && userProfile.bodyType !== 'prefer_not_to_say') {
    context.bodyType = userProfile.bodyType;
  }
  if (userProfile?.skinTone && userProfile.skinTone !== 'prefer_not_to_say') {
    context.skinTone = userProfile.skinTone;
  }
  if (userProfile?.stylePreferences && userProfile.stylePreferences.length > 0) {
    context.stylePreferences = userProfile.stylePreferences;
  }
  return context;
}

export interface WeatherContext {
  temperatureCelsius: number;
  unit: TemperatureUnit;
  condition: string;
  locationName?: string;
}

/** Returns undefined — never a fabricated placeholder — when weather is
 *  unavailable. Callers must simply omit this field in that case. */
export function buildWeatherContext(weather: WeatherData | null, unit: TemperatureUnit): WeatherContext | undefined {
  if (!weather) return undefined;
  return {
    temperatureCelsius: weather.temperatureCelsius,
    unit,
    condition: weather.condition,
    locationName: weather.locationName
  };
}

export interface PlannerEventContext {
  title: string;
  occasion: string;
  date: string;
  time: string;
  notes?: string;
}

/** Only ever build this from the SPECIFIC event the user is actively
 *  planning an outfit for — never an arbitrary/unrelated event, and never
 *  called at all for a plain Today/Stylist generation with no selected event. */
export function buildPlannerContext(event?: PlannerEvent | null): PlannerEventContext | undefined {
  if (!event) return undefined;
  return {
    title: event.title,
    occasion: event.occasion,
    date: event.date,
    time: event.time,
    notes: event.notes
  };
}

export interface RecentOutfitContext {
  /** Most-recent-first, a SMALL window — a soft "avoid repeating this too
   *  soon" signal, never a hard forbid list (that's excludeGarmentIds'
   *  job, and it only ever hard-excludes the single most recent combo). */
  recentGarmentIdCombinations: string[][];
  /** A couple of saved-look vibes as loose inspiration — not a garment
   *  list to reuse verbatim, and not a constraint. */
  savedLookVibes?: string[];
}

const RECENT_HISTORY_WINDOW = 3;
const SAVED_VIBE_SAMPLE = 2;

/**
 * Single AsyncStorage read, reused for both the existing hard-exclude
 * mechanism and the new soft RecentOutfitContext window, so adding
 * personalization does not double the number of storage reads per generate
 * action. `excludeGarmentIds` is deliberately still only the single
 * most-recent combination (unchanged behavior from M10/M13) rather than the
 * union of the whole window — unioning multiple past combinations would
 * over-constrain a small wardrobe fast (a 2-top/2-bottom minimum wardrobe
 * has almost no room left once several past combos are all excluded at
 * once). The wider window only ever travels as the soft `context` field.
 */
export async function buildRecentOutfitContext(
  savedOutfits: Outfit[] = []
): Promise<{ excludeGarmentIds: string[]; context?: RecentOutfitContext }> {
  const signatures = await loadRecentOutfitSignatures();
  if (signatures.length === 0) {
    return { excludeGarmentIds: [] };
  }

  const recentGarmentIdCombinations = signatures
    .slice(0, RECENT_HISTORY_WINDOW)
    .map((sig) => sig.split('|').filter(Boolean));

  const savedLookVibes = savedOutfits
    .slice(0, SAVED_VIBE_SAMPLE)
    .map((o) => o.vibe)
    .filter(Boolean);

  return {
    excludeGarmentIds: recentGarmentIdCombinations[0] || [],
    context: {
      recentGarmentIdCombinations,
      savedLookVibes: savedLookVibes.length > 0 ? savedLookVibes : undefined
    }
  };
}

export interface OutfitPersonalizationContext {
  userProfileContext?: UserStyleContext;
  weatherContext?: WeatherContext;
  plannerContext?: PlannerEventContext;
  recentOutfitContext?: RecentOutfitContext;
}
