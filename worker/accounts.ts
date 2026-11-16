/**
 * Accounts: more than one person, each with a vault of their own.
 *
 * The vault was always addressed by its key — a socket on `/sync/<key>` reaches
 * the Durable Object named `sync/<key>`, and a different key is simply a
 * different, empty object. So a person's account is nothing more than an email,
 * a password, and a long random key of their own (`u_…`). Signing in hands the
 * device that key; from then on it syncs exactly as the first device always has.
 *
 * The owner keeps the key the hub was set up with (`SYNC_KEY`): his vault does
 * not move, and his CLI and the hourly import go on working untouched. He can
 * give himself an account too, by signing up with that key as the claim — the
 * account then opens the same vault.
 *
 * Everything here lives in SQL in an object of its own, never in key-value
 * storage and never in the vault's object: TinyBase reads every key-value entry
 * as part of a vault (see index.ts), and the vault's object would be woken by
 * every sign-in otherwise.
 */

import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env';
import { secretsMatch } from './secret';

/** Who a key belongs to. `owner` is the person the hub was set up for. */
export interface Who {
  id: string;
  owner: boolean;
  /** The vault key: the Durable Object is `sync/<key>`. */
  key: string;
}

export type AccountError =
  | 'bad_email' | 'weak_password' | 'taken' | 'closed' | 'too_many'
  | 'wrong' | 'locked' | 'not_found' | 'owner_kept';

