/**
 * Where the vault lives, and how it reaches the other devices.
 *
 * One store per app instance, persisted locally so the window opens instantly
 * and keeps working with no network, and — when a hub is configured — kept in
 * step with every other device over a WebSocket.
 *
 * The order matters. Local persistence loads first and the UI renders from it;
 * the hub connects afterwards and merges. A device that has been switched off
 * for a week shows its own last state immediately and catches up a moment
 * later, rather than showing nothing until the network answers.
 */

import { createMergeableStore, type MergeableStore } from 'tinybase';
import { createCustomPersister, type Persister, type Persists } from 'tinybase/persisters';

/**
 * `Persists.MergeableStoreOnly`, spelled out.
 *
 * TinyBase declares Persists as an ambient const enum, which `isolatedModules`
 * forbids reading at runtime — the value has to be inlined, and inlining is
 * exactly what isolated compilation cannot do. The type still comes from the
 * enum, so this cannot drift silently.
 */
const MERGEABLE_STORE_ONLY = 2 as Persists.MergeableStoreOnly;
import { createIndexedDbPersister } from 'tinybase/persisters/persister-indexed-db';
import { createWsSynchronizer } from 'tinybase/synchronizers/synchronizer-ws-client';
import type { Vault } from './types';
import { applyVaultToStore, storeToVault } from './store';
import { loadVault, onVaultChanged, saveVault } from './vault';

const DB_NAME = 'todo-vault';
const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const CONFIG_KEY = 'todo.sync';

export interface SyncConfig {
  /** e.g. `wss://todo-sync.<subdomain>.workers.dev` */
  url: string;
  key: string;
}

export type SyncState = 'off' | 'connecting' | 'online' | 'offline';

export function readSyncConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SyncConfig>;
    if (!parsed.url || !parsed.key) return null;
    return { url: parsed.url, key: parsed.key };
  } catch {
    return null;
  }
}

/**
 * Take the hub from the CLI's config file, if this device has one and the
 * browser copy is empty.
 *
 * On a Mac it is `todo sync` that points the machine at a hub, and it writes
 * that to Application Support. A freshly installed app has empty localStorage,
 * so without this it would start local-only beside a CLI that is fully synced —
 * the two showing different vaults, which is the exact failure this whole
 * change exists to remove.
 */
export async function seedSyncConfigFromHost(): Promise<void> {
  if (!inTauri || readSyncConfig()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const found = await invoke<[string, string] | null>('sync_config');
    if (found) writeSyncConfig({ url: found[0], key: found[1] });
  } catch {
    // No config file, or an older shell without the command: the setup screen
    // and `todo sync` both still work.
  }
}

export function writeSyncConfig(config: SyncConfig | null): void {
  try {
    if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    else localStorage.removeItem(CONFIG_KEY);
  } catch {
    // A browser with site data blocked can still run the app locally.
  }
}

let store: MergeableStore | null = null;

export function getStore(): MergeableStore {
  // The client id is stable per device, so a device's own edits are recognised
  // as its own across restarts rather than looking like a stranger's.
  store ??= createMergeableStore(deviceId());
  return store;
}

