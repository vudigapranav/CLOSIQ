import { uuid } from 'expo-modules-core';
import { Directory, File, Paths } from 'expo-file-system';
import type { GarmentItem, Outfit } from '../../../src/types/wardrobe';

export const photoDir = () => new Directory(Paths.document, 'closiq-wardrobe-v2');
export const validPhoto = (name: string) => /^[a-f0-9-]{36}\.jpg$/.test(name);
// expo-file-system 57: File.copy() is asynchronous. The record must only be
// written after the copy has finished, so the caller awaits this.
export async function stagePhoto(uri: string) {
  if (!uri) return '';
  if (!uri.startsWith('file://')) throw new Error('Choose a local photograph.');
  const folder = photoDir();
  folder.create({ intermediates: true, idempotent: true });
  const target = new File(folder, uuid.v4() + '.jpg');
  try {
    await new File(uri).copy(target);
    if (!target.exists) throw new Error('The photo could not be saved on this phone.');
  } catch (error) {
    if (target.exists) target.delete();
    throw error;
  }
  return target.name;
}

export function showGarment(item: GarmentItem): GarmentItem {
  const photo = validPhoto(item.imageUrl) ? new File(photoDir(), item.imageUrl) : undefined;
  return { ...item, imageUrl: photo?.exists ? photo.uri : '' };
}

export function storeOutfit(outfit: Outfit): Outfit {
  return {
    ...outfit,
    items: outfit.items.map((item) => {
      const name = item.imageUrl.split('/').pop() ?? '';
      return { ...item, imageUrl: validPhoto(name) ? name : '' };
    })
  };
}
export const showOutfit = (o: Outfit): Outfit => ({ ...o, items: o.items.map(showGarment) });
