import { FormalityLevel, GarmentCategory, GarmentItem, LayeringPreference } from '../types/wardrobe';
import { OutfitBrain } from './outfitBrain';
import { PairingSuggestion, isOnePiece, pairCompatibility, pairingCategories, rankPairings } from './pairingSuggestions';
import { ColorFamily, colorFamiliesOf, colorFamilyLabel, hexToHsl } from './wardrobeSearch';
import { StyleDnaAxis, computeStyleDna, styleArchetype } from '../data/styleDna';

/**
 * Shop Check (2026-11-01) — shared by web and mobile.
 *
 * The user's ask: "I'm in a shop, I see a light-yellow T-shirt. I don't know
 * which of my pants would go with it." Point the camera at a piece BEFORE
 * buying it and CLOSIQ answers like a stylist who knows your closet:
 *   - wear it with: YOUR pieces that suit it, spread across colours
 *     ("your brown chinos, black trousers or blue jeans"),
 *   - whole outfits it would make with what you own, by occasion,
 *   - whether it fits your Style DNA,
 *   - whether you already own something nearly identical, or it fills a gap,
 *   - colour/styling tips, and an honest verdict with its reasons.
 *
 * On-device and deterministic: the photo is read by the existing AI garment
 * scan (or described by hand), everything after that runs here, instantly,
 * and only ever recommends clothes the user owns. The scanned piece is NOT
 * added to the wardrobe unless the user says they bought it.
 */

export type ShopVerdict = 'great' | 'good' | 'think_twice' | 'unknown';

export interface ShopCheckPoint {
  tone: 'good' | 'warn' | 'info';
  text: string;
}

export interface WearWithGroup {
  category: GarmentCategory;
  title: string;
  suggestions: PairingSuggestion[];
  /** "Wear it with your Brown Chinos, Black Trousers or Blue Jeans." */
  sentence: string;
}

export interface ShopOutfit {
  id: string;
  /** Occasion it suits, e.g. "Smart casual". */
  label: string;
  /** The user's own pieces that complete the look (the scanned piece is not included). */
  items: GarmentItem[];
  reason: string;
}

export interface StyleFit {
  level: 'strong' | 'partial' | 'new' | 'unknown';
  title: string;
  detail: string;
  /** The user's style archetype name, e.g. "Street Style". */
  archetype: string;
}

export interface ShopCheckResult {
  verdict: ShopVerdict;
  verdictTitle: string;
  verdictSummary: string;
  /** Checklist behind the verdict, good points first. */
  points: ShopCheckPoint[];
  styleFit: StyleFit;
  wearWith: WearWithGroup[];
  outfits: ShopOutfit[];
  /** Pieces the user already owns that are nearly the same (same type + colour family). */
  similarOwned: GarmentItem[];
  /** How many of the user's pieces it goes with. */
  pairCount: number;
  stylingTips: string[];
  /** Explicitly a FUTURE wardrobe idea, shown only when the closet can't complete a look. */
  lookFor?: string;
}

export interface ShopCheckOptions {
  brain?: OutfitBrain;
  layeringPreference?: LayeringPreference;
  /** profiles.style_preferences from onboarding. */
  stylePreferences?: string[];
  /** Garments from looks the user liked or wore (outfitBrain.tasteGarments). */
  taste?: GarmentItem[];
}

export const SHOP_CHECK_CANDIDATE_ID = 'shop-check-candidate';

// ---------- garment types (coarse, for "you already own one") ----------

