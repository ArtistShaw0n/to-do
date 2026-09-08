/**
 * How a bug travels from reported to closed, and what must be true at each step.
 *
 *   new → accepted → in progress → fixed (in build X) → verified → closed
 *                                      ↓                    ↓
 *                                  won't fix           reopened
 *
 * These are rules, not suggestions: every one of them exists because skipping
 * it is how a bug list stops being trustworthy. They are enforced here rather
 * than left to whoever is filling the form, and each has a test named after it.
 */

import { SEVERITIES, type Severity, type Status, type Task } from './types';

export interface Complaint {
  field: string;
  message: string;
}

export const isBug = (t: Task) => t.tags.includes('bug');

/**
 * What a bug must carry before anyone can be asked to fix it.
 *
 * Reproduction steps are the one that matters. A bug nobody can reproduce is a
 * bug nobody can fix, and it will sit on the list forever being re-read.
 */
export function checkReport(t: Task): Complaint[] {
  const out: Complaint[] = [];
  if (!isBug(t)) return out;

  if (!t.steps?.trim()) {
    out.push({ field: 'steps', message: 'No steps to reproduce — nobody can act on this.' });
  }
  if (!t.expected?.trim()) {
    out.push({ field: 'expected', message: 'Says what happens, not what should happen instead.' });
  }
  if (!t.severity) {
    out.push({ field: 'severity', message: 'No severity, so it cannot be ranked against the others.' });
  }
  if (!t.project) {
    out.push({ field: 'project', message: 'No project.' });
  }
  return out;
}

/**
 * Which moves are allowed from where, for any task.
 *
 * This is the ordinary machine: a to-do can be finished in one step, because
 * for a to-do "done" means one thing and nobody has to check it. The extra
 * demands below apply to bugs only — a rule that made every shopping-list item
 * pass through a verification queue would just be in the way.
 */
const ALLOWED: Record<Status, Status[]> = {
  inbox: ['todo', 'doing', 'done', 'cancelled'],
  todo: ['doing', 'blocked', 'fixed', 'done', 'cancelled'],
  doing: ['fixed', 'blocked', 'todo', 'done', 'cancelled'],
  blocked: ['todo', 'doing', 'done', 'cancelled'],
  // The only way out of `fixed` is verified, or back for another go.
  fixed: ['done', 'todo', 'doing'],
  done: ['todo'],
  cancelled: ['todo'],
};

export interface Move {
  to: Status;
  /** Who is making the move. Needed for the rule that follows. */
  by?: string;
  /** The build the fix went into. Required to reach `fixed`. */
  fixedIn?: string;
}

export interface MoveResult {
  ok: boolean;
  reason?: string;
  task?: Task;
}

/**
 * Apply a status change, refusing the ones that make a bug list lie.
 *
 * The refusals, and why each one exists:
 *
 *  - **A bug cannot jump to `done`.** It has to pass through `fixed` first.
 *    Otherwise "Done" means either "the developer thinks it works" or "someone
 *    checked it on a real build", and nobody can tell which — which is exactly
 *    how a regression ships.
 *
 *  - **`fixed` needs a build number.** Without it, "is this fixed in the build
 *    I am testing?" has no answer and QA re-tests everything by guesswork.
 *
 *  - **Whoever fixed it cannot be the one who verifies it.** Marking your own
 *    work as checked is not checking. This is the rule teams drop first and
 *    regret longest.
 *
 *  - **Reopening counts.** A bug reopened three times is not a fix that keeps
 *    failing; it is a diagnosis that was wrong from the start, and the count is
 *    what makes that visible.
 */
export function moveBug(task: Task, move: Move, now = new Date().toISOString()): MoveResult {
  const from = task.status;
  const { to } = move;

  if (from === to) return { ok: true, task };

  if (!ALLOWED[from]?.includes(to)) {
    return { ok: false, reason: `Cannot go from ${from} to ${to}.` };
  }

  // A bug is never closed in one step, however the general machine feels about
  // it: "done" has to mean somebody checked it, not that somebody hoped.
  if (isBug(task) && to === 'done' && from !== 'fixed') {
    return {
      ok: false,
      reason: 'A bug goes to "fixed" first, with the build it was fixed in, '
        + 'and is only closed once someone has checked it.',
    };
  }

  const next: Task = { ...task, status: to, updatedAt: now };

  if (to === 'fixed') {
    const build = move.fixedIn?.trim();
    if (isBug(task) && !build) {
      return {
        ok: false,
        reason: 'Say which build the fix went into, or nobody can tell whether '
          + 'the build they are testing has it.',
      };
    }
    next.fixedIn = build;
    next.fixedBy = move.by?.trim() || task.fixedBy;
    next.verifiedBy = undefined;
  }

  if (to === 'done') {
    const who = move.by?.trim();
    if (isBug(task)) {
      if (!who) {
        return { ok: false, reason: 'Say who checked it.' };
      }
      if (task.fixedBy && who.toLowerCase() === task.fixedBy.toLowerCase()) {
        return {
          ok: false,
          reason: `${who} fixed this, so ${who} cannot be the one who verifies it. `
            + 'Someone else has to look.',
        };
      }
    }
    next.verifiedBy = who;
    next.completedAt = now;
  }

  // Coming back from fixed or done means the fix did not hold.
  if ((from === 'fixed' || from === 'done') && (to === 'todo' || to === 'doing')) {
    next.reopenCount = (task.reopenCount ?? 0) + 1;
    next.fixedIn = undefined;
    next.verifiedBy = undefined;
    next.completedAt = undefined;
  }

  return { ok: true, task: next };
}

/**
 * Order for a list someone is working through.
 *
 * Severity ranks the damage and priority ranks the urgency, and they are read
 * in that order — worst damage first, then soonest needed. Keeping them apart
 * is the point; a single blended number cannot answer either question.
 */
const SEVERITY_RANK: Record<Severity, number> = {
  blocker: 0, major: 1, minor: 2, cosmetic: 3,
};

export function sortBugs(bugs: Task[]): Task[] {
  return [...bugs].sort((a, b) => {
    const sa = a.severity ? SEVERITY_RANK[a.severity] : SEVERITIES.length;
    const sb = b.severity ? SEVERITY_RANK[b.severity] : SEVERITIES.length;
    return sa - sb
      || a.priority - b.priority
      || (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
  });
}

/** Bugs that are fixed but nobody has checked — the queue that goes stale. */
export const awaitingCheck = (tasks: Task[]) =>
  tasks.filter((t) => isBug(t) && t.status === 'fixed');

/** Reported but never given steps or a severity, so unworkable as they stand. */
export const incomplete = (tasks: Task[]) =>
  tasks.filter((t) => isBug(t) && checkReport(t).length > 0);
