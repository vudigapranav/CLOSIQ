import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Module from 'node:module';
import { validateGarment, validateRanking } from '../src/local/validation';
import { validateRow } from '../src/local/records';

// Run the shipping SQL on a real file. The adapter only translates Expo's async
// signatures into Node SQLite equivalents. There is no simulated database.
test('SQLite migration, independent profiles, updates, rollback and restart', async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'closiq-sql-')), 'wardrobe.db');
  const sql = new DatabaseSync(file);
  const adapter = {
    execAsync: async (s: string) => {
      sql.exec(s);
    },
    runAsync: async (s: string, ...v: string[]) => sql.prepare(s).run(...v),
    getAllAsync: async (s: string, ...v: string[]) => sql.prepare(s).all(...v),
    getFirstAsync: async (s: string, ...v: string[]) => sql.prepare(s).get(...v),
    withExclusiveTransactionAsync: async (f: (tx: unknown) => Promise<void>) => {
      sql.exec('BEGIN IMMEDIATE');
      try {
        await f(adapter);
        sql.exec('COMMIT');
      } catch (e) {
        sql.exec('ROLLBACK');
        throw e;
      }
    }
  };
  const loader = Module as unknown as { _load: (name: string, ...rest: unknown[]) => unknown };
  const original = loader._load;
  loader._load = function (name, ...rest) {
    return name === 'expo-sqlite'
      ? { openDatabaseAsync: async () => adapter }
      : original.call(this, name, ...rest);
  };
  try {
    const store = await import('../src/local/store');
    await store.put('garment', 'men', 'a', { name: 'Kurta' });
    await store.put('garment', 'women', 'a', { name: 'Saree' });
    await store.merge('garment', 'men', 'a', { name: 'White kurta' });
    assert.deepEqual(await store.list('garment', 'men'), [{ name: 'White kurta' }]);
    assert.deepEqual(await store.list('garment', 'women'), [{ name: 'Saree' }]);
    const db = await store.database();
    await assert.rejects(
      db.withExclusiveTransactionAsync(async (tx) => {
        await store.put('event', 'device', 'dinner', { title: 'Dinner' }, tx);
        throw new Error('interrupted import');
      })
    );
    assert.deepEqual(await store.list('event'), []);
    await store.drop('garment', 'men', 'a');
    sql.close();
    const restarted = new DatabaseSync(file);
    assert.equal(restarted.prepare('PRAGMA user_version').get()?.user_version, 1);
    assert.equal(restarted.prepare('SELECT COUNT(*) AS n FROM records').get()?.n, 1);
    assert.equal(restarted.prepare('SELECT scope FROM records').get()?.scope, 'women');
    restarted.close();
  } finally {
    loader._load = original;
  }
});

test('local model output must identify a valid garment', () => {
  const result = validateGarment(
    JSON.stringify({
      name: 'Blue kurta',
      category: 'tops',
      primaryColor: 'blue',
      formality: 'casual',
      secondaryColors: ['white']
    })
  );
  assert.equal(result.fabric, 'unknown');
  assert.deepEqual(result.secondaryColors, ['white']);
  assert.throws(() => validateGarment('just guessing'));
  assert.throws(() => validateGarment('{"category":"laptop"}'));
});
test('generated selections can only address one supplied outfit', () => {
  assert.deepEqual(validateRanking('{"choice":2,"explanation":"Works for dinner"}', 2), {
    index: 1,
    explanation: 'Works for dinner'
  });
  for (const raw of [
    '{"choice":1,"garmentIds":["fake"],"explanation":"ok"}',
    '{"choice":3,"explanation":"ok"}',
    '{"choice":1.2,"explanation":"ok"}'
  ])
    assert.throws(() => validateRanking(raw, 2));
  assert.throws(() => validateRanking('{"choice":1,"explanation":"ok"}', 0));
});
test('restore validates data before opening the write transaction', () => {
  assert.throws(() =>
    validateRow({ kind: 'look', id: 'a', scope: 'device', body: '{"title":"incomplete"}' })
  );
  assert.throws(() => validateRow({ kind: 'garment', id: 'a', scope: 'device', body: '{}' }));
  assert.equal(
    validateRow({ kind: 'settings', id: 'onDeviceAnalysis', scope: 'device', body: 'false' }).body,
    'false'
  );
});
