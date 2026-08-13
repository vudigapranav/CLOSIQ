import { GarmentCategory, FormalityLevel, Season, WardrobeProfile, LayeringRole, GarmentItem } from '../types/wardrobe';

/**
 * Single source of truth for known/generated garment assets.
 * Add a new piece here, drop its PNG in public/wardrobe/<profile>/<folder>/<id>.png,
 * and it is available everywhere (onboarding seed wardrobe, Add Item samples)
 * with zero other code changes. See public/wardrobe/README.md.
 *
 * `id` IS the stable garment ID ("garmentId") — the AI and every screen key
 * off this field, never off the filename. `name` IS the display name shown
 * in the UI. The filename on disk is derived FROM `id` (via
 * getGarmentImagePath), never the other way around.
 */
export interface CatalogEntry {
  id: string;
  profile: WardrobeProfile;
  category: GarmentCategory;
  name: string;
  subcategory: string;
  color: string;
  hexColor: string;
  fabric: string;
  fit: string;
  /** Short style descriptor, e.g. "Streetwear", "Tailored Modern". */
  style: string;
  seasons: Season[];
  formality: FormalityLevel;
  layeringRole?: LayeringRole;
  brand?: string;
  tags: string[];
  pairingNotes: string;
  /** Show as a quick-add tile in the Add Item sheet for this profile. */
  isQuickAddSample?: boolean;
  /** Resolved public path for this entry's image — derived from id/profile/category, never hand-typed. */
  imagePath: string;
}

const CATEGORY_FOLDER: Record<GarmentCategory, string> = {
  tops: 'tops',
  bottoms: 'bottoms',
  outerwear: 'outerwear',
  shoes: 'footwear',
  accessories: 'accessories'
};

export function getGarmentImagePath(id: string, profile: WardrobeProfile, category: GarmentCategory): string {
  return `/wardrobe/${profile}/${CATEGORY_FOLDER[category]}/${id}.png`;
}

type CatalogEntryInput = Omit<CatalogEntry, 'imagePath'>;

/**
 * Raw catalog data. Deliberately excludes `imagePath` — it's derived below
 * so the id/profile/category → path formula only lives in one place
 * (getGarmentImagePath). Do not hardcode image paths here.
 */
