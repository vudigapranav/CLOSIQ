import type { VisionAnalysisResult } from '../services/visionAnalysis';
const categories = ['tops', 'bottoms', 'outerwear', 'shoes', 'accessories'] as const;
const formalities = ['casual', 'smart_casual', 'formal', 'evening'] as const;

/**
 * Small vision-language models often wrap the requested JSON in a code fence
 * or a sentence ("Here is the JSON: {...}"). Take the first complete,
 * balanced top-level object; every field is still validated strictly below.
 */
export function firstJsonObject(text: string): string {
  const start = text.indexOf('{');
  if (start < 0) throw new Error('Expected a JSON object.');
  let depth = 0,
    quoted = false,
    escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error('Expected a complete JSON object.');
}
function parseObject(text: string): Record<string, unknown> {
  const value: unknown = JSON.parse(firstJsonObject(text));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object.');
  return value as Record<string, unknown>;
}
function field(value: unknown, max = 80) {
  return typeof value === 'string' && value.trim().length <= max ? value.trim() : '';
}
function choice<T extends string>(v: unknown, options: readonly T[]) {
  return options.find((x) => x === v);
}
/**
 * A 500M vision model is far more reliable writing short "Key: value" lines
 * than a JSON object, so prompts ask for lines. JSON (bare, fenced or wrapped
 * in a sentence) is still accepted. Keys are matched case-insensitively.
 */
export function parseLines(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:[-*\d.)]+\s*)?\**\s*([A-Za-z][A-Za-z ]{1,28}?)\s*\**\s*[:=]\s*(.+?)\s*$/.exec(line);
    if (m && !(m[1].trim().toLowerCase() in out))
      out[m[1].trim().toLowerCase()] = m[2].replace(/^["'`*]+|["'`*,]+$/g, '').trim();
  }
  return out;
}
function readAnswer(text: string): Record<string, unknown> {
  if (text.includes('{')) {
    try {
      return parseObject(text);
    } catch {
      // fall through to lines
    }
  }
  const lines = parseLines(text);
  if (!Object.keys(lines).length) throw new Error('Expected labelled lines or a JSON object.');
  return lines;
}
function pick(data: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const hit = Object.keys(data).find((k) => k.toLowerCase().replace(/[\s_]/g, '') === key);
    if (hit !== undefined && data[hit] !== undefined) return data[hit];
  }
  return undefined;
}
const CATEGORY_WORDS: [GarmentCategoryWord, RegExp][] = [
  ['tops', /^(tops?|shirts?|t-?shirts?|blouses?|kurtas?|sweaters?|hoodies?|sarees?|dress(es)?)$/],
  ['bottoms', /^(bottoms?|pants|trousers|jeans|shorts|skirts?|chinos|cargos?|joggers)$/],
  ['outerwear', /^(outerwear|jackets?|coats?|blazers?|parkas?)$/],
  ['shoes', /^(shoes?|footwear|sneakers?|boots?|sandals?|heels|loafers)$/],
  ['accessories', /^(accessor(y|ies)|bags?|belts?|hats?|caps?|watch(es)?|scarf|scarves|jewell?ery)$/]
];
type GarmentCategoryWord = (typeof categories)[number];
function categoryOf(v: unknown) {
  const word = String(v ?? '').toLowerCase().trim();
  return choice(word, categories) ?? CATEGORY_WORDS.find(([, re]) => re.test(word))?.[0];
}
function formalityOf(v: unknown) {
  const word = String(v ?? '').toLowerCase().trim().replace(/[\s-]+/g, '_');
  return choice(word, formalities) ?? (word === 'business' || word === 'business_casual' ? 'smart_casual' : undefined);
}
// ---------------------------------------------------------------------------
// Short-question scan. The published 500M base model answers one simple
// question well ("The garment is a light blue button-down shirt.") but does
// not fill multi-field forms reliably, so the scan asks short questions and
// CLOSIQ derives the structured fields from the answers.

