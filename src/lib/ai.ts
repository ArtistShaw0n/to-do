/**
 * The app's way of asking the hub to think.
 *
 * Claude is not called from here: a phone would need the API key to do that,
 * and a key inside an app is a key anyone can read out of it. Instead the hub
 * holds the key and offers a few narrow doors (`/ai/*`), and this module is the
 * small amount of code that knocks on them — with the same key the sockets use.
 *
 * Everything here fails *softly*. A hub with no API key, a day's ceiling
 * already spent, a phone with no signal: each is an `AiUnavailable`, and every
 * caller has an older path to fall back to. Nothing in the app is allowed to
 * get worse because the model is out of reach.
 */

import { useSyncExternalStore } from 'react';
import type { Task, Vault } from './types';
import { readSyncConfig } from './sync';
import { isOpen } from './stats';
import { addDays, todayISO } from './dates';
import { normaliseContext } from './normalise';

export interface AiStatus {
  configured: boolean;
  model: string;
  cap: number;
  used: number;
  timezone: string;
}

/** Why a call did not return an answer. `code` is the hub's word for it. */
export class AiUnavailable extends Error {
  constructor(readonly code: string, readonly status = 0) {
    super(code);
    this.name = 'AiUnavailable';
  }
}

/** A sentence for a person, from a code for a program. */
export function describeAiError(err: unknown): string {
  const code = err instanceof AiUnavailable ? err.code : 'failed';
  switch (code) {
    case 'capped': return "Today's limit for Claude is reached. It resets tomorrow.";
    case 'not_configured': return "The hub has no API key yet, so Claude isn't switched on.";
    case 'refused': return 'Claude declined that one.';
    case 'network': case 'no_hub': return "Couldn't reach the hub.";
    case 'rate_limited': return 'Claude is busy right now. Try again in a moment.';
    case 'image_unreadable': return "That picture couldn't be opened.";
    case 'image_too_large': return 'That picture is too large to send, even shrunk.';
    default: return "Claude couldn't answer that. Try again.";
  }
}

// ── Talking to the hub ───────────────────────────────────────────────────────

/** The hub speaks https; a saved `wss://` address is the same place. */
function base(): { url: string; key: string } | null {
  const config = readSyncConfig();
  if (!config) return null;
  const url = config.url.trim().replace(/\/+$/, '')
    .replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
  return { url, key: config.key };
}

