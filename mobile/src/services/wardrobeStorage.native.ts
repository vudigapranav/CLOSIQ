import {
  type GarmentItem,
  type WardrobeProfile,
  type GarmentDetailsPatch
} from '../../../src/types/wardrobe';
import { normalizeGarmentPatch } from '../../../src/services/garmentEdit';
import { database, drop, list, merge, put } from '../local/store';
import { photoDir, stagePhoto, showGarment } from '../local/photos';
import { File } from 'expo-file-system';

export async function loadUserWardrobe(profile: WardrobeProfile) {
  return (await list<GarmentItem>('garment', profile)).map(showGarment);
}
export async function saveUserGarment(item: GarmentItem, profile: WardrobeProfile) {
  const imageUrl = stagePhoto(item.imageUrl);
  try {
    await put('garment', profile, item.id, { ...item, profile, imageUrl });
  } catch (error) {
    if (imageUrl) new File(photoDir(), imageUrl).delete();
    throw error;
  }
  return { items: await loadUserWardrobe(profile), localSaved: true, cloudSynced: false, imageSynced: false };
}
export async function updateUserGarmentDetails(
  id: string,
  profile: WardrobeProfile,
  patch: GarmentDetailsPatch
) {
  const clean = normalizeGarmentPatch(patch);
  if (Object.keys(clean.errors).length) throw new Error('Check the edited garment attributes.');
  await merge<GarmentItem>('garment', profile, id, clean.patch);
  return loadUserWardrobe(profile);
}
export async function removeUserGarment(id: string, profile: WardrobeProfile) {
  await drop('garment', profile, id);
  // Saved outfits and events keep their own photo references.
  return loadUserWardrobe(profile);
}
export async function recordGarmentsWorn(ids: string[], profile: WardrobeProfile) {
  const today = new Date().toLocaleDateString('en-CA');
  await (
    await database()
  ).withExclusiveTransactionAsync(async (tx) => {
    for (const id of new Set(ids)) {
      await tx.runAsync(
        "UPDATE records SET body=json_set(body,'$.wearCount',COALESCE(json_extract(body,'$.wearCount'),0)+1,'$.lastWornDate',?) WHERE kind='garment' AND scope=? AND id=?",
        today,
        profile,
        id
      );
    }
  });
  return loadUserWardrobe(profile);
}
