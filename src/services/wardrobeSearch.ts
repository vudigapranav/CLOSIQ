import { FormalityLevel, GarmentCategory, GarmentItem, Season } from '../types/wardrobe';

/**
 * Smart wardrobe search (2026-10-24) — shared by web and mobile.
 *
 * The user's ask after two weeks of use: "if I search for my blue jacket it
 * should show me all blue jackets, whatever type it is". A plain substring
 * search can't do that — "Navy Bomber" contains neither "blue" nor "jacket".
 *
 * So the query is split into words and EVERY word has to match the piece
 * (AND), where a word matches if it is:
 *   - a colour family ("blue" → navy, indigo, denim blue, cobalt… and any
 *     piece whose swatch hex is blue even when its colour name isn't),
 *   - a garment type ("jacket" → bomber, denim jacket, blazer, puffer…;
 *     "pants" → jeans, chinos, cargos…; "shoes" → anything in Footwear),
 *   - an occasion, season, light/dark tone, "favourite" or "never worn",
 *   - or simply text found anywhere on the piece (name, type, colour, fabric,
 *     brand, fit, style, tags, size, where it's kept).
 * Results are ranked so pieces whose own name matches come first.
 * Entirely on-device — no AI call, works offline.
 */

// ---------- colour families ----------

export type ColorFamily =
  | 'black' | 'white' | 'grey' | 'beige' | 'brown' | 'red' | 'pink'
  | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'multi';

export interface ColorFamilyInfo {
  value: ColorFamily;
  label: string;
  /** Representative swatch for filter chips. */
  hex: string;
}

export const COLOR_FAMILIES: ColorFamilyInfo[] = [
  { value: 'black', label: 'Black', hex: '#1A1A1A' },
  { value: 'white', label: 'White & cream', hex: '#F6F1E6' },
  { value: 'grey', label: 'Grey', hex: '#8C8C8C' },
  { value: 'beige', label: 'Beige & khaki', hex: '#CDB892' },
  { value: 'brown', label: 'Brown', hex: '#6B4A2F' },
  { value: 'red', label: 'Red & maroon', hex: '#A83232' },
  { value: 'pink', label: 'Pink', hex: '#E59AB5' },
  { value: 'orange', label: 'Orange & rust', hex: '#D9733A' },
  { value: 'yellow', label: 'Yellow & mustard', hex: '#D9B23A' },
  { value: 'green', label: 'Green & olive', hex: '#5E7A45' },
  { value: 'blue', label: 'Blue & navy', hex: '#2F4E86' },
  { value: 'purple', label: 'Purple', hex: '#7A4E92' },
  { value: 'multi', label: 'Multicolour', hex: '#B9A27A' }
];

/** Shade words that belong to each family (whole-word match on the colour name). */
const FAMILY_WORDS: Record<ColorFamily, string[]> = {
  black: ['black', 'jet', 'onyx', 'ebony', 'noir'],
  white: ['white', 'off-white', 'offwhite', 'ivory', 'cream', 'ecru', 'pearl', 'snow', 'chalk', 'milk'],
  grey: ['grey', 'gray', 'charcoal', 'slate', 'ash', 'silver', 'graphite', 'gunmetal', 'heather', 'smoke', 'pewter', 'melange'],
  beige: ['beige', 'khaki', 'sand', 'stone', 'taupe', 'camel', 'tan', 'nude', 'oatmeal', 'biscuit', 'fawn', 'champagne', 'buff'],
  brown: ['brown', 'espresso', 'chocolate', 'coffee', 'mocha', 'cognac', 'tortoise', 'walnut', 'chestnut', 'umber', 'sepia', 'bronze', 'mahogany'],
  red: ['red', 'maroon', 'burgundy', 'wine', 'crimson', 'scarlet', 'cherry', 'oxblood', 'brick', 'ruby', 'sindoor', 'garnet'],
  pink: ['pink', 'rose', 'blush', 'fuchsia', 'magenta', 'salmon', 'rani', 'bubblegum'],
  orange: ['orange', 'rust', 'coral', 'peach', 'apricot', 'tangerine', 'saffron', 'terracotta', 'copper', 'amber'],
  yellow: ['yellow', 'mustard', 'gold', 'golden', 'lemon', 'ochre', 'haldi', 'turmeric', 'butter'],
  green: ['green', 'olive', 'sage', 'mint', 'emerald', 'forest', 'lime', 'teal', 'bottle', 'army', 'moss', 'pista', 'pistachio', 'jade', 'hunter', 'khaki-green'],
  blue: ['blue', 'navy', 'indigo', 'denim', 'cobalt', 'azure', 'sky', 'royal', 'teal', 'turquoise', 'aqua', 'cyan', 'chambray', 'sapphire', 'powder', 'periwinkle', 'ink', 'midnight', 'ice'],
  purple: ['purple', 'violet', 'lavender', 'lilac', 'plum', 'mauve', 'grape', 'aubergine', 'eggplant', 'orchid', 'amethyst', 'wine-purple'],
  multi: ['multi', 'multicolor', 'multicolour', 'multicoloured', 'rainbow', 'tie-dye', 'tiedye']
};