export type AccountResult<T> = { ok: true; value: T } | { ok: false; error: AccountError };

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS accounts (
     id TEXT PRIMARY KEY,
     email TEXT NOT NULL UNIQUE,
     salt TEXT NOT NULL,
     hash TEXT NOT NULL,
     key TEXT NOT NULL UNIQUE,
     owner INTEGER NOT NULL DEFAULT 0,
     created TEXT NOT NULL,
     seen TEXT NOT NULL
   )`,
  // Failed sign-ins per email, and sign-ups per address: who has been turned away, and until when.
  `CREATE TABLE IF NOT EXISTS limits (k TEXT PRIMARY KEY, n INTEGER NOT NULL, until INTEGER NOT NULL)`,
];

/** WebCrypto in Workers allows at most this many PBKDF2 rounds. */
const ROUNDS = 100_000;
const MIN_PASSWORD = 8;
const MAX_FAILURES = 10;
const LOCK_MS = 15 * 60 * 1000;
const SIGNUPS_PER_ADDRESS_PER_DAY = 5;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

const b64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const b64url = (bytes: Uint8Array) => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

async function hashPassword(password: string, salt: string): Promise<string> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: Uint8Array.from(atob(salt), (c) => c.charCodeAt(0)), iterations: ROUNDS },
    material, 256,
  );
  return b64(bits);
}

type Row = { id: string; email: string; salt: string; hash: string; key: string; owner: number; seen: string };

export class Accounts extends DurableObject<Env> {
  private sql() {
    const sql = this.ctx.storage.sql;
    for (const s of SCHEMA) sql.exec(s);
    return sql;
  }

  private row(where: 'email' | 'key', value: string): Row | undefined {
    return this.sql().exec<Row>(`SELECT * FROM accounts WHERE ${where} = ?`, value).toArray()[0] as Row | undefined;
  }

  /** Count one event against a limit; true if it is still allowed. */
  private allow(k: string, max: number, windowMs: number): boolean {
    const sql = this.sql();
    const now = Date.now();
    const row = sql.exec<{ n: number; until: number }>('SELECT n, until FROM limits WHERE k = ?', k).toArray()[0];
    if (row && row.until > now && row.n >= max) return false;
    const n = row && row.until > now ? row.n + 1 : 1;
    const until = row && row.until > now ? row.until : now + windowMs;
    sql.exec('INSERT INTO limits (k, n, until) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET n = excluded.n, until = excluded.until', k, n, until);
    sql.exec('DELETE FROM limits WHERE until < ?', now);
    return true;
  }

  private locked(email: string): boolean {
    const row = this.sql().exec<{ n: number; until: number }>('SELECT n, until FROM limits WHERE k = ?', `fail:${email}`).toArray()[0];
    return !!row && row.until > Date.now() && row.n >= MAX_FAILURES;
  }

  async signUp(input: { email: string; password: string; address: string; claim?: string }): Promise<AccountResult<{ key: string; email: string; owner: boolean }>> {
    const email = input.email.trim().toLowerCase();
    if (!EMAIL.test(email)) return { ok: false, error: 'bad_email' };
    if (input.password.length < MIN_PASSWORD) return { ok: false, error: 'weak_password' };
    if (this.row('email', email)) return { ok: false, error: 'taken' };

    // The owner's claim: his existing key opens his existing vault.
    const claiming = !!input.claim && !!this.env.SYNC_KEY && secretsMatch(input.claim, this.env.SYNC_KEY);
    if (input.claim && !claiming) return { ok: false, error: 'wrong' };
    if (claiming && this.row('key', this.env.SYNC_KEY)) return { ok: false, error: 'taken' };

    if (!claiming) {
      const cap = Math.max(0, Number(this.env.MAX_ACCOUNTS ?? 100) || 0);
      const count = Number(this.sql().exec<{ c: number }>('SELECT COUNT(*) AS c FROM accounts WHERE owner = 0').one().c);
      if (count >= cap) return { ok: false, error: 'closed' };
      if (!this.allow(`signup:${input.address}`, SIGNUPS_PER_ADDRESS_PER_DAY, 24 * 60 * 60 * 1000)) {
        return { ok: false, error: 'too_many' };
      }
    }

    const salt = b64(random(16));
    const hash = await hashPassword(input.password, salt);
    const key = claiming ? this.env.SYNC_KEY : `u_${b64url(random(32))}`;
    const now = new Date().toISOString();
    this.sql().exec(
      'INSERT INTO accounts (id, email, salt, hash, key, owner, created, seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      crypto.randomUUID(), email, salt, hash, key, claiming ? 1 : 0, now, now,
    );
    return { ok: true, value: { key, email, owner: claiming } };
  }

  async signIn(input: { email: string; password: string }): Promise<AccountResult<{ key: string; email: string; owner: boolean }>> {
    const email = input.email.trim().toLowerCase();
    if (this.locked(email)) return { ok: false, error: 'locked' };
    const row = this.row('email', email);
    // Hash even when there is no such account, so the time taken does not say which emails exist.
    const hash = await hashPassword(input.password, row?.salt ?? b64(random(16)));
    if (!row || !secretsMatch(hash, row.hash)) {
      this.allow(`fail:${email}`, MAX_FAILURES, LOCK_MS);
      return { ok: false, error: 'wrong' };
    }
    this.sql().exec('DELETE FROM limits WHERE k = ?', `fail:${email}`);
    return { ok: true, value: { key: row.key, email: row.email, owner: row.owner === 1 } };
  }

  /** Who holds this key, if anyone. Marks the account seen at most once a day, so a connection costs no write. */
  async byKey(key: string): Promise<Who | null> {
    const row = this.row('key', key);
    if (!row) return null;
    const today = new Date().toISOString().slice(0, 10);
    if (row.seen.slice(0, 10) !== today) {
      this.sql().exec('UPDATE accounts SET seen = ? WHERE id = ?', new Date().toISOString(), row.id);
    }
    return { id: row.id, owner: row.owner === 1, key: row.key };
  }

  async email(key: string): Promise<string | null> {
    return this.row('key', key)?.email ?? null;
  }

  async changePassword(input: { key: string; current: string; next: string }): Promise<AccountResult<true>> {
    const row = this.row('key', input.key);
    if (!row) return { ok: false, error: 'not_found' };
    if (this.locked(row.email)) return { ok: false, error: 'locked' };
    if (!secretsMatch(await hashPassword(input.current, row.salt), row.hash)) {
      this.allow(`fail:${row.email}`, MAX_FAILURES, LOCK_MS);
      return { ok: false, error: 'wrong' };
    }
    if (input.next.length < MIN_PASSWORD) return { ok: false, error: 'weak_password' };
    const salt = b64(random(16));
    this.sql().exec('UPDATE accounts SET salt = ?, hash = ? WHERE id = ?', salt, await hashPassword(input.next, salt), row.id);
    return { ok: true, value: true };
  }

  /** Close an account. Returns its key so the caller can empty the vault; the owner's vault is never emptied this way. */
  async remove(input: { key: string; password: string }): Promise<AccountResult<{ key: string }>> {
    const row = this.row('key', input.key);
    if (!row) return { ok: false, error: 'not_found' };
    if (row.owner === 1) return { ok: false, error: 'owner_kept' };
    if (this.locked(row.email)) return { ok: false, error: 'locked' };
    if (!secretsMatch(await hashPassword(input.password, row.salt), row.hash)) {
      this.allow(`fail:${row.email}`, MAX_FAILURES, LOCK_MS);
      return { ok: false, error: 'wrong' };
    }
    this.sql().exec('DELETE FROM accounts WHERE id = ?', row.id);
    return { ok: true, value: { key: row.key } };
  }

  /** Everyone but the owner who has opened the app since `sinceIso`: whom the morning brief is written for. */
  async active(sinceIso: string): Promise<Who[]> {
    return this.sql()
      .exec<Row>('SELECT * FROM accounts WHERE owner = 0 AND seen >= ?', sinceIso)
      .toArray()
      .map((r) => ({ id: String(r.id), owner: false, key: String(r.key) }));
  }

  /** For the owner: how many accounts there are, without who. */
  async count(): Promise<number> {
    return Number(this.sql().exec<{ c: number }>('SELECT COUNT(*) AS c FROM accounts WHERE owner = 0').one().c);
  }
}

/** The one accounts object. */
export const accounts = (env: Env) => env.ACCOUNTS.get(env.ACCOUNTS.idFromName('accounts'));

/**
 * Who may use this key — the owner's `SYNC_KEY`, or an account's own key.
 * Anything else reaches nothing.
 */
export async function authorize(env: Env, key: string): Promise<Who | null> {
  if (!key) return null;
  if (env.SYNC_KEY && secretsMatch(key, env.SYNC_KEY)) return { id: 'owner', owner: true, key };
  if (!key.startsWith('u_') || key.length > 80) return null;
  return accounts(env).byKey(key);
}
