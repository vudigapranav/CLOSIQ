// Regression tests for local model cancellation (2026-11-19 review). The
// native LiteRT-LM bridge returns whatever text it produced when a
// conversation is cancelled; that text must never surface as a finished answer.
import { appStateListeners, installNativeMocks, setNativeVision } from './helpers/nativeV2Mocks';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

installNativeMocks(fs.mkdtempSync(path.join(os.tmpdir(), 'closiq-v2-model-')));

type Pending = { resolve: (v: string) => void };
const calls: string[] = [];
let initGate: Promise<void> = Promise.resolve();
let answering: Pending | null = null;
setNativeVision({
  status: async () => 'installed',
  initialize: async () => {
    calls.push('initialize');
    await initGate;
  },
  answer: (prompt) => {
    calls.push('answer:' + prompt);
    return new Promise((resolve) => (answering = { resolve }));
  },
  cancel: async () => {
    calls.push('cancel');
    answering?.resolve('{"choice": 1, "expl'); // partial text, as the runtime returns it
  },
  unload: async () => {
    calls.push('unload');
  }
});
const tick = () => new Promise((r) => setTimeout(r, 1));

test('a finished answer is returned', async () => {
  const { infer } = await import('../src/local/model');
  const pending = infer('hello');
  await tick();
  answering!.resolve('done');
  assert.equal(await pending, 'done');
});

test('cancelling during initialization stops the generation that would follow', async () => {
  const { infer, cancelGeneration, GenerationCancelled } = await import('../src/local/model');
  let open!: () => void;
  initGate = new Promise((r) => (open = r));
  calls.length = 0;
  const pending = infer('scan');
  await tick();
  await cancelGeneration();
  open();
  await assert.rejects(pending, GenerationCancelled);
  assert.deepEqual(calls, ['initialize', 'cancel']);
  initGate = Promise.resolve();
});

test('a cancelled answer is reported as interrupted, not as the partial text', async () => {
  const { infer, cancelGeneration, GenerationCancelled } = await import('../src/local/model');
  const pending = infer('chat');
  await tick();
  await cancelGeneration();
  await assert.rejects(pending, GenerationCancelled);
});

test('backgrounding the app during a scan reports an interruption', async () => {
  const { infer, GenerationCancelled } = await import('../src/local/model');
  const pending = infer('scan', 'file:///photo.jpg');
  await tick();
  for (const listener of appStateListeners.change ?? []) listener('background');
  answering!.resolve('{"name":"Blue'); // the engine was released mid-answer
  await assert.rejects(pending, GenerationCancelled);
  // The model is free again afterwards.
  const next = infer('again');
  await tick();
  answering!.resolve('ok');
  assert.equal(await next, 'ok');
});