interface Hsl { h: number; s: number; l: number }

export function hexToHsl(hex: string | undefined): Hsl | null {
  if (!hex) return null;
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue *= 60;
  return { h: hue, s, l };
}

/** Colour family read from the swatch alone — the fallback when the name says nothing. */
function familyFromHex(hex: string | undefined): ColorFamily | null {
  const hsl = hexToHsl(hex);
  if (!hsl) return null;
  const { h, s, l } = hsl;
  if (l < 0.13) return 'black';
  if (l > 0.9 && s < 0.5) return 'white';
  if (s < 0.12) return l > 0.82 ? 'white' : 'grey';
  // Warm, muted tones read as browns / beiges rather than orange.
  if (h >= 15 && h < 50 && s < 0.6) return l < 0.45 ? 'brown' : 'beige';
  if (h < 12 || h >= 345) return l > 0.7 ? 'pink' : 'red';
  if (h < 40) return 'orange';
  if (h < 66) return 'yellow';
  if (h < 170) return 'green';
  if (h < 255) return 'blue';
  if (h < 295) return 'purple';
  return 'pink';
}

const wordRe = (word: string) => new RegExp(`(^|[^a-z])${word.replace(/-/g, '[- ]?')}($|[^a-z])`);
const FAMILY_RES: [ColorFamily, RegExp[]][] = (Object.keys(FAMILY_WORDS) as ColorFamily[]).map(
  (family) => [family, FAMILY_WORDS[family].map(wordRe)]
);

/** Every colour family a piece belongs to — from its colour names first,
 *  its swatch hex when the names are unfamiliar. "Grey Olive" → grey + green. */
export function colorFamiliesOf(item: Pick<GarmentItem, 'color' | 'hexColor' | 'secondaryColors'>): ColorFamily[] {
  const names = [item.color, ...(item.secondaryColors || [])].join(' ').toLowerCase();
  const found = FAMILY_RES.filter(([, res]) => res.some((re) => re.test(names))).map(([family]) => family);
  if (found.length > 0) return found;
  const fromHex = familyFromHex(item.hexColor);
  return fromHex ? [fromHex] : [];
}

export function colorFamilyLabel(value: string): string {
  return COLOR_FAMILIES.find((f) => f.value === value)?.label ?? value;
}

// ---------- garment types ----------

const textOf = (i: GarmentItem) => [i.name, i.subcategory, ...(i.tags || [])].join(' ').toLowerCase();
/** "shirt" should not pull in T-shirts and sweatshirts. */
const withoutTees = (t: string) => t.replace(/t-?\s?shirts?|sweatshirts?|tshirts?/g, ' ');

export interface Concept {
  label: string;
  test: (item: GarmentItem) => boolean;
  /** Ranking weight when this concept matched. */
  weight: number;
}

const inCategory = (...cats: GarmentCategory[]) => (i: GarmentItem) => cats.includes(i.category);
const typeRe = (re: RegExp, ...cats: GarmentCategory[]) => (i: GarmentItem) =>
  (cats.length === 0 || cats.includes(i.category)) && re.test(textOf(i));

