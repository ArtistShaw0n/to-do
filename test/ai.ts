/**
 * Proof that the hub's Claude doors do what they claim — and refuse what they
 * should — without spending a cent.
 *
 *     pnpm test:ai
 *
 * It starts a stand-in for the Anthropic API, then a real Worker and a real
 * Durable Object (`wrangler dev`) pointed at it, and drives the hub the way the
 * apps do. The stand-in records every request, so the tests can assert on what
 * *would have been sent to Anthropic* — the model, the schema, and above all
 * what was left out.
 *
 * What this cannot prove is how the real model behaves on real Banglish. That
 * needs a key; `scripts/ai-smoke.mjs` is for the day there is one.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMergeableStore, type MergeableStore } from 'tinybase';
import { createWsSynchronizer } from 'tinybase/synchronizers/synchronizer-ws-client';
import { checkKey } from '../worker/ai';
import { parsePicture, type Draft } from '../src/lib/normalise';

const HUB_PORT = 8791;
const MOCK_PORT = 8792;
const KEY = 'local-development-key-not-a-real-secret';
const HUB = `http://localhost:${HUB_PORT}`;
const CAP = 12;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const results: [string, boolean, string?][] = [];
const check = (name: string, ok: boolean, detail?: string) => results.push([name, ok, detail]);

// ── The stand-in for api.anthropic.com ───────────────────────────────────────

interface Seen { path: string; headers: IncomingMessage['headers']; body: any }
const seen: Seen[] = [];

/** What the stand-in does is decided by a marker in the user's message. */
function reply(body: any): { status: number; json: unknown } {
  const messages = body.messages ?? [];
  const content = messages[0]?.content;
  const userText = typeof content === 'string'
    ? content
    : (content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
  const message = (text: string, stop = 'end_turn') => ({
    status: 200,
    json: {
      id: 'msg_mock', type: 'message', role: 'assistant', model: body.model,
      content: text ? [{ type: 'text', text }] : [],
      stop_reason: stop, stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 20 },
    },
  });

  if (userText.includes('__REFUSE__')) return message('', 'refusal');
  if (userText.includes('__TRUNCATE__')) return message('{"items":[', 'max_tokens');
  if (userText.includes('__EMPTY__')) return message('');
  if (userText.includes('__BADJSON__')) return message('not json at all');
  if (userText.includes('__429__')) return { status: 429, json: { type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } } };
  if (userText.includes('__401__')) return { status: 401, json: { type: 'error', error: { type: 'authentication_error', message: 'bad key' } } };

  const schema = body.output_config?.format?.schema;
  if (schema?.properties?.steps) {
    return message(JSON.stringify({ steps: ['Open the Drive', 'Add the preview popup.', 'open the drive', 'Test on mobile'] }));
  }
  if (schema?.properties?.items) {
    const isImage = (content ?? []).some?.((b: any) => b.type === 'image');
    if (isImage && userText.includes('__NOTHING__')) {
      return message(JSON.stringify({ seen: 'A settings dialog with no list or request in it.', items: [] }));
    }
    const title = isImage ? 'Fix the row read from the picture' : `Clean: ${userText.split('Input: ')[1]?.trim() ?? '?'}`;
    const items = [{ type: 'task', title, project: 'OERP', tags: ['bug'], notes: null, due: null, priority: 2 }];
    return message(JSON.stringify(isImage ? { seen: 'A bug sheet with one row.', items } : { items }));
  }
  if (String(body.system).includes('daily brief')) {
    return message('আজ **৩টা কাজ** খোলা। সবচেয়ে জরুরি — `Ship the email release`।\n\n- কিছু overdue নেই');
  }
  return message('উত্তর: **২টা** কাজ বাকি।');
}

