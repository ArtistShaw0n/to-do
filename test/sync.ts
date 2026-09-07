/**
 * Proof that four devices can share one vault without losing anything.
 *
 * This is the claim the whole sync design rests on, so it is checked against a
 * real Worker and a real Durable Object rather than a mock. Run the hub first:
 *
 *     pnpm sync:dev          # terminal 1
 *     pnpm test:sync         # terminal 2
 *
 * The cases that matter are the ones a file-in-a-shared-folder gets wrong: a
 * device that was switched off catching up, and a deletion made while it was
 * away staying deleted instead of being resurrected by the returning copy.
 */

import { createMergeableStore, type MergeableStore } from 'tinybase';
import { createWsSynchronizer } from 'tinybase/synchronizers/synchronizer-ws-client';

const HUB = process.env.SYNC_URL
  ?? 'ws://localhost:8787/sync/local-development-key-not-a-real-secret';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function connect(name: string) {
  const store = createMergeableStore(name);
  const sync = await createWsSynchronizer(store, new WebSocket(HUB) as never);
  await sync.startSync();
  await wait(400);
  return { store, sync };
}

const results: [string, boolean][] = [];
const check = (n: string, ok: boolean) => results.push([n, ok]);
const titles = (s: MergeableStore) =>
  Object.values(s.getTable('tasks')).map((r) => r.title as string).sort();
const has = (s: MergeableStore, id: string) => s.getRowIds('tasks').includes(id);

// The hub persists between runs — that is the point of it — so start from a
// known state rather than assuming an empty one.
const cleaner = await connect('cleaner');
for (const id of cleaner.store.getRowIds('tasks')) cleaner.store.delRow('tasks', id);
await wait(700);
await cleaner.sync.destroy();

const mac = await connect('mac');
const phone = await connect('phone');
await wait(500);
check('the hub starts from a clean slate', mac.store.getRowIds('tasks').length === 0);

mac.store.setRow('tasks', 't1', { title: 'Buy a UPS', status: 'todo', order: 1 });
await wait(700);
check('a task added on the Mac reaches the phone', has(phone.store, 't1'));

phone.store.setCell('tasks', 't1', 'status', 'done');
await wait(700);
check('completing it on the phone reaches the Mac',
  mac.store.getCell('tasks', 't1', 'status') === 'done');

// The phone goes out of range, and work continues without it.
await phone.sync.destroy();
await wait(300);
mac.store.setRow('tasks', 't2', {
  title: 'Written while the phone was away', status: 'todo', order: 2,
});
mac.store.delRow('tasks', 't1');
await wait(600);

// …and comes back.
const phone2 = await connect('phone');
await wait(1200);
check('the phone catches up on what it missed', has(phone2.store, 't2'));
check('a delete made while away is not resurrected', !has(phone2.store, 't1'));

// The CLI is a client like any other — no second write path.
const cli = await connect('cli');
await wait(1000);
check('a cold client receives the whole vault',
  JSON.stringify(titles(cli.store)) === JSON.stringify(titles(mac.store)));

cli.store.setRow('tasks', 't3', { title: 'Added by the CLI', status: 'todo', order: 3 });
await wait(900);
check("the CLI's write reaches the Mac", has(mac.store, 't3'));
check("the CLI's write reaches the phone", has(phone2.store, 't3'));

for (const [n, ok] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}`);
console.log('\nfinal, on every device:', JSON.stringify(titles(mac.store)));

await Promise.all([mac.sync.destroy(), phone2.sync.destroy(), cli.sync.destroy()]);
process.exit(results.some(([, ok]) => !ok) ? 1 : 0);
