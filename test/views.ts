/**
 * Proof that each screen shows what it says it shows.
 *
 *     pnpm test:views
 */

import { inboxTasks, isLive, todayReason, todayTasks, weekReview } from '../src/lib/views';
import type { Task, Vault } from '../src/lib/types';

const results: [string, boolean, string?][] = [];
const check = (n: string, ok: boolean, d?: string) => results.push([n, ok, d]);

const today = '2026-11-16';
let seq = 0;
const task = (over: Partial<Task>): Task => ({
  id: `t${++seq}`, title: `Task ${seq}`, status: 'todo', priority: 2, tags: [], subtasks: [],
  createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z', order: seq, source: 'app', ...over,
});

// ── Inbox ────────────────────────────────────────────────────────────────────

const inbox = task({ status: 'inbox', title: 'Found in a session' });
check('an inbox task is not live', !isLive(inbox));
check('…so it is on no list but Inbox, not even when it is due today', todayReason({ ...inbox, due: today }, today) === null);
check('Inbox lists inbox tasks only, newest first', (() => {
  const a = task({ status: 'inbox', createdAt: '2026-11-10T00:00:00Z' });
  const b = task({ status: 'inbox', createdAt: '2026-11-12T00:00:00Z' });
  const got = inboxTasks([a, task({}), b]);
  return got.length === 2 && got[0].id === b.id;
})());

// ── Today ────────────────────────────────────────────────────────────────────

const overdue = task({ due: '2026-11-10', title: 'overdue' });
const dueToday = task({ due: today, title: 'due today' });
const doing = task({ status: 'doing', title: 'in progress' });
const planned = task({ scheduled: today, title: 'planned for today' });
const rolled = task({ scheduled: '2026-11-14', title: 'planned for a passed day' });
const later = task({ scheduled: '2026-11-20', due: '2026-11-25', title: 'later' });
const finished = task({ status: 'done', due: today, title: 'done' });
const plain = task({ title: 'no dates' });

const t = todayTasks([plain, later, planned, finished, doing, rolled, dueToday, overdue], today);
check('Today holds the overdue, the due, the in-progress and the planned', t.length === 5, t.map((x) => x.title).join(' | '));
check('…a task planned for a day that passed rolls forward instead of vanishing', t.includes(rolled));
check('…nothing planned for later, nothing finished, nothing without a date', !t.includes(later) && !t.includes(finished) && !t.includes(plain));
check('…overdue first, then due today, then in progress, then planned',
  t[0] === overdue && t[1] === dueToday && t[2] === doing, t.map((x) => x.title).join(' | '));
check('a do-date and a deadline are different: planned later, due later — not today',
  todayReason(later, today) === null);

// ── The week ─────────────────────────────────────────────────────────────────

const vault = {
  version: 1, projects: [], notes: [], digests: [], meta: {},
  tasks: [
    task({ status: 'done', project: 'OERP', completedAt: '2026-11-16T05:00:00Z', createdAt: '2026-11-15T05:00:00Z' }),
    task({ status: 'done', project: 'OERP', completedAt: '2026-11-12T05:00:00Z' }),
    task({ status: 'done', project: 'Envato Market', completedAt: '2026-11-10T05:00:00Z' }),
    task({ status: 'done', project: 'OERP', completedAt: '2026-11-09T05:00:00Z' }), // eight days ago: out
    task({ due: '2026-11-11', title: 'late one' }),
    task({ updatedAt: '2026-10-20T00:00:00Z', createdAt: '2026-10-20T00:00:00Z', title: 'forgotten' }),
    task({ status: 'inbox' }),
  ],
} as unknown as Vault;
const w = weekReview(vault, today);
check('the week is seven days ending today', w.from === '2026-11-10' && w.to === today && w.byDay.length === 7);
check('finished counts only the seven days', w.finished.length === 3, String(w.finished.length));
check('…split by project, the busiest first', w.byProject[0].project === 'OERP' && w.byProject[0].count === 2);
check('…and by day, today last', w.byDay[6].day === today && w.byDay[6].count === 1);
check('overdue and stuck are named, inbox counted, and inbox is not "open"',
  w.overdue.length === 1 && w.stuck.some((x) => x.title === 'forgotten') && w.inbox === 1 && w.open === 2,
  `overdue ${w.overdue.length} stuck ${w.stuck.length} inbox ${w.inbox} open ${w.open}`);

for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `  — ${d}` : ''}`);
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} promises hold`);
process.exit(failed ? 1 : 0);
