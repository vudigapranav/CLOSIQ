import type { Tables } from '../types/supabase';
import type { GarmentItem, Outfit, WardrobeProfile } from '../../../src/types/wardrobe';
import type { PlannerEvent } from '../types/planner';

export function rowToGarment(row: Tables<'garments'>, imageUrl: string): GarmentItem {
  return {
    id: row.garment_id,
    name: row.name,
    category: row.category as GarmentItem['category'],
    subcategory: row.subcategory,
    color: row.color,
    hexColor: row.hex_color,
    secondaryColors: row.secondary_colors || undefined,
    fabric: row.fabric,
    seasons: (row.seasons as GarmentItem['seasons']) || [],
    formality: row.formality as GarmentItem['formality'],
    // Durable references only (Sprint M20): an uploaded photo's bucket path,
    // signed by refreshGarmentImages() in loadUserWardrobe; a seed photo's
    // `/wardrobe/...` path on the CURRENT API host, however stale the host
    // stored in the row is.
    imageUrl,
    brand: row.brand || undefined,
    favorite: row.favorite,
    wearCount: row.wear_count,
    lastWornDate: row.last_worn_date || undefined,
    dateAdded: row.date_added,
    tags: row.tags || [],
    aiConfidence: row.ai_confidence ?? undefined,
    pairingNotes: row.pairing_notes || undefined,
    fit: row.fit || undefined,
    style: row.style || undefined,
    layeringRole: (row.layering_role as GarmentItem['layeringRole']) || undefined,
    profile: (row.source_profile as WardrobeProfile) || undefined,
    isSeedItem: row.is_seed_item,
    storageLocation: row.storage_location || undefined,
    size: row.size || undefined,
    availability:
      row.availability === 'laundry' || row.availability === 'unavailable' ? row.availability : undefined,
    purchaseDate: row.purchase_date || undefined,
    pattern: row.pattern || undefined,
    collections: row.collections && row.collections.length > 0 ? row.collections : undefined
  };
}

export function rowToOutfit(row: Tables<'saved_outfits'>): Outfit {
  return {
    id: row.outfit_id,
    title: row.title,
    occasion: row.occasion,
    vibe: row.vibe,
    formalityLabel: row.formality_label,
    temperature: row.temperature ?? 0,
    items: (row.items as unknown as Outfit['items']) || [],
    styleScore: row.style_score ?? 0,
    explanation: row.explanation as unknown as Outfit['explanation'],
    saved: true,
    dateCreated: row.date_created,
    wornToday: row.worn_today,
    missingCategories: (row.missing_categories as unknown as Outfit['missingCategories']) || undefined,
    status: row.status === 'worn' ? 'worn' : 'try_later'
  };
}

export function rowToEvent(row: Tables<'planner_events'>): PlannerEvent {
  return {
    id: row.event_id,
    title: row.title,
    date: row.event_date,
    time: row.event_time,
    occasion: row.occasion,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    outfit: (row.outfit as unknown as Outfit) || undefined
  };
}

