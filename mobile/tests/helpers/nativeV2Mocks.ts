/**
 * Host harness for the V2 on-device modules (2026-11-19 review).
 *
 * The shipping SQL runs on a real SQLite file (node:sqlite). expo-file-system
 * is replaced by a small fs-backed implementation that keeps the two behaviours
 * the review found the code getting wrong:
 *   - File.copy() is asynchronous (expo-file-system 57 returns a Promise);
 *   - a folder returned by Directory.pickDirectoryAsync() is an Android
 *     Storage Access Framework tree (content://). Its children exist only as
 *     the URIs returned by createFile/createDirectory/list(); a URI built by
 *     joining a name onto the folder URI does not address the child.
 * Install BEFORE importing any module under test.
 */
import Module from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const controls = {
  /** Absolute path the next pickDirectoryAsync() returns. */
  pickedPath: '',
  /** Rejects File.copy() whose source name matches. */
  failCopy: (_name: string) => false,
  /** Throws from File.bytes() whose name matches. */
  failBytes: (_name: string) => false,
  /** Milliseconds File.copy() waits before writing. */
  copyDelayMs: 5
};

const SAF = 'content://saf/document/';
const enc = (p: string) => encodeURIComponent(p);
function toPath(uri: string): string | null {
  if (uri.startsWith('file://')) return decodeURIComponent(uri.slice('file://'.length)).replace(/\/+$/, '') || '/';
  if (uri.startsWith(SAF)) {
    const rest = uri.slice(SAF.length).replace(/\/+$/, '');
    // A joined child ("…%2Fphotos/name.jpg") is not a document URI.
    return rest.includes('/') ? null : decodeURIComponent(rest);
  }
  return null;
}
function join(parts: unknown[]): string {
  const strings = parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri));
  let out = strings[0];
  for (const s of strings.slice(1)) out = out.replace(/\/+$/, '') + '/' + s;
  return out;
}
const isSaf = (uri: string) => uri.startsWith(SAF);
function childUri(parent: string, childPath: string, dir: boolean) {
  return isSaf(parent) ? SAF + enc(childPath) + (dir ? '/' : '') : 'file://' + childPath + (dir ? '/' : '');
}
function need(uri: string) {
  const p = toPath(uri);
  if (!p) throw new Error('No such document: ' + uri);
  return p;
}

class MockFile {
  uri: string;
  constructor(...parts: unknown[]) {
    this.uri = join(parts);
  }
  get name() {
    return path.basename(decodeURIComponent(this.uri));
  }
  get exists() {
    const p = toPath(this.uri);
    return !!p && fs.existsSync(p) && fs.statSync(p).isFile();
  }
  get size() {
    const p = toPath(this.uri);
    return p && fs.existsSync(p) ? fs.statSync(p).size : 0;
  }
  async text() {
    return fs.readFileSync(need(this.uri), 'utf8');
  }
  async bytes() {
    const p = need(this.uri);
    if (controls.failBytes(path.basename(p))) throw new Error('Simulated read failure');
    return new Uint8Array(fs.readFileSync(p));
  }
  write(content: string | Uint8Array) {
    fs.writeFileSync(need(this.uri), content);
  }
  delete() {
    fs.rmSync(need(this.uri));
  }
  async copy(destination: MockFile | MockDirectory) {
    const from = need(this.uri);
    await new Promise((r) => setTimeout(r, controls.copyDelayMs));
    if (controls.failCopy(path.basename(from))) throw new Error('Simulated copy failure');
    const to =
      destination instanceof MockDirectory ? path.join(need(destination.uri), path.basename(from)) : need(destination.uri);
    fs.copyFileSync(from, to);
  }
  static async downloadFileAsync() {
    throw new Error('Network is not available in tests.');
  }
}

class MockDirectory {
  uri: string;
  constructor(...parts: unknown[]) {
    this.uri = join(parts);
  }
  get exists() {
    const p = toPath(this.uri);
    return !!p && fs.existsSync(p) && fs.statSync(p).isDirectory();
  }
  create(_options?: unknown) {
    if (isSaf(this.uri)) throw new Error('Directory.create does not work with SAF content:// uris');
    fs.mkdirSync(need(this.uri), { recursive: true });
  }
  createDirectory(name: string) {
    const p = path.join(need(this.uri), name);
    fs.mkdirSync(p);
    return new MockDirectory(childUri(this.uri, p, true));
  }
  createFile(name: string, _mime: string | null) {
    const p = path.join(need(this.uri), name);
    fs.writeFileSync(p, '');
    return new MockFile(childUri(this.uri, p, false));
  }
  list() {
    const base = need(this.uri);
    return fs.readdirSync(base).map((n) => {
      const p = path.join(base, n);
      return fs.statSync(p).isDirectory()
        ? new MockDirectory(childUri(this.uri, p, true))
        : new MockFile(childUri(this.uri, p, false));
    });
  }
  delete() {
    fs.rmSync(need(this.uri), { recursive: true, force: true });
  }
  static async pickDirectoryAsync() {
    return new MockDirectory(SAF + enc(controls.pickedPath) + '/');
  }
}

export interface FakeNative {
  status: () => Promise<string>;
  initialize: () => Promise<void>;
  answer: (prompt: string, photo: string | null) => Promise<string>;
  cancel: () => Promise<void>;
  unload: () => Promise<void>;
}
export const appStateListeners: Record<string, ((state: string) => void)[]> = {};
export let nativeVision: FakeNative | null = null;
export function setNativeVision(value: FakeNative | null) {
  nativeVision = value;
}

export function installNativeMocks(root: string) {
  const documents = path.join(root, 'documents');
  const cache = path.join(root, 'cache');
  fs.mkdirSync(documents, { recursive: true });
  fs.mkdirSync(cache, { recursive: true });
  const sql = new DatabaseSync(path.join(root, 'device.db'));
  const adapter = {
    execAsync: async (s: string) => {
      sql.exec(s);
    },
    runAsync: async (s: string, ...v: string[]) => sql.prepare(s).run(...v),
    getAllAsync: async (s: string, ...v: string[]) => sql.prepare(s).all(...v),
    getFirstAsync: async (s: string, ...v: string[]) => sql.prepare(s).get(...v),
    closeAsync: async () => {},
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
  const fileSystem = {
    File: MockFile,
    Directory: MockDirectory,
    Paths: {
      document: new MockDirectory('file://' + documents + '/'),
      cache: new MockDirectory('file://' + cache + '/'),
      availableDiskSpace: 64 * 1024 * 1024 * 1024
    }
  };
  const reactNative = {
    Platform: { OS: 'android' },
    AppState: {
      addEventListener: (event: string, listener: (state: string) => void) => {
        (appStateListeners[event] ??= []).push(listener);
        return { remove() {} };
      }
    }
  };
  const loader = Module as unknown as { _load: (name: string, ...rest: unknown[]) => unknown };
  const original = loader._load;
  loader._load = function (name, ...rest) {
    if (name === 'expo-sqlite') return { openDatabaseAsync: async () => adapter };
    if (name === 'expo-file-system') return fileSystem;
    if (name === 'expo-modules-core')
      return {
        uuid: { v4: () => randomUUID() },
        requireOptionalNativeModule: () => nativeVision
      };
    if (name === 'react-native') return reactNative;
    return original.call(this, name, ...rest);
  };
  return { sql, documents, cache };
}
