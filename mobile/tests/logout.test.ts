/**
 * M19 audit — logout failures must reach the caller.
 *
 * auth-js's `_signOut` returns `{ error }` WITHOUT removing the local
 * session when the server call fails (network down, 5xx) — so the user is
 * genuinely still signed in. Before M19, `authService.signOut()` discarded
 * that error and `App.tsx` did nothing, so Log Out silently did nothing.
 * App.tsx's Alert on `ok: false` is React-layer and SOURCE VERIFIED only;
 * this file verifies the service contract it depends on.
 */
import './helpers/installMocks';
import { setSupabase } from './helpers/installMocks';
import test from 'node:test';
import assert from 'node:assert/strict';

import { signOut } from '../src/services/authService';

test('a signOut error is returned as a failure, not swallowed', async () => {
  setSupabase({ auth: { signOut: async () => ({ error: { message: 'Failed to fetch' } }) } });
  const result = await signOut();
  assert.equal(result.ok, false);
  assert.match(result.message ?? '', /connect/i);
});

test('a signOut that throws is returned as a failure, not an unhandled rejection', async () => {
  setSupabase({
    auth: {
      signOut: async () => {
        throw new Error('network request timed out');
      }
    }
  });
  const result = await signOut();
  assert.equal(result.ok, false);
});

test('a successful signOut reports ok', async () => {
  setSupabase({ auth: { signOut: async () => ({ error: null }) } });
  assert.deepEqual(await signOut(), { ok: true });
});
