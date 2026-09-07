/**
 * The vault as a TinyBase store.
 *
 * The vault has always been one JSON document, which is why two machines could
 * not safely share it: they write the same file, and a file-sync service has no
 * way to merge two versions of it — it keeps one and renames the other a
 * conflicted copy. Nothing warns you which tasks went with it.
 *
 * A `MergeableStore` fixes that at the root. Every task, note and project is a
 * row, and each row carries the metadata needed to reconcile it with the same
 * row edited elsewhere. Two devices touching *different* tasks — which is what
 * actually happens for a single person — never contend at all.
 *
 * This module owns only the mapping between that store and the `Vault` shape
 * the rest of the app already speaks. Sync and persistence sit on top of it.
 */

import { createMergeableStore, type MergeableStore } from 'tinybase';
import {
  emptyVault, NOTE_KINDS, STATUSES,
  type Digest, type Note, type NoteKind, type Priority, type Project,
  type Status, type Subtask, type Task, type Vault,
} from './types';

export const TABLES = {
  tasks: 'tasks',
  notes: 'notes',
  projects: 'projects',
  digests: 'digests',
} as const;

/**
 * TinyBase cells hold a string, number or boolean — nothing else. `tags` and
 * `subtasks` are therefore stored as JSON text.
 *
 * That is a deliberate trade. Modelling tags as their own table would let two
 * devices each add a different tag to the same task and keep both; as one JSON
 * value, the later edit wins the whole list. For one person editing their own
 * tasks days apart, that case does not arise, and the simpler shape is the one
 * with fewer places to be wrong.
 */
function packList(value: unknown[]): string {
  return value.length ? JSON.stringify(value) : '';
}

function unpackList<T>(cell: unknown): T[] {
  if (typeof cell !== 'string' || !cell) return [];
  try {
    const parsed = JSON.parse(cell);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    // A hand-edited or truncated cell must not take the whole vault down.
    return [];
  }
}

/** Cells cannot be undefined, so absent optional fields are simply not set. */
function defined(row: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== undefined && v !== null) out[k] = v as string | number | boolean;
  }
  return out;
}

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v !== '' ? v : undefined;
const num = (v: unknown): number | undefined =>
  typeof v === 'number' ? v : undefined;

// ── Vault → store ────────────────────────────────────────────────────────────

export function taskToRow(t: Task): Record<string, string | number | boolean> {
  return defined({
    title: t.title,
    notes: t.notes,
    status: t.status,
    priority: t.priority,
    tags: packList(t.tags),
    project: t.project,
    due: t.due,
    scheduled: t.scheduled,
    estimateMin: t.estimateMin,
    subtasks: packList(t.subtasks),
    recurrence: t.recurrence,
    blockedReason: t.blockedReason,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    startedAt: t.startedAt,
    completedAt: t.completedAt,
    order: t.order,
    source: t.source,
    originalInput: t.originalInput,
    needsNormalise: t.needsNormalise,
    claimedBy: t.claimedBy,
    claimedAt: t.claimedAt,
  });
}

export function noteToRow(n: Note): Record<string, string | number | boolean> {
  return defined({
    kind: n.kind,
    title: n.title,
    username: n.username,
    secret: n.secret,
    url: n.url,
    body: n.body,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    order: n.order,
  });
}

export function writeVaultToStore(store: MergeableStore, vault: Vault): MergeableStore {
  store.transaction(() => {
    store.setTable(TABLES.tasks, Object.fromEntries(
      vault.tasks.map((t) => [t.id, taskToRow(t)]),
    ));
    store.setTable(TABLES.notes, Object.fromEntries(
      vault.notes.map((n) => [n.id, noteToRow(n)]),
    ));
    store.setTable(TABLES.projects, Object.fromEntries(
      vault.projects.map((p) => [p.id, defined({
        name: p.name, color: p.color, createdAt: p.createdAt,
      })]),
    ));
    // Digests are keyed by date, which is already unique per entry.
    store.setTable(TABLES.digests, Object.fromEntries(
      vault.digests.map((d) => [d.date, defined({
        markdown: d.markdown,
        stats: JSON.stringify(d.stats),
        createdAt: d.createdAt,
        author: d.author,
      })]),
    ));
    store.setValues(defined({
      version: vault.version,
      createdAt: vault.meta.createdAt,
      updatedAt: vault.meta.updatedAt,
      lastSeq: vault.meta.lastSeq,
    }));
  });
  return store;
}

export function vaultToStore(vault: Vault): MergeableStore {
  return writeVaultToStore(createMergeableStore(), vault);
}

// ── Store → vault ────────────────────────────────────────────────────────────

function rowToTask(id: string, row: Record<string, unknown>): Task {
  const status = STATUSES.includes(row.status as Status) ? (row.status as Status) : 'todo';
  const priority = [0, 1, 2, 3].includes(row.priority as number)
    ? (row.priority as Priority)
    : 2;
  const source = ['claude', 'app', 'cli'].includes(row.source as string)
    ? (row.source as Task['source'])
    : 'app';

  return {
    id,
    title: str(row.title) ?? '',
    notes: str(row.notes),
    status,
    priority,
    tags: unpackList<string>(row.tags),
    project: str(row.project),
    due: str(row.due),
    scheduled: str(row.scheduled),
    estimateMin: num(row.estimateMin),
    subtasks: unpackList<Subtask>(row.subtasks),
    recurrence: str(row.recurrence) as Task['recurrence'],
    blockedReason: str(row.blockedReason),
    createdAt: str(row.createdAt) ?? new Date().toISOString(),
    updatedAt: str(row.updatedAt) ?? new Date().toISOString(),
    startedAt: str(row.startedAt),
    completedAt: str(row.completedAt),
    order: num(row.order) ?? 0,
    source,
    originalInput: str(row.originalInput),
    needsNormalise: row.needsNormalise === true ? true : undefined,
    claimedBy: str(row.claimedBy),
    claimedAt: str(row.claimedAt),
  };
}

