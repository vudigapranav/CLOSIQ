import type { Outfit, SavedLookStatus } from '../../../src/types/wardrobe';
import { comboSignature } from '../../../src/services/outfitBrain';
import { database, list, merge, drop, put } from '../local/store';
import { storeOutfit, showOutfit } from '../local/photos';
export const isSameOutfitItems = (a: string[], b: string[]) => comboSignature(a) === comboSignature(b);
export async function loadSavedOutfits() {
  return (await list<Outfit>('look')).map(showOutfit);
}
export async function saveOutfitToStorage(outfit: Outfit) {
  const signature = comboSignature(outfit.items.map((i) => i.id));
  await (
    await database()
  ).withExclusiveTransactionAsync(async (tx) => {
    const rows = await tx.getAllAsync<{ id: string; body: string }>(
      "SELECT id,body FROM records WHERE kind='look' AND scope='device'"
    );
    const same = rows.find(
      (row) => comboSignature((JSON.parse(row.body) as Outfit).items.map((i) => i.id)) === signature
    );
    const id = same?.id ?? outfit.id;
    await put('look', 'device', id, storeOutfit({ ...outfit, id, saved: true }), tx);
  });
  return loadSavedOutfits();
}
export async function removeSavedOutfitFromStorage(id: string) {
  await drop('look', 'device', id);
  return loadSavedOutfits();
}
export async function updateSavedOutfitStatus(id: string, status: SavedLookStatus) {
  await merge<Outfit>('look', 'device', id, { status });
  return loadSavedOutfits();
}