const RAW_CATALOG: CatalogEntryInput[] = [
  // ---------- MEN ----------
  {
    id: 'oversized_graphic_tee',
    profile: 'men',
    category: 'tops',
    name: 'Oversized Graphic Tee',
    subcategory: 'T-Shirt',
    color: 'Vintage White',
    hexColor: '#EDE8DE',
    fabric: '100% Combed Cotton Jersey',
    fit: 'Oversized',
    style: 'Streetwear Essential',
    seasons: ['spring', 'summer'],
    formality: 'casual',
    layeringRole: 'primary_layer',
    tags: ['Relaxed Fit', 'Crew Neck', 'Statement Print'],
    pairingNotes: 'Grounds cargo pants or denim for an easy off-duty uniform.',
    isQuickAddSample: true
  },
  {
    id: 'ribbed_tank_top',
    profile: 'men',
    category: 'tops',
    name: 'Ribbed Tank Top',
    subcategory: 'Tank Top',
    color: 'Sage Green',
    hexColor: '#8A9A82',
    fabric: 'Ribbed Cotton Stretch',
    fit: 'Fitted',
    style: 'Minimalist Layering',
    seasons: ['summer'],
    formality: 'casual',
    layeringRole: 'base_layer',
    tags: ['Fitted', 'Layering Piece', 'Base Layer'],
    pairingNotes: 'A clean base layer under an open hoodie or jacket — not meant to stand alone in most contexts.',
    isQuickAddSample: true
  },
  {
    id: 'baggy_cargo_pants',
    profile: 'men',
    category: 'bottoms',
    name: 'Baggy Cargo Pants',
    subcategory: 'Cargo Pants',
    color: 'Olive Drab',
    hexColor: '#5C5A48',
    fabric: 'Cotton Ripstop',
    fit: 'Relaxed',
    style: 'Utility Streetwear',
    seasons: ['autumn', 'spring'],
    formality: 'casual',
    tags: ['Multi-Pocket', 'Relaxed Taper', 'Utility'],
    pairingNotes: 'Balances an oversized top with room to spare through the leg.',
    isQuickAddSample: true
  },
  {
    id: 'parachute_pants',
    profile: 'men',
    category: 'bottoms',
    name: 'Parachute Pants',
    subcategory: 'Technical Pants',
    color: 'Storm Grey',
    hexColor: '#6B6E72',
    fabric: 'Nylon Shell',
    fit: 'Tapered',
    style: 'Technical Streetwear',
    seasons: ['autumn', 'winter'],
    formality: 'smart_casual',
    tags: ['Cinched Ankle', 'Technical', 'Streetwear'],
    pairingNotes: 'Cinched ankles pair naturally with chunky trail sneakers.'
  },
  {
    id: 'boxy_zipup_hoodie',
    profile: 'men',
    category: 'outerwear',
    name: 'Boxy Zip-Up Hoodie',
    subcategory: 'Hoodie',
    color: 'Charcoal Heather',
    hexColor: '#3A3D3F',
    fabric: 'Brushed Fleece Cotton Blend',
    fit: 'Boxy',
    style: 'Streetwear',
    seasons: ['autumn', 'winter'],
    formality: 'casual',
    layeringRole: 'outer_layer',
    tags: ['Boxy Fit', 'Full Zip', 'Kangaroo Pocket'],
    pairingNotes: 'Layers over a tank or tee as the outfit’s anchor piece.',
    isQuickAddSample: true
  },
  {
    id: 'relaxed_denim_jacket',
    profile: 'men',
    category: 'outerwear',
    name: 'Relaxed Denim Jacket',
    subcategory: 'Denim Jacket',
    color: 'Washed Indigo',
    hexColor: '#4A5C74',
    fabric: 'Cotton Denim',
    fit: 'Relaxed',
    style: 'Classic Casual',
    seasons: ['spring', 'autumn'],
    formality: 'smart_casual',
    layeringRole: 'outer_layer',
    tags: ['Boxy', 'Button-Front', 'Classic Wash'],
    pairingNotes: 'Classic layer over graphic tees or ribbed tanks.'
  },
  {
    id: 'low_top_canvas_sneaker',
    profile: 'men',
    category: 'shoes',
    name: 'Low-Top Canvas Sneaker',
    subcategory: 'Sneakers',
    color: 'Chalk White',
    hexColor: '#F2F0EA',
    fabric: 'Canvas & Rubber Sole',
    fit: 'True to Size',
    style: 'Everyday Minimalist',
    seasons: ['spring', 'summer', 'autumn'],
    formality: 'smart_casual',
    tags: ['Lace-Up', 'Everyday', 'Lightweight'],
    pairingNotes: 'The neutral finisher that lets a bold top or pant lead.',
    isQuickAddSample: true
  },
  {
    id: 'chunky_trail_sneaker',
    profile: 'men',
    category: 'shoes',
    name: 'Chunky Trail Sneaker',
    subcategory: 'Trail Sneaker',
    color: 'Stone Grey',
    hexColor: '#9C9990',
    fabric: 'Mesh & EVA Sole',
    fit: 'True to Size',
    style: 'Streetwear',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    formality: 'casual',
    tags: ['Chunky Sole', 'Trail Inspired', 'Streetwear'],
    pairingNotes: 'Adds visual weight under cinched or cropped bottoms.'
  },
  {
    id: 'ribbed_fisherman_beanie',
    profile: 'men',
    category: 'accessories',
    name: 'Ribbed Fisherman Beanie',
    subcategory: 'Headwear',
    color: 'Toasted Camel',
    hexColor: '#A97C50',
    fabric: 'Merino Wool Rib Knit',
    fit: 'One Size',
    style: 'Cold-Weather Classic',
    seasons: ['autumn', 'winter'],
    formality: 'casual',
    tags: ['Cuffed', 'Compact', 'Cold Weather'],
    pairingNotes: 'Finishes a cold-weather look without competing for attention.',
    isQuickAddSample: true
  },
  {
    id: 'structured_baseball_cap',
    profile: 'men',
    category: 'accessories',
    name: 'Structured Baseball Cap',
    subcategory: 'Headwear',
    color: 'Forest Emerald',
    hexColor: '#1F4A3B',
    fabric: 'Cotton Twill',
    fit: 'Adjustable',
    style: 'Sporty Casual',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    formality: 'casual',
    tags: ['Adjustable Strap', 'Curved Brim'],
    pairingNotes: 'A clean emerald accent that echoes the CLOSIQ palette.'
  },

  // ---------- WOMEN ----------
  {
    id: 'tank_top',
    profile: 'women',
    category: 'tops',
    name: 'Ribbed Tank Top',
    subcategory: 'Tank Top',
    color: 'Ivory Cream',
    hexColor: '#FAF5EE',
    fabric: 'Ribbed Cotton Stretch',
    fit: 'Fitted',
    style: 'Minimalist Layering',
    seasons: ['summer', 'spring'],
    formality: 'casual',
    layeringRole: 'base_layer',
    tags: ['Fitted', 'Layering Piece', 'Base Layer'],
    pairingNotes: 'A clean base layer under a knit, blazer, or open jacket — not meant to stand alone in most contexts.',
    isQuickAddSample: true
  },
  {
    id: 'cropped_knit_top',
    profile: 'women',
    category: 'tops',
    name: 'Cropped Knit Top',
    subcategory: 'Knitwear',
    color: 'Warm Beige',
    hexColor: '#D8C7B0',
    fabric: 'Fine Merino Rib Knit',
    fit: 'Cropped',
    style: 'Elevated Casual',
    seasons: ['spring', 'autumn'],
    formality: 'smart_casual',
    layeringRole: 'primary_layer',
    tags: ['Cropped', 'Fine Gauge', 'Versatile'],
    pairingNotes: 'Balances high-waisted bottoms with clean, elevated proportion.',
    isQuickAddSample: true
  },
  {
    id: 'wide_leg_trousers',
    profile: 'women',
    category: 'bottoms',
    name: 'Wide-Leg Trousers',
    subcategory: 'Trousers',
    color: 'Charcoal Slate',
    hexColor: '#3A3F47',
    fabric: 'Fluid Crepe',
    fit: 'Wide Leg',
    style: 'Tailored Modern',
    seasons: ['autumn', 'spring', 'winter'],
    formality: 'smart_casual',
    tags: ['High Rise', 'Fluid Drape', 'Tailored'],
    pairingNotes: 'Elongates the silhouette under a cropped or fitted top.',
    isQuickAddSample: true
  },
  {
    id: 'pleated_midi_skirt',
    profile: 'women',
    category: 'bottoms',
    name: 'Pleated Midi Skirt',
    subcategory: 'Midi Skirt',
    color: 'Dusty Rose',
    hexColor: '#C79C9C',
    fabric: 'Satin-Back Crepe',
    fit: 'A-Line',
    style: 'Romantic Evening',
    seasons: ['spring', 'summer', 'autumn'],
    formality: 'evening',
    tags: ['Bias Cut', 'Elasticated Waist', 'Fluid Movement'],
    pairingNotes: 'Catches evening light elegantly alongside a fitted knit and heels.'
  },
  {
    id: 'boxy_denim_jacket',
    profile: 'women',
    category: 'outerwear',
    name: 'Boxy Denim Jacket',
    subcategory: 'Denim Jacket',
    color: 'Washed Indigo',
    hexColor: '#4A5C74',
    fabric: 'Cotton Denim',
    fit: 'Boxy',
    style: 'Classic Casual',
    seasons: ['spring', 'autumn'],
    formality: 'casual',
    layeringRole: 'outer_layer',
    tags: ['Cropped Boxy', 'Button-Front', 'Classic Wash'],
    pairingNotes: 'Layers easily over a tank or fitted knit.',
    isQuickAddSample: true
  },
  {
    id: 'belted_wrap_coat',
    profile: 'women',
    category: 'outerwear',
    name: 'Belted Wrap Coat',
    subcategory: 'Coat',
    color: 'Camel',
    hexColor: '#C29B70',
    fabric: 'Heavyweight Wool Blend',
    fit: 'Tailored',
    style: 'Tailored Elegance',
    seasons: ['autumn', 'winter'],
    formality: 'smart_casual',
    layeringRole: 'outer_layer',
    tags: ['Self-Belt', 'Notch Collar', 'Structured'],
    pairingNotes: 'Defines the waist over wide-leg trousers or a midi skirt.'
  },
  {
    id: 'platform_sneaker',
    profile: 'women',
    category: 'shoes',
    name: 'Platform Sneaker',
    subcategory: 'Sneakers',
    color: 'Chalk White',
    hexColor: '#F2F0EA',
    fabric: 'Leather & Rubber Sole',
    fit: 'True to Size',
    style: 'Everyday Casual',
    seasons: ['spring', 'summer', 'autumn'],
    formality: 'casual',
    tags: ['Chunky Sole', 'Lace-Up', 'Everyday'],
    pairingNotes: 'Keeps a fluid trouser or skirt grounded and easy.',
    isQuickAddSample: true
  },
  {
    id: 'strappy_block_heel',
    profile: 'women',
    category: 'shoes',
    name: 'Strappy Block Heel',
    subcategory: 'Heels',
    color: 'Espresso Brown',
    hexColor: '#3E2A1E',
    fabric: 'Nappa Leather',
    fit: 'True to Size',
    style: 'Elevated Evening',
    seasons: ['spring', 'summer', 'autumn'],
    formality: 'evening',
    tags: ['Ankle Strap', 'Stable Block Heel', 'Polished'],
    pairingNotes: 'Elevates a midi skirt or wide-leg trouser for evening.'
  },
  {
    id: 'ribbed_knit_beanie',
    profile: 'women',
    category: 'accessories',
    name: 'Ribbed Knit Beanie',
    subcategory: 'Headwear',
    color: 'Oatmeal Milk',
    hexColor: '#E6DEC8',
    fabric: 'Extra Fine Merino Wool',
    fit: 'One Size',
    style: 'Cold-Weather Classic',
    seasons: ['autumn', 'winter'],
    formality: 'casual',
    tags: ['Folded Cuff', 'Thermal', 'Soft Texture'],
    pairingNotes: 'Adds textural warmth to cold-weather coat layering.',
    isQuickAddSample: true
  },
  {
    id: 'structured_top_handle_bag',
    profile: 'women',
    category: 'accessories',
    name: 'Structured Top-Handle Bag',
    subcategory: 'Handbag',
    color: 'Black Chestnut',
    hexColor: '#1A1817',
    fabric: 'Grainy Calfskin',
    fit: 'One Size',
    style: 'Refined Minimalist',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    formality: 'smart_casual',
    tags: ['Top Handle', 'Magnetic Clasp', 'Sculptural'],
    pairingNotes: 'Refines any outfit with clean geometric structure.'
  }
];

