/**
 * DORMANT — the way back after something empties or corrupts the vault.
 *
 * Nothing routes to this. To use it, import `handleRestore` in index.ts and send
 * `/admin/restore` to it, deploy, do the restore, then take the two lines out and
 * deploy again. It was last used on 2026-10-19, after the budget-counter bug
 * emptied the vault (see `SQL_USAGE` in index.ts), and it worked.
 *
 * Cloudflare keeps a log of every Durable Object's storage for 30 days and can
 * put it back exactly as it was at any moment in that window. There is no button
 * for it: it is an API, callable only from inside the object. This is the smallest
 * door that reaches it, behind the same key as everything else, and it is meant to
 * left disconnected when it is not needed.
 *
 * Every restore hands back an "undo" bookmark — the state just before — so a
 * restore to the wrong moment can itself be reversed.
 */

import type { Env } from './env';
import type { TodoSync } from './index';
import { secretsMatch } from './secret';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

export async function handleRestore(request: Request, env: Env): Promise<Response> {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!env.SYNC_KEY || !secretsMatch(token, env.SYNC_KEY)) return json({ error: 'forbidden' }, 403);
  if (request.method !== 'POST') return json({ error: 'post only' }, 405);

  const body = await request.json().catch(() => ({})) as { to?: string; bookmark?: string; restart?: boolean };
  const stub = env.TODO_SYNC.get(env.TODO_SYNC.idFromName(`sync/${env.SYNC_KEY}`)) as unknown as DurableObjectStub<TodoSync>;

  try {
    if (body.restart === true) {
      // The restart kills the object mid-call, so the call is *expected* to fail.
      await stub.restartNow().catch(() => undefined);
      return json({ restarted: true });
    }
    if (typeof body.bookmark === 'string') return json(await stub.restoreBookmark(body.bookmark));
    if (typeof body.to === 'string') return json(await stub.restoreTo(body.to));
    return json({ error: 'send { to: <ISO time> }, { bookmark }, or { restart: true }' }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'failed' }, 500);
  }
}