/** "Sure! The garment is a light blue button-down shirt." -> "light blue button-down shirt" */
export function shortAnswer(text: string, maxWords = 8): string {
  const firstLines = text.trim().split(/\r?\n/).filter((l) => l.trim()).slice(0, 3).join(' ');
  const sentences = firstLines.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  const useful =
    sentences.find((x) => !/^(sure|okay|ok|yes|certainly|of course|i can|here)\b/i.test(x)) ?? sentences.at(-1) ?? '';
  const cleaned = useful
    .replace(/^(answer|name|garment|colou?r|category|formality)\s*[:=-]\s*/i, '')
    .replace(/^(the|this)\s+(garment|item|piece|clothing|outfit)\s+(is|appears to be|looks like|seems to be)\s+/i, '')
    .replace(/^(this|it)\s+(is|appears to be|looks like|seems to be)\s+/i, '')
    .replace(/^(a|an|the)\s+/i, '')
    .replace(/^(pair of|set of)\s+/i, '')
    .replace(/["'`*]/g, '')
    .replace(/[.!?,;:]+$/, '')
    .trim();
  return cleaned.split(/\s+/).slice(0, maxWords).join(' ');
}
const COLOUR_WORDS =
  /\b(light |dark |navy |pale |deep |bright )?(black|white|off-white|cream|ivory|beige|tan|khaki|camel|brown|chocolate|grey|gray|charcoal|silver|navy|blue|denim|sky blue|teal|turquoise|green|olive|sage|mint|red|maroon|burgundy|wine|pink|rose|purple|lavender|lilac|yellow|mustard|gold|orange|rust|coral|peach|multicolou?r(ed)?)\b/i;
export function colourIn(text: string) {
  return COLOUR_WORDS.exec(text)?.[0].toLowerCase() ?? '';
}
const CATEGORY_IN_NAME: [GarmentCategoryWord, RegExp][] = [
  ['shoes', /\b(shoes?|sneakers?|trainers?|boots?|sandals?|heels|loafers?|slippers?|flip-?flops?|juttis?|mojaris?)\b/i],
  ['accessories', /\b(bags?|handbags?|backpacks?|belts?|hats?|caps?|watch(es)?|scarf|scarves|sunglasses|ties?|jewell?ery|necklaces?|bracelets?|wallets?)\b/i],
  ['outerwear', /\b(jackets?|coats?|blazers?|parkas?|trench|bomber|puffer|windbreaker|overcoat|shrug)\b/i],
  ['bottoms', /\b(pants|trousers|jeans|shorts|skirts?|chinos|cargos?|joggers|leggings|sweatpants|track ?pants|palazzos?|salwar|churidars?|dhotis?|lehengas?)\b/i],
  ['tops', /\b(shirts?|t-?shirts?|tees?|tops?|blouses?|kurtas?|kurtis?|sweaters?|sweatshirts?|hoodies?|polos?|tanks?|camisoles?|cardigans?|jerseys?|sarees?|saris?|dress(es)?|gowns?|vests?)\b/i]
];
export function categoryInName(name: string) {
  return CATEGORY_IN_NAME.find(([, re]) => re.test(name))?.[0];
}
function categoryFromAnswer(text: string) {
  const word = shortAnswer(text, 3).toLowerCase();
  return categoryOf(word) ?? categoryOf(word.split(' ')[0]) ?? categoryInName(word);
}
export function formalityFromAnswer(text: string) {
  const t = text.toLowerCase();
  if (/smart[\s_-]*casual|business casual|semi[\s-]*formal/.test(t)) return 'smart_casual' as const;
  if (/evening|party|festive|cocktail/.test(t)) return 'evening' as const;
  if (/\bformal\b/.test(t)) return 'formal' as const;
  if (/\bcasual\b|everyday|relaxed/.test(t)) return 'casual' as const;
  return undefined;
}
export interface GarmentAnswers {
  name: string;
  formality: string;
  category?: string;
  colour?: string;
}
/** Builds the scan result from short answers; everything is validated. */
export function garmentFromAnswers(a: GarmentAnswers): VisionAnalysisResult {
  const name = field(shortAnswer(a.name));
  const category = categoryInName(name) ?? (a.category ? categoryFromAnswer(a.category) : undefined);
  const color = colourIn(name) || (a.colour ? colourIn(a.colour) || field(shortAnswer(a.colour, 3)) : '');
  const formality = formalityFromAnswer(a.formality);
  if (!name || !category || !color || !formality)
    throw new Error('The model could not classify this item reliably. Check the photo or enter it manually.');
  const words = name.toLowerCase().split(' ');
  return {
    name: name.charAt(0).toUpperCase() + name.slice(1),
    category,
    color,
    formality,
    subcategory: words.at(-1) || 'unknown',
    hexColor: '#999999',
    fabric: 'unknown',
    fit: 'unknown',
    style: '',
    tags: [],
    pairingNotes: '',
    pattern: '',
    secondaryColors: []
  };
}
/** Which questions are still needed after the name. */
export function missingFromName(name: string) {
  const n = shortAnswer(name);
  return { category: !categoryInName(n), colour: !colourIn(n) };
}

export function validateGarment(text: string): VisionAnalysisResult {
  const data = readAnswer(text);
  const category = categoryOf(pick(data, 'category'));
  const formality = formalityOf(pick(data, 'formality'));
  const name = field(pick(data, 'name')),
    color = field(pick(data, 'primarycolor', 'colour', 'color', 'maincolour', 'maincolor'));
  if (!name || !category || !color || !formality)
    throw new Error('The model could not classify this item reliably. Check the photo or enter it manually.');
  const secondary = pick(data, 'secondarycolors', 'secondarycolours');
  const hex = pick(data, 'hexcolor', 'hex');
  return {
    name,
    category,
    color,
    formality,
    subcategory: field(pick(data, 'subcategory', 'type')) || 'unknown',
    hexColor: /^#[0-9a-f]{6}$/i.test(String(hex)) ? String(hex) : '#999999',
    fabric: 'unknown',
    fit: field(pick(data, 'fit')) || 'unknown',
    style: field(pick(data, 'style')),
    tags: [],
    pairingNotes: field(pick(data, 'pairingnotes', 'pairing'), 240),
    pattern: field(pick(data, 'pattern')),
    secondaryColors: (Array.isArray(secondary)
      ? secondary
      : typeof secondary === 'string' && !/^(none|unknown|n\/a)$/i.test(secondary)
        ? secondary.split(/,|\band\b/)
        : []
    )
      .map((x) => field(x))
      .filter(Boolean)
      .slice(0, 4)
  };
}
// Candidates contain only owned IDs. The model may select one option; its text cannot add items.
export function validateRanking(text: string, count: number) {
  let data: Record<string, unknown>;
  let fromJson = false;
  try {
    data = parseObject(text);
    fromJson = true;
  } catch {
    data = parseLines(text);
  }
  const raw = pick(data, 'choice', 'outfit', 'option');
  const number = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d+$/.test(raw.trim()) ? Number(raw) : NaN;
  if (!Number.isInteger(number) || number < 1 || number > count) throw new Error('Invalid outfit choice.');
  // A JSON answer must not try to name garments; line answers are only ever
  // read for the number and the reason, so nothing else in them is used.
  if (fromJson && Object.keys(data).some((key) => !['choice', 'explanation'].includes(key)))
    throw new Error('Unexpected outfit fields.');
  const explanation = field(pick(data, 'explanation', 'reason', 'why'), 320);
  if (!explanation) throw new Error('Missing outfit explanation.');
  return { index: number - 1, explanation };
}

/** "Outfit 2 is the best choice." -> index 1. Only an offered number is accepted. */
export function chosenIndex(text: string, count: number) {
  const m = /\b(\d{1,2})\b/.exec(text);
  const n = m ? Number(m[1]) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > count) throw new Error('Invalid outfit choice.');
  return n - 1;
}
/** One clean sentence for "Why it works", or '' when the answer is unusable. */
export function reasonSentence(text: string) {
  const sentences = text
    .trim()
    .split(/\r?\n/)
    .join(' ')
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.replace(/^(answer|reason)\s*[:=-]\s*/i, '').replace(/["`*]/g, '').trim())
    .filter((x) => x.length > 12 && !/^(sure|okay|ok|certainly|of course|here)\b/i.test(x));
  const first = sentences[0] ?? '';
  return first.length <= 240 ? first : '';
}

/** Chat replies: at most `max` distinct sentences, so a small model's loops never reach the screen. */
export function chatReply(text: string, max = 2) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/)) {
    const sentence = raw.replace(/["`*]/g, '').trim();
    const key = sentence.toLowerCase().replace(/[^a-z0-9 ]/g, '');
    if (sentence.length < 4 || seen.has(key) || /^(sure|okay|ok|certainly|of course)\b/i.test(sentence)) continue;
    seen.add(key);
    out.push(sentence);
    if (out.length >= max) break;
  }
  return out.join(' ');
}
