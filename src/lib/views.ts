/**
 * Which tasks each screen shows, and the week in numbers.
 *
 * Three ideas from the task apps people keep using, each one a rule here:
 *
 *  - **Inbox before the list.** A task the importer found in a Claude Code
 *    session is a suggestion until someone says yes. It waits in Inbox
 *    (`status: 'inbox'`) and stays out of every other list, so a wrong guess
 *    clutters one screen instead of all of them.
 *  - **When I'll do it is not when it is due.** `scheduled` is the day you mean
 *    to work on it; `due` is the deadline. Today shows both kinds, because the
 *    question it answers is "what is on my plate now".
 *  - **A week is the unit of review.** A day is too short to see a pattern and
 *    a month too long to remember it.
 *
 * Pure, so `test/views.ts` can hold each rule.
 */

import { isOpen } from './stats';
import { todayISO, addDays } from './dates';
import type { Task, Vault } from './types';

export const isInbox = (t: Task) => t.status === 'inbox';

/** Open and accepted: what every list except Inbox shows. */
export const isLive = (t: Task) => isOpen(t) && !isInbox(t);

/** Why a task is on Today — also the order they are shown in. */
export type TodayReason = 'overdue' | 'due' | 'doing' | 'planned';

export function todayReason(t: Task, today = todayISO()): TodayReason | null {
  if (!isLive(t)) return null;
  if (t.due && t.due < today) return 'overdue';
  if (t.due === today) return 'due';
  if (t.status === 'doing') return 'doing';
  // Planned for today, or planned for a day that has passed and not done —
  // it rolls forward rather than vanishing into the past.
  if (t.scheduled && t.scheduled <= today) return 'planned';
  return null;
}

const REASON_ORDER: TodayReason[] = ['overdue', 'due', 'doing', 'planned'];

export function todayTasks(tasks: Task[], today = todayISO()): Task[] {
  return tasks
    .map((t) => ({ t, r: todayReason(t, today) }))
    .filter((x): x is { t: Task; r: TodayReason } => x.r !== null)
    .sort((a, b) => REASON_ORDER.indexOf(a.r) - REASON_ORDER.indexOf(b.r)
      || a.t.priority - b.t.priority
      || (a.t.due ?? '9').localeCompare(b.t.due ?? '9')
      || (b.t.createdAt ?? '').localeCompare(a.t.createdAt ?? ''))
    .map((x) => x.t);
}

export function inboxTasks(tasks: Task[]): Task[] {
  return tasks.filter(isInbox).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

// ── The week ─────────────────────────────────────────────────────────────────

export interface WeekReview {
  from: string; // YYYY-MM-DD, inclusive
  to: string;   // YYYY-MM-DD, inclusive (today)
  finished: Task[];
  added: number;
  open: number;
  overdue: Task[];
  inbox: number;
  /** Open and untouched for two weeks or more — oldest first. */
  stuck: Task[];
  byProject: { project: string; count: number }[];
  /** Finished per day, oldest day first, seven entries. */
  byDay: { day: string; count: number }[];
}

/** The heading for finished work filed under no project. */
export const NO_PROJECT = 'No project';

const dayOf = (iso: string | undefined) => (iso ? todayISO(new Date(iso)) : '');

export function weekReview(vault: Vault, today = todayISO()): WeekReview {
  const from = addDays(today, -6);
  const inWeek = (iso?: string) => {
    const d = dayOf(iso);
    return d >= from && d <= today;
  };
  const finished = vault.tasks
    .filter((t) => t.status === 'done' && inWeek(t.completedAt))
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  const live = vault.tasks.filter(isLive);
  const stale = addDays(today, -14);

  const projects = new Map<string, number>();
  for (const t of finished) projects.set(t.project ?? NO_PROJECT, (projects.get(t.project ?? NO_PROJECT) ?? 0) + 1);

  const byDay = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(from, i);
    return { day, count: finished.filter((t) => dayOf(t.completedAt) === day).length };
  });

  return {
    from,
    to: today,
    finished,
    added: vault.tasks.filter((t) => inWeek(t.createdAt)).length,
    open: live.length,
    overdue: live.filter((t) => t.due && t.due < today).sort((a, b) => (a.due ?? '').localeCompare(b.due ?? '')),
    inbox: vault.tasks.filter(isInbox).length,
    stuck: live
      .filter((t) => dayOf(t.updatedAt || t.createdAt) < stale)
      .sort((a, b) => (a.updatedAt || a.createdAt).localeCompare(b.updatedAt || b.createdAt))
      .slice(0, 8),
    byProject: [...projects].map(([project, count]) => ({ project, count })).sort((a, b) => b.count - a.count),
    byDay,
  };
}
