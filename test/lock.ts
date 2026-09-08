/**
 * Proof that the Notes PIN does what it claims.
 *
 *     pnpm test:lock
 *
 * A lock that is weaker than it looks is worse than no lock, so each test is
 * named after the promise it defends.
 */

import { webcrypto } from 'node:crypto';
import {
  createLock, decryptValue, encryptValue, isEncrypted, lockNotes, revealNotes, unlock,
  unlockedSecrets,
} from '../src/lib/lock';
import type { Note } from '../src/lib/types';

if (!globalThis.crypto) (globalThis as { crypto?: Crypto }).crypto = webcrypto as unknown as Crypto;

const results: [string, boolean, string?][] = [];
const check = (n: string, ok: boolean, d?: string) => results.push([n, ok, d]);

const note = (over: Partial<Note> = {}): Note => ({
  id: 'n1', kind: 'code', title: 'Tab unlock PIN', secret: '5665', body: '',
  createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z', order: 1,
  ...over,
});

const { config, key } = await createLock('5665');

// ── The PIN itself is never kept ─────────────────────────────────────────────

const stored = JSON.stringify(config);
check('the PIN does not appear in what is stored', !stored.includes('5665'));
check('a salt is kept', config.salt.length > 10);
check('the iteration count is at the OWASP floor', config.iterations >= 310_000);

// ── Recognising the right PIN ────────────────────────────────────────────────

check('the right PIN unlocks', (await unlock('5665', config)) !== null);
check('a wrong PIN does not', (await unlock('5666', config)) === null);
check('an empty PIN does not', (await unlock('', config)) === null);

const other = await createLock('5665');
check('the same PIN on another device gives a different salt', other.config.salt !== config.salt);
check('…and a different stored hash, so one cannot be recognised from the other',
  other.config.verifier !== config.verifier);

// ── Encrypting a secret ──────────────────────────────────────────────────────

const cipher = await encryptValue('5665', key);
check('the plaintext is not in the ciphertext', !cipher.includes('5665'));
check('ciphertext is marked as such', isEncrypted(cipher));
check('plaintext is not mistaken for ciphertext', !isEncrypted('5665'));
check('it decrypts back', (await decryptValue(cipher, key)) === '5665');

const again = await encryptValue('5665', key);
check('the same value encrypts differently each time', cipher !== again,
  'a reused IV is what breaks AES-GCM');
check('…and both still decrypt', (await decryptValue(again, key)) === '5665');

const wrongKey = (await createLock('9999')).key;
check('a wrong key cannot read it', (await decryptValue(cipher, wrongKey)) === null);
check('a wrong key returns null rather than throwing',
  (await decryptValue('enc.v1:zzz.zzz', key)) === null);

// ── Whole notes ──────────────────────────────────────────────────────────────

const notes = [note(), note({ id: 'n2', title: 'Home wifi', secret: 'Shawon2026' }), note({ id: 'n3', title: 'A note with nothing to hide', secret: undefined })];
const locked = await lockNotes(notes, key);

check('every secret is encrypted', locked.filter((n) => n.secret).every((n) => isEncrypted(n.secret)));
check('a note with no secret is untouched', locked[2].secret === undefined);
check('titles stay readable while locked', locked[0].title === 'Tab unlock PIN',
  'a locked list is still a list');
check('no plaintext secret survives anywhere in the locked set',
  !JSON.stringify(locked).includes('5665') && !JSON.stringify(locked).includes('Shawon2026'));

const revealed = await revealNotes(locked, key);
check('the right key reveals them again',
  revealed[0].secret === '5665' && revealed[1].secret === 'Shawon2026');

const blind = await revealNotes(locked, wrongKey);
check('a wrong key reveals nothing', blind.every((n) => n.secret === undefined));
check('…and the notes still exist', blind.length === 3 && blind[0].title === 'Tab unlock PIN');

// ── Encrypting twice must not double-wrap ────────────────────────────────────

const twice = await lockNotes(locked, key);
check('locking an already-locked set changes nothing',
  JSON.stringify(twice) === JSON.stringify(locked));
check('anything written before the PIN existed is found',
  unlockedSecrets([...locked, note({ id: 'n4', secret: 'plain' })]).length === 1);

for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `  — ${d}` : ''}`);
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} promises hold`);
process.exit(failed ? 1 : 0);
