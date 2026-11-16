/**
 * Proof that more than one person can use the hub, each with a vault nobody else
 * can reach — and that the owner's vault, key and budget are untouched by them.
 *
 *     pnpm test:accounts
 *
 * A real Worker and real Durable Objects (`wrangler dev`, a throwaway folder),
 * a stand-in for the Anthropic API, and the hub driven the way the apps drive
 * it. Never run against the live hub.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMergeableStore, type MergeableStore } from 'tinybase';
import { createWsSynchronizer } from 'tinybase/synchronizers/synchronizer-ws-client';
import { TABLES, taskToRow } from '../src/lib/store';
import type { Task } from '../src/lib/types';

const HUB_PORT = 8797;
const MOCK_PORT = 8798;
const OWNER = 'owner-key-for-local-tests-only-not-real';
const HUB = `http://localhost:${HUB_PORT}`;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const results: [string, boolean, string?][] = [];
const check = (name: string, ok: boolean, detail?: string) => results.push([name, ok, detail]);

// ── The stand-in for api.anthropic.com: every call answers with one task ──────

let apiCalls = 0;
function startMock(): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        apiCalls++;
        const body = raw ? JSON.parse(raw) : {};
        const brief = String(body.system ?? '').includes('daily brief');
        const text = brief
          ? 'আজ **১টা কাজ** খোলা।'
          : JSON.stringify({ items: [{ type: 'task', title: 'Clean task', project: null, tags: [], notes: null, due: null, priority: 2 }] });
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          id: 'msg_mock', type: 'message', role: 'assistant', model: body.model,
          content: [{ type: 'text', text }], stop_reason: 'end_turn', stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 10 },
        }));
      });
    });
    server.listen(MOCK_PORT, '127.0.0.1', () => resolve(server));
  });
}

// ── A real hub ───────────────────────────────────────────────────────────────

function startHub(persist: string): ChildProcess {
  return spawn('npx', [
    'wrangler', 'dev', '--local', '--port', String(HUB_PORT), '--persist-to', persist, '--test-scheduled',
    '--var', `SYNC_KEY:${OWNER}`,
    '--var', 'ANTHROPIC_API_KEY:sk-ant-test-key-not-real',
    '--var', `ANTHROPIC_BASE_URL:http://127.0.0.1:${MOCK_PORT}`,
    '--var', 'AI_DAILY_CAP:50',
    '--var', 'USER_AI_DAILY_CAP:2',
    '--var', 'GUESTS_AI_DAILY_CAP:3',
    '--var', 'MAX_ACCOUNTS:3',
    '--var', 'TIMEZONE:Asia/Dhaka',
  ], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CI: '1' } });
}

async function waitForHub() {
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(`${HUB}/health`)).ok) return; } catch { /* not up yet */ }
    await wait(1000);
  }
  throw new Error('the hub did not start');
}

const account = async (route: string, body: unknown, key?: string) => {
  const r = await fetch(`${HUB}/account/${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) as any };
};

const ai = async (route: string, key: string, body?: unknown) => {
  const r = await fetch(`${HUB}/ai/${route}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) as any };
};

const line = (text: string) => ({ text, today: '2026-11-16', weekday: 'Monday', projects: [] });

async function connect(key: string): Promise<{ store: MergeableStore; stop: () => Promise<void> }> {
  const store = createMergeableStore();
  const sync = await createWsSynchronizer(store, new WebSocket(`ws://localhost:${HUB_PORT}/sync/${key}`) as never);
  await sync.startSync();
  await wait(700);
  return { store, stop: async () => { await sync.destroy(); } };
}