async function request<T>(
  route: string,
  opts: { method?: 'GET' | 'POST'; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const hub = base();
  if (!hub) throw new AiUnavailable('no_hub');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 45_000);
  try {
    const res = await fetch(`${hub.url}/ai/${route}`, {
      method: opts.method ?? 'POST',
      headers: {
        authorization: `Bearer ${hub.key}`,
        ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) {
      const code = typeof data.error === 'string' ? data.error : 'failed';
      if (code === 'capped') markCapped();
      throw new AiUnavailable(code, res.status);
    }
    return data as T;
  } catch (err) {
    if (err instanceof AiUnavailable) throw err;
    throw new AiUnavailable('network');
  } finally {
    clearTimeout(timer);
  }
}

// ── Whether it is switched on ────────────────────────────────────────────────

let status: AiStatus | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Replace the snapshot rather than mutate it: `useSyncExternalStore` compares by identity. */
function setStatus(next: AiStatus | null) {
  status = next;
  emit();
}

function markUsed() {
  if (status) setStatus({ ...status, used: status.used + 1 });
}

function markCapped() {
  if (status) setStatus({ ...status, used: status.cap });
}

let askedAt = 0;

/**
 * Ask the hub whether Claude is available.
 *
 * `maxAgeMs` lets a caller that fires often — the window coming back to the front —
 * settle for an answer that is recent enough. The question is not free: it reaches
 * the Durable Object, and a hub that is asked it on every switch of window spends
 * its day waking up.
 */
export async function refreshAiStatus(maxAgeMs = 0): Promise<AiStatus | null> {
  if (maxAgeMs && status && Date.now() - askedAt < maxAgeMs) return status;
  askedAt = Date.now();
  try {
    setStatus(await request<AiStatus>('status', { method: 'GET', timeoutMs: 8_000 }));
  } catch {
    // An old hub with no /ai doors, or no signal: simply not available.
    setStatus(null);
  }
  return status;
}

/** True when a call is worth attempting right now. */
export const aiReady = (): boolean => !!status?.configured && status.used < status.cap;

export function useAiStatus(): AiStatus | null {
  return useSyncExternalStore(
    (onChange) => { listeners.add(onChange); return () => listeners.delete(onChange); },
    () => status,
  );
}

// ── The calls ────────────────────────────────────────────────────────────────

/**
 * A typed line, as the JSON text `parseItems` already knows how to read — the
 * same shape `claude -p` produces, so there is still one reader for both.
 */
export async function aiNormalise(raw: string, vault: Vault): Promise<string> {
  const c = normaliseContext(raw, vault);
  const { text } = await request<{ text: string }>('normalise', {
    body: { text: raw, today: c.today, weekday: c.weekday, projects: c.projects },
  });
  markUsed();
  return text;
}

export async function aiSteps(task: Task): Promise<string[]> {
  const { steps } = await request<{ steps: string[] }>('steps', {
    body: {
      title: task.title,
      notes: task.notes,
      project: task.project,
      tags: task.tags,
      existing: task.subtasks.map((s) => s.title),
    },
  });
  markUsed();
  return steps;
}

/** The fields the hub is willing to read. It checks again; this is the first line. */
const forModel = (t: Task) => ({
  title: t.title,
  status: t.status,
  project: t.project,
  tags: t.tags,
  priority: t.priority,
  due: t.due,
  createdAt: t.createdAt,
  completedAt: t.completedAt,
  severity: t.severity,
  blockedReason: t.blockedReason,
});

export async function aiAsk(question: string, vault: Vault): Promise<string> {
  const since = addDays(todayISO(), -7);
  const recent = vault.tasks
    .filter((t) => t.completedAt && t.completedAt.slice(0, 10) >= since)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));

  const c = normaliseContext(question, vault);
  const { answer } = await request<{ answer: string }>('ask', {
    body: {
      question,
      today: c.today,
      weekday: c.weekday,
      // Open work and the last week's finished work. Notes are not here, and
      // are not an option: the hub has no field to put them in.
      open: vault.tasks.filter(isOpen).slice(0, 300).map(forModel),
      recent: recent.slice(0, 60).map(forModel),
    },
    timeoutMs: 60_000,
  });
  markUsed();
  return answer;
}

export async function aiBrief(force: boolean): Promise<{ status: string; reason?: string }> {
  const result = await request<{ status: string; reason?: string }>('brief', {
    body: { force },
    timeoutMs: 60_000,
  });
  if (result.status === 'written') markUsed();
  return result;
}

// ── Pictures ─────────────────────────────────────────────────────────────────

/** Longest side the model reads at full detail; larger pictures are shrunk to it anyway. */
const MAX_SIDE = 1568;
/** The hub refuses more than 1.6 MB of base64; stay under it. */
const MAX_BASE64 = 1_500_000;

/**
 * A picture, small enough to send.
 *
 * A phone screenshot is several megabytes of PNG; the model reads it no better
 * than a 1568-pixel JPEG of the same thing, and the hub will not take it. So it
 * is redrawn on a canvas, on a white ground — a transparent PNG would turn
 * black as a JPEG — and tried at falling quality until it fits.
 */
export async function prepareImage(file: Blob): Promise<{ media_type: 'image/jpeg'; data: string }> {
  const bitmap = await createImageBitmap(file);
  let scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));

  for (const quality of [0.9, 0.75, 0.6]) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new AiUnavailable('image_unreadable');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (!blob) throw new AiUnavailable('image_unreadable');
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    const data = dataUrl.slice(dataUrl.indexOf(',') + 1);
    if (data.length <= MAX_BASE64) {
      bitmap.close();
      return { media_type: 'image/jpeg', data };
    }
    scale *= 0.7; // still too big: smaller as well as rougher
  }
  bitmap.close();
  throw new AiUnavailable('image_too_large');
}

/** Tasks read out of a picture, as the JSON text `parseItems` reads. */
export async function aiImage(
  image: { media_type: string; data: string },
  vault: Vault,
  hint?: string,
): Promise<string> {
  const c = normaliseContext('', vault);
  const { text } = await request<{ text: string }>('image', {
    body: { image, today: c.today, weekday: c.weekday, projects: c.projects, hint },
    timeoutMs: 90_000,
  });
  markUsed();
  return text;
}
