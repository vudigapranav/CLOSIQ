/**
 * A minimal stand-in for the Supabase JS client, shaped to the exact
 * builder chains the CLOSIQ storage modules use (`.from().select().eq()
 * .order()`, `.insert()`, `.update().eq()`, `.upsert()`, `.delete().eq()`,
 * `.maybeSingle()`, and the storage bucket's upload/sign/remove).
 *
 * Each test supplies one `resolve` function that sees the whole recorded
 * chain and decides what that call returns — which is what lets a test say
 * "the DB delete fails" or "this insert succeeds" without touching the real
 * project, and without spending any Gemini quota.
 */
export interface TableCall {
  table: string;
  op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' | null;
  payload: unknown;
  filters: unknown[][];
  single: boolean;
}

export interface SupabaseResult {
  data?: unknown;
  error?: unknown;
  count?: number;
}

export interface StorageCall {
  bucket: string;
  op: 'upload' | 'createSignedUrl' | 'createSignedUrls' | 'remove';
  args: unknown[];
}

export interface FakeSupabaseOptions {
  onTable?: (call: TableCall) => SupabaseResult | Promise<SupabaseResult>;
  onStorage?: (call: StorageCall) => SupabaseResult | Promise<SupabaseResult>;
}

export interface FakeSupabase {
  client: unknown;
  /** Every table call made, in the order the code made them. */
  tableCalls: TableCall[];
  /** Every storage call made, in order. */
  storageCalls: StorageCall[];
  /**
   * Table AND storage calls interleaved in the order they RESOLVED, e.g.
   * `garments.delete`, `storage.remove`. Ordering assertions use this.
   */
  sequence: string[];
}

export function createFakeSupabase(options: FakeSupabaseOptions = {}): FakeSupabase {
  const tableCalls: TableCall[] = [];
  const storageCalls: StorageCall[] = [];
  const sequence: string[] = [];

  const onTable = options.onTable ?? (() => ({ data: [], error: null }));
  const onStorage = options.onStorage ?? (() => ({ data: null, error: null }));

  function chain(table: string) {
    const call: TableCall = { table, op: null, payload: null, filters: [], single: false };
    tableCalls.push(call);

    const api: Record<string, unknown> = {};
    const setOp = (op: TableCall['op']) => (...args: unknown[]) => {
      call.op = op;
      call.payload = args[0];
      return api;
    };
    api.select = setOp('select');
    api.insert = setOp('insert');
    api.update = setOp('update');
    api.upsert = setOp('upsert');
    api.delete = setOp('delete');

    for (const modifier of ['eq', 'order', 'limit', 'range', 'in']) {
      api[modifier] = (...args: unknown[]) => {
        call.filters.push([modifier, ...args]);
        return api;
      };
    }
    api.maybeSingle = () => {
      call.single = true;
      return api;
    };

    // Thenable, so `await supabase.from(...)...` resolves exactly as the
    // real PostgREST builder does.
    api.then = (
      resolve: (value: SupabaseResult) => unknown,
      reject: (reason: unknown) => unknown
    ) =>
      Promise.resolve(onTable(call))
        .then((result) => {
          sequence.push(`${table}.${call.op}`);
          return result;
        })
        .then(resolve, reject);

    return api;
  }

  function bucket(name: string) {
    const record = async (op: StorageCall['op'], args: unknown[]) => {
      const call: StorageCall = { bucket: name, op, args };
      storageCalls.push(call);
      const result = await onStorage(call);
      sequence.push(`storage.${op}`);
      return result;
    };
    return {
      upload: (...args: unknown[]) => record('upload', args),
      createSignedUrl: (...args: unknown[]) => record('createSignedUrl', args),
      createSignedUrls: (...args: unknown[]) => record('createSignedUrls', args),
      remove: (...args: unknown[]) => record('remove', args)
    };
  }

  return {
    client: { from: chain, storage: { from: bucket } },
    tableCalls,
    storageCalls,
    sequence
  };
}

/** Resolves once every pending microtask/timer callback has drained — the
 *  mocked Alert fires its button callback on a timer, matching a device. */
export function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
