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
 *
 * Every entry here traces back to a real image in `public/test samples/`
 * (the hackathon team's curated source folder — see that folder's sibling
 * note in STATE.md for the full inventory/classification notes). The actual
 * PNG files live in `public/wardrobe/<profile>/<folder>/<id>.png` as
 * symlinks back into `public/test samples/...` so nothing there is moved,
 * renamed, or duplicated on disk.
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
  return `/wardrobe/${profile}/${CATEGORY_FOLDER[category]}/${id}.webp`;
}

type CatalogEntryInput = Omit<CatalogEntry, 'imagePath'>;

/**
 * Raw catalog data. Deliberately excludes `imagePath` — it's derived below
 * so the id/profile/category → path formula only lives in one place
 * (getGarmentImagePath). Do not hardcode image paths here.
 */
const RAW_CATALOG: CatalogEntryInput[] = [
  // ==================== MEN — TOPS ====================
  {
    id: 'charcoal_art_tee',
    profile: 'men',
    category: 'tops',
    name: 'Charcoal Art Tee',
    subcategory: 'Graphic Tee',
    color: 'Charcoal',
    hexColor: '#3A3F47',
    fabric: 'Cotton Jersey',
    fit: 'Oversized',
    style: 'Streetwear Essential',
    seasons: ['spring', 'summer'],
    formality: 'casual',
    layeringRole: 'primary_layer',
    tags: ['Oversized', 'Graphic Print', 'Streetwear'],
    pairingNotes: 'Grounds cargo or parachute pants for an easy off-duty uniform.',
    isQuickAddSample: true
  },
  {
    id: 'cream_graphic_tee',
    profile: 'men',
    category: 'tops',
    name: 'Cream Graphic Tee',
    subcategory: 'Graphic Tee',
    color: 'Cream',
    hexColor: '#F5EFE3',
    fabric: 'Cotton Jersey',
    fit: 'Oversized',
    style: 'Streetwear Essential',
    seasons: ['spring', 'summer'],
    formality: 'casual',
    layeringRole: 'primary_layer',
    tags: ['Oversized', 'Graphic Print'],
    pairingNotes: 'A light, easy base for warm-weather layering.'
  },
  {
    id: 'light_blue_poplin_shirt',
    profile: 'men',
    category: 'tops',
    name: 'Light Blue Poplin Shirt',
    subcategory: 'Poplin Shirt',
    color: 'Light Blue',
    hexColor: '#A9C4D9',
    fabric: 'Cotton Poplin',
    fit: 'Regular',
    style: 'Smart Casual',
    seasons: ['spring', 'summer', 'autumn'],
    formality: 'smart_casual',
    layeringRole: 'primary_layer',
    tags: ['Button-Front', 'Crisp Weave'],
    pairingNotes: 'Dresses up trousers or reads relaxed with denim.'
  },
  {
    id: 'olive_college_tee',
    profile: 'men',
    category: 'tops',
    name: 'Olive College Tee',
    subcategory: 'Graphic Tee',
    color: 'Olive',
    hexColor: '#5C5A48',
    fabric: 'Cotton Jersey',
    fit: 'Regular',
    style: 'Collegiate Casual',
    seasons: ['spring', 'autumn'],
    formality: 'casual',
    layeringRole: 'primary_layer',
    tags: ['Collegiate Print', 'Everyday'],
    pairingNotes: 'An easy campus staple that pairs with almost any bottom.'
  },
  {
    id: 'stone_taupe_poplin_shirt',
    profile: 'men',
    category: 'tops',
    name: 'Stone Taupe Poplin Shirt',
    subcategory: 'Poplin Shirt',
    color: 'Stone Taupe',
    hexColor: '#B5A99A',
    fabric: 'Cotton Poplin',
    fit: 'Regular',
    style: 'Smart Casual',
    seasons: ['spring', 'autumn'],
    formality: 'smart_casual',
    layeringRole: 'primary_layer',
    tags: ['Button-Front', 'Neutral'],
    pairingNotes: 'A quiet neutral that layers cleanly under a jacket.'
  },
  {
    id: 'vintage_gray_tee',
    profile: 'men',
    category: 'tops',
    name: 'Vintage Gray Tee',
    subcategory: 'Graphic Tee',
    color: 'Vintage Gray',
    hexColor: '#9C9990',
    fabric: 'Cotton Jersey',
    fit: 'Regular',
    style: 'Streetwear Essential',
    seasons: ['spring', 'summer'],
    formality: 'casual',
    layeringRole: 'primary_layer',
    tags: ['Washed Finish', 'Everyday'],
    pairingNotes: 'A worn-in basic that anchors nearly any casual look.'
  },
  {
    id: 'washed_black_graphic_tee',
    profile: 'men',
    category: 'tops',
    name: 'Washed Black Graphic Tee',
    subcategory: 'Graphic Tee',
    color: 'Washed Black',
    hexColor: '#232323',
    fabric: 'Cotton Jersey',
    fit: 'Oversized',
    style: 'Streetwear Essential',
    seasons: ['spring', 'summer', 'autumn'],
    formality: 'casual',
    layeringRole: 'primary_layer',
    tags: ['Oversized', 'Graphic Print'],
    pairingNotes: 'A dark, easy base that lets bolder bottoms lead.'
  },
  {
    id: 'white_oxford_shirt',
    profile: 'men',
    category: 'tops',
    name: 'White Oxford Shirt',
    subcategory: 'Oxford Shirt',
    color: 'White',
    hexColor: '#F2F0EA',
    fabric: 'Cotton Oxford',
    fit: 'Regular',
    style: 'Classic Casual',
    seasons: ['spring', 'summer', 'autumn'],
    formality: 'smart_casual',
    layeringRole: 'primary_layer',
    tags: ['Button-Down Collar', 'Classic'],
    pairingNotes: 'The clean neutral that lets trousers or denim lead.'
  },

  // ==================== MEN — BOTTOMS ====================
  {
    id: 'black_cargo_pants',
    profile: 'men',
    category: 'bottoms',
    name: 'Black Cargo Pants',
    subcategory: 'Cargo Pants',
    color: 'Black',
    hexColor: '#1A1817',
    fabric: 'Cotton Ripstop',
    fit: 'Relaxed',
    style: 'Utility Streetwear',
    seasons: ['autumn', 'spring'],
    formality: 'casual',
    tags: ['Multi-Pocket', 'Relaxed'],
    pairingNotes: 'Balances an oversized top with room to spare through the leg.',
    isQuickAddSample: true
  },
  {
    id: 'black_parachute_pants',
    profile: 'men',
    category: 'bottoms',
    name: 'Black Parachute Pants',
    subcategory: 'Parachute Pants',
    color: 'Black',
    hexColor: '#1A1817',
    fabric: 'Nylon Shell',
    fit: 'Tapered',
    style: 'Technical Streetwear',
    seasons: ['autumn', 'winter'],
    formality: 'smart_casual',
    tags: ['Cinched Ankle', 'Technical'],
    pairingNotes: 'Cinched ankles pair naturally with chunky trail sneakers.'
  },
  {
    id: 'charcoal_tech_pants',
    profile: 'men',
    category: 'bottoms',
    name: 'Charcoal Tech Pants',
    subcategory: 'Technical Pants',
    color: 'Charcoal',
    hexColor: '#3A3F47',
    fabric: 'Technical Nylon Blend',
    fit: 'Tapered',
    style: 'Technical Streetwear',
    seasons: ['autumn', 'winter'],
    formality: 'smart_casual',
    tags: ['Technical', 'Streetwear'],
    pairingNotes: 'A sleek, technical base for a modern streetwear silhouette.'
  },
  {
    id: 'cream_wide_leg_trousers',
    profile: 'men',
    category: 'bottoms',
    name: 'Cream Wide-Leg Trousers',
    subcategory: 'Trousers',
    color: 'Cream',
    hexColor: '#F5EFE3',
    fabric: 'Cotton Twill',
    fit: 'Wide Leg',
    style: 'Tailored Modern',
    seasons: ['spring', 'summer'],
    formality: 'smart_casual',
    tags: ['Wide Leg', 'Tailored'],
    pairingNotes: 'Elongates the silhouette under a fitted or cropped top.'
  },
  {
    id: 'olive_cargo_pants',
    profile: 'men',
    category: 'bottoms',
    name: 'Olive Cargo Pants',
    subcategory: 'Cargo Pants',
    color: 'Olive',
    hexColor: '#5C5A48',
    fabric: 'Cotton Ripstop',
    fit: 'Relaxed',
    style: 'Utility Streetwear',
    seasons: ['autumn', 'spring'],
    formality: 'casual',
    tags: ['Multi-Pocket', 'Utility'],
    pairingNotes: 'A utility staple that grounds an oversized top.'
  },
  {
    id: 'stone_cargo_pants',
    profile: 'men',
    category: 'bottoms',
    name: 'Stone Cargo Pants',
    subcategory: 'Cargo Pants',
    color: 'Stone',
    hexColor: '#9C9990',
    fabric: 'Cotton Ripstop',
    fit: 'Relaxed',
    style: 'Utility Streetwear',
    seasons: ['spring', 'summer', 'autumn'],
    formality: 'casual',
    tags: ['Multi-Pocket', 'Neutral'],
    pairingNotes: 'A neutral utility pant that pairs with almost any top.'
  },
  {
    id: 'taupe_parachute_pants',
    profile: 'men',
    category: 'bottoms',
    name: 'Taupe Parachute Pants',
    subcategory: 'Parachute Pants',
    color: 'Taupe',
    hexColor: '#B5A99A',
    fabric: 'Nylon Shell',
    fit: 'Tapered',
    style: 'Technical Streetwear',
    seasons: ['autumn', 'winter'],
    formality: 'smart_casual',
    tags: ['Cinched Ankle', 'Technical'],
    pairingNotes: 'Cinched ankles pair naturally with chunky trail sneakers.'
  },

  // ==================== MEN — FOOTWEAR ====================
  {
    id: 'leather_loafers',
    profile: 'men',
    category: 'shoes',
    name: 'Leather Loafers',
    subcategory: 'Loafers',
    color: 'Espresso Brown',
    hexColor: '#3E2A1E',
    fabric: 'Leather',
    fit: 'True to Size',
    style: 'Refined Casual',
    seasons: ['spring', 'autumn', 'winter'],
    formality: 'smart_casual',
    tags: ['Penny Loafer', 'Refined'],
    pairingNotes: 'Elevates trousers or a poplin shirt for smart-casual polish.'
  },
  {
    id: 'retro_trail_runner_sneakers',
    profile: 'men',
    category: 'shoes',
    name: 'Retro Trail Runner Sneakers',
    subcategory: 'Trail Sneaker',
    color: 'Stone Grey',
    hexColor: '#9C9990',
    fabric: 'Mesh & Leather',
    fit: 'True to Size',
    style: 'Technical Streetwear',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    formality: 'casual',
    tags: ['Chunky Sole', 'Trail Inspired'],
    pairingNotes: 'Adds visual weight under cinched or cropped bottoms.'
  },
  {
    id: 'skate_sneakers',
    profile: 'men',
    category: 'shoes',
    name: 'Skate Sneakers',
    subcategory: 'Skate Sneakers',
    color: 'Grey Olive',
    hexColor: '#6B6E72',
    fabric: 'Suede & Mesh',
    fit: 'True to Size',
    style: 'Streetwear',
    seasons: ['spring', 'summer', 'autumn'],
    formality: 'casual',
    tags: ['Low-Top', 'Streetwear'],
    pairingNotes: 'The everyday streetwear finisher for cargo or denim.'
  },
  {
    id: 'trail_sneakers',
    profile: 'men',
    category: 'shoes',
    name: 'Trail Sneakers',
    subcategory: 'Trail Sneaker',
    color: 'Stone Multi',
    hexColor: '#C4BBA8',
    fabric: 'Mesh & EVA Sole',
    fit: 'True to Size',
    style: 'Streetwear',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    formality: 'casual',
    tags: ['Chunky Sole', 'Trail Inspired'],
    pairingNotes: 'Adds visual weight under cinched or cropped bottoms.'
  },
  {
    id: 'utility_boots',
    profile: 'men',
    category: 'shoes',
    name: 'Utility Boots',
    subcategory: 'Boots',
    color: 'Espresso Brown',
    hexColor: '#3E2A1E',
    fabric: 'Leather',
    fit: 'True to Size',
    style: 'Utility Rugged',
    seasons: ['autumn', 'winter'],
    formality: 'casual',
    tags: ['Lace-Up', 'Rugged'],
    pairingNotes: 'A rugged cold-weather anchor for cargo or tech pants.'
  },
  {
    id: 'white_leather_sneakers',
    profile: 'men',
    category: 'shoes',
    name: 'White Leather Sneakers',
    subcategory: 'Sneakers',
    color: 'White',
    hexColor: '#F2F0EA',
    fabric: 'Leather & Rubber Sole',
    fit: 'True to Size',
    style: 'Everyday Minimalist',
    seasons: ['spring', 'summer', 'autumn'],
    formality: 'smart_casual',
    tags: ['Lace-Up', 'Everyday'],
    pairingNotes: 'The neutral finisher that lets a bold top or pant lead.',
    isQuickAddSample: true
  },

  // ==================== MEN — OUTERWEAR ====================
  {
    id: 'charcoal_cropped_bomber',
    profile: 'men',
    category: 'outerwear',
    name: 'Charcoal Cropped Bomber',
    subcategory: 'Bomber Jacket',
    color: 'Charcoal',
    hexColor: '#3A3F47',
    fabric: 'Nylon Shell',
    fit: 'Cropped',
    style: 'Streetwear',
    seasons: ['autumn', 'winter'],
    formality: 'casual',
    layeringRole: 'outer_layer',
    tags: ['Cropped', 'Streetwear'],
    pairingNotes: 'Layers cleanly over a tee without adding bulk.'
  },
  {
    id: 'charcoal_zip_hoodie',
    profile: 'men',
    category: 'outerwear',
    name: 'Charcoal Zip Hoodie',
    subcategory: 'Hoodie',
    color: 'Charcoal',
    hexColor: '#3A3F47',
    fabric: 'Brushed Fleece Cotton Blend',
    fit: 'Boxy',
    style: 'Streetwear',
    seasons: ['autumn', 'winter'],
    formality: 'casual',
    layeringRole: 'outer_layer',
    tags: ['Boxy Fit', 'Full Zip'],
    pairingNotes: "Layers over a tee as the outfit's anchor piece."
  },
  {
    id: 'olive_zip_hoodie',
    profile: 'men',
    category: 'outerwear',
    name: 'Olive Zip Hoodie',
    subcategory: 'Hoodie',
    color: 'Olive',
    hexColor: '#5C5A48',
    fabric: 'Brushed Fleece Cotton Blend',
    fit: 'Boxy',
    style: 'Streetwear',
    seasons: ['autumn', 'winter'],
    formality: 'casual',
    layeringRole: 'outer_layer',
    tags: ['Boxy Fit', 'Full Zip'],
    pairingNotes: "Layers over a tee as the outfit's anchor piece."
  },
  {
    id: 'washed_denim_jacket',
    profile: 'men',
    category: 'outerwear',
    name: 'Washed Denim Jacket',
    subcategory: 'Denim Jacket',
    color: 'Washed Indigo',
    hexColor: '#4A5C74',
    fabric: 'Cotton Denim',
    fit: 'Relaxed',
    style: 'Classic Casual',
    seasons: ['spring', 'autumn'],
    formality: 'smart_casual',
    layeringRole: 'outer_layer',
    tags: ['Button-Front', 'Classic Wash'],
    pairingNotes: 'Classic layer over graphic tees or poplin shirts.',
    isQuickAddSample: true
  },

  // ==================== MEN — ACCESSORIES ====================
  {
    id: 'black_90s_sunglasses',
    profile: 'men',
    category: 'accessories',
    name: 'Black 90s Sunglasses',
    subcategory: 'Sunglasses',
    color: 'Black',
    hexColor: '#1A1817',
    fabric: 'Acetate',
    fit: 'One Size',
    style: 'Retro',
    seasons: ['spring', 'summer'],
    formality: 'casual',
    tags: ['Retro', 'Statement'],
    pairingNotes: 'A retro accent that finishes a casual streetwear look.'
  },
  {
    id: 'black_fisherman_beanie',
    profile: 'men',
    category: 'accessories',
    name: 'Black Fisherman Beanie',
    subcategory: 'Headwear',
    color: 'Black',
    hexColor: '#1A1817',
    fabric: 'Wool Rib Knit',
    fit: 'One Size',
    style: 'Cold-Weather Classic',
    seasons: ['autumn', 'winter'],
    formality: 'casual',
    tags: ['Cuffed', 'Cold Weather'],
    pairingNotes: 'Finishes a cold-weather look without competing for attention.',
    isQuickAddSample: true
  },
  {
    id: 'black_sling_bag',
    profile: 'men',
    category: 'accessories',
    name: 'Black Sling Bag',
    subcategory: 'Sling Bag',
    color: 'Black',
    hexColor: '#1A1817',
    fabric: 'Leather',
    fit: 'One Size',
    style: 'Refined Minimalist',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    formality: 'smart_casual',
    tags: ['Crossbody', 'Refined'],
    pairingNotes: 'A clean crossbody that refines any casual outfit.'
  },
  {
    id: 'charcoal_utility_sling',
    profile: 'men',
    category: 'accessories',
    name: 'Charcoal Utility Sling',
    subcategory: 'Sling Bag',
    color: 'Charcoal',
    hexColor: '#3A3F47',
    fabric: 'Technical Nylon',
    fit: 'One Size',
    style: 'Utility Streetwear',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    formality: 'casual',
    tags: ['Crossbody', 'Utility'],
    pairingNotes: 'A technical crossbody that suits cargo-led outfits.'
  },
  {
    id: 'cream_fisherman_beanie',
    profile: 'men',
    category: 'accessories',
    name: 'Cream Fisherman Beanie',
    subcategory: 'Headwear',
    color: 'Cream',
    hexColor: '#F5EFE3',
    fabric: 'Wool Rib Knit',
    fit: 'One Size',
    style: 'Cold-Weather Classic',
    seasons: ['autumn', 'winter'],
    formality: 'casual',
    tags: ['Cuffed', 'Cold Weather'],
    pairingNotes: 'A soft neutral that finishes a cold-weather look.'
  },
  {
    id: 'crescent_hobo_bag',
    profile: 'men',
    category: 'accessories',
    name: 'Crescent Hobo Bag',
    subcategory: 'Hobo Bag',
    color: 'Black',
    hexColor: '#1A1817',
    fabric: 'Technical Nylon',
    fit: 'One Size',
    style: 'Refined Minimalist',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    formality: 'casual',
    tags: ['Crescent Shape', 'Everyday'],
    pairingNotes: 'A relaxed, everyday carry that pairs with any casual look.'
  },
  {
    id: 'crossbody_sling_bag',
    profile: 'men',
    category: 'accessories',
    name: 'Crossbody Sling Bag',
    subcategory: 'Crossbody Bag',
    color: 'Espresso Brown',
    hexColor: '#3E2A1E',
    fabric: 'Leather',
    fit: 'One Size',
    style: 'Refined Minimalist',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    formality: 'smart_casual',
    tags: ['Crossbody', 'Refined'],
    pairingNotes: 'A refined leather crossbody for a smart-casual finish.'
  },
  {
    id: 'olive_fisherman_beanie',
    profile: 'men',
    category: 'accessories',
    name: 'Olive Fisherman Beanie',
    subcategory: 'Headwear',
    color: 'Olive',
    hexColor: '#5C5A48',
    fabric: 'Wool Rib Knit',
    fit: 'One Size',
    style: 'Cold-Weather Classic',
    seasons: ['autumn', 'winter'],
    formality: 'casual',
    tags: ['Cuffed', 'Cold Weather'],
    pairingNotes: 'A utility-toned beanie that suits cargo-led looks.'
  },
  {
    id: 'olive_sling_bag',
    profile: 'men',
    category: 'accessories',
    name: 'Olive Sling Bag',
    subcategory: 'Sling Bag',
    color: 'Olive',
    hexColor: '#5C5A48',
    fabric: 'Technical Nylon',
    fit: 'One Size',
    style: 'Utility Streetwear',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    formality: 'casual',
    tags: ['Crossbody', 'Utility'],
    pairingNotes: 'A technical crossbody that suits cargo-led outfits.'
  },
  {
    id: 'structured_utility_shoulder_bag',
    profile: 'men',
    category: 'accessories',
    name: 'Structured Utility Shoulder Bag',
    subcategory: 'Shoulder Bag',
    color: 'Black',
    hexColor: '#1A1817',
    fabric: 'Technical Nylon',
    fit: 'One Size',
    style: 'Technical Utility',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    formality: 'casual',
    tags: ['Structured', 'Technical'],
    pairingNotes: 'A technical shoulder bag that anchors a streetwear look.'
  },
  {
    id: 'tortoise_90s_sunglasses',
    profile: 'men',
    category: 'accessories',
    name: 'Tortoise 90s Sunglasses',
    subcategory: 'Sunglasses',
    color: 'Tortoise Brown',
    hexColor: '#6B4A2E',
    fabric: 'Acetate',
    fit: 'One Size',
    style: 'Retro',
    seasons: ['spring', 'summer'],
    formality: 'casual',
    tags: ['Retro', 'Tortoiseshell'],
    pairingNotes: 'A warm-toned retro accent for a casual look.'
  },

  // ==================== WOMEN — TOPS ====================
  {
    id: 'cropped_boxy_tshirt',
    profile: 'women',
    category: 'tops',
    name: 'Cropped Boxy T-Shirt',
    subcategory: 'Graphic T-Shirt',
    color: 'Charcoal',
    hexColor: '#3A3F47',
    fabric: 'Cotton Jersey',
    fit: 'Cropped',
    style: 'Streetwear Casual',
    seasons: ['spring', 'summer'],
    formality: 'casual',
    layeringRole: 'primary_layer',
    tags: ['Cropped', 'Boxy', 'Graphic Print'],
    pairingNotes: 'Balances high-waisted bottoms with an easy, boxy silhouette.'
  },
  {
    id: 'cropped_button_up_shirt',
    profile: 'women',
    category: 'tops',
    name: 'Cropped Button-Up Shirt',
    subcategory: 'Button-Up Shirt',
    color: 'White',
    hexColor: '#F2F0EA',
    fabric: 'Cotton Poplin',
    fit: 'Cropped',
    style: 'Classic Casual',
    seasons: ['spring', 'summer'],
    formality: 'smart_casual',
    layeringRole: 'primary_layer',
    tags: ['Cropped', 'Button-Front'],
    pairingNotes: 'A crisp neutral that layers cleanly under a jacket.',
    isQuickAddSample: true
  },
  {
    id: 'cropped_zip_up_top',
    profile: 'women',
    category: 'tops',
    name: 'Cropped Zip-Up Top',
    subcategory: 'Zip-Up Top',
    color: 'Deep Olive',
    hexColor: '#4A4A32',
    fabric: 'Technical Jersey',
    fit: 'Cropped',
    style: 'Athletic Elevated',
    seasons: ['spring', 'autumn'],
    formality: 'casual',
    layeringRole: 'primary_layer',
    tags: ['Cropped', 'Full Zip', 'Athletic'],
    pairingNotes: 'An elevated athletic top that pairs well with wide-leg bottoms.'
  },
  {
    id: 'fitted_ribbed_tank_top',
    profile: 'women',
    category: 'tops',
    name: 'Fitted Ribbed Tank Top',
    subcategory: 'Tank Top',
    color: 'Black',
    hexColor: '#1A1817',
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
    id: 'satin_cowl_neck_top',
    profile: 'women',
    category: 'tops',
    name: 'Satin Cowl-Neck Top',
    subcategory: 'Cowl-Neck Cami',
    color: 'Taupe',
    hexColor: '#B5A99A',
    fabric: 'Satin',
    fit: 'Fitted',
    style: 'Elevated Evening',
    seasons: ['spring', 'summer', 'autumn'],
    formality: 'evening',
    layeringRole: 'primary_layer',
    tags: ['Cowl Neck', 'Fluid Drape'],
    pairingNotes: 'Catches evening light elegantly alongside tailored bottoms.'
  },
  {
    id: 'charcoal_asymmetric_long_sleeve_top',
    profile: 'women',
    category: 'tops',
    name: 'Charcoal Asymmetric Long-Sleeve Top',
    subcategory: 'Asymmetric Top',
    color: 'Charcoal Grey',
    hexColor: '#4A4D52',
    fabric: 'Ribbed Jersey',
    fit: 'Fitted',
    style: 'Modern Minimalist',
    seasons: ['autumn', 'winter'],
    formality: 'smart_casual',
    layeringRole: 'primary_layer',
    tags: ['Asymmetric Neckline', 'Fitted'],
    pairingNotes: 'The asymmetric neckline reads modern against clean tailored bottoms.'
  },
  {
    id: 'ivory_cropped_crew_neck',
    profile: 'women',
    category: 'tops',
    name: 'Ivory Cropped Crew Neck',
    subcategory: 'Crew Neck Knit',
    color: 'Ivory',
    hexColor: '#FAF5EE',
    fabric: 'Fine Merino Rib Knit',
    fit: 'Cropped',
    style: 'Elevated Casual',
    seasons: ['spring', 'autumn'],
    formality: 'smart_casual',
    layeringRole: 'primary_layer',
    tags: ['Cropped', 'Fine Gauge'],
    pairingNotes: 'Balances high-waisted bottoms with clean, elevated proportion.'
  },
  {
    id: 'light_blue_oversized_button_shirt',
    profile: 'women',
    category: 'tops',
    name: 'Light Blue Oversized Button Shirt',
    subcategory: 'Button-Up Shirt',
    color: 'Light Blue',
    hexColor: '#A9C4D9',
    fabric: 'Cotton Poplin',
    fit: 'Oversized',
    style: 'Smart Casual',
    seasons: ['spring', 'summer'],
    formality: 'smart_casual',
    layeringRole: 'primary_layer',
    tags: ['Oversized', 'Button-Front'],
    pairingNotes: 'Layers easily over a tank or wears open over denim.'
  },

  // ==================== WOMEN — BOTTOMS ====================
  {
    id: 'cargo_mini_skirt',
    profile: 'women',
    category: 'bottoms',
    name: 'Cargo Mini Skirt',
    subcategory: 'Mini Skirt',
    color: 'Olive',
    hexColor: '#5C5A48',
    fabric: 'Cotton Twill',
    fit: 'Mini',
    style: 'Utility Streetwear',
    seasons: ['spring', 'summer'],
    formality: 'casual',
    tags: ['Utility Pockets', 'Mini'],
    pairingNotes: 'Grounds a cropped top with a utility-inspired edge.'
  },
  {
    id: 'denim_maxi_skirt',
    profile: 'women',
    category: 'bottoms',
    name: 'Denim Maxi Skirt',
    subcategory: 'Maxi Skirt',
    color: 'Washed Indigo',
    hexColor: '#4A5C74',
    fabric: 'Cotton Denim',
    fit: 'Maxi',
    style: 'Classic Casual',
    seasons: ['spring', 'autumn'],
    formality: 'casual',
    tags: ['Denim', 'Maxi Length'],
    pairingNotes: 'A classic denim silhouette that pairs with a fitted or cropped top.'
  },
  {
    id: 'high_waisted_wide_leg_jeans',
    profile: 'women',
    category: 'bottoms',
    name: 'High-Waisted Wide-Leg Jeans',
    subcategory: 'Jeans',
    color: 'Denim Blue',
    hexColor: '#4A5C74',
    fabric: 'Cotton Denim',
    fit: 'Wide Leg',
    style: 'Tailored Modern',
    seasons: ['autumn', 'spring', 'winter'],
    formality: 'smart_casual',
    tags: ['High Rise', 'Wide Leg'],
    pairingNotes: 'Elongates the silhouette under a cropped or fitted top.',
    isQuickAddSample: true
  },
  {
    id: 'low_rise_straight_leg_jeans',
    profile: 'women',
    category: 'bottoms',
    name: 'Low-Rise Straight-Leg Jeans',
    subcategory: 'Jeans',
    color: 'Denim Blue',
    hexColor: '#4A5C74',
    fabric: 'Cotton Denim',
    fit: 'Straight Leg',
    style: 'Everyday Casual',
    seasons: ['spring', 'autumn'],
    formality: 'casual',
    tags: ['Low Rise', 'Straight Leg'],
    pairingNotes: 'A versatile everyday denim that pairs with nearly any top.'
  },
  {
    id: 'stone_parachute_pants',
    profile: 'women',
    category: 'bottoms',
    name: 'Parachute Pants',
    subcategory: 'Parachute Pants',
    color: 'Stone Grey',
    hexColor: '#9C9990',
    fabric: 'Nylon Shell',
    fit: 'Tapered',
    style: 'Technical Streetwear',
    seasons: ['autumn', 'winter'],
    formality: 'smart_casual',
    tags: ['Cinched Ankle', 'Technical'],
    pairingNotes: 'Cinched ankles pair naturally with chunky sneakers.'
  },
  {
    id: 'pleated_wide_leg_trousers',
    profile: 'women',
    category: 'bottoms',
    name: 'Pleated Wide-Leg Trousers',
    subcategory: 'Trousers',
    color: 'Charcoal Slate',
    hexColor: '#3A3F47',
    fabric: 'Fluid Crepe',
    fit: 'Wide Leg',
    style: 'Tailored Modern',
    seasons: ['autumn', 'spring', 'winter'],
    formality: 'smart_casual',
    tags: ['Pleated', 'Wide Leg'],
    pairingNotes: 'Elongates the silhouette under a cropped or fitted top.'
  },

  // ==================== WOMEN — FOOTWEAR ====================
  {
    id: 'chunky_loafers',
    profile: 'women',
    category: 'shoes',
    name: 'Chunky Loafers',
    subcategory: 'Loafers',
    color: 'Black',
    hexColor: '#1A1817',
    fabric: 'Leather',
    fit: 'True to Size',
    style: 'Everyday Chunky',
    seasons: ['autumn', 'spring', 'winter'],
    formality: 'smart_casual',
    tags: ['Chunky Sole', 'Penny Loafer'],
    pairingNotes: 'Keeps a fluid trouser or skirt grounded and easy.'
  },
  {
    id: 'knee_high_leather_boots',
    profile: 'women',
    category: 'shoes',
    name: 'Knee-High Leather Boots',
    subcategory: 'Knee-High Boots',
    color: 'Espresso Brown',
    hexColor: '#3E2A1E',
    fabric: 'Leather',
    fit: 'True to Size',
    style: 'Tailored Elegance',
    seasons: ['autumn', 'winter'],
    formality: 'smart_casual',
    tags: ['Knee-High', 'Block Heel'],
    pairingNotes: 'Elevates a skirt or trouser for a polished cold-weather look.'
  },
  {
    id: 'minimal_white_sneakers',
    profile: 'women',
    category: 'shoes',
    name: 'Minimal White Sneakers',
    subcategory: 'Sneakers',
    color: 'White',
    hexColor: '#F2F0EA',
    fabric: 'Leather & Rubber Sole',
    fit: 'True to Size',
    style: 'Everyday Minimalist',
    seasons: ['spring', 'summer', 'autumn'],
    formality: 'casual',
    tags: ['Lace-Up', 'Everyday'],
    pairingNotes: 'The neutral finisher that lets a bold top or bottom lead.',
    isQuickAddSample: true
  },
  {
    id: 'retro_runner_sneakers',
    profile: 'women',
    category: 'shoes',
    name: 'Retro Runner Sneakers',
    subcategory: 'Sneakers',
    color: 'Grey Cream',
    hexColor: '#C4C0B4',
    fabric: 'Suede & Mesh',
    fit: 'True to Size',
    style: 'Retro Athletic',
    seasons: ['spring', 'summer', 'autumn'],
    formality: 'casual',
    tags: ['Retro', 'Athletic'],
    pairingNotes: 'A retro athletic finisher for an easy everyday look.'
  },

  // ==================== WOMEN — OUTERWEAR ====================
  {
    id: 'light_wash_denim_jacket',
    profile: 'women',
    category: 'outerwear',
    name: 'Light Wash Denim Jacket',
    subcategory: 'Denim Jacket',
    color: 'Light Wash Denim',
    hexColor: '#A9C4D9',
    fabric: 'Cotton Denim',
    fit: 'Oversized',
    style: 'Classic Casual',
    seasons: ['spring', 'autumn'],
    formality: 'casual',
    layeringRole: 'outer_layer',
    tags: ['Oversized', 'Classic Wash'],
    pairingNotes: 'Layers easily over a tank or fitted knit.',
    isQuickAddSample: true
  },

  // ==================== WOMEN — ACCESSORIES ====================
  {
    id: 'crescent_hobo_bag_petite',
    profile: 'women',
    category: 'accessories',
    name: 'Crescent Hobo Bag',
    subcategory: 'Hobo Bag',
    color: 'Black',
    hexColor: '#1A1817',
    fabric: 'Technical Nylon',
    fit: 'One Size',
    style: 'Refined Minimalist',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    formality: 'casual',
    tags: ['Crescent Shape', 'Everyday'],
    pairingNotes: 'A relaxed, everyday carry that pairs with any casual look.'
  },
  {
    id: 'rectangular_90s_sunglasses',
    profile: 'women',
    category: 'accessories',
    name: 'Rectangular 90s Sunglasses',
    subcategory: 'Sunglasses',
    color: 'Black',
    hexColor: '#1A1817',
    fabric: 'Acetate',
    fit: 'One Size',
    style: 'Retro',
    seasons: ['spring', 'summer'],
    formality: 'casual',
    tags: ['Retro', 'Statement'],
    pairingNotes: 'A retro accent that finishes a casual look.'
  },
  {
    id: 'structured_mini_shoulder_bag',
    profile: 'women',
    category: 'accessories',
    name: 'Structured Mini Shoulder Bag',
    subcategory: 'Shoulder Bag',
    color: 'Burgundy',
    hexColor: '#5E2129',
    fabric: 'Leather',
    fit: 'One Size',
    style: 'Refined Elegance',
    seasons: ['autumn', 'winter'],
    formality: 'smart_casual',
    tags: ['Structured', 'Top Handle'],
    pairingNotes: 'Refines any outfit with a rich, structured accent.',
    isQuickAddSample: true
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
