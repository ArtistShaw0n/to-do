/**
 * The sync hub.
 *
 * A Cloudflare Worker that routes WebSocket connections to a Durable Object,
 * which holds the authoritative copy of the vault and relays changes between
 * every connected device. TinyBase supplies both halves; this file is only
 * routing and access control.
 *
 * Every client speaks the same protocol — the Mac app, the Windows app, the
 * phones, and the CLI that Claude drives. There is deliberately no second HTTP
 * API for the CLI: a separate write path would be a separate place for the
 * merge rules to be applied slightly differently, and that is exactly the kind
 * of difference that loses a task months later.
 */

import { createMergeableStore } from 'tinybase';
import { createDurableObjectStoragePersister } from 'tinybase/persisters/persister-durable-object-storage';
import {
  getWsServerDurableObjectFetch,
  WsServerDurableObject,
} from 'tinybase/synchronizers/synchronizer-ws-server-durable-object';

export interface Env {
  // Typed as the base class, not TodoSync: the routing helper only needs the
  // contract TinyBase defines, and the narrower type is not assignable to it.
  // wrangler.toml is what binds this name to the concrete class.
  TODO_SYNC: DurableObjectNamespace<WsServerDurableObject>;
  /** The shared secret every client must present. Set with `wrangler secret`. */
  SYNC_KEY: string;
}

export class TodoSync extends WsServerDurableObject<Env> {
  /**
   * Persist the store to the Durable Object's own storage.
   *
   * Without this the vault would live only in the connected clients: the first
   * moment all four devices are closed at once, the hub would come back empty
   * and hand that emptiness to whichever device connected next.
   */
  createPersister() {
    const store = createMergeableStore();
    return createDurableObjectStoragePersister(store, this.ctx.storage);
  }
}

/**
 * Timing-safe comparison.
 *
 * A plain `===` on a secret leaks its length and its matching prefix through
 * how long the comparison takes. The window is small over a network, but the
 * fix costs nothing.
 */
function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
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
    if (parts.length !== 2 || parts[0] !== 'sync') {
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
};
