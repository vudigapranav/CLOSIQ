/**
 * Sprint M19 regression-test harness.
 *
 * These tests run the REAL storage modules under plain Node — no Expo, no
 * device, no Metro — so the three things those modules reach for that only
 * exist inside React Native are intercepted here: `react-native` (Alert),
 * AsyncStorage, and the Supabase client. Nothing about the modules under
 * test is stubbed, mirrored, or reimplemented: every assertion exercises
 * the shipping code path.
 *
 * MUST be imported first, before any module under test — Node resolves and
 * executes a required module immediately, so the interception has to be in
 * place before the first `require` of anything that touches these.
 *
 * Zero Gemini calls: nothing here talks to the AI services, and every
 * failure under test is produced by a mocked Supabase rejection.
 */
import Module from 'node:module';

// `config.ts` reads React Native's `__DEV__` global at import time.
(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;

// Deterministic API host for image-resolution assertions (config.ts reads
// this at import time; each test file runs in its own process).
export const TEST_API_URL = 'https://api.closiq.test';
export const TEST_SUPABASE_URL = 'https://proj.supabase.co';
process.env.EXPO_PUBLIC_API_URL = TEST_API_URL;

export interface AlertCall {
  title: string;
  message?: string;
  buttons?: { text: string; style?: string; onPress?: () => void }[];
}

/** Every Alert the code under test raised, in order. */
export const alertCalls: AlertCall[] = [];

/**
 * Controls what the mocked Alert does when the code offers a retry.
 * 'decline' presses "Not now" (the default — keeps tests deterministic and
 * bounded); 'accept' presses "Try again".
 */
export let alertResponse: 'decline' | 'accept' = 'decline';
export function setAlertResponse(mode: 'decline' | 'accept'): void {
  alertResponse = mode;
}

/**
 * Runs when an alert is raised, BEFORE its button fires — lets a test do
 * something "while the dialog is on screen", e.g. switch accounts.
 */
let alertHook: ((call: AlertCall) => void) | null = null;
export function setAlertHook(hook: ((call: AlertCall) => void) | null): void {
  alertHook = hook;
}

export function resetAlerts(): void {
  alertCalls.length = 0;
  alertResponse = 'decline';
  alertHook = null;
}

const reactNativeMock = {
  Alert: {
    alert(title: string, message?: string, buttons?: AlertCall['buttons']) {
      alertCalls.push({ title, message, buttons });
      alertHook?.({ title, message, buttons });
      if (!buttons || buttons.length === 0) return;
      const wanted = alertResponse === 'accept' ? 'Try again' : 'Not now';
      const chosen = buttons.find((b) => b.text === wanted) ?? buttons[0];
      // Alert callbacks fire asynchronously on a real device; keeping that
      // shape here means the code under test is exercised the same way.
      setTimeout(() => chosen.onPress?.(), 0);
    }
  }
};

/** In-memory AsyncStorage. `store` is asserted on directly by the tests. */
export const store = new Map<string, string>();

const asyncStorageMock = {
  async getItem(key: string) {
    return store.has(key) ? (store.get(key) as string) : null;
  },
  async setItem(key: string, value: string) {
    store.set(key, value);
  },
  async removeItem(key: string) {
    store.delete(key);
  }
};

/** The Supabase client the tests program per-case. Assigned by setSupabase(). */
let supabaseImpl: unknown = null;
export function setSupabase(impl: unknown): void {
  supabaseImpl = impl;
}

/** Login repair: authService now consults `supabaseConfigCheck` before any
 *  request, so the double must expose it (and let a test make it fail). */
let configCheckImpl: { ok: boolean; problem?: string; message?: string } = { ok: true };
export function setSupabaseConfigCheck(check: { ok: boolean; problem?: string; message?: string }): void {
  configCheckImpl = check;
}

const supabaseClientMock = {
  get supabase() {
    return supabaseImpl;
  },
  get supabaseConfigCheck() {
    return configCheckImpl;
  },
  get isSupabaseConfigured() {
    return configCheckImpl.ok;
  },
  SUPABASE_URL: TEST_SUPABASE_URL
};

type Loader = (request: string, parent: unknown, isMain: boolean) => unknown;
const moduleInternals = Module as unknown as { _load: Loader };
const originalLoad = moduleInternals._load;

moduleInternals._load = function patchedLoad(this: unknown, request: string, parent: unknown, isMain: boolean) {
  if (request === 'react-native') return reactNativeMock;
  if (request === '@react-native-async-storage/async-storage') {
    return { __esModule: true, default: asyncStorageMock };
  }
  if (request.endsWith('/supabaseClient') || request === './supabaseClient') {
    return supabaseClientMock;
  }
  return originalLoad.call(this, request, parent, isMain);
} as Loader;

export function resetStore(): void {
  store.clear();
}