function startMock(): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const body = raw ? JSON.parse(raw) : {};
        seen.push({ path: req.url ?? '', headers: req.headers, body });

        // GET /v1/models/<id> — what `checkKey` asks. Which answer depends on
        // the key and the model name, so each way a key can fail is reachable.
        if (req.method === 'GET' && req.url?.startsWith('/v1/models/')) {
          const model = decodeURIComponent(req.url.slice('/v1/models/'.length).split('?')[0]);
          const key = String(req.headers['x-api-key'] ?? '');
          const fail = (status: number, type: string) => {
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ type: 'error', error: { type, message: 'SECRET-MESSAGE-THAT-MUST-NOT-LEAK' } }));
          };
          if (key === 'sk-ant-bad') return fail(401, 'authentication_error');
          if (key === 'sk-ant-forbidden') return fail(403, 'permission_error');
          if (model === 'claude-not-a-model') return fail(404, 'not_found_error');
          res.writeHead(200, { 'content-type': 'application/json' });
          return res.end(JSON.stringify({ id: model, type: 'model', display_name: 'Mock', created_at: '2026-01-01T00:00:00Z' }));
        }

        const { status, json } = reply(body);
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(json));
      });
    });
    server.listen(MOCK_PORT, '127.0.0.1', () => resolve(server));
  });
}

// ── A real hub ───────────────────────────────────────────────────────────────

function startHub(persist: string): ChildProcess {
  const child = spawn('npx', [
    'wrangler', 'dev', '--local', '--port', String(HUB_PORT), '--persist-to', persist,
    '--test-scheduled',
    '--var', `SYNC_KEY:${KEY}`,
    '--var', 'ANTHROPIC_API_KEY:sk-ant-test-key-not-real',
    '--var', `ANTHROPIC_BASE_URL:http://127.0.0.1:${MOCK_PORT}`,
    '--var', `AI_DAILY_CAP:${CAP}`,
    '--var', 'TIMEZONE:Asia/Dhaka',
  ], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CI: '1' } });
  return child;
}

async function waitForHub() {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(`${HUB}/health`);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await wait(1000);
  }
  throw new Error('the hub did not start');
}

