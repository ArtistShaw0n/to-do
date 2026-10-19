/**
 * Proof that the hub does not rewrite what it already holds.
 *
 *     pnpm test:writes
 *
 * Each time a Durable Object wakes, TinyBase's persister saves the whole vault
 * back — every cell is a key of its own. The free plan allows 100,000 rows written
 * a day, so about 120 wakes of an ~800-entry vault used all of it, and on
 * 2026-10-19 Cloudflare blocked the hub until midnight UTC. `worker/storage.ts`
 * stops that. These run TinyBase's own persister against a stand-in for Durable
 * Object storage that counts every row it is asked to write.
 */

import { createMergeableStore, type MergeableStore } from 'tinybase';
import { createDurableObjectStoragePersister } from 'tinybase/persisters/persister-durable-object-storage';
import { skipUnchangedWrites } from '../worker/storage';

const results: [string, boolean, string?][] = [];
const check = (n: string, ok: boolean, d?: string) => results.push([n, ok, d]);
const settle = () => new Promise((resolve) => setTimeout(resolve, 40));

/** Durable Object storage as far as TinyBase uses it, counting every row it is asked to write. */
function fakeStorage() {
  const data = new Map<string, unknown>();
  const self = {
    /** Rows written. A put of a value that is already there still counts — as it does on the platform. */
    written: 0,
    /** The platform saying "daily rows_written limit exceeded". */
    refuse: false,
    size: () => data.size,
    async list({ prefix = '' }: { prefix?: string } = {}) {
      return new Map([...data].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)]));
    },
    async transaction<T>(closure: (txn: unknown) => Promise<T>): Promise<T> {
      const staged = new Map<string, unknown>();
      const txn = {
        async get(keys: string[]) {
          if (keys.length > 128) throw new Error('get() takes at most 128 keys');
          return new Map(keys.filter((k) => data.has(k)).map((k) => [k, structuredClone(data.get(k))]));
        },
        async put(entries: Record<string, unknown>) {
          if (Object.keys(entries).length > 128) throw new Error('put() takes at most 128 entries');
          for (const [k, v] of Object.entries(entries)) staged.set(k, structuredClone(v));
        },
      };
      const result = await closure(txn);
      if (self.refuse && staged.size) throw new Error('Durable Objects daily rows_written limit exceeded');
      for (const [k, v] of staged) { data.set(k, v); self.written += 1; }
      return result;
    },
  };
  return self;
}

/** A vault of the size this one is: ~60 tasks of ~11 cells each. */
function vaultOf(tasks: number): MergeableStore {
  const store = createMergeableStore();
  for (let i = 0; i < tasks; i++) {
    store.setRow('tasks', `t${i}`, {
      title: `Task number ${i}`, status: 'todo', priority: 2, project: 'OERP', tags: '["bug","email"]',
      notes: 'A line of notes', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
      order: i, due: '2026-10-20', originalInput: 'kal kaj korte hobe',
    });
  }
  store.setRow('notes', 'n1', { title: 'Wifi', kind: 'wifi', body: '' });
  store.setValue('version', 1);
  return store;
}

/** What the Durable Object's constructor does when it wakes. */
async function wake(storage: unknown, store: MergeableStore = createMergeableStore()) {
  const persister = createDurableObjectStoragePersister(store, storage as never);
  await persister.load();
  await persister.startAutoSave();
  return { store, persister };
}

// ── TinyBase on its own: the problem ─────────────────────────────────────────

const raw = fakeStorage();
await wake(raw, vaultOf(60));
const entries = raw.written;
check('the first save writes the whole vault, one key per cell', entries > 700, String(entries));

let before = raw.written;
await wake(raw);
const rewrote = raw.written - before;
check('TinyBase alone rewrites the entire vault every time the object wakes (this is what used the day up)',
  rewrote === entries, `${rewrote} rows rewritten for no change`);

// ── With the wrapper ─────────────────────────────────────────────────────────

const lean = fakeStorage();
const storage = skipUnchangedWrites(lean as never);

await wake(storage, vaultOf(60));
check('the first save still writes everything', lean.written === entries && lean.size() === raw.size(),
  `${lean.written} written, ${lean.size()} stored`);

before = lean.written;
const second = await wake(storage);
check('waking up again writes nothing', lean.written - before === 0, `${lean.written - before} rows`);
check('…and what it woke to is the whole vault',
  second.store.getRowCount('tasks') === 60 && second.store.getCell('tasks', 't7', 'title') === 'Task number 7');

// ── A real change still gets through, and only that ──────────────────────────

before = lean.written;
second.store.transaction(() => {
  second.store.setCell('tasks', 't7', 'status', 'done');
  second.store.setCell('tasks', 't7', 'updatedAt', '2026-10-19T10:00:00.000Z');
});
await settle();
const edit = lean.written - before;
check('an edit writes what it touched and nothing else', edit >= 2 && edit <= 8, `${edit} rows`);

before = lean.written;
const third = await wake(storage);
check('the edit is there after the next wake, and that wake writes nothing',
  third.store.getCell('tasks', 't7', 'status') === 'done' && lean.written - before === 0,
  `status=${third.store.getCell('tasks', 't7', 'status')}, ${lean.written - before} rows`);

// ── A write the platform refuses is not remembered as done ───────────────────

lean.refuse = true;
before = lean.written;
third.store.setCell('tasks', 't9', 'status', 'done');
await settle();
check('a refused write stores nothing', lean.written === before);

lean.refuse = false;
await third.persister.save();
const caught = lean.written - before;
check('the next full save writes exactly what was refused — no more, no less',
  caught >= 1 && caught <= 8, `${caught} rows`);
check('…and it is stored', (await wake(storage)).store.getCell('tasks', 't9', 'status') === 'done');

// ── The wrapper keeps to the platform's rules, and stays out of the way ──────

const big = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`k${i}`, [i, 'a', i]]));
before = lean.written;
await storage.transaction(async (txn) => { await txn.put(big); });
check('a put of more than 128 entries is split, not refused', lean.written - before === 300, `${lean.written - before}`);
before = lean.written;
await storage.transaction(async (txn) => { await txn.put(big); });
check('…and the same put again writes nothing', lean.written - before === 0, `${lean.written - before}`);
check('everything else on the storage reaches the real thing', (await storage.list({ prefix: 'k' })).size === 300);

for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `  — ${d}` : ''}`);
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} promises hold`);
process.exit(failed ? 1 : 0);
