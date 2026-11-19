// Regression tests for the 2026-11-19 independent review of the V2 on-device
// storage. The shipping modules run unmodified against real SQLite and an
// fs-backed expo-file-system (see helpers/nativeV2Mocks.ts).
import { controls, installNativeMocks } from './helpers/nativeV2Mocks';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { GarmentItem, Outfit } from '../../src/types/wardrobe';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'closiq-v2-storage-'));
const { sql, documents, cache } = installNativeMocks(root);
const photoFolder = path.join(documents, 'closiq-wardrobe-v2');
const photoFiles = () => (fs.existsSync(photoFolder) ? fs.readdirSync(photoFolder).sort() : []);
const body = (id: string) =>
  JSON.parse((sql.prepare("SELECT body FROM records WHERE id=?").get(id) as { body: string }).body);
const count = () => (sql.prepare('SELECT COUNT(*) AS n FROM records').get() as { n: number }).n;

const base: GarmentItem = {
  id: 'g1',
  name: 'Blue shirt',
  category: 'tops',
  subcategory: 'shirt',
  color: 'blue',
  hexColor: '#002277',
  fabric: 'unknown',
  seasons: ['summer'],
  formality: 'casual',
  imageUrl: '',
  favorite: false,
  wearCount: 0,
  dateAdded: '2026-11-19',
  tags: []
};
function pickedPhoto(name: string, content = 'jpeg:' + name) {
  const file = path.join(cache, name);
  fs.writeFileSync(file, content);
  return 'file://' + file;
}

test('a garment is stored only after its photo copy has finished', async () => {
  const { saveUserGarment } = await import('../src/services/wardrobeStorage.native');
  const saved = await saveUserGarment({ ...base, imageUrl: pickedPhoto('pick.jpg') }, 'men');
  const name = body('g1').imageUrl as string;
  assert.match(name, /^[a-f0-9-]{36}\.jpg$/);
  assert.equal(fs.readFileSync(path.join(photoFolder, name), 'utf8'), 'jpeg:pick.jpg');
  // The wardrobe returned to the screen already shows the copied photo.
  assert.ok(saved.items[0].imageUrl.endsWith(name));

  const before = photoFiles();
  controls.failCopy = (n) => n === 'bad.jpg';
  await assert.rejects(saveUserGarment({ ...base, id: 'g2', imageUrl: pickedPhoto('bad.jpg') }, 'men'));
  controls.failCopy = () => false;
  assert.equal(sql.prepare("SELECT id FROM records WHERE id='g2'").get(), undefined);
  assert.deepEqual(photoFiles(), before);
});

