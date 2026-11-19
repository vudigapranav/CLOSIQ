import { Directory, File } from 'expo-file-system';
import { uuid } from 'expo-modules-core';
import { database, type Row } from './store';
import { photoDir, validPhoto } from './photos';
import { validateRow } from './records';

function mapPhotoRefs(value: unknown, translate: (name: string) => string): unknown {
  if (Array.isArray(value)) return value.map((v) => mapPhotoRefs(v, translate));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => {
        if (key === 'imageUrl') {
          if (v === '') return [key, ''];
          if (typeof v !== 'string' || !validPhoto(v)) throw new Error('Invalid backup photo reference.');
          return [key, translate(v)];
        }
        return [key, mapPhotoRefs(v, translate)];
      })
    );
  }
  return value;
}

export async function exportBackup() {
  const destination = await Directory.pickDirectoryAsync();
  const folder = destination.createDirectory('CLOSIQ-' + uuid.v4());
  const pictures = folder.createDirectory('photos');
  try {
    const rows = await (await database()).getAllAsync<Row>('SELECT kind,scope,id,body FROM records');
    const refs = new Set<string>();
    for (const row of rows)
      mapPhotoRefs(JSON.parse(row.body), (name) => {
        refs.add(name);
        return name;
      });
    for (const name of refs) {
      const file = new File(photoDir(), name);
      if (!file.exists) throw new Error('A referenced wardrobe photo is missing.');
      file.copy(new File(pictures, name));
    }
    folder.createFile('wardrobe.json', 'application/json').write(JSON.stringify({ version: 1, rows }));
    return 'Saved ' + rows.length + ' records and ' + refs.size + ' photos in ' + folder.name + '.';
  } catch (error) {
    folder.delete();
    throw error;
  }
}

export async function restoreBackup() {
  const source = await Directory.pickDirectoryAsync();
  const manifest = new File(source, 'wardrobe.json');
  if (!manifest.exists || manifest.size > 32 * 1024 * 1024) throw new Error('Choose a CLOSIQ backup folder.');
  const data = JSON.parse(await manifest.text());
  if (data.version !== 1 || !Array.isArray(data.rows) || data.rows.length > 50000)
    throw new Error('Unsupported backup format.');
  const rows: Row[] = data.rows.map(validateRow);
  const photos = photoDir();
  photos.create({ idempotent: true, intermediates: true });
  const mapped = new Map<string, File>();
  let inserted = 0;
  try {
    await (
      await database()
    ).withExclusiveTransactionAsync(async (tx) => {
      for (const row of rows) {
        const previous = await tx.getFirstAsync(
          'SELECT id FROM records WHERE kind=? AND scope=? AND id=?',
          row.kind,
          row.scope,
          row.id
        );
        if (previous) continue;
        const value = mapPhotoRefs(JSON.parse(row.body), (name) => {
          if (!mapped.has(name)) {
            const input = new File(source, 'photos', name);
            if (!input.exists || input.size > 32 * 1024 * 1024)
              throw new Error('Missing or oversized backup photo.');
            const output = new File(photos, uuid.v4() + '.jpg');
            mapped.set(name, output);
            input.copy(output);
          }
          return mapped.get(name)!.name;
        });
        await tx.runAsync(
          'INSERT INTO records(kind,scope,id,body) VALUES(?,?,?,?)',
          row.kind,
          row.scope,
          row.id,
          JSON.stringify(value)
        );
        inserted++;
      }
    });
  } catch (error) {
    for (const file of mapped.values()) if (file.exists) file.delete();
    throw error;
  }
  return 'Restored ' + inserted + ' records. Existing records were kept.';
}
