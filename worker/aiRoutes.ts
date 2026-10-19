/**
 * The hub's HTTP face for Claude: `/ai/*`.
 *
 * Each route is a *purpose*, not a pipe. A client says "turn this line into a
 * task" or "answer this question about these tasks"; it cannot say "send this
 * prompt to Claude". The prompts live on the hub, the fields that may be sent
 * are named here, and the day's budget is spent before the model is called. A
 * generic proxy would hand anyone holding the sync key the whole credit; this
 * hands them four narrow doors and a ceiling.
 *
 * Auth is the same shared secret the sockets use, sent as a bearer token — a
 * `fetch` can set a header, which a browser WebSocket cannot.
 */

import type { Env } from './env';
import type { TodoSync } from './index';
import { secretsMatch } from './secret';
import { AiError, complete, DEFAULT_MODEL, isConfigured, parseJson, type AiFailure } from './ai';
import { dayIn, safeZone } from './day';
import {
  ASK_SYSTEM, IMAGE_SCHEMA, IMAGE_SYSTEM, STEPS_SCHEMA, STEPS_SYSTEM,
  askUser, imageUser, stepsUser, type TaskLike,
} from './prompts';
import { NORMALISE_SCHEMA, normaliseSystem, normaliseUser } from '../src/lib/prompts';

const CORS: Record<string, string> = {
  // The credential is a bearer header, not a cookie, so there is nothing for a
  // wildcard origin to leak: a page that does not hold the key gets a 403 like
  // anyone else. The desktop app loads from its own origin and needs this.
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-max-age': '86400',
};

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

const STATUS: Record<AiFailure, number> = {
  not_configured: 503, capped: 429, refused: 422, truncated: 502,
  empty: 502, rate_limited: 503, auth: 502, upstream: 502,
};

const failure = (code: AiFailure) => json({ error: code }, STATUS[code]);

// ── Reading what the client sent ─────────────────────────────────────────────

class Bad extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

const isObject = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);

async function readBody(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes) throw new Bad('request too large', 413);
  const text = await request.text();
  if (text.length > maxBytes) throw new Bad('request too large', 413);
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Bad('body is not valid JSON'); }
  if (!isObject(parsed)) throw new Bad('body must be a JSON object');
  return parsed;
}

function text(x: unknown, field: string, max: number): string | undefined {
  if (x === undefined || x === null || x === '') return undefined;
  if (typeof x !== 'string') throw new Bad(`${field} must be a string`);
  if (x.length > max) throw new Bad(`${field} is longer than ${max} characters`);
  return x;
}

function required(x: unknown, field: string, max: number): string {
  const v = text(x, field, max)?.trim();
  if (!v) throw new Bad(`${field} is required`);
  return v;
}

function list(x: unknown, field: string, maxItems: number, maxLen: number): string[] {
  if (x === undefined || x === null) return [];
  if (!Array.isArray(x)) throw new Bad(`${field} must be a list`);
  if (x.length > maxItems) throw new Bad(`${field} has more than ${maxItems} entries`);
  return x.map((v, i) => {
    if (typeof v !== 'string' || v.length > maxLen) throw new Bad(`${field}[${i}] is not a short string`);
    return v;
  });
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
function date(x: unknown, field: string): string {
  if (typeof x !== 'string' || !DATE.test(x)) throw new Bad(`${field} must be YYYY-MM-DD`);
  return x;
}

/**
 * The whitelist. A task arrives with whatever fields the client had; only these
 * come out, which is the whole privacy guarantee for the ask feature — notes,
 * the original wording and every bug field except severity are dropped here,
 * not trusted to have been left off.
 */
function tasks(x: unknown, field: string, maxItems: number): TaskLike[] {
  if (x === undefined || x === null) return [];
  if (!Array.isArray(x)) throw new Bad(`${field} must be a list`);
  if (x.length > maxItems) throw new Bad(`${field} has more than ${maxItems} tasks`);
  return x.map((raw, i) => {
    if (!isObject(raw)) throw new Bad(`${field}[${i}] is not a task`);
    const due = text(raw.due, 'due', 10);
    if (due && !DATE.test(due)) throw new Bad(`${field}[${i}].due must be YYYY-MM-DD`);
    const priority = raw.priority;
    return {
      title: required(raw.title, `${field}[${i}].title`, 300),
      status: text(raw.status, 'status', 20) ?? 'todo',
      project: text(raw.project, 'project', 80),
      tags: list(raw.tags, 'tags', 12, 40),
      priority: typeof priority === 'number' && [0, 1, 2, 3].includes(priority) ? priority : undefined,
      due,
      createdAt: text(raw.createdAt, 'createdAt', 40),
      completedAt: text(raw.completedAt, 'completedAt', 40),
      severity: text(raw.severity, 'severity', 12),
      blockedReason: text(raw.blockedReason, 'blockedReason', 200),
    };
  });
}

// ── The hub's own state: the day's budget, and the store ─────────────────────

/**
 * The same Durable Object the sockets reach. Its name is the path the clients
 * connect on — `sync/<key>` — because TinyBase's router names it that way.
 */
const hub = (env: Env) =>
  env.TODO_SYNC.get(env.TODO_SYNC.idFromName(`sync/${env.SYNC_KEY}`)) as unknown as DurableObjectStub<TodoSync>;

export const dailyCap = (env: Env) => Math.max(1, Number(env.AI_DAILY_CAP) || 150);

// ── Routes ───────────────────────────────────────────────────────────────────

export async function handleAi(request: Request, env: Env, parts: string[]): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!env.SYNC_KEY || !secretsMatch(token, env.SYNC_KEY)) return json({ error: 'forbidden' }, 403);

  const route = parts.slice(1).join('/');
  const tz = safeZone(env.TIMEZONE);
  const today = dayIn(tz);
  const cap = dailyCap(env);

  if (route === 'status' && request.method === 'GET') {
    const used = isConfigured(env) ? await hub(env).usedOn(today) : 0;
    return json({
      configured: isConfigured(env),
      model: env.AI_MODEL?.trim() || DEFAULT_MODEL,
      cap,
      used,
      timezone: tz,
    });
  }

  if (request.method !== 'POST') return json({ error: 'not_found' }, 404);

  try {
    switch (route) {
      case 'normalise': return await normalise(request, env, today, cap);
      case 'steps': return await steps(request, env, today, cap);
      case 'image': return await image(request, env, today, cap);
      case 'ask': return await ask(request, env, today, cap);
      case 'brief': return await brief(request, env);
      default: return json({ error: 'not_found' }, 404);
    }
  } catch (err) {
    if (err instanceof Bad) return json({ error: 'bad_request', detail: err.message }, err.status);
    if (err instanceof AiError) {
      // The code and nothing else: no message, no prompt, no reply.
      console.error(`[ai] ${route} failed: ${err.code}`);
      return failure(err.code);
    }
    console.error(`[ai] ${route} crashed`);
    return failure('upstream');
  }
}

