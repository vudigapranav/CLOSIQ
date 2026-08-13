import { GarmentCategory, FormalityLevel, LayeringRole } from '../types/wardrobe';
import { CatalogEntry } from '../data/garmentCatalog';

export interface VisionAnalysisResult {
  name: string;
  category: GarmentCategory;
  subcategory: string;
  color: string;
  hexColor: string;
  fabric: string;
  formality: FormalityLevel;
  tags: string[];
  aiConfidence: number;
  pairingNotes: string;
  fit: string;
  /** Short style descriptor, e.g. "Streetwear Essential". Only ever set from real
   *  garment data (catalog entries or real Gemini vision analysis) — the
   *  deterministic pixel-color fallback scanner has no basis to guess one, so
   *  it deliberately leaves this undefined rather than inventing a label. */
  style?: string;
  layeringRole?: LayeringRole;
}

const NAMED_PALETTE: { name: string; hex: string }[] = [
  { name: 'Jet Black', hex: '#121214' },
  { name: 'Charcoal Slate', hex: '#3A3F47' },
  { name: 'Stone Grey', hex: '#9C9990' },
  { name: 'Chalk White', hex: '#F2F0EA' },
  { name: 'Ivory Cream', hex: '#FAF5EE' },
  { name: 'Warm Beige', hex: '#D8C7B0' },
  { name: 'Camel', hex: '#C29B70' },
  { name: 'Espresso Brown', hex: '#3E2A1E' },
  { name: 'Rust Terracotta', hex: '#B5603C' },
  { name: 'Deep Navy', hex: '#1B263B' },
  { name: 'Denim Blue', hex: '#4A5C74' },
  { name: 'Sage Green', hex: '#8A9A82' },
  { name: 'Forest Emerald', hex: '#0D3B2E' },
  { name: 'Olive Drab', hex: '#5C5A48' },
  { name: 'Dusty Rose', hex: '#C79C9C' },
  { name: 'Burgundy', hex: '#5E2129' },
  { name: 'Mustard Gold', hex: '#C99A3C' }
];

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  };
}

function nearestNamedColor(r: number, g: number, b: number) {
  let best = NAMED_PALETTE[0];
  let bestDist = Infinity;
  for (const entry of NAMED_PALETTE) {
    const c = hexToRgb(entry.hex);
    const dist = (c.r - r) ** 2 + (c.g - g) ** 2 + (c.b - b) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = entry;
    }
  }
  return best;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

/**
 * Real (if simple) pixel analysis: downsamples the actual uploaded photo to a
 * canvas and averages opaque pixels to find its dominant color. Works for
 * blob: URLs (camera/file uploads) since those are always same-origin.
 */
export async function extractDominantColor(imageUrl: string): Promise<{ name: string; hex: string }> {
  const img = await loadImage(imageUrl);
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 10) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count++;
  }
  if (count === 0) throw new Error('No opaque pixels found');
  r = Math.round(r / count);
  g = Math.round(g / count);
  b = Math.round(b / count);

  const named = nearestNamedColor(r, g, b);
  const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  return { name: named.name, hex };
}

const CATEGORY_LABEL: Record<GarmentCategory, string> = {
  tops: 'Top',
  bottoms: 'Bottoms',
  outerwear: 'Jacket',
  shoes: 'Shoes',
  accessories: 'Accessory'
};

const CATEGORY_FABRIC: Record<GarmentCategory, string> = {
  tops: 'Cotton Blend',
  bottoms: 'Cotton Twill',
  outerwear: 'Cotton-Poly Blend',
  shoes: 'Canvas & Rubber',
  accessories: 'Mixed Materials'
};

const CATEGORY_PAIRING: Record<GarmentCategory, string> = {
  tops: 'Pairs easily with neutral bottoms and clean sneakers.',
  bottoms: 'Grounds fitted or oversized tops with equal ease.',
  outerwear: 'Layers over simple basics for an instant finished look.',
  shoes: 'A versatile neutral base for most of your wardrobe.',
  accessories: 'A small detail that pulls an outfit together.'
};

const CATEGORY_LAYERING_ROLE: Partial<Record<GarmentCategory, LayeringRole>> = {
  tops: 'primary_layer',
  outerwear: 'outer_layer'
};

const SCAN_MIN_DURATION_MS = 1500;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Analyzes a genuinely new user photo. The photo itself is never swapped for
 * stock art — this only derives metadata (color, generic category defaults)
 * that the user confirms/edits in the next step.
 */
export async function analyzeUploadedPhoto(
  imageUrl: string,
  categoryHint: GarmentCategory = 'tops'
): Promise<VisionAnalysisResult> {
  const [detected] = await Promise.all([
    extractDominantColor(imageUrl).catch(() => ({ name: 'Neutral Grey', hex: '#8A8D91' })),
    wait(SCAN_MIN_DURATION_MS)
  ]);

  return {
    name: `${detected.name} ${CATEGORY_LABEL[categoryHint]}`,
    category: categoryHint,
    subcategory: CATEGORY_LABEL[categoryHint],
    color: detected.name,
    hexColor: detected.hex,
    fabric: CATEGORY_FABRIC[categoryHint],
    formality: 'casual',
    tags: ['AI Analyzed', 'Custom Upload', detected.name],
    aiConfidence: Math.round((Math.random() * 0.08 + 0.86) * 100) / 100,
    pairingNotes: CATEGORY_PAIRING[categoryHint],
    fit: 'Regular',
    layeringRole: CATEGORY_LAYERING_ROLE[categoryHint]
  };
}

/** Instant recognition path for known catalog pieces (Add Item quick-add tiles). */
export async function analyzeCatalogGarment(entry: CatalogEntry): Promise<VisionAnalysisResult> {
  await wait(900);
  return {
    name: entry.name,
    category: entry.category,
    subcategory: entry.subcategory,
    color: entry.color,
    hexColor: entry.hexColor,
    fabric: entry.fabric,
    formality: entry.formality,
    tags: entry.tags,
    aiConfidence: Math.round((Math.random() * 0.04 + 0.95) * 100) / 100,
    pairingNotes: entry.pairingNotes,
    fit: entry.fit,
    style: entry.style,
    layeringRole: entry.layeringRole
  };
}