export function deviceId(): string {
  const KEY = 'todo.deviceId';
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = `d${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `d${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * On a Mac, the JSON file stays the local copy.
 *
 * IndexedDB would be the obvious choice, and it is what the phones use — but
 * `bin/todo.mjs` reads that file, and with no hub configured yet it is the only
 * thing the two share. Persisting to IndexedDB instead would leave the app and
 * the CLI writing to different places and quietly diverging, which is a worse
 * problem than the one being solved.
 *
 * So the file remains the local ground and the hub is what makes it shared.
 * Both stay true at once, and nothing breaks before the hub exists.
 */
function createFilePersister(store: MergeableStore): Persister<Persists.MergeableStoreOnly> {
  return createCustomPersister<() => void, Persists.MergeableStoreOnly>(
    store,
    async () => {
      const { vault } = await loadVault();
      const scratch = createMergeableStore();
      applyVaultToStore(scratch, vault);
      return scratch.getMergeableContent();
    },
    async () => {
      await saveVault(storeToVault(store));
    },
    // Claude and the CLI still write this file directly, so keep watching it.
    (listener) => {
      let dispose: (() => void) | undefined;
      void onVaultChanged(() => listener()).then((fn) => { dispose = fn; });
      return () => dispose?.();
    },
    (handle) => handle(),
    undefined,
    MERGEABLE_STORE_ONLY,
  );
}

/**
 * Load whatever this device already had. Resolves once the UI can render.
 *
 * Which local copy depends on whether a hub is configured, and the reason is
 * the CLI. With no hub, the JSON file is the only thing the app and
 * `bin/todo.mjs` share, so the app must keep writing it or the two diverge.
 * Once a hub exists they both talk to that instead, and the file is redundant —
 * so IndexedDB is used, exactly as on the phones.
 *
 * That is not just tidiness. The vault lives inside a MEGA folder, which macOS
 * treats as a removable volume: every single write raised a system permission
 * prompt. Writing a file nothing reads any more, at the price of a dialog per
 * keystroke, is the worst of both.
 */
export async function startLocalPersistence(): Promise<() => void> {
  const useFile = inTauri && !readSyncConfig();
  const persister = useFile
    ? createFilePersister(getStore())
    : createIndexedDbPersister(getStore(), DB_NAME, 1);
  await persister.load();
  await persister.startAutoSave();
  return () => void persister.destroy();
}

/**
 * Connect to the hub and keep syncing.
 *
 * Failure here is ordinary, not exceptional — no hub configured yet, no
 * network, a laptop lid closed mid-flight. The local store carries on either
 * way, so this reports state and never throws into the caller.
 */
export async function startSync(
  config: SyncConfig,
  onState: (state: SyncState) => void,
): Promise<() => void> {
  let closed = false;
  let socket: WebSocket | null = null;
  let synchronizer: Awaited<ReturnType<typeof createWsSynchronizer>> | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;

  /**
   * Tear the previous attempt down before starting another.
   *
   * Without this each reconnection left the old synchronizer attached to a dead
   * socket, still trying to send: "WebSocket is already in CLOSING or CLOSED
   * state", once per attempt, forever. A phone moving in and out of signal
   * would accumulate them all day.
   */
  const teardown = async () => {
    const [oldSync, oldSocket] = [synchronizer, socket];
    synchronizer = null;
    socket = null;
    try { await oldSync?.destroy(); } catch { /* already gone */ }
    try { oldSocket?.close(); } catch { /* already closed */ }
  };

  const connect = async () => {
    if (closed) return;
    await teardown();
    onState('connecting');
    try {
      const ws = new WebSocket(`${config.url.replace(/\/$/, '')}/sync/${config.key}`);
      socket = ws;

      // Waiting for the handshake before attaching means the synchronizer never
      // writes into a socket that is still connecting or already refused.
      await new Promise<void>((resolve, reject) => {
        if (ws.readyState === WebSocket.OPEN) return resolve();
        const done = () => { ws.removeEventListener('open', onOpen); ws.removeEventListener('error', onError); };
        const onOpen = () => { done(); resolve(); };
        const onError = () => { done(); reject(new Error('could not reach the hub')); };
        ws.addEventListener('open', onOpen);
        ws.addEventListener('error', onError);
        setTimeout(() => { done(); reject(new Error('the hub did not answer')); }, 10_000);
      });
      if (closed) return void (await teardown());

      synchronizer = await createWsSynchronizer(getStore(), ws as never);
      await synchronizer.startSync();
      if (closed) return void (await teardown());

      attempt = 0;
      onState('online');

      ws.addEventListener('close', () => {
        if (closed || socket !== ws) return;
        onState('offline');
        schedule();
      });
    } catch {
      if (closed) return;
      await teardown();
      onState('offline');
      schedule();
    }
  };

  const schedule = () => {
    // Back off, but keep trying: a phone that regains signal should reconnect
    // on its own rather than waiting for the app to be reopened.
    const delay = Math.min(30_000, 1000 * 2 ** attempt++);
    retry = setTimeout(() => void connect(), delay);
  };

  await connect();

  return () => {
    closed = true;
    clearTimeout(retry);
    void teardown();
    onState('off');
  };
}

// ── Reading and writing the vault ────────────────────────────────────────────

export function currentVault(): Vault {
  return storeToVault(getStore());
}

export function applyVault(vault: Vault): void {
  applyVaultToStore(getStore(), vault);
}

/** Call `fn` whenever anything changes, from any source. */
export function onStoreChanged(fn: () => void): () => void {
  const s = getStore();
  const listeners = [
    s.addTablesListener(() => fn()),
    s.addValuesListener(() => fn()),
  ];
  return () => listeners.forEach((id) => s.delListener(id));
}

// ── Migration ────────────────────────────────────────────────────────────────

const MIGRATED_KEY = 'todo.migratedFromFile';

/**
 * Move an existing JSON vault into the store, once.
 *
 * Guarded twice on purpose. The flag stops it re-running, and the emptiness
 * check stops it from overwriting a store that already has content — which is
 * what would happen on a second device that synced first and only then noticed
 * a stale file sitting in its old location.
 */
export function migrateFromFile(fileVault: Vault): 'migrated' | 'skipped' {
  const s = getStore();
  const alreadyHasData = s.getRowIds('tasks').length > 0 || s.getRowIds('notes').length > 0;
  const alreadyRun = (() => {
    try { return localStorage.getItem(MIGRATED_KEY) === '1'; } catch { return false; }
  })();

  if (alreadyRun || alreadyHasData) return 'skipped';
  if (!fileVault.tasks.length && !fileVault.notes.length) return 'skipped';

  applyVaultToStore(s, fileVault);
  try { localStorage.setItem(MIGRATED_KEY, '1'); } catch { /* not fatal */ }
  return 'migrated';
}