const TYPE_CONCEPTS: { words: string[]; label: string; test: (i: GarmentItem) => boolean }[] = [
  // Categories
  { words: ['top', 'tops', 'upper', 'upperwear'], label: 'Tops', test: inCategory('tops') },
  { words: ['bottom', 'bottoms', 'lower', 'lowers', 'bottomwear'], label: 'Bottoms', test: inCategory('bottoms') },
  { words: ['outerwear', 'layer', 'layers', 'outer'], label: 'Outerwear', test: inCategory('outerwear') },
  { words: ['shoe', 'shoes', 'footwear', 'chappals', 'kicks'], label: 'Footwear', test: inCategory('shoes') },
  { words: ['accessory', 'accessories', 'acc'], label: 'Accessories', test: inCategory('accessories') },
  // Outerwear
  {
    words: ['jacket', 'jackets'],
    label: 'Jackets (any type)',
    test: (i) => /(jacket|blazer|bomber|shacket|windbreaker|puffer|anorak|overshirt|gilet|varsity|trucker|biker|harrington|bandhgala|nehru)/.test(textOf(i))
  },
  { words: ['coat', 'coats'], label: 'Coats', test: typeRe(/(coat|trench|parka|peacoat|duster|overcoat)/) },
  { words: ['blazer', 'blazers'], label: 'Blazers', test: typeRe(/(blazer|sport coat|suit jacket|bandhgala)/) },
  // Tops
  { words: ['tee', 'tees', 'tshirt', 'tshirts'], label: 'T-shirts', test: typeRe(/(\btees?\b|t-?\s?shirt|tshirt|crew ?neck tee)/) },
  { words: ['shirt', 'shirts'], label: 'Shirts', test: (i) => /(shirt|oxford|poplin|button[- ]?(up|down)|flannel)/.test(withoutTees(textOf(i))) },
  { words: ['polo', 'polos'], label: 'Polos', test: typeRe(/polo/) },
  { words: ['hoodie', 'hoodies', 'hoody', 'sweatshirt', 'sweatshirts'], label: 'Hoodies & sweatshirts', test: typeRe(/(hoodie|hoody|sweatshirt|zip-?up)/) },
  { words: ['sweater', 'sweaters', 'jumper', 'jumpers', 'knit', 'knits', 'cardigan', 'cardigans', 'pullover'], label: 'Knits & sweaters', test: typeRe(/(sweater|jumper|knit|cardigan|pullover|turtleneck)/) },
  { words: ['tank', 'tanks', 'vest', 'vests', 'cami', 'camis', 'camisole', 'singlet', 'baniyan', 'banian'], label: 'Tanks & camis', test: (i) => i.layeringRole === 'base_layer' || /(tank|cami|singlet|\bvest\b|baniyan|tube top)/.test(textOf(i)) },
  { words: ['kurta', 'kurtas', 'kurti', 'kurtis', 'tunic'], label: 'Kurtas', test: typeRe(/(kurta|kurti|tunic|anarkali|pathani)/) },
  { words: ['dress', 'dresses', 'gown', 'frock'], label: 'Dresses', test: typeRe(/(dress|gown|frock|jumpsuit)/) },
  { words: ['saree', 'sarees', 'sari', 'saris'], label: 'Sarees', test: typeRe(/(saree|sari\b)/) },
  { words: ['lehenga', 'lehengas', 'ethnic', 'traditional', 'desi'], label: 'Ethnic wear', test: typeRe(/(kurta|kurti|saree|sari\b|lehenga|sherwani|dupatta|salwar|churidar|dhoti|anarkali|bandhgala|nehru|jutti|mojari|kolhapuri|pathani|ethnic|chikankari|patiala)/) },
  // Bottoms
  { words: ['jean', 'jeans'], label: 'Jeans', test: (i) => typeRe(/(jean|denim)/, 'bottoms')(i) && !/(skirt|shorts?\b)/.test(textOf(i)) },
  { words: ['pant', 'pants', 'trouser', 'trousers', 'slacks'], label: 'Pants & trousers', test: typeRe(/(pant|trouser|jean|chino|cargo|jogger|legging|slack|palazzo|salwar|churidar|track|dhoti)/, 'bottoms') },
  { words: ['chino', 'chinos'], label: 'Chinos', test: typeRe(/chino/) },
  { words: ['cargo', 'cargos'], label: 'Cargos', test: typeRe(/(cargo|parachute|utility pant)/) },
  { words: ['jogger', 'joggers', 'trackpant', 'trackpants', 'sweatpants'], label: 'Joggers', test: typeRe(/(jogger|track|sweatpant)/) },
  { words: ['short', 'shorts'], label: 'Shorts', test: typeRe(/shorts?\b/, 'bottoms') },
  { words: ['skirt', 'skirts'], label: 'Skirts', test: typeRe(/skirt/) },
  // Footwear
  { words: ['sneaker', 'sneakers', 'trainer', 'trainers', 'runner', 'runners'], label: 'Sneakers', test: typeRe(/(sneaker|trainer|runner|canvas shoe|plimsoll)/) },
  { words: ['boot', 'boots'], label: 'Boots', test: typeRe(/boot/) },
  { words: ['loafer', 'loafers', 'moccasin', 'moccasins'], label: 'Loafers', test: typeRe(/(loafer|moccasin)/) },
  { words: ['sandal', 'sandals', 'slides', 'slippers', 'chappal', 'flipflops'], label: 'Sandals & chappals', test: typeRe(/(sandal|slide|slipper|chappal|flip|kolhapuri)/) },
  { words: ['heel', 'heels', 'pumps', 'stilettos', 'wedges'], label: 'Heels', test: typeRe(/(heel|pump|stiletto|wedge)/) },
  { words: ['oxfords', 'brogues', 'derby', 'derbies'], label: 'Formal shoes', test: typeRe(/(oxford|brogue|derby|monk)/, 'shoes') },
  // Accessories
  { words: ['bag', 'bags', 'purse', 'purses', 'tote', 'totes', 'backpack', 'clutch'], label: 'Bags', test: typeRe(/(bag|tote|clutch|backpack|purse|satchel|crossbody|hobo|sling)/) },
  { words: ['sunglass', 'sunglasses', 'shades', 'glasses', 'eyewear'], label: 'Eyewear', test: typeRe(/(sunglass|shades|glasses|eyewear)/) },
  { words: ['cap', 'caps', 'hat', 'hats', 'beanie', 'headwear'], label: 'Caps & hats', test: typeRe(/(\bcap\b|hat\b|beanie|headwear|bucket)/) },
  { words: ['watch', 'watches'], label: 'Watches', test: typeRe(/watch/) },
  { words: ['belt', 'belts'], label: 'Belts', test: typeRe(/belt/) },
  { words: ['scarf', 'scarves', 'stole', 'stoles', 'dupatta', 'dupattas', 'shawl', 'muffler'], label: 'Scarves & dupattas', test: typeRe(/(scarf|scarves|stole|dupatta|shawl|muffler)/) },
  { words: ['jewellery', 'jewelry', 'chain', 'ring', 'bracelet', 'earrings', 'necklace'], label: 'Jewellery', test: typeRe(/(jewel|chain|ring\b|bracelet|earring|necklace|bangle|kada)/) }
];