/** Spend one unit of today's budget before anything is sent. */
async function spend(env: Env, today: string, cap: number): Promise<void> {
  if (!isConfigured(env)) throw new AiError('not_configured', 'no API key on the hub');
  if (!(await hub(env).reserve(today, cap)).ok) throw new AiError('capped', 'the daily ceiling is reached');
}

async function normalise(request: Request, env: Env, today: string, cap: number) {
  const body = await readBody(request, 16_000);
  const raw = required(body.text, 'text', 2000);
  const ctx = {
    today: date(body.today, 'today'),
    weekday: text(body.weekday, 'weekday', 12) ?? '',
    projects: list(body.projects, 'projects', 60, 80),
    raw,
  };
  await spend(env, today, cap);

  const reply = await complete(env, {
    system: normaliseSystem(),
    user: normaliseUser(ctx),
    effort: 'low',
    maxTokens: 2048,
    schema: NORMALISE_SCHEMA,
  });
  parseJson(reply); // never hand the client something it cannot read
  // The client already parses this shape from `claude -p`; handing it the JSON
  // text keeps one reader for every source.
  return json({ text: reply });
}

async function steps(request: Request, env: Env, today: string, cap: number) {
  const body = await readBody(request, 8_000);
  const input = {
    title: required(body.title, 'title', 300),
    notes: text(body.notes, 'notes', 600),
    project: text(body.project, 'project', 80),
    tags: list(body.tags, 'tags', 12, 40),
    existing: list(body.existing, 'existing', 30, 160),
  };
  await spend(env, today, cap);

  const reply = await complete(env, {
    system: STEPS_SYSTEM,
    user: stepsUser(input),
    effort: 'low',
    maxTokens: 2048,
    schema: STEPS_SCHEMA,
  });

  const seen = new Set(input.existing.map((s) => s.trim().toLowerCase()));
  const fresh = (parseJson<{ steps?: unknown }>(reply).steps ?? []) as unknown[];
  const out: string[] = [];
  for (const s of fresh) {
    if (typeof s !== 'string') continue;
    const step = s.trim().replace(/\.$/, '').slice(0, 100);
    if (step && !seen.has(step.toLowerCase())) { seen.add(step.toLowerCase()); out.push(step); }
  }
  return json({ steps: out.slice(0, 8) });
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

async function image(request: Request, env: Env, today: string, cap: number) {
  const body = await readBody(request, 4_200_000);
  const img = body.image;
  if (!isObject(img)) throw new Bad('image is required');
  const mediaType = img.media_type as ImageType;
  if (!IMAGE_TYPES.includes(mediaType)) throw new Bad('image.media_type must be jpeg, png, webp or gif');
  const data = typeof img.data === 'string' ? img.data : '';
  if (!data || data.length > 4_000_000) throw new Bad('image.data is missing or larger than 4 MB');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data.slice(0, 4096))) throw new Bad('image.data is not base64');

  const ctx = {
    today: date(body.today, 'today'),
    weekday: text(body.weekday, 'weekday', 12) ?? '',
    projects: list(body.projects, 'projects', 60, 80),
    hint: text(body.hint, 'hint', 200),
  };
  await spend(env, today, cap);

  const reply = await complete(env, {
    system: IMAGE_SYSTEM,
    user: [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
      { type: 'text', text: imageUser(ctx) },
    ],
    effort: 'medium',
    maxTokens: 4096,
    schema: IMAGE_SCHEMA,
  });
  parseJson(reply);
  return json({ text: reply });
}

async function ask(request: Request, env: Env, today: string, cap: number) {
  const body = await readBody(request, 150_000);
  const input = {
    today: date(body.today, 'today'),
    weekday: text(body.weekday, 'weekday', 12) ?? '',
    question: required(body.question, 'question', 500),
    open: tasks(body.open, 'open', 300),
    recent: tasks(body.recent, 'recent', 60),
  };
  await spend(env, today, cap);

  const answer = await complete(env, {
    system: ASK_SYSTEM,
    user: askUser(input),
    effort: 'medium',
    maxTokens: 1500,
  });
  return json({ answer });
}

async function brief(request: Request, env: Env) {
  if (!isConfigured(env)) throw new AiError('not_configured', 'no API key on the hub');
  const body = await readBody(request, 1_000);
  const result = await hub(env).makeBrief({ force: body.force === true });
  return json(result, result.status === 'failed' ? 502 : 200);
}
