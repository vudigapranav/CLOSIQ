import { requireOptionalNativeModule } from 'expo-modules-core';
import { File, Paths } from 'expo-file-system';
import { AppState } from 'react-native';

export const model = {
  name: 'SmolVLM2-500M · base',
  revision: '307bf6d1018edd2c2d0903b92628151bdb5cc2b7',
  bytes: 363085824,
  repo: 'litert-community/SmolVLM2-500M',
  file: 'SmolVLM2-500M.litertlm'
} as const;
type Status = 'missing' | 'installed' | 'ready' | 'unsupported';
interface NativeVision {
  initializeBackend?(gpu: boolean): Promise<void>;
  memoryKiB?(): Promise<number>;
  status(): Promise<Status>;
  initialize(): Promise<void>;
  install(uri: string): Promise<void>;
  answer(prompt: string, photo: string | null): Promise<string>;
  cancel(): Promise<void>;
  unload(): Promise<void>;
  remove(): Promise<void>;
}
const native = requireOptionalNativeModule<NativeVision>('ClosiqVision');
function runtime() {
  if (!native) throw new Error('Install a CLOSIQ native mobile build to use photo analysis.');
  return native;
}
export const modelStatus = async (): Promise<Status> => (native ? native.status() : 'unsupported');
let working = false;
export async function installModel(progress: (percent: number) => void, signal: AbortSignal) {
  const api = runtime();
  if (working) throw new Error('Another model operation is running.');
  if (Paths.availableDiskSpace < model.bytes * 2 + 64 * 1024 * 1024)
    throw new Error('Free at least 800 MB before installing.');
  working = true;
  const stage = new File(Paths.cache, 'closiq-model.partial');
  try {
    if (stage.exists) stage.delete();
    await File.downloadFileAsync(
      'https://huggingface.co/' + model.repo + '/resolve/' + model.revision + '/' + model.file,
      stage,
      {
        signal,
        onProgress: ({ bytesWritten }) =>
          progress(Math.min(100, Math.floor((bytesWritten / model.bytes) * 100)))
      }
    );
    if (signal.aborted) throw new Error('Installation cancelled.');
    await api.install(stage.uri);
  } finally {
    working = false;
    if (stage.exists) stage.delete();
  }
}
export async function initializeModel() {
  await runtime().initialize();
}
export async function deleteModel() {
  if (working) throw new Error('Finish the current operation before deleting the model.');
  await runtime().remove();
}
export const unloadModel = async () => native?.unload();
// The native runtime stops a cancelled conversation and returns whatever text
// it had produced so far. Each cancel (user, timeout, app backgrounding) moves
// this epoch, so infer() reports that partial text as an interruption instead
// of a finished answer, and a cancel during initialization also stops the
// generation that would otherwise start right after it.
let cancelEpoch = 0;
export const cancelGeneration = async () => {
  cancelEpoch++;
  await native?.cancel();
};
export class GenerationCancelled extends Error {
  constructor() {
    super('Local analysis was interrupted. Try again or enter details manually.');
    this.name = 'GenerationCancelled';
  }
}
if (native) {
  AppState.addEventListener('memoryWarning', () => {
    cancelEpoch++;
    void native.unload().catch(() => {});
  });
  // Android releases the engine when the activity backgrounds (cancelling any
  // running conversation), so the answer in flight is incomplete.
  AppState.addEventListener('change', (state) => {
    if (state === 'background') cancelEpoch++;
  });
}

export async function infer(prompt: string, photo?: string) {
  if (working) throw new Error('Another model operation is running.');
  const api = runtime();
  working = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expired = false;
  const epoch = cancelEpoch;
  const task = async () => {
    try {
      await api.initialize();
      if (expired) throw new Error('Model initialization timed out.');
      if (epoch !== cancelEpoch) throw new GenerationCancelled();
      const answer = await api.answer(prompt.slice(0, 2400), photo ?? null);
      if (epoch !== cancelEpoch) throw new GenerationCancelled();
      return answer;
    } finally {
      working = false;
    }
  };
  try {
    return await Promise.race([
      task(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          cancelEpoch++;
          void api.cancel().catch(() => {});
          reject(new Error('Local analysis timed out. Try again or enter details manually.'));
        }, 60000);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export const memoryKiB = async () => native?.memoryKiB?.();

export async function initializeBenchmark(gpu: boolean) {
  const api = runtime();
  if (api.initializeBackend) await api.initializeBackend(gpu);
  else await api.initialize();
}