/** Public catalog — every entry carries a resolved `imagePath`, derived once here. */
export const GARMENT_CATALOG: CatalogEntry[] = RAW_CATALOG.map((entry) => ({
  ...entry,
  imagePath: getGarmentImagePath(entry.id, entry.profile, entry.category)
}));

export function findCatalogEntry(id: string): CatalogEntry | undefined {
  return GARMENT_CATALOG.find((entry) => entry.id === id);
}

export function getQuickAddSamples(profile: WardrobeProfile): CatalogEntry[] {
  return GARMENT_CATALOG.filter((entry) => entry.profile === profile && entry.isQuickAddSample);
}

export function getCatalogForProfile(profile: WardrobeProfile): CatalogEntry[] {
  return GARMENT_CATALOG.filter((entry) => entry.profile === profile);
}

function catalogEntryToGarmentItem(entry: CatalogEntry): GarmentItem {
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category,
    subcategory: entry.subcategory,
    color: entry.color,
    hexColor: entry.hexColor,
    fabric: entry.fabric,
    seasons: entry.seasons,
    formality: entry.formality,
    imageUrl: entry.imagePath,
    brand: 'CLOSIQ Wardrobe',
    favorite: false,
    wearCount: 0,
    dateAdded: new Date().toISOString().split('T')[0],
    tags: entry.tags,
    aiConfidence: 0.97,
    pairingNotes: entry.pairingNotes,
    fit: entry.fit,
    layeringRole: entry.layeringRole,
    profile: entry.profile,
    isSeedItem: true
  };
}

/** The starter wardrobe auto-populated at onboarding / when switching profiles. */
export function getProfileSeedWardrobe(profile: WardrobeProfile): GarmentItem[] {
  return getCatalogForProfile(profile).map(catalogEntryToGarmentItem);
}
