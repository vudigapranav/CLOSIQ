import { Directory, File } from 'expo-file-system';
import { uuid } from 'expo-modules-core';
import { database, type Row } from './store';
import { photoDir, validPhoto } from './photos';
import { validateRow } from './records';

const MAX_PHOTO_BYTES = 32 * 1024 * 1024;

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

/**
 * The folder picker returns a Storage Access Framework tree on Android
 * (content://…/tree/…). Its children cannot be addressed by joining a path
 * onto that URI, so backups create children with createFile/createDirectory
 * and find them again with list(). Names come from the document URI, which is
 * path-like for folders on the phone's own storage.
 */
export function entryName(entry: File | Directory) {
  const raw = decodeURIComponent(entry.uri.replace(/\/+$/, ''));
  return raw.split(/[/:]/).pop() ?? '';
}
function findEntry<T extends typeof File | typeof Directory>(
  folder: Directory,
  name: string,
  type: T
): InstanceType<T> | undefined {
  return folder.list().find((e) => e instanceof type && entryName(e) === name) as InstanceType<T> | undefined;
}

export async function exportBackup() {
  const destination = await Directory.pickDirectoryAsync();
  const folder = destination.createDirectory('CLOSIQ-' + uuid.v4());
  try {
    const pictures = folder.createDirectory('photos');
    const stored = await (await database()).getAllAsync<Row>('SELECT kind,scope,id,body FROM records');
    const present = new Map<string, boolean>();
    const exists = (name: string) => {
      if (!present.has(name)) present.set(name, new File(photoDir(), name).exists);
      return present.get(name)!;
    };
    // A record whose photo file is gone keeps its data and shows the standard
    // placeholder; one lost photo must not make the whole wardrobe unexportable.
    const rows = stored.map((row) => ({
      ...row,
      body: JSON.stringify(mapPhotoRefs(JSON.parse(row.body), (name) => (exists(name) ? name : '')))
    }));
    let copied = 0;
    for (const [name, ok] of present) {
      if (!ok) continue;
      const source = new File(photoDir(), name);
      pictures.createFile(name, 'image/jpeg').write(await source.bytes());
      copied++;
    }
    // Written last: a folder without wardrobe.json is an incomplete backup.
    folder.createFile('wardrobe.json', 'application/json').write(JSON.stringify({ version: 1, rows }));
    const missing = present.size - copied;
    return (
      'Saved ' +
      rows.length +
      ' records and ' +
      copied +
      ' photos in ' +
      entryName(folder) +
      '.' +
      (missing ? ' ' + missing + ' photos were already missing on this phone.' : '')
    );
  } catch (error) {
    try {
      folder.delete();
    } catch {
      // Keep the original error.
    }
    throw error;
  }
}

export async function restoreBackup() {
  const source = await Directory.pickDirectoryAsync();
  const manifest = findEntry(source, 'wardrobe.json', File);
  if (!manifest || (manifest.size ?? 0) > 32 * 1024 * 1024) throw new Error('Choose a CLOSIQ backup folder.');
  const data = JSON.parse(await manifest.text());
  if (data.version !== 1 || !Array.isArray(data.rows) || data.rows.length > 50000)
    throw new Error('Unsupported backup format.');
  const rows: Row[] = data.rows.map(validateRow);
  const folder = findEntry(source, 'photos', Directory);
  const available = new Map<string, File>();
  for (const entry of folder?.list() ?? []) if (entry instanceof File) available.set(entryName(entry), entry);
  const photos = photoDir();
  photos.create({ idempotent: true, intermediates: true });
  const mapped = new Map<string, File | null>();
  let inserted = 0,
    missing = 0;
  async function restorePhoto(name: string) {
    const input = available.get(name);
    if (!input || (input.size ?? 0) > MAX_PHOTO_BYTES) {
      missing++;
      return null;
    }
    const output = new File(photos, uuid.v4() + '.jpg');
    mapped.set(name, output);
    output.write(await input.bytes());
    return output;
  }
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
        const names = new Set<string>();
        mapPhotoRefs(JSON.parse(row.body), (name) => (names.add(name), name));
        for (const name of names) if (!mapped.has(name)) mapped.set(name, await restorePhoto(name));
        const value = mapPhotoRefs(JSON.parse(row.body), (name) => mapped.get(name)?.name ?? '');
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
    for (const file of mapped.values()) if (file?.exists) file.delete();
    throw error;
  }
  return (
    'Restored ' +
    inserted +
    ' records. Existing records were kept.' +
    (missing ? ' ' + missing + ' photos were missing from the backup and show a placeholder.' : '')
  );
}
