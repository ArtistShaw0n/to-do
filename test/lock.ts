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
  applySealed, createLock, decryptValue, encryptValue, isEncrypted, lockNotes, revealNotes,
  sealPending, unlock, unlockedSecrets,
} from '../src/lib/lock';
import type { Note } from '../src/lib/types';
import { looksLikeSecret, noteLocally } from '../src/lib/normalise';

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

// ── A secret that is born plaintext after the PIN exists ─────────────────────
//
// Typed into the composer, added through the CLI, or written by an older copy of
// the app on another device: each lands readable, and each must be sealed.

const mixed = [
  ...locked,
  note({ id: 'n5', title: 'Typed after the PIN', secret: '9911' }),
  note({ id: 'n6', title: 'No secret at all', secret: undefined }),
];
const plan = await sealPending(mixed, key);
check('only the plaintext secret is queued for sealing', plan.length === 1 && plan[0].id === 'n5');
check('what is queued is encrypted, not the plaintext again',
  isEncrypted(plan[0].sealed) && plan[0].sealed !== '9911');

const sealedSet = applySealed(mixed, plan);
check('after sealing, nothing plaintext is left', unlockedSecrets(sealedSet).length === 0);
check('the sealed secret reads back to what was typed',
  (await decryptValue(sealedSet.find((n) => n.id === 'n5')!.secret!, key)) === '9911');
check('already-encrypted notes are byte-for-byte untouched',
  JSON.stringify(sealedSet.slice(0, locked.length)) === JSON.stringify(locked));
check('a note with no secret stays without one', sealedSet.find((n) => n.id === 'n6')!.secret === undefined);
check('the plaintext never survives in what would be stored', !JSON.stringify(sealedSet).includes('9911'));

// Encryption is async, so the vault can move on while it runs. Sealing must not
// put an old value back over a newer one.
const movedOn = mixed.map((n) => (n.id === 'n5' ? { ...n, secret: 'changed-meanwhile' } : n));
const afterMove = applySealed(movedOn, plan);
check('a secret edited in the meantime is not overwritten by the stale seal',
  afterMove.find((n) => n.id === 'n5')!.secret === 'changed-meanwhile');
check('…and is simply sealed on the next pass',
  (await sealPending(afterMove, key)).length === 1);

check('sealing an all-sealed set finds nothing to do', (await sealPending(sealedSet, key)).length === 0);

// ── A note made on the device never carries its secret in its title ──────────
//
// The title is the one field the PIN does not encrypt, so a value that lands
// there is on the hub in the clear however well the secret field is sealed.
// `noteLocally` used to fall back to the raw line when cleaning emptied the
// title — which is exactly what a line made only of secret words and a value does.

for (const [line, secret] of [
  ['tab er pass 5665', '5665'],
  ['wifi key 8823sd91', '8823sd91'],
  ['pin 5665', '5665'],
  ['pin 5665 5665', '5665'],
  ['PIN: 4471', '4471'],
  ['Netflix login me@x.com pass Qw12', 'Qw12'],
] as const) {
  const made = noteLocally(line);
  check(`"${line}" — the value is split out into the secret`, made.secret === secret, String(made.secret));
  check(`"${line}" — and is absent from the title`, !made.title.includes(secret), made.title);
  check(`"${line}" — the title is not empty`, made.title.trim().length > 0);
}
// (The composer only reaches for `noteLocally` when a line has a value in it, or
// states a passcode; a line with neither is kept word for word, by `add`.)
check('a line with no value has no secret to protect',
  noteLocally('Gym locker combination is on the red keyring').secret === undefined);
check('a line that merely states a passcode is recognised', looksLikeSecret('wifi key 8823sd91'));
check('a line that asks for work on a login is not', !looksLikeSecret('portal er login page ta thik korte hobe'));

for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `  — ${d}` : ''}`);
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} promises hold`);
process.exit(failed ? 1 : 0);
