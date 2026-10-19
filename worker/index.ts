/**
 * The sync hub.
 *
 * A Cloudflare Worker that routes WebSocket connections to a Durable Object,
 * which holds the authoritative copy of the vault and relays changes between
 * every connected device. TinyBase supplies both halves; this file is routing,
 * access control, and the few things only the hub can do because it is the one
 * participant that is always on — spend the day's AI budget, and write the
 * morning brief.
 *
 * Every client speaks the same protocol — the Mac app, the Windows app, the
 * phones, and the CLI that Claude drives. There is deliberately no second HTTP
 * API for the vault: a separate write path would be a separate place for the
 * merge rules to be applied slightly differently, and that is exactly the kind
 * of difference that loses a task months later. `/ai/*` is not a second way to
 * write the vault; it asks questions and, for the brief, writes one row through
 * the very store the sockets share.
 */

import { createMergeableStore, type MergeableStore } from 'tinybase';
import { createDurableObjectStoragePersister } from 'tinybase/persisters/persister-durable-object-storage';
import {
  getWsServerDurableObjectFetch,
  WsServerDurableObject,
} from 'tinybase/synchronizers/synchronizer-ws-server-durable-object';
import type { Env } from './env';
import { secretsMatch } from './secret';
import { handleAi, dailyCap } from './aiRoutes';
import { writeBrief, type BriefResult } from './brief';
import { dayIn, safeZone } from './day';
import { isConfigured } from './ai';

export type { Env };

/**
 * Everything this file stores lives in a SQL table, never in key-value storage.
 *
 * That is not a style choice. TinyBase's persister loads the vault by listing
 * *every* key-value entry in the object's storage and reading each as one of its
 * own. A counter written there — a bare number — cannot be read as one, so the
 * load fails, quietly; the vault comes back empty; and the next save writes that
 * emptiness over everything. It happened: one restart after the first day's
 * budget was spent, the hub held no tasks. A SQL table is invisible to that
 * listing, which is the whole of the fix, and `test:ai` now restarts the hub with
 * a spent budget and checks the vault is still there.
 */
const SQL_USAGE = 'CREATE TABLE IF NOT EXISTS ai_usage (day TEXT PRIMARY KEY, used INTEGER NOT NULL)';

/** What an earlier version wrote into key-value storage, and must be cleared before the vault loads. */
const LEGACY_KV_PREFIX = 'ai/';

export class TodoSync extends WsServerDurableObject<Env> {
  /**
   * The hub's own copy of the vault.
   *
   * `declare`, not a plain field: TinyBase's constructor calls
   * `createPersister()` while it is still constructing, and a field with an
   * initialiser would be reset to `undefined` the moment that constructor
   * returned — silently, and only on the DO's first request after waking.
   */
  private declare store?: MergeableStore;
  private declare briefing?: Promise<BriefResult>;

  /**
   * Persist the store to the Durable Object's own storage.
   *
   * Without this the vault would live only in the connected clients: the first
   * moment all four devices are closed at once, the hub would come back empty
   * and hand that emptiness to whichever device connected next.
   *
   * The store is also a *peer*: TinyBase wires it into the same synchronizer
   * the sockets use, so a row written to it here reaches every device.
   */
  async createPersister() {
    // An earlier version kept the day's counter as a key-value entry, which the
    // vault's own loader cannot read (see SQL_USAGE). Any left behind are
    // removed *before* the load, or the load would fail on them once more.
    const legacy = [...(await this.ctx.storage.list({ prefix: LEGACY_KV_PREFIX })).keys()];
    if (legacy.length) await this.ctx.storage.delete(legacy);

    const store = createMergeableStore();
    this.store = store;
    return createDurableObjectStoragePersister(store, this.ctx.storage);
  }

  // ── The day's AI budget ────────────────────────────────────────────────────

  /**
   * Spend one unit of the day's budget, or say there is none left.
   *
   * A Durable Object handles one thing at a time, so two calls cannot both read
   * "149 of 150" and both go ahead — which is why the counter lives here and
   * not in the Worker, where it would race.
   */
  async reserve(day: string, cap: number): Promise<{ ok: boolean; used: number }> {
    const sql = this.ctx.storage.sql;
    sql.exec(SQL_USAGE);

    const row = sql.exec<{ used: number }>('SELECT used FROM ai_usage WHERE day = ?', day).toArray()[0];
    const used = row ? Number(row.used) : 0;
    if (used >= cap) return { ok: false, used };

    // A new day: yesterday's counter has nothing left to say.
    if (!row) sql.exec('DELETE FROM ai_usage WHERE day != ?', day);

    sql.exec(
      'INSERT INTO ai_usage (day, used) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET used = excluded.used',
      day, used + 1,
    );
    return { ok: true, used: used + 1 };
  }