const call = (route: string, body?: unknown, key: string | null = KEY, method = 'POST') =>
  fetch(`${HUB}/ai/${route}`, {
    method,
    headers: {
      ...(key ? { authorization: `Bearer ${key}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

const ctx = { today: '2026-10-19', weekday: 'Monday', projects: ['OERP', 'Personal'] };

async function connect(name: string): Promise<{ store: MergeableStore; stop: () => Promise<void> }> {
  const store = createMergeableStore(name);
  const sync = await createWsSynchronizer(store, new WebSocket(`ws://localhost:${HUB_PORT}/sync/${KEY}`) as never);
  await sync.startSync();
  await wait(500);
  return { store, stop: async () => { await sync.destroy(); } };
}

// ── The run ──────────────────────────────────────────────────────────────────

const persist = mkdtempSync(join(tmpdir(), 'vault-ai-test-'));
const mock = await startMock();
const hub = startHub(persist);
let hubLog = '';
hub.stdout?.on('data', (d) => (hubLog += d));
hub.stderr?.on('data', (d) => (hubLog += d));

let failure: unknown;
try {
  await waitForHub();

  // ── Who may knock ──────────────────────────────────────────────────────────
  check('no key is refused', (await call('status', undefined, null, 'GET')).status === 403);
  check('the wrong key is refused', (await call('status', undefined, 'wrong-key', 'GET')).status === 403);
  const preflight = await fetch(`${HUB}/ai/normalise`, { method: 'OPTIONS' });
  check('a preflight from another origin is answered without a key',
    preflight.status === 204 && preflight.headers.get('access-control-allow-headers')?.includes('authorization') === true);

  const status = await (await call('status', undefined, KEY, 'GET')).json() as any;
  check('status reports the hub is configured', status.configured === true, JSON.stringify(status));
  check('status names the model', status.model === 'claude-opus-5-5');
  check('status carries the ceiling', status.cap === CAP && status.used === 0);
  check('a response from the hub is readable cross-origin',
    (await call('status', undefined, KEY, 'GET')).headers.get('access-control-allow-origin') === '*');

  // ── Is the key any good? ───────────────────────────────────────────────────
  check('the key check needs the sync key too', (await call('check', undefined, null, 'GET')).status === 403);
  const good = await (await call('check', undefined, KEY, 'GET')).json() as any;
  check('a working key is reported as accepted, with the model available',
    good.configured === true && good.key === 'accepted' && good.model === 'available', JSON.stringify(good));
  check('the check asks the API for the configured model, not a hard-coded one',
    seen.some((r) => r.path.startsWith('/v1/models/claude-opus-5-5')));

  const env = (key: string | undefined, model = 'claude-opus-5-5') =>
    ({ ANTHROPIC_API_KEY: key, ANTHROPIC_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`, AI_MODEL: model });
  const bad = await checkKey(env('sk-ant-bad'));
  check('a rejected key says so, with the status and the type',
    bad.key === 'rejected' && bad.status === 401 && bad.type === 'authentication_error', JSON.stringify(bad));
  const forbidden = await checkKey(env('sk-ant-forbidden'));
  check('a key that is refused permission is "rejected" too, and says 403',
    forbidden.key === 'rejected' && forbidden.status === 403, JSON.stringify(forbidden));
  const noModel = await checkKey(env('sk-ant-fine', 'claude-not-a-model'));
  check('a good key that cannot see the model says the model is the problem',
    noModel.key === 'accepted' && noModel.model === 'unavailable' && noModel.status === 404, JSON.stringify(noModel));
  check('no key at all is "not configured", nothing more', JSON.stringify(await checkKey(env(undefined))) === '{"configured":false}');
  check('the API\'s own message never comes back — only a status and a type',
    !JSON.stringify([bad, forbidden, noModel]).includes('SECRET-MESSAGE'));

  // ── Turning a line into a task ─────────────────────────────────────────────
  seen.length = 0;
  const res = await call('normalise', { text: 'kalke invoice pathate hobe', ...ctx });
  const out = await res.json() as any;
  const parsed = JSON.parse(out.text);
  check('a typed line comes back as parseable items', res.status === 200 && parsed.items?.[0]?.type === 'task', out.text);
  check('the line reached the model', JSON.stringify(seen[0]?.body).includes('kalke invoice pathate hobe'));

  const sent = seen[0]?.body;
  check('it asked for the configured model', sent?.model === 'claude-opus-5-5');
  check('the reply is held to a schema', sent?.output_config?.format?.type === 'json_schema');
  check('effort is set explicitly', sent?.output_config?.effort === 'low');
  check('no sampling parameters are sent (this model rejects them)',
    sent?.temperature === undefined && sent?.top_p === undefined && sent?.top_k === undefined);
  check('thinking is left alone (it cannot be disabled)', sent?.thinking === undefined);
  check('server-side fallback is opted in', sent?.fallbacks === 'default');
  check('…with the header that gates it',
    String(seen[0]?.headers['anthropic-beta'] ?? '').includes('server-side-fallback-2026-07-01'));
  check('the key travels as the API expects', seen[0]?.headers['x-api-key'] === 'sk-ant-test-key-not-real');
  check('the rules are in the system prompt, the line in the user turn',
    String(sent?.system).includes('Task rules:') && !String(sent?.system).includes('kalke invoice'));

  // ── What is refused before it costs anything ───────────────────────────────
  const before = seen.length;
  check('an empty line is refused', (await call('normalise', { text: '   ', ...ctx })).status === 400);
  check('an over-long line is refused', (await call('normalise', { text: 'x'.repeat(2001), ...ctx })).status === 400);
  check('a malformed date is refused', (await call('normalise', { text: 'a', ...ctx, today: 'tomorrow' })).status === 400);
  check('invalid JSON is refused', (await fetch(`${HUB}/ai/normalise`, {
    method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: '{nope',
  })).status === 400);
  check('refusals cost no API call', seen.length === before);
  const afterRefusals = (await (await call('status', undefined, KEY, 'GET')).json() as any).used;
  check('…and no budget', afterRefusals === 1, `used ${afterRefusals}`);

  // ── Failures are reported by kind, never by content ────────────────────────
  const failures: [string, number, string][] = [
    ['__REFUSE__', 422, 'refused'],
    ['__TRUNCATE__', 502, 'truncated'],
    ['__EMPTY__', 502, 'empty'],
    ['__BADJSON__', 502, 'upstream'],
    ['__429__', 503, 'rate_limited'],
    ['__401__', 502, 'auth'],
  ];
  for (const [marker, expectStatus, code] of failures) {
    const r = await call('normalise', { text: marker, ...ctx });
    const body = await r.json() as any;
    check(`${code}: status ${expectStatus} and the code, nothing else`,
      r.status === expectStatus && body.error === code && Object.keys(body).length === 1,
      `${r.status} ${JSON.stringify(body)}`);
  }

  // ── Breaking a task into steps ─────────────────────────────────────────────
  const stepsRes = await call('steps', {
    title: 'Show a preview popup before download in the Drive', project: 'OERP',
    tags: ['bug', 'email'], existing: ['Open the Drive'],
  });
  const steps = await stepsRes.json() as any;
  check('steps come back as a list', stepsRes.status === 200 && Array.isArray(steps.steps));
  check('a step that already exists is not offered again (any case)',
    !steps.steps.some((s: string) => s.toLowerCase() === 'open the drive'), JSON.stringify(steps));
  check('trailing full stops are stripped', steps.steps.includes('Add the preview popup'), JSON.stringify(steps));

  // ── Reading a picture ──────────────────────────────────────────────────────
  seen.length = 0;
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const imgRes = await call('image', { image: { media_type: 'image/png', data: png }, ...ctx });
  const img = await imgRes.json() as any;
  check('a picture comes back as tasks', imgRes.status === 200 && JSON.parse(img.text).items?.length === 1);
  const blocks = seen[0]?.body?.messages?.[0]?.content ?? [];
  check('the picture is sent as an image block', blocks[0]?.type === 'image' && blocks[0]?.source?.media_type === 'image/png');
  check('a picture can only yield tasks, never notes',
    JSON.stringify(seen[0]?.body?.output_config?.format?.schema).includes('"note"') === false);
  check('the picture reply is held to a schema that asks for `seen` first',
    JSON.stringify(Object.keys(seen[0]?.body?.output_config?.format?.schema?.properties ?? {})) === '["seen","items"]'
    && (seen[0]?.body?.output_config?.format?.schema?.required ?? []).includes('seen'));

  // What the app does with the reply: the tasks, and the sentence that explains an empty one.
  const fallback: Draft = { type: 'task', title: '', tags: [], priority: 2, originalInput: '' };
  const readPic = parsePicture(img.text, fallback);
  check('a picture reply parses to its tasks and what it saw',
    readPic.items.length === 1 && readPic.seen === 'A bug sheet with one row.', JSON.stringify(readPic));

  // Nothing in the picture is an answer, not an error — and says what it was.
  seen.length = 0;
  const nothingRes = await call('image', { image: { media_type: 'image/png', data: png }, ...ctx, hint: '__NOTHING__' });
  const nothing = await nothingRes.json() as any;
  check('a picture with no work in it is a 200, not an error', nothingRes.status === 200, String(nothingRes.status));
  const emptyPic = parsePicture(nothing.text, fallback);
  check('…it parses to no tasks, plus the sentence saying what it was',
    emptyPic.items.length === 0 && emptyPic.seen === 'A settings dialog with no list or request in it.', JSON.stringify(emptyPic));
  const textBlock = (seen[0]?.body?.messages?.[0]?.content ?? []).find((b: any) => b.type === 'text')?.text ?? '';
  check('what the person typed travels as "what to look for"', textBlock.includes('What to look for: __NOTHING__'), textBlock);
  check('a hint over 200 characters is refused, not silently cut',
    (await call('image', { image: { media_type: 'image/png', data: png }, ...ctx, hint: 'x'.repeat(201) })).status === 400);
  check('a reply with no `seen` still parses (older hub, or a stand-in)',
    parsePicture(JSON.stringify({ items: [{ type: 'task', title: 'A', project: null, tags: [], notes: null, due: null, priority: 2 }] }), fallback).seen === undefined);
  check('a reply that is not JSON at all is still an error, not an empty picture',
    (() => { try { parsePicture('the picture is lovely', fallback); return false; } catch { return true; } })());
  check('an unsupported image type is refused',
    (await call('image', { image: { media_type: 'image/bmp', data: png }, ...ctx })).status === 400);
  const big = 'A'.repeat(1_700_000);
  const tooBig = await call('image', { image: { media_type: 'image/png', data: big }, ...ctx });
  check('a picture over the CPU-safe ceiling is refused before it is parsed (413)',
    tooBig.status === 413, String(tooBig.status));
  const justOver = await call('image', { image: { media_type: 'image/png', data: 'A'.repeat(1_650_000).slice(0, 1_650_000) }, ...ctx });
  check('…and one just over the data ceiling is refused too', [400, 413].includes(justOver.status), String(justOver.status));
  check('non-base64 data is refused',
    (await call('image', { image: { media_type: 'image/png', data: '<script>' }, ...ctx })).status === 400);

  // ── Asking about the list — and what must never travel ─────────────────────
  seen.length = 0;
  const askRes = await call('ask', {
    ...ctx,
    question: 'OERP-র কী বাকি?',
    open: [{
      title: 'Ship the email release', status: 'todo', project: 'OERP', priority: 1, due: '2026-10-20',
      // Fields the client must not be able to smuggle through:
      notes: 'SECRET-NOTE-TEXT', originalInput: 'SECRET-ORIGINAL-WORDING', steps: 'SECRET-STEPS',
      reportedBy: 'SECRET-REPORTER', evidenceUrl: 'https://secret.example/evidence',
    }],
    recent: [],
  });
  const asked = await askRes.json() as any;
  check('an answer comes back', askRes.status === 200 && asked.answer?.includes('২টা'));
  const wire = JSON.stringify(seen[0]?.body);
  check('the task title was sent', wire.includes('Ship the email release'));
  check('"due tomorrow" was worked out for the model', wire.includes('due tomorrow'));
  check('notes never leave the hub', !wire.includes('SECRET-NOTE-TEXT'));
  check('the original wording never leaves the hub', !wire.includes('SECRET-ORIGINAL-WORDING'));
  check('steps and reporter never leave the hub', !wire.includes('SECRET-STEPS') && !wire.includes('SECRET-REPORTER'));
  check('evidence links never leave the hub', !wire.includes('secret.example'));
  check('a task with no title is refused',
    (await call('ask', { ...ctx, question: 'q', open: [{ status: 'todo' }] })).status === 400);

  // ── The ceiling ────────────────────────────────────────────────────────────
  const used = (await (await call('status', undefined, KEY, 'GET')).json() as any).used;
  let capped = 0;
  for (let i = used; i < CAP + 2; i++) {
    const r = await call('normalise', { text: `fill ${i}`, ...ctx });
    if (r.status === 429) capped += 1;
  }
  check('the daily ceiling stops calls', capped >= 1, `${capped} refused`);
  const hit = await call('normalise', { text: 'one too many', ...ctx });
  check('…with 429 and the code', hit.status === 429 && (await hit.json() as any).error === 'capped');
  const final = await (await call('status', undefined, KEY, 'GET')).json() as any;
  check('the counter never passes the ceiling', final.used === CAP, `used ${final.used} of ${CAP}`);
  const callsBefore = seen.length;
  await call('normalise', { text: 'still no', ...ctx });
  check('a capped request is never sent to the API', seen.length === callsBefore);

} catch (err) {
  failure = err;
}

// The ceiling test spent the day. Restart on fresh storage for the brief.
hub.kill();
await wait(1500);
const persist2 = mkdtempSync(join(tmpdir(), 'vault-ai-test2-'));
const hub2 = startHub(persist2);
hub2.stdout?.on('data', (d) => (hubLog += d));
hub2.stderr?.on('data', (d) => (hubLog += d));

try {
  await waitForHub();

  const mac = await connect('mac');
  const phone = await connect('phone');
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

  // An empty vault has nothing to brief.
  const empty = await (await call('brief', {})).json() as any;
  check('an empty vault gets no brief (and no charge)', empty.status === 'skipped' && empty.reason === 'nothing_open', JSON.stringify(empty));

  mac.store.setRow('tasks', 't1', {
    title: 'Ship the email release', status: 'todo', priority: 1, project: 'OERP', order: 1,
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', source: 'cli', tags: '["release","email"]', subtasks: '[]',
  });
  mac.store.setRow('tasks', 't2', {
    title: 'Call the plumber', status: 'todo', priority: 2, order: 2,
    createdAt: '2026-10-02T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z', source: 'cli', tags: '[]', subtasks: '[]',
  });
  // A note with a secret — it must stay out of the prompt entirely.
  mac.store.setRow('notes', 'n1', {
    kind: 'code', title: 'Tablet', secret: 'enc.v1:SECRET-NOTE-CIPHERTEXT', body: 'SECRET-NOTE-BODY',
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', order: 1,
  });
  await wait(900);

  seen.length = 0;
  const written = await (await call('brief', {})).json() as any;
  check('the hub writes a brief', written.status === 'written' && written.date === day, JSON.stringify(written));
  await wait(900);

  const onPhone = phone.store.getRow('digests', day);
  check('…and it reaches a device that never asked for it', typeof onPhone.markdown === 'string' && onPhone.markdown.includes('Ship the email release'),
    JSON.stringify(onPhone));
  check('…authored "api", so a Claude-written one can be told apart', onPhone.author === 'api');
  check('…with the day\'s numbers attached', JSON.parse(String(onPhone.stats)).open === 2);

  const briefWire = JSON.stringify(seen[0]?.body);
  check('the brief prompt carried the tasks', briefWire.includes('Ship the email release') && briefWire.includes('Call the plumber'));
  check('the most pressing task comes first', briefWire.indexOf('Ship the email release') < briefWire.indexOf('Call the plumber'));
  check('notes never reached the brief prompt',
    !briefWire.includes('SECRET-NOTE') && !briefWire.includes('Tablet'));

  const again = await (await call('brief', {})).json() as any;
  check('a second request the same day writes nothing', again.status === 'skipped' && again.reason === 'already_written');
  const forced = await (await call('brief', { force: true })).json() as any;
  check('refresh from the app rewrites it', forced.status === 'written');

  // A brief Claude wrote in a session must survive the morning job.
  const tomorrow = new Date(Date.now() + 36 * 3_600_000);
  phone.store.setRow('digests', day, { markdown: 'Written by hand, in a session.', stats: '{}', createdAt: new Date().toISOString(), author: 'claude' });
  await wait(900);
  const scheduled = await fetch(`${HUB}/__scheduled?cron=30+0+*+*+*`);
  await wait(1500);
  check('the cron trigger runs', scheduled.status === 200);
  check('the morning job does not overwrite a session-written brief',
    mac.store.getCell('digests', day, 'markdown') === 'Written by hand, in a session.',
    String(mac.store.getCell('digests', day, 'markdown')));

  // And when there is nothing yet, the morning job writes one on its own.
  phone.store.delRow('digests', day);
  await wait(900);
  seen.length = 0;
  await fetch(`${HUB}/__scheduled?cron=30+0+*+*+*`);
  await wait(2500);
  check('the morning job writes a brief when there is none',
    mac.store.getCell('digests', day, 'author') === 'api' && seen.length === 1,
    `author=${mac.store.getCell('digests', day, 'author')} calls=${seen.length}`);

  // …but replaces the machine-made floor.
  phone.store.setRow('digests', day, { markdown: 'floor', stats: '{}', createdAt: new Date().toISOString(), author: 'auto' });
  await wait(900);
  const replaced = await (await call('brief', {})).json() as any;
  check('a machine-made floor is replaced', replaced.status === 'written');
  void tomorrow;

  // The brief spends from the same budget as everything else.
  let guard = 0;
  while (guard++ < CAP + 2 && (await call('normalise', { text: `drain ${guard}`, ...ctx })).status !== 429) { /* spend it */ }
  const held = await (await call('brief', { force: true })).json() as any;
  check('the brief respects the ceiling', held.status === 'skipped' && held.reason === 'capped', JSON.stringify(held));

  await mac.stop();
  await phone.stop();
} catch (err) {
  failure ??= err;
} finally {
  hub2.kill();
  mock.close();
  await wait(500);
  rmSync(persist, { recursive: true, force: true });
  rmSync(persist2, { recursive: true, force: true });
}

// ── The vault survives the hub restarting ────────────────────────────────────
//
// The test that was missing, and the one that matters most. A Durable Object is
// restarted by every deploy, every secret change and every idle eviction, and each
// time it loads the vault back from storage. The daily budget counter lives in
// that same storage. If loading cannot read it, the vault comes back EMPTY — and
// the next save writes that emptiness over everything.

try {
  const persist3 = mkdtempSync(join(tmpdir(), 'vault-ai-test3-'));
  let hub3 = startHub(persist3);
  hub3.stdout?.on('data', (d) => (hubLog += d));
  hub3.stderr?.on('data', (d) => (hubLog += d));
  await waitForHub();

  const first = await connect('first');
  first.store.setRow('tasks', 'keep1', {
    title: 'must survive a restart', status: 'todo', priority: 2, order: 1,
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', source: 'cli', tags: '[]', subtasks: '[]',
  });
  first.store.setRow('notes', 'keepn', {
    kind: 'code', title: 'a note too', secret: 'enc.v1:xxxx.yyyy', body: '',
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', order: 1,
  });
  await wait(1200);

  // Spend a unit of the day's budget — this is what writes the counter.
  await call('normalise', { text: 'spend one unit', ...ctx });
  const spent = (await (await call('status', undefined, KEY, 'GET')).json() as any).used;
  check('the budget counter was written before the restart', spent >= 1, String(spent));

  await first.stop();
  hub3.kill();
  await wait(2500);

  hub3 = startHub(persist3);          // same storage, a new process: a restart
  hub3.stdout?.on('data', (d) => (hubLog += d));
  hub3.stderr?.on('data', (d) => (hubLog += d));
  await waitForHub();

  const second = await connect('second');
  await wait(1500);
  check('a restart with the budget counter in storage does not lose a task',
    second.store.hasRow('tasks', 'keep1'), `tasks after restart: ${second.store.getRowIds('tasks').length}`);
  check('…nor a note', second.store.hasRow('notes', 'keepn'));

  // …and the vault must survive the *next* save too, which is the one that would
  // have written the emptiness over it.
  second.store.setCell('tasks', 'keep1', 'title', 'still here after a second change');
  await wait(1200);
  await second.stop();
  hub3.kill();
  await wait(2500);
  hub3 = startHub(persist3);
  hub3.stdout?.on('data', (d) => (hubLog += d));
  await waitForHub();
  const third = await connect('third');
  await wait(1500);
  check('…and after a second restart, with the change that came between',
    third.store.getCell('tasks', 'keep1', 'title') === 'still here after a second change');
  check('the budget carries across restarts (it is a counter, not a reset)',
    ((await (await call('status', undefined, KEY, 'GET')).json() as any).used) >= 1);
  await third.stop();
  hub3.kill();
  await wait(800);
  rmSync(persist3, { recursive: true, force: true });
} catch (err) {
  failure ??= err;
}

// ── Report ───────────────────────────────────────────────────────────────────

let failed = 0;
for (const [name, ok, detail] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  — ${detail}` : ''}`);
  if (!ok) failed += 1;
}
if (failure) {
  console.log(`\nThe run stopped early: ${failure instanceof Error ? failure.stack : failure}`);
  console.log('\n--- hub log (tail) ---\n' + hubLog.split('\n').slice(-25).join('\n'));
  process.exit(1);
}
console.log(`\n${results.length - failed}/${results.length} promises hold`);
process.exit(failed ? 1 : 0);
