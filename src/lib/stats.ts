/**
 * What the vault adds up to.
 *
 * Kept apart from `vault.ts` because that file carries the Tauri bridge and
 * touches `window`, which the sync hub cannot import. The hub writes the daily
 * brief and needs exactly these numbers, computed by exactly this code — a
 * second copy would drift from the one the app shows.
 */

import type { Stats, Task, Vault } from './types';
import { todayISO } from './dates';

export const isOpen = (t: Task) => t.status !== 'done' && t.status !== 'cancelled';

export function computeStats(vault: Vault, day = todayISO()): Stats {
  const open = vault.tasks.filter(isOpen);
  return {
    date: day,
    total: vault.tasks.length,
    open: open.length,
    doing: open.filter((t) => t.status === 'doing').length,
    blocked: open.filter((t) => t.status === 'blocked').length,
    overdue: open.filter((t) => t.due && t.due < day).length,
    dueToday: open.filter((t) => t.due === day).length,
    completedToday: vault.tasks.filter((t) => t.completedAt?.slice(0, 10) === day).length,
    urgent: open.filter((t) => t.priority === 0).length,
    streak: computeStreak(vault, day),
  };
}

/** Consecutive days ending today (or yesterday) with at least one completion. */
function computeStreak(vault: Vault, day: string): number {
  const done = new Set(
    vault.tasks.filter((t) => t.completedAt).map((t) => t.completedAt!.slice(0, 10)),
  );
  if (done.size === 0) return 0;

  const cursor = new Date(`${day}T12:00:00`);
  // Nothing finished yet today shouldn't read as a broken streak.
  if (!done.has(day)) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (done.has(todayISO(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
