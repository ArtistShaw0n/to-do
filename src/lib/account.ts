/**
 * The app's side of accounts (the hub's side is `worker/accounts.ts`).
 *
 * An account is how a person who is not the owner gets a vault: sign up or sign
 * in with an email and a password, and the hub hands back a vault key. From
 * there the device syncs exactly as the owner's always have — the key goes into
 * the same `todo.sync` config, and nothing else in the app knows the difference.
 */

import { writeSyncConfig, type SyncConfig } from './sync';

/** Where the app looks for the hub when nobody has said otherwise. */
export const DEFAULT_HUB = 'https://vault.artist-shawon.workers.dev';

const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/**
 * The hub this copy of the app belongs to. A phone that opened the app from the
 * hub is already there; the desktop app, and a copy served by a dev server, use
 * the default.
 */
export function defaultHub(): string {
  if (!inTauri && typeof location !== 'undefined' && /^https:$/.test(location.protocol)
    && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    return location.origin;
  }
  return DEFAULT_HUB;
}

const toHttp = (url: string) => url.trim().replace(/\/+$/, '').replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
const toWs = (url: string) => toHttp(url).replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');

export type AccountError =
  | 'bad_email' | 'weak_password' | 'taken' | 'closed' | 'too_many'
  | 'wrong' | 'locked' | 'not_found' | 'owner_kept' | 'offline';

/** What to tell a person, in a sentence, for each refusal. */
export const ACCOUNT_MESSAGES: Record<AccountError, string> = {
  bad_email: 'That does not look like an email address.',
  weak_password: 'The password needs at least 8 characters.',
  taken: 'An account with this email already exists — sign in instead.',
  closed: 'No new accounts can be opened on this hub right now.',
  too_many: 'Too many accounts opened from here today. Try again tomorrow.',
  wrong: 'The email or password is not right.',
  locked: 'Too many wrong passwords. Wait fifteen minutes and try again.',
  not_found: 'This account no longer exists.',
  owner_kept: "The hub owner's account cannot be closed from the app.",
  offline: 'Could not reach the hub. Check the connection and try again.',
};

type Reply<T> = { ok: true; value: T } | { ok: false; error: AccountError };

async function post<T>(hub: string, route: string, body: unknown, key?: string): Promise<Reply<T>> {
  try {
    const r = await fetch(`${toHttp(hub)}/account/${route}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, value: data as T };
    const error = typeof data?.error === 'string' && data.error in ACCOUNT_MESSAGES ? data.error : 'offline';
    return { ok: false, error };
  } catch {
    return { ok: false, error: 'offline' };
  }
}

interface Session { key: string; email: string; owner: boolean }

/**
 * Sign up or sign in, and on success point this device at the new vault.
 *
 * `claim` is for the owner only: his existing hub key, which makes the account
 * open the vault he already has.
 */
export async function enter(
  mode: 'signin' | 'signup',
  input: { hub: string; email: string; password: string; claim?: string },
): Promise<Reply<SyncConfig>> {
  const r = await post<Session>(input.hub, mode, {
    email: input.email, password: input.password, ...(input.claim ? { claim: input.claim } : {}),
  });
  if (!r.ok) return r;
  const config: SyncConfig = { url: toWs(input.hub), key: r.value.key, email: r.value.email };
  writeSyncConfig(config);
  return { ok: true, value: config };
}

export const changePassword = (config: SyncConfig, current: string, next: string) =>
  post<true>(config.url, 'password', { current, next }, config.key);

export const closeAccount = (config: SyncConfig, password: string) =>
  post<{ deleted: true }>(config.url, 'delete', { password }, config.key);

// ── This device ──────────────────────────────────────────────────────────────

const LOCAL_ONLY = 'todo.localOnly';
const BRING_FILE = 'todo.bringFile';

/** The desktop app may be used with no account at all, on that one machine. */
export const isLocalOnly = () => { try { return localStorage.getItem(LOCAL_ONLY) === '1'; } catch { return false; } };
export const setLocalOnly = (on: boolean) => {
  try { if (on) localStorage.setItem(LOCAL_ONLY, '1'); else localStorage.removeItem(LOCAL_ONLY); } catch { /* */ }
};

/**
 * Leaving "this Mac only" for an account: the tasks made so far live in the
 * file, which the app stops reading once a hub is configured. This asks the
 * next start to carry them into the account's vault, once.
 */
export const markBringFile = () => { try { localStorage.setItem(BRING_FILE, '1'); } catch { /* */ } };
export function takeBringFile(): boolean {
  try {
    const on = localStorage.getItem(BRING_FILE) === '1';
    localStorage.removeItem(BRING_FILE);
    return on;
  } catch {
    return false;
  }
}

/**
 * Sign out: forget the key *and* this device's copy of the vault.
 *
 * The copy has to go. The local store merges into whichever vault it next
 * connects to, so leaving it would hand one person's tasks to the next person
 * who signs in here. Only the theme survives.
 */
export async function signOut(): Promise<void> {
  try {
    const keep = localStorage.getItem('todo.theme');
    for (const k of Object.keys(localStorage)) if (k.startsWith('todo.')) localStorage.removeItem(k);
    if (keep) localStorage.setItem('todo.theme', keep);
  } catch { /* */ }
  await new Promise<void>((resolve) => {
    try {
      const req = indexedDB.deleteDatabase('todo-vault');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
  location.reload();
}
