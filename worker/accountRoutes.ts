/**
 * `/account/*`: sign up, sign in, change the password, close the account.
 *
 * Each answer is a vault key or a short error code — never a message that says
 * more than it has to. "wrong" covers both "no such email" and "wrong password",
 * so the door cannot be used to find out who has an account.
 */

import type { Env } from './env';
import type { TodoSync } from './index';
import { accounts, type AccountError } from './accounts';

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-max-age': '86400',
};

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

const STATUS: Record<AccountError, number> = {
  bad_email: 400, weak_password: 400, taken: 409, closed: 403, too_many: 429,
  wrong: 401, locked: 429, not_found: 404, owner_kept: 403,
};

async function body(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('content-length') ?? 0) > 4_000) return {};
  try {
    const parsed = JSON.parse(await request.text());
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

const str = (x: unknown, max = 200) => (typeof x === 'string' && x.length <= max ? x : '');

export async function handleAccount(request: Request, env: Env, parts: string[]): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const route = parts.slice(1).join('/');
  const auth = request.headers.get('authorization') ?? '';
  const key = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const store = accounts(env);

  if (route === 'me' && request.method === 'GET') {
    const email = key ? await store.email(key) : null;
    return email ? json({ email }) : json({ error: 'not_found' }, 404);
  }
  if (request.method !== 'POST') return json({ error: 'not_found' }, 404);

  const b = await body(request);
  const reply = <T>(r: { ok: true; value: T } | { ok: false; error: AccountError }) =>
    r.ok ? json(r.value) : json({ error: r.error }, STATUS[r.error]);

  switch (route) {
    case 'signup':
      return reply(await store.signUp({
        email: str(b.email),
        password: str(b.password),
        claim: str(b.claim, 200) || undefined,
        address: request.headers.get('cf-connecting-ip') ?? 'unknown',
      }));
    case 'signin':
      return reply(await store.signIn({ email: str(b.email), password: str(b.password) }));
    case 'password':
      return reply(await store.changePassword({ key, current: str(b.current), next: str(b.next) }));
    case 'delete': {
      const r = await store.remove({ key, password: str(b.password) });
      if (!r.ok) return reply(r);
      // Empty the vault the account held. Its key is gone, so nothing can reach it again either way.
      const vault = env.TODO_SYNC.get(env.TODO_SYNC.idFromName(`sync/${r.value.key}`)) as unknown as DurableObjectStub<TodoSync>;
      try { await vault.wipe(); } catch { /* aborting the object ends the call; the data is already gone */ }
      return json({ deleted: true });
    }
    default:
      return json({ error: 'not_found' }, 404);
  }
}
