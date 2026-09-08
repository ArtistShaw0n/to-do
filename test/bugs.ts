/**
 * Proof that each bug rule actually refuses what it claims to refuse.
 *
 *     pnpm test:bugs
 *
 * Every test is named after the rule it defends, so a failure says which
 * guarantee has gone rather than which function threw.
 */

import { checkReport, incomplete, awaitingCheck, moveBug, sortBugs } from '../src/lib/bugs';
import type { Severity, Status, Task } from '../src/lib/types';

const results: [string, boolean, string?][] = [];
const check = (name: string, ok: boolean, detail?: string) => results.push([name, ok, detail]);

let seq = 0;
function bug(over: Partial<Task> = {}): Task {
  seq += 1;
  return {
    id: `b${seq}`,
    title: 'Attachment preview fails',
    status: 'todo',
    priority: 2,
    tags: ['bug', 'email'],
    project: 'OERP',
    subtasks: [],
    createdAt: '2026-09-08T09:00:00.000Z',
    updatedAt: '2026-09-08T09:00:00.000Z',
    order: seq,
    source: 'app',
    steps: '1. Open Drive\n2. Click a file',
    expected: 'It previews without downloading',
    severity: 'major',
    ...over,
  } as Task;
}

// ── A bug cannot be closed without being checked ─────────────────────────────

check('a bug cannot jump from in-progress straight to done',
  moveBug(bug({ status: 'doing' }), { to: 'done', by: 'Shawon' }).ok === false);

check('the refusal explains what to do instead',
  /fixed.*first/i.test(moveBug(bug({ status: 'doing' }), { to: 'done', by: 'S' }).reason ?? ''));

check('a plain task may still go straight to done',
  moveBug(bug({ status: 'doing', tags: [] }), { to: 'done', by: 'Shawon' }).ok === true);

// ── Fixing needs a build number ──────────────────────────────────────────────

check('cannot mark fixed without saying which build',
  moveBug(bug({ status: 'doing' }), { to: 'fixed', by: 'Rahim' }).ok === false);

const fixed = moveBug(bug({ status: 'doing' }), { to: 'fixed', by: 'Rahim', fixedIn: 'v2.4.1' });
check('marking fixed records the build and the fixer',
  fixed.ok && fixed.task?.fixedIn === 'v2.4.1' && fixed.task?.fixedBy === 'Rahim');

check('a fixed bug still counts as open work',
  fixed.task?.status === 'fixed' && fixed.task?.status !== 'done');

// ── The fixer cannot verify their own fix ────────────────────────────────────

const selfVerify = moveBug(fixed.task!, { to: 'done', by: 'Rahim' });
check('the person who fixed it cannot be the one who verifies it',
  selfVerify.ok === false);
check('and it says so by name',
  /Rahim.*cannot/i.test(selfVerify.reason ?? ''));

check('case does not let the same person through',
  moveBug(fixed.task!, { to: 'done', by: 'rahim' }).ok === false);

const verified = moveBug(fixed.task!, { to: 'done', by: 'Abdullah' });
check('someone else can verify it', verified.ok === true);
check('verifying records who checked it', verified.task?.verifiedBy === 'Abdullah');
check('closing without saying who is refused',
  moveBug(fixed.task!, { to: 'done' }).ok === false);

// ── Reopening ────────────────────────────────────────────────────────────────

const reopened = moveBug(verified.task!, { to: 'todo' });
check('a closed bug can be reopened', reopened.ok === true);
check('reopening counts', reopened.task?.reopenCount === 1);
check('reopening clears the build it was supposedly fixed in',
  reopened.task?.fixedIn === undefined && reopened.task?.verifiedBy === undefined);

const twice = moveBug(
  moveBug(moveBug(reopened.task!, { to: 'fixed', by: 'Rahim', fixedIn: 'v2.4.2' }).task!,
    { to: 'done', by: 'Abdullah' }).task!,
  { to: 'todo' });
check('the count keeps climbing across rounds', twice.task?.reopenCount === 2);

// ── A report only has to be complete once it leaves your hands ───────────────

check('a bug you kept to yourself is never complained about',
  checkReport(bug({ steps: undefined, expected: undefined, severity: undefined })).length === 0);

check('handing it to someone with no steps is a complaint',
  checkReport(bug({ reportedBy: 'Abdullah', steps: undefined })).some((c) => c.field === 'steps'));
check('handing it on with no expected result is a complaint',
  checkReport(bug({ reportedBy: 'Abdullah', expected: undefined })).some((c) => c.field === 'expected'));
check('someone else having fixed it counts as handed on too',
  checkReport(bug({ fixedBy: 'Rahim', steps: undefined })).some((c) => c.field === 'steps'));

check('severity ranks the list, it is not demanded',
  checkReport(bug({ reportedBy: 'Abdullah', severity: undefined })).length === 0);
check('a complete handed-on report has no complaints',
  checkReport(bug({ reportedBy: 'Abdullah' })).length === 0);
check('a plain task is never complained about',
  checkReport(bug({ tags: [], reportedBy: 'Abdullah', steps: undefined })).length === 0);

// ── Severity and priority stay separate ──────────────────────────────────────

const typo = bug({ severity: 'cosmetic', priority: 0, title: 'Typo on the front page' });
const adminCrash = bug({ severity: 'blocker', priority: 3, title: 'Crash in an unused screen' });
const order = sortBugs([typo, adminCrash]).map((t) => t.title);
check('worst damage sorts first, whatever its urgency',
  order[0] === 'Crash in an unused screen',
  order.join(' then '));

const twoBlockers = sortBugs([
  bug({ severity: 'blocker', priority: 3, title: 'later' }),
  bug({ severity: 'blocker', priority: 0, title: 'sooner' }),
]).map((t) => t.title);
check('within one severity, urgency decides', twoBlockers[0] === 'sooner');

// ── The queues that go stale ─────────────────────────────────────────────────

const pool = [
  bug({ status: 'fixed', fixedIn: 'v1' }),
  bug({ status: 'doing' }),
  bug({ status: 'fixed', fixedIn: 'v1' }),
  bug({ steps: undefined }),                          // his own line — his business
  bug({ reportedBy: 'Abdullah', steps: undefined }),  // someone else's to fix
];
check('awaiting-check finds only the fixed ones', awaitingCheck(pool).length === 2);
check('incomplete passes over a personal note and finds the handed-on one',
  incomplete(pool).length === 1);

// ── Moves that make no sense are refused ─────────────────────────────────────

for (const [from, to] of [['done', 'fixed'], ['cancelled', 'done'], ['inbox', 'fixed']] as [Status, Status][]) {
  check(`${from} → ${to} is refused`, moveBug(bug({ status: from }), { to, by: 'x' }).ok === false);
}

// ── Report ───────────────────────────────────────────────────────────────────

for (const [name, ok, detail] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} rules hold`);
process.exit(failed ? 1 : 0);

// Keeps the Severity import honest if the file is ever trimmed.
export type { Severity };