// ---------- occasions, seasons, tone, status ----------

const formalityIs = (...levels: FormalityLevel[]) => (i: GarmentItem) => levels.includes(i.formality);
const seasonIs = (...seasons: Season[]) => (i: GarmentItem) => (i.seasons || []).some((s) => seasons.includes(s));

const lightness = (i: GarmentItem) => hexToHsl(i.hexColor)?.l;
const isLight = (i: GarmentItem) =>
  /(light|pale|pastel|baby|powder|sky|ice|washed)/.test(i.color.toLowerCase()) || (lightness(i) ?? 0) >= 0.62;
const isDark = (i: GarmentItem) =>
  /(dark|deep|navy|midnight|charcoal|black|espresso)/.test(i.color.toLowerCase()) || (lightness(i) ?? 1) <= 0.3;

const OTHER_CONCEPTS: { words: string[]; label: string; test: (i: GarmentItem) => boolean }[] = [
  { words: ['casual', 'everyday', 'daily', 'chill', 'weekend'], label: 'Casual', test: formalityIs('casual') },
  { words: ['smart_casual', 'smart'], label: 'Smart casual', test: formalityIs('smart_casual') },
  { words: ['formal', 'formals'], label: 'Formal', test: formalityIs('formal', 'evening') },
  { words: ['office', 'work', 'interview', 'meeting', 'business'], label: 'Office-ready', test: formalityIs('formal', 'smart_casual') },
  { words: ['party', 'evening', 'night', 'date', 'clubbing'], label: 'Evening & party', test: formalityIs('evening', 'formal') },
  { words: ['summer', 'hot', 'garmi'], label: 'Summer', test: seasonIs('summer') },
  { words: ['winter', 'cold', 'warm', 'sardi'], label: 'Winter', test: seasonIs('winter') },
  { words: ['spring'], label: 'Spring', test: seasonIs('spring') },
  { words: ['autumn', 'fall'], label: 'Autumn', test: seasonIs('autumn') },
  { words: ['monsoon', 'rain', 'rainy', 'baarish'], label: 'Monsoon-friendly', test: (i) => seasonIs('autumn', 'spring')(i) || /(nylon|technical|shell|waterproof|rain)/.test((i.fabric || '').toLowerCase()) },
  { words: ['light', 'pale', 'pastel'], label: 'Light shades', test: isLight },
  { words: ['dark', 'deep'], label: 'Dark shades', test: isDark },
  { words: ['favorite', 'favorites', 'favourite', 'favourites', 'fav', 'favs', 'loved'], label: 'Favourites', test: (i) => i.favorite },
  { words: ['unworn', 'never_worn'], label: 'Never worn', test: (i) => (i.wearCount || 0) === 0 }
];

