import {
  FormalityLevel,
  GarmentCategory,
  GarmentItem,
  LayeringPreference,
  Outfit,
  OutfitScoreFactor,
  OutfitScoreFactorKey,
  Season,
  isGarmentAvailable
} from '../../types/wardrobe';
import { WeatherSnapshot, isRainy, weatherBand } from '../weather/weatherCore';
import {
  ETHNIC_ONLY_BOTTOM,
  FORMALITY_LABEL,
  capitalize,
  colorHarmony,
  formalityGap,
  garmentText,
  isEthnic,
  isNeutralGarment,
  isOnePiece,
  resolveTargetFormality
} from './garmentTraits';

/**
 * CLOSIQ's deterministic outfit engine (2026-11-11) — shared by web and mobile.
 *
 * This is the "rule-based" half of the hybrid stylist:
 *   - it BUILDS outfits when the AI is unavailable (and is labelled as such),
 *   - it SCORES every outfit — AI or local — with the same explainable
 *     factors, so "why it works" is computed, never invented.
 *
 * Every factor is 0–1 with a weight; a factor the engine has no data for
 * (no weather, no style preferences, no feedback yet) gets weight 0 and is
 * left out of the total instead of being guessed. Pure functions, no I/O.
 */

export interface OutfitContext {
  /** Occasion / free text ("client meeting", "Goa trip"). */
  prompt: string;
  layeringPreference?: LayeringPreference;
  /** Real weather only — omit when unknown. */
  weather?: WeatherSnapshot | null;
  /** Onboarding style ids (src/data/styleDna.ts STYLE_PREFERENCE_OPTIONS). */
  stylePreferences?: string[];
  /** Outfit brain signals (src/services/outfitBrain.ts), structurally typed to avoid an import cycle. */
  brain?: EngineBrain;
  /** Pieces that must not be used (e.g. the previous outfit on "regenerate"). */
  excludeGarmentIds?: string[];
  /** YYYY-MM-DD; defaults to today. Drives rotation + season. */
  today?: string;
}

export interface EngineBrain {
  disliked: Set<string>;
  okay: Set<string>;
  recent: string[];
  likedGarmentIds: Set<string>;
}

export interface OutfitScore {
  /** 0–100, weighted mean of the factors that had data. */
  total: number;
  factors: OutfitScoreFactor[];
}

// ---------- helpers ----------

const signature = (ids: string[]) => [...new Set(ids)].sort().join('|');
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

const todayIso = () => new Date().toISOString().slice(0, 10);

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso.slice(0, 10));
  const b = Date.parse(toIso.slice(0, 10));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return Math.round((b - a) / 86_400_000);
}