function rowToNote(id: string, row: Record<string, unknown>): Note {
  const kind = NOTE_KINDS.includes(row.kind as NoteKind) ? (row.kind as NoteKind) : 'other';
  return {
    id,
    kind,
    title: str(row.title) ?? '',
    username: str(row.username),
    secret: str(row.secret),
    url: str(row.url),
    body: str(row.body) ?? '',
    createdAt: str(row.createdAt) ?? new Date().toISOString(),
    updatedAt: str(row.updatedAt) ?? new Date().toISOString(),
    order: num(row.order) ?? 0,
  };
}

export function storeToVault(store: MergeableStore): Vault {
  const base = emptyVault();
  const values = store.getValues() as Record<string, unknown>;

  const tasks: Task[] = Object.entries(store.getTable(TABLES.tasks))
    .map(([id, row]) => rowToTask(id, row as Record<string, unknown>));

  const notes: Note[] = Object.entries(store.getTable(TABLES.notes))
    .map(([id, row]) => rowToNote(id, row as Record<string, unknown>));

  const projects: Project[] = Object.entries(store.getTable(TABLES.projects))
    .map(([id, row]) => {
      const r = row as Record<string, unknown>;
      return {
        id,
        name: str(r.name) ?? '',
        color: str(r.color) ?? '',
        createdAt: str(r.createdAt),
      };
    });

  const digests: Digest[] = Object.entries(store.getTable(TABLES.digests))
    .map(([date, row]) => {
      const r = row as Record<string, unknown>;
      let stats = base.digests[0]?.stats;
      try {
        stats = JSON.parse(str(r.stats) ?? 'null') ?? stats;
      } catch {
        // A malformed stats blob costs a digest's numbers, not the digest.
      }
      return {
        date,
        markdown: str(r.markdown) ?? '',
        stats: stats as Digest['stats'],
        createdAt: str(r.createdAt) ?? '',
        author: str(r.author) ?? 'auto',
      };
    });

  return {
    version: num(values.version) ?? base.version,
    // Row order is not meaningful in a store; the app sorts by `order` anyway,
    // but sorting here keeps a round trip byte-identical to what went in.
    tasks: tasks.sort((a, b) => a.order - b.order),
    notes: notes.sort((a, b) => a.order - b.order),
    projects,
    digests: digests.sort((a, b) => a.date.localeCompare(b.date)),
    meta: {
      createdAt: str(values.createdAt) ?? base.meta.createdAt,
      updatedAt: str(values.updatedAt) ?? base.meta.updatedAt,
      lastSeq: num(values.lastSeq) ?? 0,
    },
  };
}

// ── Writing a whole vault without touching every row ─────────────────────────

/** Cell-by-cell equality; row objects are flat, so this is the whole test. */
function sameRow(
  a: Record<string, unknown> | undefined,
  b: Record<string, string | number | boolean>,
): boolean {
  if (!a) return false;
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return bk.every((k) => a[k] === b[k]);
}

function syncTable(
  store: MergeableStore,
  table: string,
  rows: Record<string, Record<string, string | number | boolean>>,
): void {
  const existing = store.getTable(table) as Record<string, Record<string, unknown>>;

  for (const [id, row] of Object.entries(rows)) {
    // Writing an unchanged row would stamp it as freshly edited, and a later
    // merge would then prefer it over a genuine edit made on another device.
    if (!sameRow(existing[id], row)) store.setRow(table, id, row);
  }
  for (const id of Object.keys(existing)) {
    if (!(id in rows)) store.delRow(table, id);
  }
}

/**
 * Apply a whole `Vault` to the store, writing only what actually differs.
 *
 * The app's mutation API hands back a complete vault rather than a patch, which
 * is the right shape for the UI but the wrong one for a store whose merging is
 * per row: `setTable` would restamp every row on every keystroke, and the next
 * merge would treat all of them as newer than another device's real edits. The
 * point of moving off a single JSON document would be lost at the last step.
 */
export function applyVaultToStore(store: MergeableStore, vault: Vault): void {
  store.transaction(() => {
    syncTable(store, TABLES.tasks, Object.fromEntries(
      vault.tasks.map((t) => [t.id, taskToRow(t)]),
    ));
    syncTable(store, TABLES.notes, Object.fromEntries(
      vault.notes.map((n) => [n.id, noteToRow(n)]),
    ));
    syncTable(store, TABLES.projects, Object.fromEntries(
      vault.projects.map((p) => [p.id, defined({
        name: p.name, color: p.color, createdAt: p.createdAt,
      })]),
    ));
    syncTable(store, TABLES.digests, Object.fromEntries(
      vault.digests.map((d) => [d.date, defined({
        markdown: d.markdown,
        stats: JSON.stringify(d.stats),
        createdAt: d.createdAt,
        author: d.author,
      })]),
    ));
    store.setValues(defined({
      version: vault.version,
      createdAt: vault.meta.createdAt,
      updatedAt: vault.meta.updatedAt,
      lastSeq: vault.meta.lastSeq,
    }));
  });
}