const COLOR_CONCEPTS: { words: string[]; label: string; test: (i: GarmentItem) => boolean }[] = COLOR_FAMILIES.map((f) => ({
  // The family's own base words; specific shades ("olive") stay exact text matches.
  words: f.value === 'grey' ? ['grey', 'gray', 'greys', 'grays'] : f.value === 'multi' ? ['multi', 'multicolor', 'multicolour', 'colourful', 'colorful'] : [f.value, `${f.value}s`],
  label: f.value === 'multi' ? 'Multicolour' : `${f.label.split(' ')[0]} shades`,
  test: (i: GarmentItem) => colorFamiliesOf(i).includes(f.value)
}));

const CONCEPTS_BY_WORD = new Map<string, Concept[]>();
function register(list: { words: string[]; label: string; test: (i: GarmentItem) => boolean }[], weight: number) {
  for (const c of list) {
    for (const w of c.words) {
      const arr = CONCEPTS_BY_WORD.get(w) || [];
      arr.push({ label: c.label, test: c.test, weight });
      CONCEPTS_BY_WORD.set(w, arr);
    }
  }
}
register(COLOR_CONCEPTS, 2);
register(TYPE_CONCEPTS, 2);
register(OTHER_CONCEPTS, 1);

// ---------- query parsing ----------

const STOPWORDS = new Set([
  'my', 'the', 'a', 'an', 'all', 'any', 'show', 'me', 'find', 'i', 'have', 'with', 'for', 'in', 'of',
  'and', 'some', 'that', 'which', 'what', 'do', 'own', 'item', 'items', 'clothes', 'clothing', 'piece',
  'pieces', 'colour', 'color', 'colored', 'coloured', 'please', 'to', 'wear', 'wearing', 'outfit', 'stuff',
  'one', 'ones', 'is', 'are', 'it', 'something', 'thing', 'things', 'where', 'kept', 'mera', 'meri', 'mere'
]);