test('backup and restore work through an Android picked folder, keep records with a missing photo, and roll back', async () => {
  const { saveUserGarment } = await import('../src/services/wardrobeStorage.native');
  const { saveOutfitToStorage } = await import('../src/services/savedOutfitsStorage.native');
  const { put } = await import('../src/local/store');
  const { exportBackup, restoreBackup } = await import('../src/local/backup');
  const shown = await saveUserGarment(
    { ...base, id: 'g3', name: 'Trousers', category: 'bottoms', imageUrl: pickedPhoto('trousers.jpg') },
    'men'
  );
  const look: Outfit = {
    id: 'look1',
    title: 'Dinner',
    occasion: 'dinner',
    vibe: 'calm',
    formalityLabel: 'Casual',
    items: shown.items,
    styleScore: 0,
    explanation: { summary: 'Works.' } as Outfit['explanation'],
    saved: true,
    dateCreated: '2026-11-19'
  };
  await saveOutfitToStorage(look);
  // A record whose photo file has disappeared from the phone.
  await put('garment', 'women', 'lost', { ...base, id: 'lost', imageUrl: '00000000-0000-4000-8000-000000000000.jpg' });

  const exportRoot = path.join(root, 'export');
  fs.mkdirSync(exportRoot);
  controls.pickedPath = exportRoot;
  const exported = await exportBackup();
  assert.match(exported, /Saved 4 records and 2 photos/);
  assert.match(exported, /1 photos were already missing/);
  const [folderName] = fs.readdirSync(exportRoot);
  const backupFolder = path.join(exportRoot, folderName);
  const manifest = JSON.parse(fs.readFileSync(path.join(backupFolder, 'wardrobe.json'), 'utf8'));
  assert.equal(JSON.parse(manifest.rows.find((r: { id: string }) => r.id === 'lost').body).imageUrl, '');
  assert.equal(fs.readdirSync(path.join(backupFolder, 'photos')).length, 2);

  // A fresh install: no records, no photos.
  sql.exec('DELETE FROM records');
  fs.rmSync(photoFolder, { recursive: true });
  controls.pickedPath = backupFolder;

  // A failed restore leaves neither records nor copied photos behind.
  const lastPhoto = JSON.parse(manifest.rows.find((r: { id: string }) => r.id === 'g3').body).imageUrl;
  controls.failBytes = (n) => n === lastPhoto;
  await assert.rejects(restoreBackup());
  controls.failBytes = () => false;
  assert.equal(count(), 0);
  assert.deepEqual(photoFiles(), []);

  assert.match(await restoreBackup(), /Restored 4 records/);
  assert.equal(count(), 4);
  const g1 = body('g1').imageUrl,
    g3 = body('g3').imageUrl;
  assert.ok(fs.existsSync(path.join(photoFolder, g1)) && fs.existsSync(path.join(photoFolder, g3)));
  // Restored photos get new names, so a restore can never overwrite a local photo.
  assert.notEqual(g1, JSON.parse(manifest.rows.find((r: { id: string }) => r.id === 'g1').body).imageUrl);
  // The saved look points at the same restored files as the garments.
  assert.deepEqual(new Set(body('look1').items.map((i: GarmentItem) => i.imageUrl)), new Set([g1, g3]));
  assert.equal(body('lost').imageUrl, '');
  const files = photoFiles();
  assert.equal(files.length, 2);

  // Restoring the same folder again changes nothing.
  assert.match(await restoreBackup(), /Restored 0 records/);
  assert.deepEqual(photoFiles(), files);

  // A photo deleted from the backup folder restores its record with a placeholder.
  sql.exec("DELETE FROM records WHERE id='g3'");
  fs.rmSync(path.join(backupFolder, 'photos', lastPhoto));
  assert.match(await restoreBackup(), /Restored 1 records.*1 photos were missing/);
  assert.equal(body('g3').imageUrl, '');
});

test('model JSON may be wrapped in prose or a fence, but every field is still checked', async () => {
  const { validateGarment, validateRanking } = await import('../src/local/validation');
  const garment = { name: 'Blue kurta {long}', category: 'tops', primaryColor: 'blue', formality: 'casual' };
  assert.equal(validateGarment('Here is the JSON:\n```json\n' + JSON.stringify(garment) + '\n```').name, 'Blue kurta {long}');
  assert.deepEqual(validateRanking('Sure! {"choice": 2, "explanation": "Smart \\"and\\" warm"} Hope that helps.', 2), {
    index: 1,
    explanation: 'Smart "and" warm'
  });
  assert.throws(() => validateGarment('{"name":"Blue kurta","category":"tops"'));
  assert.throws(() => validateRanking('Pick: {"choice":1,"garmentIds":["fake"],"explanation":"ok"}', 2));
  assert.throws(() => validateGarment('I think it is a shirt.'));
});

test('an ambiguous V1 look reference keeps its snapshot instead of blocking the import', async () => {
  const { mapLegacyLook } = await import('../src/local/cloudRows');
  const men = { ...base, id: 'v1:u:men:tee', profile: 'men' as const, imageUrl: 'a.jpg' };
  const women = { ...base, id: 'v1:u:women:tee', profile: 'women' as const, imageUrl: 'b.jpg' };
  const originals = new Map([['tee', [men, women]], ['shirt', [{ ...men, id: 'v1:u:men:shirt' }]]]);
  const look = {
    id: 'l',
    items: [
      { ...base, id: 'tee', imageUrl: 'https://cloud/x.jpg' },
      { ...base, id: 'tee', profile: 'women' as const },
      { ...base, id: 'shirt' },
      { ...base, id: 'gone' }
    ]
  } as unknown as Outfit;
  const mapped = mapLegacyLook(look, originals, 'v1:u:');
  assert.deepEqual(
    mapped.items.map((i) => [i.id, i.imageUrl]),
    [
      ['v1:u:archived:tee', ''],
      ['v1:u:women:tee', 'b.jpg'],
      ['v1:u:men:shirt', 'a.jpg'],
      ['v1:u:archived:gone', '']
    ]
  );
  assert.equal(mapped.id, 'v1:u:look:l');
});
