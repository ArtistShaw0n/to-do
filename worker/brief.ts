/**
 * The morning brief, written by the hub itself.
 *
 * Until now a brief existed only on days Shawon opened a session and Claude
 * wrote one. This writes it without anyone: it reads the tasks out of the very
 * store the devices sync with, asks Claude for three to six lines, and writes
 * one row into `digests`. The hub's store is a peer like any other, so that row
 * reaches every device the way a task typed on a phone does.
 *
 * It reads tasks and nothing else. Notes hold passwords; `storeToVault` hands
 * them over along with everything, and they are dropped on the floor here.
 */

import type { MergeableStore } from 'tinybase';
import { storeToVault, TABLES } from '../src/lib/store';
import { computeStats, isOpen } from '../src/lib/stats';
import type { Task } from '../src/lib/types';
import { AiError, complete, type AiEnv } from './ai';
import { dayIn, daysBefore, weekdayIn } from './day';
import { BRIEF_SYSTEM, briefUser, type TaskLike } from './prompts';

export interface BriefResult {
  status: 'written' | 'skipped' | 'failed';
  date: string;
  /** Why nothing was written, or what went wrong — a code, never a message from the API. */
  reason?: string;
}

/** The fields the model may see, and only those. */
const forModel = (t: Task): TaskLike => ({
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

/**
 * Most pressing first, so that when a long list is trimmed it is the tail that
 * goes: urgent before normal, then the soonest due date, then the newest.
 */
function byPressure(a: Task, b: Task): number {
  return a.priority - b.priority
    || (a.due ?? '9999').localeCompare(b.due ?? '9999')
    || (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
}

/** A reply that is plausibly a brief. Anything else is not worth showing. */
export function cleanBrief(text: string): string | null {
  const body = text
    .replace(/^```(?:markdown|md)?\s*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .trim();
  return body.length >= 12 && body.length <= 2000 ? body : null;
}

export interface BriefOptions {
  tz: string;
  /** Rewrite even a brief that is already there. A person asked for it. */
  force: boolean;
  /** Spend one unit of today's budget; false when none is left. */
  reserve: () => Promise<boolean>;
  now?: Date;
}

export async function writeBrief(
  env: AiEnv,
  store: MergeableStore,
  opts: BriefOptions,
): Promise<BriefResult> {
  const now = opts.now ?? new Date();
  const date = dayIn(opts.tz, now);

  // A brief Claude wrote in a session, or that this wrote earlier today, stands:
  // the morning job must not overwrite something better. Only a machine-made
  // floor is replaced, or anything at all when a person pressed refresh.
  const existing = store.getRow(TABLES.digests, date);
  const author = typeof existing.author === 'string' ? existing.author : undefined;
  if (!opts.force && author && author !== 'auto') {
    return { status: 'skipped', date, reason: 'already_written' };
  }

  const vault = storeToVault(store);
  const open = vault.tasks.filter(isOpen).sort(byPressure);
  if (!open.length) return { status: 'skipped', date, reason: 'nothing_open' };

  if (!(await opts.reserve())) return { status: 'skipped', date, reason: 'capped' };

  const since = daysBefore(date, 3);
  const recent = vault.tasks
    .filter((t) => t.completedAt && t.completedAt.slice(0, 10) >= since)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));

  const stats = computeStats(vault, date);

  let markdown: string | null;
  try {
    markdown = cleanBrief(await complete(env, {
      system: BRIEF_SYSTEM,
      user: briefUser({
        today: date,
        weekday: weekdayIn(opts.tz, now),
        timezone: opts.tz,
        stats,
        open: open.map(forModel),
        recent: recent.map(forModel),
      }),
      effort: 'medium',
      maxTokens: 2048,
    }));
  } catch (err) {
    return { status: 'failed', date, reason: err instanceof AiError ? err.code : 'upstream' };
  }
  if (!markdown) return { status: 'failed', date, reason: 'unusable' };

  store.setRow(TABLES.digests, date, {
    markdown,
    stats: JSON.stringify(stats),
    createdAt: now.toISOString(),
    author: 'api',
  });
  return { status: 'written', date };
}
