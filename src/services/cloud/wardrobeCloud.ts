import { supabase, SUPABASE_URL, GARMENT_IMAGES_BUCKET, SIGNED_URL_TTL_SECONDS } from './supabase';
import { GarmentItem, GarmentDetailsPatch, LayeringPreference, Outfit, WardrobeProfile } from '../../types/wardrobe';
import { normalizeStorageLocation } from '../../data/storageLocations';
import { normalizeSize } from '../../data/garmentSizes';

/**
 * Web cloud data (2026-10-13): the same rows the mobile app reads and writes
 * (mobile/src/services/wardrobeStorage.ts, savedOutfitsStorage.ts,
 * profileSettingsStorage.ts), mapped identically, so both apps share one
 * account. Every query is scoped to the signed-in user and RLS enforces it
 * server-side as well.
 */

type GarmentRow = {
  garment_id: string;
  name: string;
  category: string;
  subcategory: string;
  color: string;
  hex_color: string;
  secondary_colors: string[] | null;
  fabric: string;
  seasons: string[] | null;
  formality: string;
  image_url: string;
  storage_path: string | null;
  brand: string | null;
  favorite: boolean;
  wear_count: number;
  last_worn_date: string | null;
  date_added: string;
  tags: string[] | null;
  ai_confidence: number | null;
  pairing_notes: string | null;
  fit: string | null;
  style: string | null;
  layering_role: string | null;
  source_profile: string | null;
  is_seed_item: boolean;
  storage_location: string | null;
  size: string | null;
};

// ---------- images ----------

const SIGNED_PATH_MARKER = `/storage/v1/object/sign/${GARMENT_IMAGES_BUCKET}/`;

/** Bucket path inside a (possibly expired) signed URL, or null. */
function storagePathFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const at = url.indexOf(SIGNED_PATH_MARKER);
  if (at === -1) return null;
  const rest = url.slice(at + SIGNED_PATH_MARKER.length).split('?')[0];
  try {
    return decodeURIComponent(rest);
  } catch {
    return rest;
  }
}

/** Seed/catalog images live at /wardrobe/... on whatever host serves the app;
 *  older rows stored a LAN host in front of that path. */
function resolveStaticImageUrl(url: string): string {
  const at = url.indexOf('/wardrobe/');
  return at > 0 && /^https?:\/\//.test(url) ? url.slice(at) : url;
}

/** Re-signs every uploaded photo in one batch; leaves other images alone. */
async function refreshImages<T extends { imageUrl: string }>(items: T[]): Promise<T[]> {
  const paths = [...new Set(items.map((i) => storagePathFromUrl(i.imageUrl)).filter((p): p is string => !!p))];
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabase.storage.from(GARMENT_IMAGES_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    for (const entry of data || []) {
      if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
    }
  }
  return items.map((item) => {
    const path = storagePathFromUrl(item.imageUrl);
    if (path) return signed.has(path) ? { ...item, imageUrl: signed.get(path)! } : item;
    return { ...item, imageUrl: resolveStaticImageUrl(item.imageUrl) };
  });
}

/** A data: URL as a JPEG Blob for upload. */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

// ---------- garments ----------

function rowToGarment(row: GarmentRow): GarmentItem {
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
    imageUrl: row.storage_path
      ? `${SUPABASE_URL}${SIGNED_PATH_MARKER}${encodeURI(row.storage_path)}`
      : resolveStaticImageUrl(row.image_url),
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
    size: row.size || undefined
  };
}

export async function loadWardrobe(userId: string, profile: WardrobeProfile): Promise<GarmentItem[]> {
  const { data, error } = await supabase
    .from('garments')
    .select('*')
    .eq('user_id', userId)
    .eq('wardrobe_profile', profile)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return refreshImages(((data || []) as GarmentRow[]).map(rowToGarment));
}

/**
 * Saves a new garment. A photo the user picked arrives as a data: URL and is
 * uploaded to `<userId>/<garmentId>.jpg` in the private bucket first (same
 * convention and RLS policy as mobile). Returns the item as stored.
 */
