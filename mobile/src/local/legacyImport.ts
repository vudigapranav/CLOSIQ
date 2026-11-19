import { createClient } from '@supabase/supabase-js';
import { File } from 'expo-file-system';
import { uuid } from 'expo-modules-core';
import type { Database, Tables } from '../types/supabase';
import type { GarmentItem, Outfit, WardrobeProfile } from '../../../src/types/wardrobe';
import { checkSupabaseConfig } from '../services/supabaseConfig';
import { database, put, type Kind, type Scope } from './store';
import { rowToGarment, rowToOutfit, rowToEvent, mapLegacyLook } from './cloudRows';
import { photoDir } from './photos';

export async function importLegacy(email: string, password: string, progress: (s: string) => void) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '',
    key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!checkSupabaseConfig(url, key).ok)
    throw new Error('This build needs V1 Supabase settings for account import.');
  const client = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error('Could not sign in to the V1 account.');
  const uid = data.user.id,
    db = await database();
  let completed = 0,
    missingPhotos = 0;
  const prefix = 'v1:' + uid + ':';
  const already = async (kind: Kind, scope: Scope, id: string) =>
    !!(await db.getFirstAsync(
      'SELECT id FROM records WHERE kind=? AND scope=? AND id=?',
      'migration',
      'device',
      [kind, scope, id].join('|')
    ));
  const save = async (kind: Kind, scope: Scope, id: string, value: unknown) => {
    await db.withExclusiveTransactionAsync(async (tx) => {
      await put(kind, scope, id, value, tx);
      await put('migration', 'device', [kind, scope, id].join('|'), { localId: id }, tx);
    });
    completed++;
    progress('Imported ' + completed + ' new records.');
  };
  const originals = new Map<string, GarmentItem[]>();
  async function addGarment(row: Tables<'garments'>) {
    if (row.wardrobe_profile !== 'men' && row.wardrobe_profile !== 'women')
      throw new Error('Unknown legacy wardrobe profile.');
    const scope: WardrobeProfile = row.wardrobe_profile,
      id = prefix + scope + ':' + row.garment_id;
    let garment: GarmentItem | undefined;
    if (await already('garment', scope, id)) {
      const found = await db.getFirstAsync<{ body: string }>(
        "SELECT body FROM records WHERE kind='garment' AND scope=? AND id=?",
        scope,
        id
      );
      if (found) garment = JSON.parse(found.body);
    } else {
      const folder = photoDir();
      folder.create({ idempotent: true, intermediates: true });
      let imageUrl = '';
      if (row.storage_path) {
        if (!row.storage_path.startsWith(uid + '/')) throw new Error('Unexpected legacy photo owner.');
        const signed = await client.storage.from('garment-images').createSignedUrl(row.storage_path, 120);
        if (signed.error || !signed.data)
          throw new Error('Could not authorize photo download. Retry to resume.');
        const dest = new File(folder, uuid.v4() + '.jpg');
        try {
          await File.downloadFileAsync(signed.data.signedUrl, dest);
          imageUrl = dest.name;
        } catch (e) {
          if (dest.exists) dest.delete();
          throw e;
        }
      } else if (row.image_url) missingPhotos++;
      garment = { ...rowToGarment(row, imageUrl), id, profile: scope };
      try {
        await save('garment', scope, id, garment);
      } catch (e) {
        if (imageUrl) new File(folder, imageUrl).delete();
        throw e;
      }
    }
    if (garment) originals.set(row.garment_id, [...(originals.get(row.garment_id) ?? []), garment]);
  }
  const mapLook = (look: Outfit) => mapLegacyLook(look, originals, prefix);
  try {
    for (const table of ['garments', 'saved_outfits', 'planner_events'] as const) {
      for (let offset = 0; ; offset += 100) {
        const result = await client
          .from(table)
          .select('*')
          .eq('user_id', uid)
          .order('id')
          .range(offset, offset + 99);
        if (result.error) throw new Error('Could not read ' + table + '. Retry to resume.');
        for (const row of result.data) {
          if ('garment_id' in row) await addGarment(row);
          else if ('outfit_id' in row) {
            const look = mapLook(rowToOutfit(row));
            if (!(await already('look', 'device', look.id))) await save('look', 'device', look.id, look);
          } else if ('event_id' in row) {
            const event = rowToEvent(row),
              id = prefix + 'event:' + event.id;
            if (!(await already('event', 'device', id)))
              await save('event', 'device', id, {
                ...event,
                id,
                outfit: event.outfit && mapLook(event.outfit)
              });
          }
        }
        if (result.data.length < 100) break;
      }
    }
  } finally {
    await client.auth.signOut({ scope: 'local' });
  }
  return (
    'Imported ' + completed + ' records. ' + missingPhotos + ' catalog photos lacked a private storage file.'
  );
}