/** Calendar season for a date (northern hemisphere, which covers India). */
export function seasonForDate(iso: string): Season {
  const month = Number(iso.slice(5, 7));
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

const WARM_FABRIC = /(wool|cashmere|fleece|down|puffer|tweed|corduroy|flannel|knit|sherpa|velvet|leather|quilted|thermal)/;
const LIGHT_FABRIC = /(linen|cotton|chambray|seersucker|rayon|viscose|mesh|chiffon|georgette|muslin|khadi)/;
const RAIN_UNFRIENDLY = /(suede|canvas|velvet|satin|espadrille|mojari|jutti)/;
const STREET = /(graphic|hoodie|sweatshirt|cargo|oversized|sneaker|jogger|bomber|street)/;
const TAILORED = /(blazer|trouser|oxford|coat|suit|waistcoat|bandhgala|nehru|chino|loafer|formal|tailored)/;
const SPORTY = /(sport|sneaker|track|jogger|athletic|gym|running|trainer|active)/;
const RELAXED_FIT = /(oversized|relaxed|baggy|loose|boxy)/;

/** Does a garment express one of the onboarding style preferences? */
export function matchesStylePreference(item: GarmentItem, pref: string): boolean {
  const t = garmentText(item);
  switch (pref) {
    case 'minimal':
      return isNeutralGarment(item);
    case 'casual':
      return item.formality === 'casual';
    case 'streetwear':
      return STREET.test(t);
    case 'smart_casual':
      return item.formality === 'smart_casual';
    case 'classic':
      return TAILORED.test(t) || item.formality === 'formal';
    case 'sporty':
      return SPORTY.test(t);
    case 'oversized':
      return RELAXED_FIT.test(t);
    case 'clean_contemporary':
      return isNeutralGarment(item) && !/(print|graphic|floral|check|plaid|stripe)/.test(`${t} ${(item.pattern || '').toLowerCase()}`);
    default:
      return false;
  }
}

/** A cold day wants an outer layer; a hot one wants none. */
function needsOuterLayer(ctx: OutfitContext): 'yes' | 'no' | 'optional' {
  if (!ctx.weather) return 'optional';
  const band = weatherBand(ctx.weather);
  if (band === 'freezing' || band === 'cold') return 'yes';
  if (band === 'warm' || band === 'hot') return 'no';
  return 'optional';
}

// ---------- the scorer ----------

const FACTOR_LABEL: Record<OutfitScoreFactorKey, string> = {
  formality: 'Occasion fit',
  color: 'Colour harmony',
  weather: 'Weather',
  season: 'Season',
  style: 'Your style',
  feedback: 'Your feedback',
  rotation: 'Fresh rotation',
  completeness: 'Complete look'
};

const BASE_WEIGHT: Record<OutfitScoreFactorKey, number> = {
  formality: 3,
  color: 2.5,
  weather: 2,
  season: 1,
  style: 1.5,
  feedback: 1.5,
  rotation: 1,
  completeness: 2
};

function factor(key: OutfitScoreFactorKey, score: number, note: string, weight = BASE_WEIGHT[key]): OutfitScoreFactor {
  return { key, label: FACTOR_LABEL[key], score: round2(clamp01(score)), weight, note };
}

function formalityFactor(items: GarmentItem[], target: FormalityLevel): OutfitScoreFactor {
  const core = items.filter((i) => i.category !== 'accessories');
  if (core.length === 0) return factor('formality', 0, 'No pieces to judge yet.');
  const fit = core.reduce((sum, i) => sum + (1 - formalityGap(i.formality, target) / 3), 0) / core.length;
  let spread = 0;
  for (const a of core) for (const b of core) spread = Math.max(spread, formalityGap(a.formality, b.formality));
  const score = fit - (spread >= 2 ? 0.2 : 0);
  const label = FORMALITY_LABEL[target].toLowerCase();
  const note =
    score >= 0.85
      ? `Every piece sits at the ${label} level this occasion calls for.`
      : spread >= 2
        ? `Mixes very casual and very dressy pieces — fine if intentional, but less polished for ${label}.`
        : `Close to the ${label} level; one piece is a step off.`;
  return factor('formality', score, note);
}

function colorFactor(items: GarmentItem[]): OutfitScoreFactor {
  const visible = items.filter((i) => i.category !== 'accessories');
  if (visible.length < 2) return factor('color', 0.5, 'Only one visible piece — nothing to pair colours with.', BASE_WEIGHT.color / 2);
  let total = 0;
  let pairs = 0;
  let worst = Number.POSITIVE_INFINITY;
  let best: { score: number; reason?: string } = { score: Number.NEGATIVE_INFINITY };
  for (let a = 0; a < visible.length; a += 1) {
    for (let b = a + 1; b < visible.length; b += 1) {
      const h = colorHarmony(visible[a], visible[b]);
      total += h.score;
      pairs += 1;
      worst = Math.min(worst, h.score);
      if (h.score > best.score && h.reason) best = h;
    }
  }
  // colorHarmony runs about −1.5 … +2.5 → 0 … 1.
  const avg = (total / pairs + 1.5) / 4;
  const score = worst <= -1.5 ? Math.min(avg, 0.45) : avg;
  const note = worst <= -1.5 ? 'Two of these colours compete with each other.' : best.reason ? `${best.reason}.` : 'Colours sit comfortably together.';
  return factor('color', score, note);
}

function weatherFactor(items: GarmentItem[], ctx: OutfitContext): OutfitScoreFactor {
  const w = ctx.weather;
  if (!w) return factor('weather', 0, 'No weather data — this look was not checked against the forecast.', 0);
  const band = weatherBand(w);
  const temp = Math.round(w.feelsLikeC ?? w.temperatureC);
  const hasOuter = items.some((i) => i.category === 'outerwear');
  const texts = items.map((i) => `${garmentText(i)} ${(i.fabric || '').toLowerCase()}`);
  const warmPieces = texts.filter((t) => WARM_FABRIC.test(t)).length;
  const lightPieces = texts.filter((t) => LIGHT_FABRIC.test(t)).length;
  let score = 0.75;
  const notes: string[] = [];

  if (band === 'freezing' || band === 'cold') {
    score = hasOuter ? 0.85 + Math.min(warmPieces, 2) * 0.075 : 0.25 + Math.min(warmPieces, 2) * 0.1;
    notes.push(hasOuter ? `An outer layer for ${temp}°C.` : `${temp}°C calls for an outer layer this look doesn't have.`);
  } else if (band === 'cool') {
    score = hasOuter || warmPieces > 0 ? 0.9 : 0.6;
    notes.push(hasOuter ? `A layer for a cool ${temp}°C.` : `${temp}°C is cool — carry a light layer.`);
  } else if (band === 'mild') {
    score = 0.9;
    notes.push(`Comfortable for a mild ${temp}°C.`);
  } else {
    score = (hasOuter ? 0.45 : 0.85) + Math.min(lightPieces, 2) * 0.05 - Math.min(warmPieces, 2) * 0.15;
    notes.push(hasOuter ? `An outer layer will be heavy at ${temp}°C.` : `Breathable for ${temp}°C.`);
  }

  if (isRainy(w)) {
    const shoes = items.find((i) => i.category === 'shoes');
    if (shoes && RAIN_UNFRIENDLY.test(`${garmentText(shoes)} ${(shoes.fabric || '').toLowerCase()}`)) {
      score -= 0.25;
      notes.push(`Rain is likely — ${shoes.name} may not like it.`);
    } else {
      notes.push('Rain is likely — shoes are rain-safe.');
    }
  }
  return factor('weather', score, notes.join(' '));
}

function seasonFactor(items: GarmentItem[], ctx: OutfitContext): OutfitScoreFactor {
  const season = seasonForDate(ctx.today ?? todayIso());
  const tagged = items.filter((i) => i.seasons && i.seasons.length > 0);
  if (tagged.length === 0) return factor('season', 0, 'Pieces have no season tags.', 0);
  const inSeason = tagged.filter((i) => i.seasons.includes(season)).length;
  const score = inSeason / tagged.length;
  return factor('season', score, score === 1 ? `All tagged pieces suit ${season}.` : `${inSeason} of ${tagged.length} tagged pieces are tagged for ${season}.`);
}

function styleFactor(items: GarmentItem[], ctx: OutfitContext): OutfitScoreFactor {
  const prefs = (ctx.stylePreferences || []).filter(Boolean);
  if (prefs.length === 0) return factor('style', 0, 'No style preferences set yet.', 0);
  const matching = items.filter((i) => prefs.some((p) => matchesStylePreference(i, p)));
  const score = items.length === 0 ? 0 : matching.length / items.length;
  return factor(
    'style',
    0.3 + score * 0.7,
    matching.length > 0 ? `${matching.length} of ${items.length} pieces match the styles you chose.` : "A step outside the styles you chose."
  );
}

function feedbackFactor(items: GarmentItem[], ctx: OutfitContext): OutfitScoreFactor {
  const brain = ctx.brain;
  if (!brain) return factor('feedback', 0, 'No outfit feedback yet.', 0);
  const sig = signature(items.map((i) => i.id));
  if (brain.disliked.has(sig)) return factor('feedback', 0, 'You disliked this exact combination.');
  const hasSignal = brain.likedGarmentIds.size > 0 || brain.okay.size > 0 || brain.recent.length > 0 || brain.disliked.size > 0;
  if (!hasSignal) return factor('feedback', 0, 'No outfit feedback yet.', 0);
  let score = 0.6;
  const notes: string[] = [];
  const liked = items.filter((i) => brain.likedGarmentIds.has(i.id)).length;
  if (liked > 0) {
    score += Math.min(liked, 3) * 0.13;
    notes.push(`${liked} piece${liked === 1 ? '' : 's'} from looks you liked or wore.`);
  }
  if (brain.okay.has(sig)) {
    score -= 0.25;
    notes.push('You rated this exact look "okay".');
  }
  const recentIndex = brain.recent.indexOf(sig);
  if (recentIndex !== -1) {
    score -= 0.45;
    notes.push('Shown to you recently.');
  }
  return factor('feedback', score, notes.join(' ') || 'A new combination for you.');
}

function rotationFactor(items: GarmentItem[], ctx: OutfitContext): OutfitScoreFactor {
  const today = ctx.today ?? todayIso();
  const core = items.filter((i) => i.category !== 'accessories');
  if (core.length === 0) return factor('rotation', 0, '', 0);
  const recentlyWorn = core.filter((i) => i.lastWornDate && daysBetween(i.lastWornDate, today) <= 2);
  const neverWorn = core.filter((i) => !i.wearCount);
  let score = 1 - (recentlyWorn.length / core.length) * 0.7;
  score += Math.min(neverWorn.length, 2) * 0.05;
  const note =
    recentlyWorn.length > 0
      ? `${recentlyWorn.map((i) => i.name).join(', ')} ${recentlyWorn.length === 1 ? 'was' : 'were'} worn in the last 2 days.`
      : neverWorn.length > 0
        ? `Brings ${neverWorn.length === 1 ? 'a piece you haven\'t worn yet' : 'pieces you haven\'t worn yet'} into rotation.`
        : 'Nothing here was worn in the last 2 days.';
  return factor('rotation', score, note);
}

function completenessFactor(items: GarmentItem[]): OutfitScoreFactor {
  const has = (c: GarmentCategory) => items.some((i) => i.category === c);
  const onePiece = items.some(isOnePiece);
  const body = onePiece || (has('tops') && has('bottoms'));
  const parts = [body, has('shoes')];
  const score = parts.filter(Boolean).length / parts.length;
  const missing: string[] = [];
  if (!onePiece && !has('tops')) missing.push('a top');
  if (!onePiece && !has('bottoms')) missing.push('a bottom');
  if (!has('shoes')) missing.push('shoes');
  return factor('completeness', score, missing.length ? `Missing ${missing.join(' and ')}.` : 'Head-to-toe look.');
}

/** Scores ANY outfit (AI or local) with the same explainable factors. */
export function scoreOutfit(items: GarmentItem[], ctx: OutfitContext): OutfitScore {
  const target = resolveTargetFormality(ctx.prompt || '');
  const factors = [
    formalityFactor(items, target),
    colorFactor(items),
    weatherFactor(items, ctx),
    seasonFactor(items, ctx),
    styleFactor(items, ctx),
    feedbackFactor(items, ctx),
    rotationFactor(items, ctx),
    completenessFactor(items)
  ];
  const weightSum = factors.reduce((s, f) => s + f.weight, 0);
  const total = weightSum === 0 ? 0 : factors.reduce((s, f) => s + f.score * f.weight, 0) / weightSum;
  return { total: Math.round(total * 100), factors };
}

// ---------- candidate generation ----------

/** Pieces the engine may use: available, not excluded. */
export function eligibleWardrobe(wardrobe: GarmentItem[], ctx: Pick<OutfitContext, 'excludeGarmentIds'> = {}): GarmentItem[] {
  const excluded = new Set(ctx.excludeGarmentIds || []);
  return wardrobe.filter((g) => isGarmentAvailable(g) && !excluded.has(g.id));
}

function piecePrior(item: GarmentItem, ctx: OutfitContext, target: FormalityLevel): number {
  let s = 3 - formalityGap(item.formality, target);
  const w = ctx.weather;
  if (w) {
    const band = weatherBand(w);
    const t = `${garmentText(item)} ${(item.fabric || '').toLowerCase()}`;
    if ((band === 'hot' || band === 'warm') && WARM_FABRIC.test(t)) s -= 1;
    if ((band === 'cold' || band === 'freezing') && LIGHT_FABRIC.test(t) && item.category !== 'shoes') s -= 0.5;
    if (isRainy(w) && item.category === 'shoes' && RAIN_UNFRIENDLY.test(t)) s -= 1;
  }
  if (ctx.brain?.likedGarmentIds.has(item.id)) s += 0.4;
  if ((ctx.stylePreferences || []).some((p) => matchesStylePreference(item, p))) s += 0.3;
  if (item.favorite) s += 0.15;
  return s;
}

function topK(pool: GarmentItem[], k: number, ctx: OutfitContext, target: FormalityLevel): GarmentItem[] {
  return [...pool]
    .map((item) => ({ item, s: piecePrior(item, ctx, target) }))
    .sort((a, b) => b.s - a.s || a.item.id.localeCompare(b.item.id))
    .slice(0, k)
    .map((x) => x.item);
}

/** Base-layer tops only when the user is fine with them, the prompt asks, or there's an outer layer. */
function layeringAllows(top: GarmentItem, outer: GarmentItem | undefined, ctx: OutfitContext): boolean {
  if (top.layeringRole !== 'base_layer') return true;
  if ((ctx.layeringPreference || 'sometimes') !== 'avoid') return true;
  if (/(layer|tank|base layer|under|camisole)/i.test(ctx.prompt || '')) return true;
  return Boolean(outer);
}

function compatibleBottom(top: GarmentItem, bottom: GarmentItem): boolean {
  if (ETHNIC_ONLY_BOTTOM.test(garmentText(bottom)) && !isEthnic(top)) return false;
  return true;
}

export interface RankedOutfit {
  items: GarmentItem[];
  score: OutfitScore;
}

/**
 * Builds and ranks complete outfits from the user's OWN available pieces.
 * Returns up to `limit` alternatives with different lead pieces, best first.
 * Disliked combinations are never returned. Empty when nothing can be built.
 */
export function rankOutfits(wardrobe: GarmentItem[], ctx: OutfitContext, limit = 3): RankedOutfit[] {
  const pool = eligibleWardrobe(wardrobe, ctx);
  const target = resolveTargetFormality(ctx.prompt || '');
  const by = (c: GarmentCategory) => pool.filter((g) => g.category === c);

  const allTops = by('tops');
  const onePieces = allTops.filter(isOnePiece);
  const tops = topK(allTops.filter((t) => !isOnePiece(t)), 6, ctx, target);
  const bottoms = topK(by('bottoms'), 6, ctx, target);
  const shoes = topK(by('shoes'), 4, ctx, target);
  const outers = topK(by('outerwear'), 3, ctx, target);
  const accessory = topK(by('accessories'), 1, ctx, target)[0];
  const onePieceTop = topK(onePieces, 3, ctx, target);

  const outerNeed = needsOuterLayer(ctx);
  const outerOptions: (GarmentItem | undefined)[] =
    outerNeed === 'no' ? [undefined] : outerNeed === 'yes' && outers.length > 0 ? outers : [undefined, ...outers];
  const shoeOptions: (GarmentItem | undefined)[] = shoes.length > 0 ? shoes : [undefined];

  const bodies: GarmentItem[][] = [];
  for (const top of tops) {
    if (bottoms.length === 0) bodies.push([top]);
    for (const bottom of bottoms) if (compatibleBottom(top, bottom)) bodies.push([top, bottom]);
  }
  for (const dress of onePieceTop) bodies.push([dress]);
  if (bodies.length === 0) for (const bottom of bottoms) bodies.push([bottom]);
  // No tops or bottoms at all: still offer what exists (shoes, a layer) rather than nothing.
  if (bodies.length === 0) bodies.push([]);

  const seen = new Set<string>();
  const ranked: RankedOutfit[] = [];
  for (const body of bodies) {
    for (const outer of outerOptions) {
      const top = body.find((i) => i.category === 'tops');
      if (top && !layeringAllows(top, outer, ctx)) continue;
      for (const shoe of shoeOptions) {
        const items = [...body, ...(shoe ? [shoe] : []), ...(outer ? [outer] : [])];
        if (items.length === 0) continue;
        // Accessories are a finishing touch for dressier occasions, never a scoring lever.
        if (accessory && target !== 'casual') items.push(accessory);
        const sig = signature(items.map((i) => i.id));
        if (seen.has(sig) || ctx.brain?.disliked.has(sig)) continue;
        seen.add(sig);
        ranked.push({ items, score: scoreOutfit(items, ctx) });
      }
    }
  }
  ranked.sort((a, b) => b.score.total - a.score.total || signature(a.items.map((i) => i.id)).localeCompare(signature(b.items.map((i) => i.id))));

  // Alternatives should feel different: a new lead piece each (top / one-piece), then fall back.
  const out: RankedOutfit[] = [];
  const leads = new Set<string>();
  for (const r of ranked) {
    if (out.length >= limit) break;
    const lead = r.items[0]?.id;
    if (lead && leads.has(lead)) continue;
    if (lead) leads.add(lead);
    out.push(r);
  }
  for (const r of ranked) {
    if (out.length >= limit) break;
    if (!out.includes(r)) out.push(r);
  }
  return out;
}

// ---------- outfit assembly ----------

const VIBE_BY_FORMALITY: Record<FormalityLevel, string> = {
  casual: 'Easy & Relaxed',
  smart_casual: 'Elevated Casual',
  formal: 'Polished & Structured',
  evening: 'Refined After-Dark'
};

const CORE: GarmentCategory[] = ['tops', 'bottoms', 'shoes'];

/** A short, honest title from what's actually in the look. */
function titleFor(items: GarmentItem[], target: FormalityLevel): string {
  const lead = items.find((i) => i.category === 'tops') ?? items[0];
  const second = items.find((i) => i.category === 'bottoms' || i.category === 'outerwear');
  if (!lead) return `${FORMALITY_LABEL[target]} look`;
  const colours = [lead.color, second?.color].filter((c): c is string => Boolean(c && c.trim()));
  const unique = [...new Set(colours.map((c) => capitalize(c.trim().toLowerCase())))];
  return unique.length > 0 ? `${unique.join(' & ')} ${FORMALITY_LABEL[target]}` : `${FORMALITY_LABEL[target]} look`;
}

function noteOf(score: OutfitScore, key: OutfitScoreFactorKey): string {
  return score.factors.find((f) => f.key === key)?.note ?? '';
}

/** "Why it works" text built from the computed factors — the strongest first. */
export function explainScore(score: OutfitScore): Outfit['explanation'] {
  const considered = score.factors.filter((f) => f.weight > 0 && f.note);
  const strongest = [...considered].sort((a, b) => b.score * b.weight - a.score * a.weight).slice(0, 2);
  const summary = strongest.map((f) => f.note).join(' ');
  const weather = score.factors.find((f) => f.key === 'weather');
  return {
    summary: summary || 'Built only from pieces you own.',
    colorHarmony: noteOf(score, 'color'),
    silhouette: noteOf(score, 'formality'),
    weatherSuitability: weather?.note || 'No weather data.',
    versatilityNote: noteOf(score, 'rotation')
  };
}

function missingCore(items: GarmentItem[]): GarmentCategory[] | undefined {
  const onePiece = items.some(isOnePiece);
  const missing = CORE.filter((c) => !items.some((i) => i.category === c) && !(c === 'bottoms' && onePiece));
  return missing.length > 0 ? missing : undefined;
}

/** Turns ranked items into a full rule-based Outfit (source 'local'). */
export function buildEngineOutfit(ranked: RankedOutfit, ctx: OutfitContext, idSuffix: string | number = 0): Outfit {
  const target = resolveTargetFormality(ctx.prompt || '');
  return {
    id: `outfit-${Date.now()}-${idSuffix}`,
    title: titleFor(ranked.items, target),
    occasion: ctx.prompt || FORMALITY_LABEL[target],
    vibe: VIBE_BY_FORMALITY[target],
    formalityLabel: FORMALITY_LABEL[target],
    temperature: ctx.weather ? Math.round(ctx.weather.temperatureC) : undefined,
    items: ranked.items,
    // No AI evaluated it: styleScore 0 keeps every "% Match" badge off; the
    // engine's own score lives in ruleScore and is labelled rule-based.
    styleScore: 0,
    ruleScore: ranked.score.total,
    scoreBreakdown: ranked.score.factors,
    explanation: explainScore(ranked.score),
    missingCategories: missingCore(ranked.items),
    source: 'local',
    saved: false,
    dateCreated: (ctx.today ?? todayIso()).slice(0, 10)
  };
}

/** Attaches the engine's explainable score to an outfit chosen elsewhere (e.g. by the AI). */
export function withRuleScore<T extends Outfit>(outfit: T, ctx: OutfitContext): T {
  const score = scoreOutfit(outfit.items, ctx);
  return { ...outfit, ruleScore: score.total, scoreBreakdown: score.factors };
}

/**
 * Swap candidates for one slot, ranked by how good the WHOLE outfit becomes
 * with each — only available pieces, layering + ethnic rules respected.
 */
export function rankSwapCandidates(outfit: Pick<Outfit, 'items'>, category: GarmentCategory, wardrobe: GarmentItem[], ctx: OutfitContext): GarmentItem[] {
  const current = outfit.items.find((i) => i.category === category);
  const others = outfit.items.filter((i) => i.category !== category);
  const outer = others.find((i) => i.category === 'outerwear');
  const top = others.find((i) => i.category === 'tops');
  const bottom = others.find((i) => i.category === 'bottoms');
  let pool = eligibleWardrobe(wardrobe, ctx).filter((g) => g.category === category && g.id !== current?.id);
  if (category === 'tops') {
    pool = pool.filter((t) => layeringAllows(t, outer, ctx));
    // With a bottom already in the look: no one-piece over it, and the new
    // top must suit that bottom (e.g. a churidar only under an ethnic top).
    if (bottom) pool = pool.filter((t) => !isOnePiece(t) && compatibleBottom(t, bottom));
  }
  if (category === 'bottoms' && top) pool = pool.filter((b) => compatibleBottom(top, b));
  if (category === 'bottoms' && others.some(isOnePiece)) pool = [];
  return pool
    .map((g) => ({ g, s: scoreOutfit([...others, g], ctx).total }))
    .sort((a, b) => b.s - a.s || a.g.id.localeCompare(b.g.id))
    .map((x) => x.g);
}

/**
 * An AI pick must be a wearable look: one body (a top + bottom, or a
 * one-piece), never two pieces from the same category, nothing excluded.
 */
export function isCoherentAIOutfit(items: GarmentItem[], excludeIds: string[] = []): boolean {
  if (items.some((i) => excludeIds.includes(i.id))) return false;
  const counts = new Map<GarmentCategory, number>();
  for (const i of items) counts.set(i.category, (counts.get(i.category) || 0) + 1);
  if ([...counts.values()].some((n) => n > 1)) return false;
  const onePiece = items.some(isOnePiece);
  if (onePiece && counts.has('bottoms')) return false;
  return onePiece || counts.has('tops') || counts.has('bottoms');
}