export async function addGarment(userId: string, profile: WardrobeProfile, item: GarmentItem): Promise<GarmentItem> {
  let imageUrl = item.imageUrl;
  let storagePath: string | null = null;

  if (item.imageUrl.startsWith('data:')) {
    storagePath = `${userId}/${item.id}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(GARMENT_IMAGES_BUCKET)
      .upload(storagePath, await dataUrlToBlob(item.imageUrl), { contentType: 'image/jpeg', upsert: true });
    if (uploadError) throw uploadError;
    const { data: signed } = await supabase.storage
      .from(GARMENT_IMAGES_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    imageUrl = signed?.signedUrl || `${SUPABASE_URL}${SIGNED_PATH_MARKER}${encodeURI(storagePath)}`;
  }

  const { error } = await supabase.from('garments').insert({
    user_id: userId,
    garment_id: item.id,
    wardrobe_profile: profile,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    color: item.color,
    hex_color: item.hexColor,
    secondary_colors: item.secondaryColors || null,
    fabric: item.fabric,
    seasons: item.seasons,
    formality: item.formality,
    image_url: storagePath ? imageUrl : item.imageUrl,
    storage_path: storagePath,
    brand: item.brand || null,
    favorite: item.favorite,
    wear_count: item.wearCount,
    last_worn_date: item.lastWornDate || null,
    date_added: item.dateAdded,
    tags: item.tags,
    ai_confidence: item.aiConfidence ?? null,
    pairing_notes: item.pairingNotes || null,
    fit: item.fit || null,
    style: item.style || null,
    layering_role: item.layeringRole || null,
    source_profile: item.profile || null,
    is_seed_item: item.isSeedItem || false,
    storage_location: normalizeStorageLocation(item.storageLocation) ?? null,
    size: normalizeSize(item.size) ?? null
  });
  if (error) {
    if (storagePath) await supabase.storage.from(GARMENT_IMAGES_BUCKET).remove([storagePath]);
    throw error;
  }
  return { ...item, imageUrl };
}

export async function deleteGarment(userId: string, profile: WardrobeProfile, item: GarmentItem): Promise<void> {
  const { error } = await supabase
    .from('garments')
    .delete()
    .eq('user_id', userId)
    .eq('garment_id', item.id)
    .eq('wardrobe_profile', profile);
  if (error) throw error;
  // Photo cleanup only after the row is gone; seed items never had an upload.
  const path = storagePathFromUrl(item.imageUrl);
  if (path) await supabase.storage.from(GARMENT_IMAGES_BUCKET).remove([path]);
}

export async function updateGarment(
  userId: string,
  profile: WardrobeProfile,
  id: string,
  patch: GarmentDetailsPatch & { wearCount?: number; lastWornDate?: string }
): Promise<void> {
  const row: Record<string, unknown> = {};
  if ('storageLocation' in patch) row.storage_location = normalizeStorageLocation(patch.storageLocation) ?? null;
  if ('size' in patch) row.size = normalizeSize(patch.size) ?? null;
  if (patch.wearCount !== undefined) row.wear_count = patch.wearCount;
  if (patch.lastWornDate !== undefined) row.last_worn_date = patch.lastWornDate;
  if (Object.keys(row).length === 0) return;
  const { error } = await supabase
    .from('garments')
    .update(row)
    .eq('user_id', userId)
    .eq('garment_id', id)
    .eq('wardrobe_profile', profile);
  if (error) throw error;
}

// ---------- saved looks ----------

type OutfitRow = {
  outfit_id: string;
  title: string;
  occasion: string;
  vibe: string;
  formality_label: string;
  temperature: number | null;
  items: unknown;
  style_score: number | null;
  explanation: unknown;
  date_created: string;
  worn_today: boolean;
  missing_categories: string[] | null;
};

export async function loadSavedOutfits(userId: string): Promise<Outfit[]> {
  const { data, error } = await supabase
    .from('saved_outfits')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const outfits = ((data || []) as OutfitRow[]).map(
    (row): Outfit => ({
      id: row.outfit_id,
      title: row.title,
      occasion: row.occasion,
      vibe: row.vibe,
      formalityLabel: row.formality_label,
      temperature: row.temperature ?? 0,
      items: (row.items as GarmentItem[]) || [],
      styleScore: row.style_score ?? 0,
      explanation: row.explanation as Outfit['explanation'],
      saved: true,
      dateCreated: row.date_created,
      wornToday: row.worn_today,
      missingCategories: (row.missing_categories as Outfit['missingCategories']) || undefined
    })
  );
  // Looks embed garment snapshots whose signed URLs expire; re-sign them.
  return Promise.all(outfits.map(async (o) => ({ ...o, items: await refreshImages(o.items) })));
}

export async function saveOutfit(userId: string, outfit: Outfit): Promise<void> {
  const { error } = await supabase.from('saved_outfits').insert({
    user_id: userId,
    outfit_id: outfit.id,
    title: outfit.title,
    occasion: outfit.occasion,
    vibe: outfit.vibe,
    formality_label: outfit.formalityLabel,
    temperature: outfit.temperature,
    items: outfit.items,
    style_score: outfit.styleScore,
    explanation: outfit.explanation,
    date_created: outfit.dateCreated,
    worn_today: outfit.wornToday || false,
    missing_categories: outfit.missingCategories || []
  });
  if (error) throw error;
}

export async function removeOutfit(userId: string, outfitId: string): Promise<void> {
  const { error } = await supabase.from('saved_outfits').delete().eq('user_id', userId).eq('outfit_id', outfitId);
  if (error) throw error;
}

// ---------- preferences ----------

export interface CloudPreferences {
  profile: WardrobeProfile;
  layeringPreference: LayeringPreference;
}

/** null = this account hasn't chosen a wardrobe profile yet (show onboarding). */
export async function loadPreferences(userId: string): Promise<CloudPreferences | null> {
  const { data, error } = await supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    profile: (data.wardrobe_profile as WardrobeProfile) || 'men',
    layeringPreference: (data.layering_preference as LayeringPreference) || 'sometimes'
  };
}

export async function savePreferences(userId: string, prefs: CloudPreferences): Promise<void> {
  const { error } = await supabase.from('user_preferences').upsert(
    { user_id: userId, wardrobe_profile: prefs.profile, layering_preference: prefs.layeringPreference },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}

// ---------- profile basics (name + style preferences) ----------

export interface ProfileBasics {
  name: string;
  stylePreferences: string[];
}

export async function loadProfileBasics(userId: string): Promise<ProfileBasics> {
  const { data, error } = await supabase
    .from('profiles')
    .select('name, style_preferences')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return { name: data?.name || '', stylePreferences: data?.style_preferences || [] };
}

/**
 * Saves only what the web onboarding asks for. Upsert touches just these
 * columns, so body type, skin tone and the mobile app's own
 * onboarding_completed flag are left alone; a blank name never overwrites
 * one set on the phone.
 */
export async function saveProfileBasics(userId: string, basics: ProfileBasics): Promise<void> {
  const row: Record<string, unknown> = { id: userId, style_preferences: basics.stylePreferences };
  if (basics.name) row.name = basics.name;
  const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}