const TYPES: [string, RegExp][] = [
  ['tee', /(\btees?\b|t-?\s?shirt|tshirt)/],
  ['polo', /polo/],
  ['hoodie', /(hoodie|hoody|sweatshirt)/],
  ['knit', /(sweater|jumper|knit|cardigan|pullover|turtleneck)/],
  ['tank', /(tank|cami|singlet|\bvest\b)/],
  ['kurta', /(kurta|kurti|tunic|anarkali|pathani)/],
  ['dress', /(dress|gown|frock|jumpsuit)/],
  ['saree', /(saree|\bsari\b)/],
  ['shirt', /(shirt|oxford|poplin|button[- ]?(up|down)|flannel|blouse)/],
  ['jeans', /(jean|denim pant)/],
  ['chinos', /chino/],
  ['cargo', /(cargo|parachute)/],
  ['joggers', /(jogger|track|sweatpant)/],
  ['shorts', /shorts?\b/],
  ['skirt', /skirt/],
  ['trousers', /(trouser|pant|slack|palazzo)/],
  ['sneakers', /(sneaker|trainer|runner)/],
  ['boots', /boot/],
  ['loafers', /(loafer|moccasin)/],
  ['sandals', /(sandal|slide|slipper|chappal|kolhapuri|flip)/],
  ['heels', /(heel|pump|stiletto|wedge)/],
  ['formal shoes', /(oxford shoe|brogue|derby|monk)/],
  ['blazer', /(blazer|bandhgala|suit jacket)/],
  ['coat', /(coat|trench|parka)/],
  ['jacket', /(jacket|bomber|shacket|windbreaker|puffer|gilet)/],
  ['bag', /(bag|tote|clutch|backpack|purse|satchel|sling)/],
  ['eyewear', /(sunglass|glasses|shades)/],
  ['headwear', /(\bcap\b|hat\b|beanie|headwear)/],
  ['watch', /watch/],
  ['belt', /belt/],
  ['scarf', /(scarf|stole|dupatta|shawl|muffler)/]
];

function coarseType(i: GarmentItem): string {
  const sub = `${i.subcategory} ${i.name}`.toLowerCase();
  // T-shirts first so "T-Shirt" never reads as a shirt.
  for (const [type, re] of TYPES) {
    if (type === 'shirt' && /(t-?\s?shirt|tshirt|sweatshirt)/.test(sub)) continue;
    if (re.test(sub)) return `${i.category}:${type}`;
  }
  return `${i.category}:${i.subcategory.trim().toLowerCase()}`;
}

const TYPE_NOUN: Record<string, string> = {
  tee: 'T-shirt', polo: 'polo', hoodie: 'hoodie', knit: 'knit', tank: 'tank top', kurta: 'kurta', dress: 'dress',
  saree: 'saree', shirt: 'shirt', jeans: 'pair of jeans', chinos: 'pair of chinos', cargo: 'pair of cargos',
  joggers: 'pair of joggers', shorts: 'pair of shorts', skirt: 'skirt', trousers: 'pair of trousers',
  sneakers: 'pair of sneakers', boots: 'pair of boots', loafers: 'pair of loafers', sandals: 'pair of sandals',
  heels: 'pair of heels', 'formal shoes': 'pair of formal shoes', blazer: 'blazer', coat: 'coat', jacket: 'jacket',
  bag: 'bag', eyewear: 'pair of sunglasses', headwear: 'cap', watch: 'watch', belt: 'belt', scarf: 'scarf'
};

function typeNoun(i: GarmentItem): string {
  const key = coarseType(i).split(':')[1];
  return TYPE_NOUN[key] ?? (i.subcategory.trim().toLowerCase() || 'piece');
}

const CATEGORY_NOUN: Record<GarmentCategory, string> = {
  tops: 'tops', bottoms: 'bottoms', outerwear: 'outerwear', shoes: 'footwear', accessories: 'accessories'
};

// ---------- colour advice ----------

const NEUTRAL_FAMILIES: ColorFamily[] = ['black', 'white', 'grey', 'beige', 'brown'];

function isNeutralPiece(i: GarmentItem): boolean {
  const fams = colorFamiliesOf(i);
  if (fams.length > 0 && fams.every((f) => NEUTRAL_FAMILIES.includes(f))) return true;
  // Navy and denim behave like neutrals in a wardrobe.
  return /(navy|denim|indigo|chambray|olive|khaki)/.test(i.color.toLowerCase());
}

type Tone = 'neutral' | 'light' | 'bright' | 'dark' | 'mid';

function toneOf(i: GarmentItem): Tone {
  if (isNeutralPiece(i)) return 'neutral';
  const hsl = hexToHsl(i.hexColor);
  const name = i.color.toLowerCase();
  if (/(light|pale|pastel|baby|powder|soft|mint|blush|lavender|lemon|butter|sky)/.test(name) || (hsl && hsl.l >= 0.72)) return 'light';
  if (/(dark|deep|bottle|wine|maroon|burgundy|plum|forest)/.test(name) || (hsl && hsl.l <= 0.3)) return 'dark';
  if (/(neon|bright|electric|hot)/.test(name) || (hsl && hsl.s >= 0.65)) return 'bright';
  return 'mid';
}

const colourName = (i: GarmentItem) => i.color.trim().toLowerCase() || 'this colour';

