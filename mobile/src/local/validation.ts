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
export function validateGarment(text: string): VisionAnalysisResult {
  const data = parseObject(text);
  const category = choice(data.category, categories);
  const formality = choice(data.formality, formalities);
  const name = field(data.name),
    color = field(data.primaryColor);
  if (!name || !category || !color || !formality)
    throw new Error('The model could not classify this item reliably. Check the photo or enter it manually.');
  return {
    name,
    category,
    color,
    formality,
    subcategory: field(data.subcategory) || 'unknown',
    hexColor: /^#[0-9a-f]{6}$/i.test(String(data.hexColor)) ? String(data.hexColor) : '#999999',
    fabric: 'unknown',
    fit: field(data.fit) || 'unknown',
    style: field(data.style),
    tags: [],
    pairingNotes: field(data.pairingNotes, 240),
    pattern: field(data.pattern),
    secondaryColors: Array.isArray(data.secondaryColors)
      ? data.secondaryColors
          .map((x) => field(x))
          .filter(Boolean)
          .slice(0, 4)
      : []
  };
}
// Candidates contain only owned IDs. The model may select one option; its text cannot add items.
export function validateRanking(text: string, count: number) {
  const data = parseObject(text);
  if (
    typeof data.choice !== 'number' ||
    !Number.isInteger(data.choice) ||
    data.choice < 1 ||
    data.choice > count
  )
    throw new Error('Invalid outfit choice.');
  if (Object.keys(data).some((key) => !['choice', 'explanation'].includes(key)))
    throw new Error('Unexpected outfit fields.');
  const explanation = field(data.explanation, 320);
  if (!explanation) throw new Error('Missing outfit explanation.');
  return { index: data.choice - 1, explanation };
}
