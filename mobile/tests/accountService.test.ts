import './helpers/installMocks';
import { setSupabase, store } from './helpers/installMocks';
import test from 'node:test';
import assert from 'node:assert/strict';

import { deleteMyAccount, getAiPhotoConsent, setAiPhotoConsent, AI_PHOTO_CONSENT_KEY } from '../src/services/accountService';

test('deleteMyAccount does nothing and reports not_enabled when the RPC is missing', async () => {
  let signedOut = false;
  setSupabase({
    rpc: async () => ({ error: { code: 'PGRST202', message: 'function not found' } }),
    auth: {
      signOut: async () => {
        signedOut = true;
        return { error: null };
      }
    }
  });
  const res = await deleteMyAccount();
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.reason, 'not_enabled');
  assert.equal(signedOut, false);
});

test('Postgres 42883 is also treated as a missing RPC', async () => {
  setSupabase({ rpc: async () => ({ error: { code: '42883' } }), auth: { signOut: async () => ({ error: null }) } });
  const res = await deleteMyAccount();
  assert.equal(res.ok === false && res.reason, 'not_enabled');
});

test('deleteMyAccount signs out after the RPC succeeds', async () => {
  let signedOut = false;
  setSupabase({
    rpc: async () => ({ error: null }),
    auth: {
      signOut: async () => {
        signedOut = true;
        return { error: null };
      }
    }
  });
  assert.deepEqual(await deleteMyAccount(), { ok: true });
  assert.equal(signedOut, true);
});

test('AI photo consent defaults on and persists', async () => {
  store.clear();
  setSupabase({ from: () => ({ update: () => ({ eq: async () => { throw new Error('no column'); } }) }) });
  assert.equal(await getAiPhotoConsent(), true);
  await setAiPhotoConsent(false);
  assert.equal(store.get(AI_PHOTO_CONSENT_KEY), 'false');
  assert.equal(await getAiPhotoConsent(), false);
  await setAiPhotoConsent(true);
  assert.equal(await getAiPhotoConsent(), true);
});