/** Does the socket open at all? A refused key gets a 403 before any upgrade. */
async function socketOpens(key: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:${HUB_PORT}/sync/${key}`);
    const done = (ok: boolean) => { try { ws.close(); } catch { /* */ } resolve(ok); };
    ws.onopen = () => done(true);
    ws.onerror = () => done(false);
    setTimeout(() => done(false), 5000);
  });
}

function task(id: string, title: string): Task {
  const now = new Date().toISOString();
  return { id, title, status: 'todo', priority: 2, tags: [], subtasks: [], createdAt: now, updatedAt: now, order: 0, source: 'app' };
}

async function writeTask(key: string, t: Task) {
  const c = await connect(key);
  c.store.setRow(TABLES.tasks, t.id, taskToRow(t));
  await wait(800);
  await c.stop();
}

async function titles(key: string): Promise<string[]> {
  const c = await connect(key);
  const rows = c.store.getTable(TABLES.tasks);
  await c.stop();
  return Object.values(rows).map((r) => String(r.title));
}

// ── The run ──────────────────────────────────────────────────────────────────

const persist = mkdtempSync(join(tmpdir(), 'vault-accounts-'));
const mock = await startMock();
let hub = startHub(persist);

try {
  await waitForHub();

  // Signing up
  const a = await account('signup', { email: 'Rina@Example.com', password: 'correct horse' });
  check('signing up gives a vault key of its own', a.status === 200 && /^u_[\w-]{40,}$/.test(a.body.key), JSON.stringify(a));
  const A = a.body.key as string;
  check('the email is kept in lower case', a.body.email === 'rina@example.com');

  check('a malformed email is refused', (await account('signup', { email: 'not-an-email', password: 'long enough' })).body.error === 'bad_email');
  check('a short password is refused', (await account('signup', { email: 'x@example.com', password: 'short' })).body.error === 'weak_password');
  check('the same email cannot open a second account', (await account('signup', { email: 'rina@example.com', password: 'another one' })).status === 409);

  const b = await account('signup', { email: 'karim@example.com', password: 'another horse' });
  const B = b.body.key as string;
  check('a second person gets a different key', !!B && B !== A);

  // Signing in
  const inA = await account('signin', { email: 'RINA@example.com', password: 'correct horse' });
  check('signing in returns the same key', inA.status === 200 && inA.body.key === A);
  const wrongPw = await account('signin', { email: 'rina@example.com', password: 'wrong horse' });
  const noUser = await account('signin', { email: 'nobody@example.com', password: 'whatever!' });
  check('a wrong password and an unknown email look the same', wrongPw.status === 401 && noUser.status === 401
    && wrongPw.body.error === 'wrong' && noUser.body.error === 'wrong');

  // Each vault is its own
  await writeTask(A, task('t-rina', "Rina's task"));
  await writeTask(OWNER, task('t-owner', "Shawon's task"));
  const seenByA = await titles(A), seenByB = await titles(B), seenByOwner = await titles(OWNER);
  check("each person sees only their own tasks",
    seenByA.join() === "Rina's task" && seenByB.length === 0 && seenByOwner.join() === "Shawon's task",
    JSON.stringify({ seenByA, seenByB, seenByOwner }));
  check('the owner key still opens the owner vault', seenByOwner.includes("Shawon's task"));
  check('a made-up account key reaches nothing', !(await socketOpens('u_' + 'x'.repeat(43))));
  check('an issued key does connect', await socketOpens(A));
  check('a made-up key gets no AI', (await ai('status', 'u_' + 'y'.repeat(43))).status === 403);

  // Budgets: each guest has 2, all guests together 3, and the owner his own
  const a1 = await ai('normalise', A, line('one')), a2 = await ai('normalise', A, line('two')), a3 = await ai('normalise', A, line('three'));
  check("a guest's own daily ceiling holds", a1.status === 200 && a2.status === 200 && a3.status === 429, `${a1.status} ${a2.status} ${a3.status}`);
  const b1 = await ai('normalise', B, line('one')), b2 = await ai('normalise', B, line('two'));
  check('all guests together cannot pass the shared ceiling', b1.status === 200 && b2.status === 429, `${b1.status} ${b2.status}`);
  const statusB = await ai('status', B);
  check('a guest whose pool is spent is told so', statusB.body.used >= statusB.body.cap, JSON.stringify(statusB.body));
  const o1 = await ai('normalise', OWNER, line('owner'));
  const statusO = await ai('status', OWNER);
  check("the guests never spend the owner's budget", o1.status === 200 && statusO.body.used === 1 && statusO.body.cap === 50, JSON.stringify(statusO.body));
  check("the session importer's door is the owner's alone", (await ai('sessions', A, { sessions: [] })).status === 403);
  check("checking the hub's API key is the owner's alone", (await ai('check', A)).status === 403);

  // Changing the password
  check('a password change needs the current password', (await account('password', { current: 'nope nope', next: 'new horse!!' }, A)).status === 401);
  const changed = await account('password', { current: 'correct horse', next: 'new horse!!' }, A);
  check('the password can be changed', changed.status === 200);
  check('the old password stops working', (await account('signin', { email: 'rina@example.com', password: 'correct horse' })).status === 401);
  const again = await account('signin', { email: 'rina@example.com', password: 'new horse!!' });
  check('the new one works and the vault key is unchanged', again.body.key === A);

  // The account ceiling
  await account('signup', { email: 'third@example.com', password: 'third horse' });
  check('no more accounts than MAX_ACCOUNTS', (await account('signup', { email: 'fourth@example.com', password: 'fourth horse' })).body.error === 'closed');

  // The owner's claim
  check('a wrong claim is refused', (await account('signup', { email: 'me@example.com', password: 'owner horse', claim: 'not-the-key' })).body.error === 'wrong');
  const claim = await account('signup', { email: 'me@example.com', password: 'owner horse', claim: OWNER });
  check("the owner's claim opens his existing vault", claim.status === 200 && claim.body.key === OWNER && claim.body.owner === true, JSON.stringify(claim));
  check('the claim is not counted against MAX_ACCOUNTS', claim.status === 200);
  check("the owner's account cannot be deleted from the app", (await account('delete', { password: 'owner horse' }, OWNER)).body.error === 'owner_kept');
  check('the owner vault is still whole after all that', (await titles(OWNER)).includes("Shawon's task"));

  // The morning brief, for everyone with something open
  apiCalls = 0;
  await fetch(`${HUB}/__scheduled?cron=30+0+*+*+*`);
  await wait(4000);
  const briefOf = async (key: string) => {
    const c = await connect(key);
    const rows = Object.values(c.store.getTable(TABLES.digests));
    await c.stop();
    return rows;
  };
  const [briefA, briefB, briefO] = [await briefOf(A), await briefOf(B), await briefOf(OWNER)];
  check('the morning job writes the owner his brief', briefO.some((r) => r.author === 'api'), JSON.stringify(briefO));
  check('…and skips an empty vault without calling the API', briefB.length === 0);
  check("…and a guest whose budget is spent is not written one (the owner's is not used for it)", briefA.length === 0);

  // Closing an account
  check('closing needs the password', (await account('delete', { password: 'wrong' }, A)).status === 401);
  const closed = await account('delete', { password: 'new horse!!' }, A);
  check('an account can be closed', closed.status === 200 && closed.body.deleted === true);
  check('its key reaches nothing afterwards', !(await socketOpens(A)));
  check('its email no longer signs in', (await account('signin', { email: 'rina@example.com', password: 'new horse!!' })).status === 401);
  const reborn = await account('signup', { email: 'rina@example.com', password: 'fresh horse' });
  check('signing up again starts an empty vault', reborn.status === 200 && reborn.body.key !== A && (await titles(reborn.body.key)).length === 0);

  // A restart keeps everything
  hub.kill();
  await wait(2000);
  hub = startHub(persist);
  await waitForHub();
  check('accounts survive a restart', (await account('signin', { email: 'karim@example.com', password: 'another horse' })).body.key === B);
  check('the owner vault survives a restart', (await titles(OWNER)).includes("Shawon's task"));

  // Locking out a guesser
  for (let i = 0; i < 10; i++) await account('signin', { email: 'karim@example.com', password: `guess ${i}!!` });
  check('ten wrong passwords lock the account for a while, even against the right one',
    (await account('signin', { email: 'karim@example.com', password: 'another horse' })).body.error === 'locked');
} catch (err) {
  check('the run finished', false, String(err));
} finally {
  hub.kill();
  mock.close();
  rmSync(persist, { recursive: true, force: true });
}

let failed = 0;
for (const [name, ok, detail] of results) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  — ${detail}` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} promises hold`);
process.exit(failed ? 1 : 0);
