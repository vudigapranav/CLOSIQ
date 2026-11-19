import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

export type Kind =
  | 'garment'
  | 'look'
  | 'event'
  | 'history'
  | 'feedback'
  | 'settings'
  | 'profile'
  | 'migration';
export type Scope = 'device' | 'men' | 'women';
export type Row = { kind: Kind; scope: Scope; id: string; body: string };
let connection: Promise<SQLiteDatabase> | undefined;

export const schema = `
  CREATE TABLE IF NOT EXISTS records (
    kind TEXT NOT NULL, scope TEXT NOT NULL, id TEXT NOT NULL,
    body TEXT NOT NULL CHECK(json_valid(body)),
    PRIMARY KEY(kind, scope, id)
  );
  PRAGMA user_version = 1;
`;

async function open() {
  const db = await openDatabaseAsync('closiq-device-v2.db');
  try {
    await db.execAsync('PRAGMA journal_mode=WAL');
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if (version?.user_version === 0) await db.withExclusiveTransactionAsync((tx) => tx.execAsync(schema));
    else if (version?.user_version !== 1) throw new Error('Update CLOSIQ to read this wardrobe.');
    return db;
  } catch (error) {
    await db.closeAsync();
    throw error;
  }
}

export function database() {
  return (connection ??= open().catch((error) => {
    connection = undefined;
    throw error;
  }));
}

export async function list<T>(kind: Kind, scope: Scope = 'device'): Promise<T[]> {
  const rows = await (
    await database()
  ).getAllAsync<{ body: string }>(
    'SELECT body FROM records WHERE kind=? AND scope=? ORDER BY rowid DESC',
    kind,
    scope
  );
  return rows.map((row) => JSON.parse(row.body) as T);
}

export async function put(kind: Kind, scope: Scope, id: string, value: unknown, tx?: SQLiteDatabase) {
  await (tx ?? (await database())).runAsync(
    'INSERT INTO records(kind,scope,id,body) VALUES(?,?,?,?) ON CONFLICT(kind,scope,id) DO UPDATE SET body=excluded.body',
    kind,
    scope,
    id,
    JSON.stringify(value)
  );
}

export async function drop(kind: Kind, scope: Scope, id: string) {
  await (await database()).runAsync('DELETE FROM records WHERE kind=? AND scope=? AND id=?', kind, scope, id);
}

export async function merge<T extends object>(
  kind: Kind,
  scope: Scope,
  id: string,
  patch: Partial<T>,
  defaults?: T
) {
  let result: T | undefined;
  await (
    await database()
  ).withExclusiveTransactionAsync(async (tx) => {
    const row = await tx.getFirstAsync<{ body: string }>(
      'SELECT body FROM records WHERE kind=? AND scope=? AND id=?',
      kind,
      scope,
      id
    );
    if (!row && !defaults) return;
    result = { ...defaults, ...(row ? JSON.parse(row.body) : {}), ...patch };
    await put(kind, scope, id, result, tx);
  });
  return result;
}
