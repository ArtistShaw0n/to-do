/**
 * Storage that does not rewrite what it already holds.
 *
 * TinyBase's Durable Object server, each time it wakes, loads the vault and then
 * saves *all of it back*: every cell, row and table is a key of its own, and
 * `startAutoSave` begins with a full save whether or not anything changed. A
 * Durable Object is put to sleep after a few idle seconds and woken by the next
 * request, so every wake rewrote the whole vault — about 800 rows, every time.
 *
 * The free plan allows 100,000 rows written a day. That is roughly 120 wakes: a
 * few devices coming to the front, a few AI calls, a deploy or two. On 2026-10-19
 * it ran out, and Cloudflare refused every request that reaches the object until
 * 00:00 UTC — no sync and no AI, on every device, for the rest of the day.
 *
 * This wraps the storage the persister is given and drops a write of what is
 * already stored. Reads are cheap (five million a day free); writes are what run
 * out. A real change still goes through — TinyBase already writes only those once
 * it is running — and so does a write that failed earlier, because the comparison
 * is with what storage actually holds, not with what was last attempted.
 *
 * `test:writes` holds each of these as a named promise.
 */

/** The most keys a Durable Object takes in one `get` or one `put`. */
const BATCH = 128;

type Entries = Record<string, unknown>;

/** A member of the real object, bound to it, so it still works when reached through a Proxy. */
const bound = (target: object, prop: string | symbol) => {
  const member = Reflect.get(target, prop, target);
  return typeof member === 'function' ? member.bind(target) : member;
};

/** Put only the entries whose stored value is different, or missing. */
async function putChanged(txn: DurableObjectTransaction, entries: Entries): Promise<void> {
  const keys = Object.keys(entries);
  const changed: string[] = [];

  for (let i = 0; i < keys.length; i += BATCH) {
    const slice = keys.slice(i, i + BATCH);
    const held = await txn.get<unknown>(slice);
    for (const key of slice) {
      if (!held.has(key) || JSON.stringify(held.get(key)) !== JSON.stringify(entries[key])) changed.push(key);
    }
  }

  for (let i = 0; i < changed.length; i += BATCH) {
    await txn.put(Object.fromEntries(changed.slice(i, i + BATCH).map((key) => [key, entries[key]])));
  }
}

function skipUnchanged(txn: DurableObjectTransaction): DurableObjectTransaction {
  return new Proxy(txn, {
    get(target, prop) {
      if (prop === 'put') {
        return (first: unknown, ...rest: unknown[]) =>
          // TinyBase only ever puts one object of entries. Anything else — a single
          // key, or a call with options — is not ours to second-guess.
          first && typeof first === 'object' && rest.length === 0
            ? putChanged(target, first as Entries)
            : Reflect.apply(target.put, target, [first, ...rest]);
      }
      return bound(target, prop);
    },
  });
}

export function skipUnchangedWrites(storage: DurableObjectStorage): DurableObjectStorage {
  return new Proxy(storage, {
    get(target, prop) {
      if (prop === 'transaction') {
        return <T>(closure: (txn: DurableObjectTransaction) => Promise<T>): Promise<T> =>
          target.transaction((txn) => closure(skipUnchanged(txn)));
      }
      return bound(target, prop);
    },
  });
}