/** Phrases folded into a single token before splitting. */
const PHRASES: [RegExp, string][] = [
  [/\bt[\s-]?shirts?\b/g, 'tshirt'],
  [/\bsmart[\s-]casual\b/g, 'smart_casual'],
  [/\bnever[\s-]worn\b/g, 'never_worn'],
  [/\boff[\s-]white\b/g, 'off-white'],
  [/\bflip[\s-]flops?\b/g, 'flipflops'],
  [/\btrack[\s-]?pants?\b/g, 'trackpants'],
  [/\bsweat[\s-]?pants?\b/g, 'sweatpants'],
  [/\bsun[\s-]?glasses\b/g, 'sunglasses'],
  [/\bmulti[\s-]?colou?r(ed)?\b/g, 'multicolour'],
  [/\bbutton[\s-](up|down)\b/g, 'shirt']
];

function singular(word: string): string {
  if (word.length <= 3 || word.endsWith('ss')) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (/(ches|shes|xes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

export interface SearchTerm {
  /** The word as the user typed it (after phrase folding). */
  word: string;
  /** What CLOSIQ understood it as, e.g. "Blue shades", "Jackets (any type)". */
  concepts: Concept[];
}

export function parseSearchQuery(query: string): SearchTerm[] {
  let q = (query || '').toLowerCase().replace(/[’']/g, '');
  for (const [re, rep] of PHRASES) q = q.replace(re, rep);
  return q
    .split(/[^a-z0-9_\-.]+/)
    .map((w) => w.replace(/^[-.]+|[-.]+$/g, ''))
    .filter((w) => w && !STOPWORDS.has(w))
    .map((word) => ({ word, concepts: CONCEPTS_BY_WORD.get(word) || CONCEPTS_BY_WORD.get(singular(word)) || [] }));
}

/** Chips for "Looking for: Blue shades · Jackets (any type)". */
export function describeSearch(query: string): string[] {
  return parseSearchQuery(query).map((t) => (t.concepts.length > 0 ? t.concepts[0].label : `“${t.word}”`));
}

// ---------- matching ----------

const FORMALITY_LABEL: Record<FormalityLevel, string> = {
  casual: 'casual', smart_casual: 'smart casual', formal: 'formal', evening: 'evening party'
};
const CATEGORY_LABEL: Record<GarmentCategory, string> = {
  tops: 'tops', bottoms: 'bottoms', outerwear: 'outerwear', shoes: 'footwear shoes', accessories: 'accessories'
};

function haystack(i: GarmentItem): string {
  return [
    i.name, i.subcategory, i.color, ...(i.secondaryColors || []), i.fabric, i.brand, i.fit, i.style,
    ...(i.tags || []), i.storageLocation, i.size, FORMALITY_LABEL[i.formality], CATEGORY_LABEL[i.category],
    ...(i.seasons || []), i.layeringRole?.replace('_', ' ')
  ].filter(Boolean).join(' ').toLowerCase();
}

/** 0 = no match; higher = stronger. */
function termScore(term: SearchTerm, item: GarmentItem, hay: string, name: string): number {
  const forms = [term.word, singular(term.word)];
  if (singular(term.word) === 'shirt') {
    name = withoutTees(name);
    hay = withoutTees(hay);
  }
  let score = 0;
  if (forms.some((f) => name.includes(f))) score = Math.max(score, 3);
  else if (forms.some((f) => hay.includes(f))) score = Math.max(score, 1);
  for (const c of term.concepts) if (c.test(item)) score = Math.max(score, c.weight);
  return score;
}

/**
 * Pieces matching every word of `query`, best first. An empty query (or one
 * made only of filler words like "show me my") returns `items` unchanged.
 */
export function searchWardrobe(items: GarmentItem[], query: string): GarmentItem[] {
  const terms = parseSearchQuery(query);
  if (terms.length === 0) return items;
  const scored: { item: GarmentItem; score: number; index: number }[] = [];
  items.forEach((item, index) => {
    const hay = haystack(item);
    const name = item.name.toLowerCase();
    let total = 0;
    for (const term of terms) {
      const s = termScore(term, item, hay, name);
      if (s === 0) return;
      total += s;
    }
    scored.push({ item, score: total, index });
  });
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((s) => s.item);
}