  // ── Recovery (see restore.ts) ──────────────────────────────────────────────
  // Dormant: nothing routes here. Re-adding the route in index.ts, for as long as it
  // takes, is how a vault is put back.

  async restoreTo(iso: string): Promise<{ bookmark: string; undo: string; now: string }> {
    const when = new Date(iso);
    if (Number.isNaN(when.getTime())) throw new Error('not a time');
    const now = await this.ctx.storage.getCurrentBookmark();
    const bookmark = await this.ctx.storage.getBookmarkForTime(when);
    const undo = await this.ctx.storage.onNextSessionRestoreBookmark(bookmark);
    return { bookmark, undo, now };
  }

  async restoreBookmark(bookmark: string): Promise<{ bookmark: string; undo: string }> {
    const undo = await this.ctx.storage.onNextSessionRestoreBookmark(bookmark);
    return { bookmark, undo };
  }

  restartNow(): void {
    this.ctx.abort('restore');
  }

  async usedOn(day: string): Promise<number> {
    const sql = this.ctx.storage.sql;
    sql.exec(SQL_USAGE);
    const row = sql.exec<{ used: number }>('SELECT used FROM ai_usage WHERE day = ?', day).toArray()[0];
    return row ? Number(row.used) : 0;
  }

  // ── The morning brief ──────────────────────────────────────────────────────

  /**
   * Write today's brief. One at a time: the morning job and an app opening at
   * the same moment would otherwise both ask Claude and both be charged.
   */
  makeBrief(opts: { force: boolean }): Promise<BriefResult> {
    this.briefing ??= this.runBrief(opts.force).finally(() => { this.briefing = undefined; });
    return this.briefing;
  }

  private async runBrief(force: boolean): Promise<BriefResult> {
    const tz = safeZone(this.env.TIMEZONE);
    const store = this.store;
    if (!store) return { status: 'failed', date: dayIn(tz), reason: 'no_store' };

    return writeBrief(this.env, store, {
      tz,
      force,
      reserve: async () => (await this.reserve(dayIn(tz), dailyCap(this.env))).ok,
    });
  }
}

const routeToDurableObject = getWsServerDurableObjectFetch<'TODO_SYNC'>('TODO_SYNC');

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response('ok', { headers: { 'content-type': 'text/plain' } });
    }

    // The path is `/sync/<key>`. It names the Durable Object *and* proves the
    // caller is allowed to reach it.
    //
    // A secret in the path is not the shape one would choose freely — it can
    // land in logs — but browsers cannot set headers on a WebSocket handshake,
    // and this has to work from a phone's browser as well as from Node. The
    // URL is inside TLS, the Worker never logs it, and one wrong key reaches
    // nothing: a different key is simply a different, empty Durable Object.
    const parts = url.pathname.split('/').filter(Boolean);

    // Claude's doors. These *can* carry the key in a header, so they do.
    if (parts[0] === 'ai') return handleAi(request, env, parts);


    if (parts[0] !== 'sync') {
      // Everything else is the app itself.
      return env.ASSETS.fetch(request);
    }
    if (parts.length !== 2) {
      return new Response('not found', { status: 404 });
    }
    if (!env.SYNC_KEY || !secretsMatch(parts[1], env.SYNC_KEY)) {
      return new Response('forbidden', { status: 403 });
    }

    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('expected a websocket upgrade', { status: 426 });
    }

    return routeToDurableObject(request, env);
  },

  /**
   * Half past six in the morning, Dhaka time (see `[triggers]`): write the day's
   * brief so it is already there when the app opens. Quiet when there is no API
   * key — the hub is for syncing first, and a missing key is not an error.
   */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (!isConfigured(env) || !env.SYNC_KEY) return;
    const stub = env.TODO_SYNC.get(env.TODO_SYNC.idFromName(`sync/${env.SYNC_KEY}`)) as unknown as DurableObjectStub<TodoSync>;
    ctx.waitUntil(
      stub.makeBrief({ force: false })
        .then((r) => console.log(`[brief] ${r.status}${r.reason ? ` (${r.reason})` : ''}`))
        .catch(() => console.error('[brief] crashed')),
    );
  },
};
