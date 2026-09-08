/**
 * The PIN that guards the secrets in Notes.
 *
 * What this actually does, stated plainly because a lock that is weaker than it
 * looks is worse than no lock at all:
 *
 *  - The PIN is never stored. A key is derived from it with PBKDF2, and only a
 *    hash of that key is kept, which is enough to recognise the right PIN and
 *    useless for recovering it.
 *  - Every `secret` field is encrypted with that key before it is written. The
 *    hub stores ciphertext and has never held a plaintext secret. Nor has the
 *    vault file, nor another device's browser storage.
 *  - Titles, usernames and URLs stay readable, so a locked Notes list is still
 *    a list — you can see that the tab PIN is recorded without seeing it.
 *
 * What it does not do: a four-digit PIN has ten thousand possibilities, and
 * anyone holding the encrypted vault can try them all offline. The iteration
 * count makes that slow rather than impossible. This defends against someone
 * picking up an unlocked phone — which is the actual risk here — and not
 * against someone who takes the data and has time.
 *
 * There is no recovery. A recovery path is a second key, and a second key is a
 * second way in.
 */

import type { Note, Vault } from './types';

const ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface LockConfig {
  salt: string;
  verifier: string;
  iterations: number;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (bytes: ArrayBuffer | Uint8Array): string =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)));

const fromB64 = (s: string): Uint8Array =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/**
 * PIN + salt → an AES key.
 *
 * PBKDF2 at 310,000 iterations — OWASP's floor for SHA-256 — so each guess
 * costs real time on the attacker's machine as well as a moment on ours.
 */
async function deriveKey(pin: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey', 'deriveBits'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

/** A hash of the key, which recognises the right PIN without storing either. */
async function verifierFor(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return toB64(await crypto.subtle.digest('SHA-256', raw));
}

/** Set a PIN for the first time. Returns what the vault should remember. */
export async function createLock(pin: string): Promise<{ config: LockConfig; key: CryptoKey }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await deriveKey(pin, salt, ITERATIONS);
  return {
    config: { salt: toB64(salt), verifier: await verifierFor(key), iterations: ITERATIONS },
    key,
  };
}

/** Check a PIN. Returns the key on success, null on the wrong PIN. */
export async function unlock(pin: string, config: LockConfig): Promise<CryptoKey | null> {
  const key = await deriveKey(pin, fromB64(config.salt), config.iterations);
  return (await verifierFor(key)) === config.verifier ? key : null;
}

// ── Encrypting one value ─────────────────────────────────────────────────────

/** Marks a stored value as ciphertext, so plain and encrypted never mix up. */
const PREFIX = 'enc.v1:';

export const isEncrypted = (value: string | undefined): boolean =>
  typeof value === 'string' && value.startsWith(PREFIX);

export async function encryptValue(plain: string, key: CryptoKey): Promise<string> {
  // A fresh IV per value: reusing one under the same key is what breaks GCM.
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource }, key, enc.encode(plain),
  );
  return `${PREFIX}${toB64(iv)}.${toB64(cipher)}`;
}

/**
 * Returns null when the value cannot be read — a wrong key, or a value from
 * before a PIN was reset. Never throws: one unreadable secret must not take
 * the Notes list down with it.
 */
export async function decryptValue(stored: string, key: CryptoKey): Promise<string | null> {
  if (!isEncrypted(stored)) return stored;
  try {
    const [ivPart, cipherPart] = stored.slice(PREFIX.length).split('.');
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(ivPart) as BufferSource },
      key,
      fromB64(cipherPart) as BufferSource,
    );
    return dec.decode(plain);
  } catch {
    return null;
  }
}

// ── Whole notes ──────────────────────────────────────────────────────────────

/**
 * Encrypt every secret that is not already encrypted.
 *
 * Only `secret` — a title, a username and a URL are what make the list usable
 * while locked, and encrypting them would leave a column of ciphertext that
 * tells you nothing about which note you are looking at.
 */
export async function lockNotes(notes: Note[], key: CryptoKey): Promise<Note[]> {
  return Promise.all(notes.map(async (n) => (
    n.secret && !isEncrypted(n.secret)
      ? { ...n, secret: await encryptValue(n.secret, key) }
      : n
  )));
}

export async function revealNotes(notes: Note[], key: CryptoKey): Promise<Note[]> {
  return Promise.all(notes.map(async (n) => {
    if (!n.secret || !isEncrypted(n.secret)) return n;
    const plain = await decryptValue(n.secret, key);
    return plain === null ? { ...n, secret: undefined } : { ...n, secret: plain };
  }));
}

export const hasLock = (vault: Vault): boolean => !!vault.meta.lock;

/** Secrets waiting to be encrypted — anything written before the PIN existed. */
export const unlockedSecrets = (notes: Note[]): Note[] =>
  notes.filter((n) => n.secret && !isEncrypted(n.secret));
