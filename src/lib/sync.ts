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
import { createIndexedDbPersister } from 'tinybase/persisters/persister-indexed-db';
import { createWsSynchronizer } from 'tinybase/synchronizers/synchronizer-ws-client';
import type { Vault } from './types';
import { applyVaultToStore, storeToVault } from './store';

const DB_NAME = 'todo-vault';
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

function deviceId(): string {
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

/** Load whatever this device already had. Resolves once the UI can render. */
export async function startLocalPersistence(): Promise<() => void> {
  const persister = createIndexedDbPersister(getStore(), DB_NAME, 1);
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

  const connect = async () => {
    if (closed) return;
    onState('connecting');
    try {
      socket = new WebSocket(`${config.url.replace(/\/$/, '')}/sync/${config.key}`);
      synchronizer = await createWsSynchronizer(getStore(), socket as never);
      await synchronizer.startSync();
      if (closed) return;
      attempt = 0;
      onState('online');

      socket.addEventListener('close', () => {
        if (closed) return;
        onState('offline');
        schedule();
      });
    } catch {
      if (closed) return;
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
    void synchronizer?.destroy();
    socket?.close();
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
