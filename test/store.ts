/**
 * The vault-to-store mapping, and the property the whole design depends on:
 * writing a whole vault must touch only the rows that actually changed.
 *
 *     pnpm test:store
 *
 * No server needed — this is all in-process.
 */

import { readFileSync } from 'node:fs';
import { createMergeableStore } from 'tinybase';
import { applyVaultToStore, storeToVault, vaultToStore, writeVaultToStore } from '../src/lib/store';
import type { Vault } from '../src/lib/types';

const results: [string, boolean, string?][] = [];
const check = (n: string, ok: boolean, detail?: string) => results.push([n, ok, detail]);

const vaultFile = process.env.VAULT ?? 'data/tasks.json';
const seed = JSON.parse(readFileSync(vaultFile, 'utf8')) as Vault;

/** Key order carries no meaning in JSON; compare content, not spelling. */
const canon = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([, x]) => x !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, x]) => [k, canon(x)]),
    );
  }
  return v;
};
const norm = (v: Vault) => JSON.stringify(canon({
  ...v,
  tasks: [...v.tasks].sort((a, b) => a.id.localeCompare(b.id)),
  notes: [...v.notes].sort((a, b) => a.id.localeCompare(b.id)),
  projects: [...v.projects].sort((a, b) => a.id.localeCompare(b.id)),
}));

// 1. A full round trip must not lose or alter a single field.
check('round trip preserves the real vault', norm(storeToVault(vaultToStore(seed))) === norm(seed),
  `${seed.tasks.length} tasks, ${seed.notes.length} notes, ${seed.projects.length} projects`);

// 2. Writing an unchanged vault must not restamp anything.
//
// This is the one that matters. The app hands back a whole vault on every edit;
// if that restamps every row, a later merge treats all of them as newer than
// another device's genuine edits, and moving off a single JSON document buys
// nothing.
const store = writeVaultToStore(createMergeableStore('test'), seed);

/**
 * A content hash per task row.
 *
 * `getMergeableContent()` nests as [tables, values], each entry being
 * [content, stamp, hash] all the way down to the cell. The row-level *stamp* is
 * empty — an earlier version of this test read that and saw nothing ever
 * change — so the hash at index 2 is the signal for "this row was rewritten".
 */
const hashesOf = (): Record<string, number> => {
  const [tablesEntry] = store.getMergeableContent();
  const tables = tablesEntry[0] as Record<string, [Record<string, unknown[]>, string, number]>;
  const [rows] = tables.tasks;
  return Object.fromEntries(
    Object.entries(rows).map(([id, row]) => [id, row[2] as number]),
  );
};

const before = hashesOf();
applyVaultToStore(store, seed);
const afterNoop = hashesOf();
const restamped = Object.keys(before).filter((id) => before[id] !== afterNoop[id]);
check('re-writing an identical vault rewrites nothing', restamped.length === 0,
  restamped.length ? `${restamped.length} rows rewritten` : 'all rows untouched');

// 3. Changing one task must restamp exactly that task.
const target = seed.tasks[3].id;
const edited: Vault = {
  ...seed,
  tasks: seed.tasks.map((t) => (t.id === target ? { ...t, title: `${t.title} (edited)` } : t)),
};
applyVaultToStore(store, edited);
const afterEdit = hashesOf();
const changed = Object.keys(before).filter((id) => before[id] !== afterEdit[id]);
check('editing one task rewrites only that task',
  changed.length === 1 && changed[0] === target,
  `rewritten: ${changed.join(', ') || 'none'}`);

// 4. Deleting a task must remove it, and leave the rest alone.
const withoutOne: Vault = { ...edited, tasks: edited.tasks.filter((t) => t.id !== seed.tasks[5].id) };
applyVaultToStore(store, withoutOne);
const back = storeToVault(store);
check('deleting a task removes exactly one',
  back.tasks.length === seed.tasks.length - 1 && !back.tasks.some((t) => t.id === seed.tasks[5].id));

// 5. Adding a task must not disturb the others.
const beforeAdd = hashesOf();
const withNew: Vault = {
  ...withoutOne,
  tasks: [...withoutOne.tasks, {
    ...seed.tasks[0], id: 'brand-new', title: 'A brand new task', order: 9999,
  }],
};
applyVaultToStore(store, withNew);
const afterAdd = hashesOf();
const disturbed = Object.keys(beforeAdd).filter((id) => beforeAdd[id] !== afterAdd[id]);
check('adding a task disturbs no existing row', disturbed.length === 0,
  disturbed.length ? `disturbed: ${disturbed.join(', ')}` : 'none disturbed');

for (const [n, ok, detail] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${detail ? `  — ${detail}` : ''}`);
}
process.exit(results.some(([, ok]) => !ok) ? 1 : 0);