function colourTip(i: GarmentItem): string {
  const c = colourName(i);
  switch (toneOf(i)) {
    case 'neutral':
      return `${cap(c)} is a neutral — it goes with almost everything you own, including your colourful pieces.`;
    case 'light':
      return `${cap(c)} is a soft, light colour. Ground it with darker neutrals — brown, black, navy or denim — and keep the rest of the look plain.`;
    case 'dark':
      return `Deep ${c} looks richest against lighter neutrals — white, cream, beige or light denim — for contrast.`;
    case 'bright':
      return `${cap(c)} is a statement colour: let it be the only bright piece and keep everything else neutral.`;
    default:
      return `Pair ${c} with neutrals, or with one shade from the same colour family for a tonal look.`;
  }
}

/** Colour families to look for when the closet can't complete a look. */
function partnerFamiliesFor(i: GarmentItem): string {
  switch (toneOf(i)) {
    case 'light': return 'navy, brown, black or denim';
    case 'dark': return 'white, cream, beige or light denim';
    case 'neutral': return 'almost any colour — start with white, black or denim';
    default: return 'white, black, beige or denim';
  }
}

function fitTip(i: GarmentItem): string | null {
  const fit = (i.fit || '').toLowerCase();
  if (/(oversized|relaxed|boxy|baggy|wide)/.test(fit)) {
    return i.category === 'bottoms'
      ? 'A relaxed bottom balances best with a neater, more fitted top.'
      : 'A relaxed fit looks intentional with slimmer or straight bottoms — avoid going oversized head to toe.';
  }
  if (/(slim|fitted|skinny|tailored|cropped)/.test(fit)) {
    return i.category === 'bottoms'
      ? 'A slim bottom works with a slightly looser top on top for an easy silhouette.'
      : 'A fitted piece pairs well with straight or relaxed bottoms.';
  }
  return null;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- style DNA ----------

const PREFERENCE_AXES: Record<string, StyleDnaAxis['key'][]> = {
  minimal: ['minimal'],
  clean_contemporary: ['minimal'],
  streetwear: ['street'],
  oversized: ['street'],
  sporty: ['street'],
  smart_casual: ['smart'],
  classic: ['tailored', 'smart'],
  casual: []
};

function styleFitFor(candidate: GarmentItem, wardrobe: GarmentItem[], options: ShopCheckOptions): StyleFit {
  const prefs = options.stylePreferences ?? [];
  const taste = options.taste ?? [];
  const archetype = styleArchetype(wardrobe, prefs, taste);
  if (wardrobe.length === 0 && prefs.length === 0) {
    return {
      level: 'unknown',
      title: 'Style DNA not built yet',
      detail: 'Add a few of your clothes and CLOSIQ can tell whether new pieces match your style.',
      archetype: archetype.name
    };
  }
  const traits = computeStyleDna([candidate]).filter((a) => a.score > 0);
  const dna = computeStyleDna(wardrobe, taste).filter((a) => a.score > 0).sort((a, b) => b.score - a.score);
  const strongAxes = new Set<StyleDnaAxis['key']>(dna.filter((a, idx) => idx < 2 || a.score >= 35).map((a) => a.key));
  for (const p of prefs) for (const key of PREFERENCE_AXES[p] ?? []) strongAxes.add(key);

  const shared = traits.filter((t) => strongAxes.has(t.key));
  const casualFan = prefs.includes('casual') || share(wardrobe, (i) => i.formality === 'casual') >= 60;

  if (shared.length > 0) {
    return {
      level: 'strong',
      title: `Fits your ${archetype.name} style`,
      detail: `It's ${shared.map((t) => t.label.toLowerCase()).join(' and ')} — the same direction as most of what you own and love.`,
      archetype: archetype.name
    };
  }
  if (isNeutralPiece(candidate) || (casualFan && candidate.formality === 'casual')) {
    return {
      level: 'partial',
      title: 'Blends into your style',
      detail: isNeutralPiece(candidate)
        ? 'Not a signature piece for you, but its neutral colour slots easily into what you already wear.'
        : 'Not a signature piece for you, but it matches the easy, casual way you dress.',
      archetype: archetype.name
    };
  }
  const trait = traits[0]?.label.toLowerCase();
  return {
    level: 'new',
    title: 'A new direction for you',
    detail: trait
      ? `Your wardrobe has little ${trait} in it. Great if you want to try something new — otherwise it may not get worn much.`
      : "It's different from what you usually wear. Great if you want to try something new — otherwise it may not get worn much.",
    archetype: archetype.name
  };
}

function share(items: GarmentItem[], test: (i: GarmentItem) => boolean): number {
  return items.length === 0 ? 0 : Math.round((items.filter(test).length / items.length) * 100);
}

// ---------- wear-with (diverse colours) ----------

const primaryFamily = (i: GarmentItem) => colorFamiliesOf(i)[0] ?? 'other';

/** Best first, but spread over colour families so the list reads
 *  "brown, black, blue" rather than three blacks. */
function diversify(list: PairingSuggestion[], limit: number): PairingSuggestion[] {
  const picked: PairingSuggestion[] = [];
  const seen = new Set<string>();
  for (const s of list) {
    if (picked.length >= limit) break;
    const fam = primaryFamily(s.item);
    if (!seen.has(fam)) {
      picked.push(s);
      seen.add(fam);
    }
  }
  for (const s of list) {
    if (picked.length >= limit) break;
    if (!picked.includes(s)) picked.push(s);
  }
  return picked;
}

function listNames(items: GarmentItem[]): string {
  const names = items.map((i) => i.name);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

const WEAR_WITH_TITLE: Record<GarmentCategory, string> = {
  tops: 'Tops you own', bottoms: 'Bottoms you own', outerwear: 'Layers you own', shoes: 'Footwear you own', accessories: 'Accessories you own'
};

// ---------- outfits ----------

const FORMALITY_ORDER: FormalityLevel[] = ['casual', 'smart_casual', 'formal', 'evening'];
/** Occasion names per formality level; repeats get the next name so three
 *  casual looks read as three different days, not one label three times. */
const OCCASION_LABELS = [
  ['Easy everyday', 'Weekend casual', 'Casual day out'],
  ['Smart casual', 'Dinner or date', 'Work-friendly'],
  ['Office ready', 'Meeting day', 'Formal event'],
  ['Evening out', 'Party night', 'Celebration']
];

/** What else a complete look needs, for the scanned piece. */
function outfitSlots(candidate: GarmentItem): GarmentCategory[] {
  if (isOnePiece(candidate)) return ['shoes'];
  switch (candidate.category) {
    case 'tops': return ['bottoms', 'shoes'];
    case 'bottoms': return ['tops', 'shoes'];
    case 'outerwear': return ['tops', 'bottoms', 'shoes'];
    case 'shoes': return ['tops', 'bottoms'];
    case 'accessories': return ['tops', 'bottoms', 'shoes'];
  }
}

function buildOutfits(candidate: GarmentItem, wardrobe: GarmentItem[], options: ShopCheckOptions): ShopOutfit[] {
  const slots = outfitSlots(candidate);
  const pools = slots.map((cat) => rankPairings(candidate, cat, wardrobe, options).slice(0, 4));
  if (pools.some((p) => p.length === 0)) return [];

  // Every combination of the best few per slot (at most 4×4×4).
  let combos: PairingSuggestion[][] = [[]];
  for (const pool of pools) combos = combos.flatMap((combo) => pool.map((s) => [...combo, s]));

  const scored = combos
    .map((combo) => {
      let score = combo.reduce((sum, s) => sum + s.score, 0);
      let clash = false;
      for (let a = 0; a < combo.length; a++) {
        for (let b = a + 1; b < combo.length; b++) {
          const pair = pairCompatibility(combo[a].item, combo[b].item, options.brain);
          if (pair.score < -1) clash = true;
          score += pair.score * 0.5;
        }
      }
      return { combo, score, clash };
    })
    .filter((c) => !c.clash)
    .sort((a, b) => b.score - a.score);

  // Up to 3 looks, each with a different main partner (the first slot), and
  // reusing as few of the earlier looks' pieces as possible.
  const outfits: ShopOutfit[] = [];
  const usedLead = new Set<string>();
  const usedItems = new Set<string>();
  const labelUses = [0, 0, 0, 0];
  while (outfits.length < 3) {
    let best: { combo: PairingSuggestion[]; adjusted: number } | null = null;
    for (const { combo, score } of scored) {
      if (usedLead.has(combo[0].item.id)) continue;
      const reused = combo.filter((s) => usedItems.has(s.item.id)).length;
      const adjusted = score - reused * 1.5;
      if (!best || adjusted > best.adjusted) best = { combo, adjusted };
    }
    if (!best) break;
    const items = best.combo.map((s) => s.item);
    usedLead.add(items[0].id);
    items.forEach((i) => usedItems.add(i.id));
    const level = Math.min(3, Math.max(0, Math.round(
      [candidate, ...items].reduce((sum, i) => sum + Math.max(0, FORMALITY_ORDER.indexOf(i.formality)), 0) / (items.length + 1)
    )));
    const names = OCCASION_LABELS[level];
    outfits.push({
      id: [SHOP_CHECK_CANDIDATE_ID, ...items.map((i) => i.id)].join('|'),
      label: names[Math.min(labelUses[level]++, names.length - 1)],
      items,
      reason: best.combo[0].reason
    });
  }
  return outfits;
}

// ---------- the check ----------

export function runShopCheck(candidate: GarmentItem, wardrobe: GarmentItem[], options: ShopCheckOptions = {}): ShopCheckResult {
  const owned = wardrobe.filter((g) => g.id !== candidate.id);
  const styleFit = styleFitFor(candidate, owned, options);
  const stylingTips = [colourTip(candidate), fitTip(candidate)].filter((t): t is string => Boolean(t));
  if (candidate.pairingNotes) stylingTips.push(candidate.pairingNotes);

  if (owned.length === 0) {
    return {
      verdict: 'unknown',
      verdictTitle: 'Add your clothes first',
      verdictSummary: "CLOSIQ can only judge a new piece against what you already own — and your wardrobe is empty. Add a few of your clothes, then scan again.",
      points: [{ tone: 'info', text: 'Your wardrobe is empty, so there is nothing to pair it with yet.' }],
      styleFit,
      wearWith: [],
      outfits: [],
      similarOwned: [],
      pairCount: 0,
      stylingTips,
      lookFor: `It would pair with ${partnerFamiliesFor(candidate)} pieces.`
    };
  }

  // Wear it with — your pieces, spread across colours.
  const wearWith: WearWithGroup[] = pairingCategories(candidate).map((category) => {
    const ranked = rankPairings(candidate, category, owned, options);
    const suggestions = diversify(ranked, 4);
    const nouns = category === 'shoes' ? 'footwear' : CATEGORY_NOUN[category];
    return {
      category,
      title: WEAR_WITH_TITLE[category],
      suggestions,
      sentence: suggestions.length > 0
        ? `Wear it with your ${listNames(suggestions.slice(0, 3).map((s) => s.item))}.`
        : `None of your ${nouns} suit it well yet.`
    };
  });
  const pairCount = new Set(
    pairingCategories(candidate).flatMap((cat) => rankPairings(candidate, cat, owned, options).filter((s) => s.score >= 1).map((s) => s.item.id))
  ).size;

  const outfits = buildOutfits(candidate, owned, options);

  // Already own one? Fills a gap?
  const type = coarseType(candidate);
  const fams = colorFamiliesOf(candidate);
  const sameType = owned.filter((g) => coarseType(g) === type);
  const similarOwned = sameType.filter((g) => colorFamiliesOf(g).some((f) => fams.includes(f)));
  const sameCategory = owned.filter((g) => g.category === candidate.category);
  const sameFormality = share(owned, (g) => g.formality === candidate.formality);

  const points: ShopCheckPoint[] = [];
  let score = 0;

  if (pairCount >= 6) {
    score += 2;
    points.push({ tone: 'good', text: `Goes with ${pairCount} pieces you already own.` });
  } else if (pairCount >= 3) {
    score += 1;
    points.push({ tone: 'good', text: `Goes with ${pairCount} pieces you already own.` });
  } else if (pairCount > 0) {
    points.push({ tone: 'warn', text: `Only goes with ${pairCount} piece${pairCount === 1 ? '' : 's'} you own.` });
  } else {
    score -= 2;
    points.push({ tone: 'warn', text: 'Nothing you own pairs well with it yet.' });
  }

  if (outfits.length >= 2) {
    score += 1;
    points.push({ tone: 'good', text: `Makes ${outfits.length} complete outfits with your clothes.` });
  } else if (outfits.length === 1) {
    points.push({ tone: 'info', text: 'Makes one complete outfit with your clothes.' });
  } else {
    score -= 1;
    const missing = outfitSlots(candidate).filter((cat) => rankPairings(candidate, cat, owned, options).length === 0);
    points.push({
      tone: 'warn',
      text: missing.length > 0
        ? `You'd still need ${missing.map((c) => CATEGORY_NOUN[c]).join(' and ')} that suit it to finish a look.`
        : "Your pieces don't come together into a full outfit with it yet."
    });
  }

  const noun = typeNoun(candidate);
  const shortNoun = noun.replace(/^pair of /, '');
  const colourLabel = fams[0] ? colorFamilyLabel(fams[0]).split(' ')[0].toLowerCase() : colourName(candidate);
  if (similarOwned.length >= 2) {
    score -= 2;
    points.push({ tone: 'warn', text: `You already own ${similarOwned.length} very similar pieces: ${similarOwned.slice(0, 3).map((g) => g.name).join(', ')}.` });
  } else if (similarOwned.length === 1) {
    score -= 1;
    points.push({ tone: 'warn', text: `You already own something very similar: ${similarOwned[0].name}.` });
  } else if (sameCategory.length === 0) {
    score += 1;
    points.push({ tone: 'good', text: `You don't own any ${CATEGORY_NOUN[candidate.category]} yet — this fills a real gap.` });
  } else if (sameType.length > 0) {
    score += 1;
    points.push({ tone: 'good', text: `Your first ${colourLabel} ${shortNoun} — a new colour next to the ${sameType.length} you own.` });
  } else {
    score += 1;
    points.push({ tone: 'good', text: `Something new — you don't own a ${noun} like it.` });
  }

  if (styleFit.level === 'strong') {
    score += 1;
    points.push({ tone: 'good', text: styleFit.title + '.' });
  } else if (styleFit.level === 'new') {
    points.push({ tone: 'info', text: 'A new direction for your style.' });
  }

  if (owned.length >= 5 && sameFormality < 10 && candidate.category !== 'accessories') {
    score -= 1;
    const label = candidate.formality.replace('_', ' ');
    points.push({ tone: 'warn', text: `Few of your clothes are as ${label} as this, so it has fewer partners.` });
  }

  // Owning a near-twin outweighs everything else: one caps it at "could
  // work", two or more means think twice, however well it pairs.
  let verdict: ShopVerdict = score >= 3 ? 'great' : score >= 1 ? 'good' : 'think_twice';
  if (similarOwned.length >= 2) verdict = 'think_twice';
  else if (similarOwned.length === 1 && verdict === 'great') verdict = 'good';
  const leadSentence = wearWith.find((g) => g.suggestions.length > 0)?.sentence;
  const verdictTitle = verdict === 'great' ? 'A smart addition' : verdict === 'good' ? 'Could work for you' : 'Think twice';
  const outfitLine = outfits.length > 0 ? ` That's ${outfits.length} ready outfit${outfits.length === 1 ? '' : 's'} from your wardrobe.` : '';
  const verdictSummary =
    verdict === 'think_twice'
      ? similarOwned.length > 0
        ? `You already own ${similarOwned.length === 1 ? 'something' : 'pieces'} very close to this (${similarOwned.slice(0, 2).map((g) => g.name).join(', ')}), so it adds little new.`
        : "It doesn't connect well with the clothes you own yet, so it may end up rarely worn."
      : similarOwned.length > 0
      ? `It pairs well, but it's close to your ${similarOwned[0].name} — only worth it if you want a second one.${outfitLine}`
      : `${leadSentence ?? ''}${outfitLine}`.trim();

  points.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'good' ? -1 : b.tone === 'good' ? 1 : a.tone === 'info' ? -1 : 1));

  const needsMore = outfits.length === 0 || pairCount < 3;
  return {
    verdict,
    verdictTitle,
    verdictSummary,
    points,
    styleFit,
    wearWith,
    outfits,
    similarOwned,
    pairCount,
    stylingTips,
    lookFor: needsMore ? `Future idea: it would also pair with ${partnerFamiliesFor(candidate)} pieces, if you add some to your wardrobe.` : undefined
  };
}

/** The scanned piece as a garment, so the same pairing engine can judge it. */
export function shopCandidate(fields: Omit<GarmentItem, 'id' | 'favorite' | 'wearCount' | 'dateAdded' | 'seasons' | 'tags' | 'imageUrl'> & Partial<GarmentItem>): GarmentItem {
  return {
    id: SHOP_CHECK_CANDIDATE_ID,
    favorite: false,
    wearCount: 0,
    dateAdded: new Date().toISOString().split('T')[0],
    seasons: [],
    tags: [],
    imageUrl: '',
    ...fields
  };
}
