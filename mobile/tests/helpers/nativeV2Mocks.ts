/**
 * Host harness for the V2 on-device AI modules. Replaces the three native
 * imports `src/local/model.ts` and the `.native.ts` AI services reach for:
 * expo-file-system (only Paths/File are touched at import time),
 * expo-modules-core (the HeyHangerVision native module) and react-native
 * (AppState). Install BEFORE importing any module under test.
 */
import Module from 'node:module';
import { randomUUID } from 'node:crypto';

export interface FakeNative {
  status: () => Promise<string>;
  initialize: () => Promise<void>;
  answer: (prompt: string, photo: string | null) => Promise<string>;
  cancel: () => Promise<void>;
  unload: () => Promise<void>;
}
export const appStateListeners: Record<string, ((state: string) => void)[]> = {};
let nativeVision: FakeNative | null = null;
export function setNativeVision(value: FakeNative | null) {
  nativeVision = value;
}

class StubFile {
  uri: string;
  constructor(...parts: unknown[]) {
    this.uri = parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');
  }
  get exists() {
    return false;
  }
  delete() {}
  static async downloadFileAsync() {
    throw new Error('Network is not available in tests.');
  }
}

export function installNativeMocks() {
  const loader = Module as unknown as { _load: (name: string, ...rest: unknown[]) => unknown };
  const original = loader._load;
  loader._load = function (name, ...rest) {
    if (name === 'expo-file-system')
      return { File: StubFile, Paths: { cache: { uri: 'file:///cache' }, availableDiskSpace: 64e9 } };
    if (name === 'expo-modules-core')
      return { uuid: { v4: () => randomUUID() }, requireOptionalNativeModule: () => nativeVision };
    if (name === 'react-native')
      return {
        Platform: { OS: 'android' },
        AppState: {
          addEventListener: (event: string, listener: (state: string) => void) => {
            (appStateListeners[event] ??= []).push(listener);
            return { remove() {} };
          }
        }
      };
    return original.call(this, name, ...rest);
  };
}
