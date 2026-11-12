#!/usr/bin/env node
/**
 * The work done in Claude Code on this Mac → the task list, every hour.
 *
 *     node scripts/sessions-to-tasks.mjs                 # dry run: shows what it would add, writes nothing
 *     node scripts/sessions-to-tasks.mjs --apply         # adds the tasks (what launchd runs, hourly)
 *     node scripts/sessions-to-tasks.mjs --since 2026-11-12T00:00:00Z   # dry run over a chosen window
 *
 * Each run reads only what was written since the last one — the byte offset of
 * every session file is kept in its state file — condenses it (his messages,
 * Claude's replies, files edited, commits), scrubs anything shaped like a
 * secret, and asks the hub's Claude (`POST /ai/sessions`) what work it shows.
 * The answer goes in through the CLI like any other task. A dry run never moves
 * the offsets, so it can be repeated.
 *
 * Refuses to write when the hub cannot be reached — the CLI would otherwise fall
 * back to the local file, which the hub never reads back — and stops for the
 * month at a spending ceiling (`VAULT_SESSIONS_MONTHLY_CAP`, $50).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeSession, loadVault, openSession, readSyncConfig } from '../bin/vault.mjs';
import { condense, condenseParts, readNew } from './lib/sessions.mjs';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const SINCE_ARG = args.includes('--since') ? args[args.indexOf('--since') + 1] : undefined;
const QUIET = args.includes('--quiet');
const BACKFILL = args.includes('--backfill');
const MONTH_ARG = args.includes('--month') ? args[args.indexOf('--month') + 1] : undefined;

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PROJECTS = process.env.VAULT_SESSIONS_PROJECTS || join(homedir(), '.claude', 'projects');
const STATE_DIR = process.env.VAULT_SESSIONS_STATE_DIR
  || join(homedir(), 'Library', 'Application Support', 'com.shawon.vault', 'session-import');
const STATE = join(STATE_DIR, 'state.json');
const LEDGER = join(STATE_DIR, 'imported.jsonl');
const LOCK = join(STATE_DIR, 'lock');
const MONTHLY_CAP = Number(process.env.VAULT_SESSIONS_MONTHLY_CAP) || 50;
const BATCH_CHARS = 220_000;

/** The Vault app's own `claude -p` runs: the app tidying a typed line, not his work. */
const IGNORED_FOLDERS = [/com-shawon-vault-run/];

/** $ per million tokens, input / output. Anything unlisted is costed as Opus. */
const PRICES = {
  'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5],
  'claude-opus-5': [5, 25], 'claude-opus-4-8': [5, 25], 'claude-sonnet-5': [2, 10],
};
const costOf = (u) => {
  const [i, o] = PRICES[u.model] ?? PRICES['claude-opus-5-5'];
  return (u.inputTokens * i + u.outputTokens * o) / 1e6;
};

// Kept in step with KIND_TAGS in src/lib/vault.ts and the module table in CLAUDE.md.
const KIND = ['bug', 'enhancement', 'release', 'design', 'frontend', 'backend', 'responsive',
  'architecture', 'requirements', 'billing', 'docs', 'test'];
const MODULES = ['email', 'project-hub', 'hris', 'meet-chat', 'team-evaluation', 'shared-ui',
  'property-booking', 'notification', 'portal'];

const say = (...m) => { if (!QUIET) console.log(...m); };
const log = (msg) => {
  mkdirSync(STATE_DIR, { recursive: true });
  appendFileSync(join(STATE_DIR, 'runs.log'), `${new Date().toISOString()} ${msg}\n`);
};

// ── State ────────────────────────────────────────────────────────────────────

function readState() {
  try { return JSON.parse(readFileSync(STATE, 'utf8')); } catch { return null; }
}

function writeState(state) {
  mkdirSync(STATE_DIR, { recursive: true });
  const tmp = `${STATE}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 1));
  renameSync(tmp, STATE);
}

function takeLock() {
  mkdirSync(STATE_DIR, { recursive: true });
  if (existsSync(LOCK)) {
    const pid = Number(readFileSync(LOCK, 'utf8'));
    try { process.kill(pid, 0); return false; } catch { /* stale */ }
  }
  writeFileSync(LOCK, String(process.pid));
  return true;
}

const dhakaDay = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
const startOfToday = () => new Date(`${dhakaDay()}T00:00:00+06:00`).toISOString();

// ── Finding what is new ──────────────────────────────────────────────────────

function sessionFiles() {
  const out = [];
  for (const folder of readdirSync(PROJECTS)) {
    if (IGNORED_FOLDERS.some((re) => re.test(folder))) continue;
    const dir = join(PROJECTS, folder);
    let names;
    try { names = readdirSync(dir); } catch { continue; }
    for (const n of names) if (n.endsWith('.jsonl')) out.push(join(dir, n));
  }
  return out;
}

function collect(state, since) {
  const sessions = [];
  const next = {};
  let ref = 0;
  for (const file of sessionFiles()) {
    const st = statSync(file);
    const known = state.files[file];
    // A file untouched since the window opened has nothing for us: remember where it ends.
    if (!known && st.mtime.toISOString() < since) { next[file] = { offset: st.size }; continue; }
    if (known && known.offset === st.size) { next[file] = known; continue; }

    const { events, end } = readNew(file, known?.offset ?? 0, known ? undefined : since);
    const title = events.filter((e) => e.kind === 'title').at(-1)?.text ?? known?.title;
    const work = events.filter((e) => e.kind !== 'title');
    const lastUser = work.filter((e) => e.kind === 'user').at(-1)?.text ?? known?.lastUser;
    next[file] = { offset: end, title, lastUser: lastUser?.slice(0, 400) };
    if (!work.length) continue;

    const firstIsUser = work[0].kind === 'user';
    sessions.push({
      ref: `s${++ref}`,
      file,
      folder: work.find((e) => e.cwd)?.cwd ?? file,
      title,
      started: work[0].ts,
      ended: work.at(-1).ts,
      log: condense(work, { earlier: firstIsUser ? undefined : known?.lastUser }),
    });
  }
  return { sessions, next };
}

/** The hub reads at most 1 MB; Bengali is three bytes a character, so batches are measured both ways. */
const BATCH_BYTES = 600_000;

function batches(sessions) {
  const out = [];
  let cur = [];
  let size = 0;
  let bytes = 0;
  for (const s of sessions) {
    const b = Buffer.byteLength(s.log);
    if (cur.length && (size + s.log.length > BATCH_CHARS || bytes + b > BATCH_BYTES)) { out.push(cur); cur = []; size = 0; bytes = 0; }
    cur.push(s);
    size += s.log.length;
    bytes += b;
  }
  if (cur.length) out.push(cur);
  return out;
}

// ── Asking the hub ───────────────────────────────────────────────────────────

async function ask(config, payload) {
  const base = config.url.replace(/\/+$/, '').replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
  const res = await fetch(`${base}/ai/sessions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.key}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(300_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`the hub answered ${res.status} ${body.error ?? ''} ${body.detail ?? ''}`.trim());
  return { reply: JSON.parse(body.text), usage: body.usage };
}

// ── Checking and applying ────────────────────────────────────────────────────

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Everything the model said, sorted into what will be done and what was refused, and why. */
function vet(items, existing, sessions, projects, allowNew, ours, aliases = {}) {
  const byId = new Map(existing.map((t) => [t.id, t]));
  const known = new Map(projects.map((p) => [p.toLowerCase(), p]));
  const titles = new Set(existing.map((t) => norm(t.title)));
  const accepted = [];
  const refused = [];
  for (const it of items) {
    const session = sessions.find((s) => s.ref === it.session);
    if (it.action === 'complete') {
      const t = byId.get(it.existing ?? '');
      if (!t) { refused.push([it, 'no such task in the list it was shown']); continue; }
      if (t.status === 'done' || t.status === 'cancelled') { refused.push([it, 'already finished']); continue; }
      // His tasks are his: the importer adds, it never changes one he made. A task
      // of his this work seems to finish is reported for him to close himself.
      // One the importer added itself an hour ago, it may close — otherwise
      // "started at ten, finished at eleven" would stay open for ever.
      if (!ours.includes(t.id)) {
        refused.push([{ ...it, title: `${t.id} ${t.title}` }, 'looks finished by this work — left for you to mark done']);
        continue;
      }
      if ((t.tags ?? []).includes('bug')) { refused.push([{ ...it, title: `${t.id} ${t.title}` }, 'a bug goes fix → verify, left for you']); continue; }
      accepted.push({ ...it, title: t.title, session, task: t });
      continue;
    }
    if (!it.title?.trim()) { refused.push([it, 'no title']); continue; }
    if (titles.has(norm(it.title))) { refused.push([it, 'a task with this title already exists']); continue; }
    const dropped = it.tags.filter((t) => !KIND.includes(t) && !MODULES.includes(t));
    const tags = it.tags.filter((t) => KIND.includes(t) || MODULES.includes(t))
      .filter((t) => !(it.status === 'done' && t === 'bug'));
    titles.add(norm(it.title));
    // A folder's name is not always the project's: the To-Do repo is the Vault app.
    const named = it.project ? aliases[it.project] ?? it.project : null;
    let project = named ? known.get(named.toLowerCase()) ?? named : null;
    let held;
    if (project && !known.has(project.toLowerCase()) && !allowNew.includes(project)) {
      held = project; // a new project is his call: filed with none until he says yes
      project = null;
    }
    accepted.push({ ...it, project, held, tags, dropped, session });
  }
  return { accepted, refused };
}

function cli(argv) {
  const out = execFileSync(process.execPath, [join(ROOT, 'bin', 'todo.mjs'), ...argv], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  return out;
}

/** Everything a run decided, written in one CLI call — one connection to the hub. Returns the ids in order. */
function applyAll(items, atOf = () => undefined) {
  if (!items.length) return [];
  const entries = items.map((item) => {
    if (item.action === 'complete') return { done: item.task.id };
    const flags = { p: String(item.priority) };
    const at = atOf(item);
    if (at) flags.at = at;
    if (item.project) flags.project = item.project;
    if (item.tags.length) flags.tag = item.tags.join(',');
    if (item.notes) flags.notes = item.notes;
    if (item.due) flags.due = item.due;
    if (item.evidence) flags.raw = item.evidence;
    if (item.status === 'done') flags.status = 'done';
    return { title: item.title, flags };
  });
  mkdirSync(STATE_DIR, { recursive: true });
  const file = join(STATE_DIR, `batch-${process.pid}.json`);
  writeFileSync(file, JSON.stringify(entries));
  try {
    const out = cli(['import', file]);
    const ids = JSON.parse(out.match(/^IDS (.*)$/m)?.[1] ?? 'null');
    if (!Array.isArray(ids) || ids.length !== items.length) throw new Error('the CLI did not report every id');
    return ids;
  } finally {
    try { unlinkSync(file); } catch { /* gone */ }
  }
}

// ── Reading the past, once ───────────────────────────────────────────────────

/**
 * Every session from the very first up to where the hourly run begins
 * (`state.since`), a session-day at a time, month by month from the oldest — so a
 * task left open in May and finished in June ends up done. A long day is split
 * into parts, never cut. Each task carries the date the work happened.
 */
function pastUnits(until) {
  const units = [];
  for (const file of sessionFiles()) {
    const { events } = readNew(file, 0);
    const title = events.filter((e) => e.kind === 'title').at(-1)?.text;
    const work = events.filter((e) => e.kind !== 'title' && e.ts < until);
    const byDay = new Map();
    for (const e of work) {
      const day = dhakaDay(new Date(e.ts));
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(e);
    }
    let lastUser;
    for (const [day, evs] of [...byDay].sort(([a], [b]) => (a < b ? -1 : 1))) {
      const earlier = evs[0].kind === 'user' ? undefined : lastUser;
      lastUser = evs.filter((e) => e.kind === 'user').at(-1)?.text ?? lastUser;
      if (!evs.some((e) => e.kind === 'user') && !earlier) continue;
      const parts = condenseParts(evs, { earlier });
      parts.forEach((log, i) => units.push({
        file, day, title: parts.length > 1 ? `${title ?? 'session'} — part ${i + 1} of ${parts.length}` : title,
        folder: evs.find((e) => e.cwd)?.cwd ?? file, started: evs[0].ts, ended: evs.at(-1).ts, log,
      }));
    }
  }
  return units.sort((a, b) => (a.started < b.started ? -1 : 1));
}

/**
 * `limit`: at most this many batches, then stop — the hourly run finishes an
 * unfinished backfill a few batches at a time instead of all at once, so the hub's
 * daily read and write allowances are never spent in one go.
 */
async function backfill(config, state, { limit = Infinity } = {}) {
  let ran = 0;
  const until = state.since;
  const units = pastUnits(until).filter((u) => !MONTH_ARG || u.day.startsWith(MONTH_ARG));
  const months = [...new Set(units.map((u) => u.day.slice(0, 7)))];
  say(`The past: ${units.length} session-days in ${months.length} months, ${units.reduce((n, u) => n + u.log.length, 0)} chars, up to ${until}.`);
  state.backfillDone ??= [];
  const totals = { calls: 0, cost: 0, added: 0, done: 0, completed: 0, refused: 0, held: new Map(), silent: 0 };

  for (const month of months) {
    // A month is finished as a whole: its batches are cut afresh each run, so
    // their numbers only mean something inside one run.
    if (APPLY && state.backfillDone.includes(month)) continue;
    let ref = 0;
    const monthUnits = units.filter((u) => u.day.startsWith(month)).map((u) => ({ ...u, ref: `s${++ref}` }));
    for (const [gi, group] of batches(monthUnits).entries()) {
      const key = `${month}#${gi}`;
      if (APPLY && state.backfillDone.includes(key)) continue;
      if (ran >= limit) { log(`backfill paused after ${ran} batches; continues next hour`); return false; }
      ran += 1;
      if (APPLY && state.spent >= MONTHLY_CAP) throw new Error(`stopped at ${key}: this month's ceiling of $${MONTHLY_CAP} is spent`);

      if (!(await openSession({ quiet: true }))) throw new Error('could not reach the hub; stopped');
      const vault = loadVault();
      await closeSession();
      const open = vault.tasks.filter((t) => !['done', 'cancelled'].includes(t.status));
      const done = vault.tasks.filter((t) => t.status === 'done')
        .sort((a, b) => ((b.completedAt ?? '') < (a.completedAt ?? '') ? -1 : 1));
      const existing = [...open, ...done].slice(0, 400)
        .map((t) => ({ id: t.id, title: t.title, status: t.status, project: t.project, tags: t.tags }));
      const projects = vault.projects.map((p) => p.name);
      const lastDay = group.at(-1).day;

      const { reply, usage } = await ask(config, {
        today: lastDay,
        weekday: new Date(`${lastDay}T12:00:00+06:00`).toLocaleDateString('en-US', { weekday: 'long' }),
        projects,
        existing,
        sessions: group.map(({ ref, folder, title, started, ended, log: l }) => ({ ref, folder, title, started, ended, log: l })),
      });
      const cost = costOf(usage);
      totals.calls += 1;
      totals.cost += cost;
      const { accepted, refused } = vet(reply.items, existing, group, projects,
        state.allowNewProjects ?? [], state.imported ?? [], state.projectAliases ?? {});
      totals.refused += refused.length;
      totals.silent += group.filter((u) => /\] USER: /.test(u.log) && !reply.items.some((i) => i.session === u.ref)).length;
      for (const it of accepted) {
        if (it.held) totals.held.set(it.held, (totals.held.get(it.held) ?? 0) + 1);
        if (it.action === 'complete') totals.completed += 1;
        else if (it.status === 'done') totals.done += 1;
        else totals.added += 1;
      }
      say(`  ${key}: ${group.length} session-days, ${group.reduce((n, u) => n + u.log.length, 0)} chars, $${cost.toFixed(3)} → `
        + `${accepted.length} accepted, ${refused.length} refused. ${reply.seen}`);
      if (!APPLY) {
        for (const it of accepted) say(`      ${it.action === 'complete' ? '✓ complete' : `+ ${it.status}`} ${it.title}  {${it.project ?? (it.held ? `(${it.held}?)` : '—')} · ${it.tags.join(',')}}  [${it.session?.day}]`);
        continue;
      }

      const ids = applyAll(accepted, (it) => (it.action === 'add' ? it.session?.ended : undefined));
      accepted.forEach((it, i) => {
        const id = ids[i];
        if (it.action === 'add' && id) state.imported = [...(state.imported ?? []), id].slice(-5000);
        appendFileSync(LEDGER, `${JSON.stringify({ at: new Date().toISOString(), backfill: key, id, action: it.action, status: it.status, title: it.title, project: it.project, day: it.session?.day, session: it.session?.file })}\n`);
      });
      state.spent += cost;
      state.backfillDone.push(key);
      writeState(state);
    }
    if (APPLY) { state.backfillDone.push(month); writeState(state); }
  }
  const held = [...totals.held].map(([p, n]) => `${p} (${n})`).join(', ');
  const verdict = `${APPLY ? 'backfill' : 'backfill dry'}: ${totals.calls} calls, $${totals.cost.toFixed(2)}, `
    + `${totals.added} open + ${totals.done} done added, ${totals.completed} closed, ${totals.refused} refused, `
    + `${totals.silent} session-days gave nothing${held ? `; held projects: ${held}` : ''}`;
  log(verdict);
  say(`\n${verdict}`);
  if (APPLY) { state.backfillPending = false; writeState(state); }
  return true;
}

/** The hourly run's second job: carry on with the past, if any is left and the hub's day allows it. */
async function continueBackfill(config, state) {
  if (!APPLY || !state.backfillPending) return;
  if (state.backfillResumeAfter && new Date().toISOString() < state.backfillResumeAfter) return;
  await backfill(config, state, { limit: Number(process.env.VAULT_BACKFILL_PER_RUN) || 6 });
}

// ── The run ──────────────────────────────────────────────────────────────────

async function main() {
  if (!takeLock()) { log('skipped: another run is in progress'); return; }
  try {
    const config = readSyncConfig();
    if (!config) throw new Error('this Mac is not pointed at a hub (`todo sync`)');

    let state = readState() ?? { since: startOfToday(), files: {}, month: '', spent: 0 };
    // Held off the hub until a time — e.g. its daily read allowance is nearly spent.
    // Nothing is lost: the offsets do not move, so the next run reads it all.
    if (APPLY && state.pauseUntil && new Date().toISOString() < state.pauseUntil) {
      log(`paused until ${state.pauseUntil}`);
      return;
    }
    const month = dhakaDay().slice(0, 7);
    if (state.month !== month) { state.month = month; state.spent = 0; }
    if (APPLY && state.spent >= MONTHLY_CAP) {
      log(`stopped: this month's ceiling of $${MONTHLY_CAP} is spent ($${state.spent.toFixed(2)})`);
      return;
    }
    if (BACKFILL) { await backfill(config, state); return; }

    // A dry run with --since looks at a chosen window from scratch.
    const view = SINCE_ARG ? { ...state, files: {} } : state;
    const since = SINCE_ARG ? new Date(SINCE_ARG).toISOString() : state.since;

    const started = Date.now();
    const { sessions, next } = collect(view, since);
    const readMs = Date.now() - started;
    say(`Read ${sessions.length} session${sessions.length === 1 ? '' : 's'} with new work since ${since} (${readMs} ms).`);

    if (!sessions.length) {
      if (APPLY) { state.files = next; writeState(state); }
      log(`${APPLY ? 'apply' : 'dry'}: nothing new`);
      await continueBackfill(config, state);
      return;
    }

    if (!(await openSession({ quiet: true }))) throw new Error('could not reach the hub; nothing was written');
    const vault = loadVault();
    await closeSession();
    const fortnight = new Date(Date.now() - 14 * 86400_000).toISOString();
    const existing = vault.tasks
      .filter((t) => !['done', 'cancelled'].includes(t.status) || (t.completedAt ?? t.updatedAt ?? '') >= fortnight)
      .map((t) => ({ id: t.id, title: t.title, status: t.status, project: t.project, tags: t.tags }));
    const projects = vault.projects.map((p) => p.name);

    const report = { sessions: sessions.length, chars: 0, calls: 0, cost: 0, tokens: [0, 0], accepted: [], refused: [], seen: [], silent: [] };
    for (const group of batches(sessions)) {
      const payload = {
        today: dhakaDay(),
        weekday: new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Dhaka' }),
        projects,
        existing,
        sessions: group.map(({ ref, folder, title, started: s, ended, log: l }) => ({ ref, folder, title, started: s, ended, log: l })),
      };
      report.chars += group.reduce((n, s) => n + s.log.length, 0);
      const { reply, usage } = await ask(config, payload);
      report.calls += 1;
      report.tokens[0] += usage.inputTokens;
      report.tokens[1] += usage.outputTokens;
      report.cost += costOf(usage);
      report.seen.push(reply.seen);
      const { accepted, refused } = vet(reply.items, existing, group, projects, state.allowNewProjects ?? [], state.imported ?? [], state.projectAliases ?? {});
      // Every session with a request should account for at least one item.
      for (const s of group) {
        if (/\] USER: /.test(s.log) && !reply.items.some((i) => i.session === s.ref)) report.silent.push(s);
      }
      report.accepted.push(...accepted);
      report.refused.push(...refused);
    }

    if (APPLY) {
      let ids;
      try { ids = applyAll(report.accepted); } catch (err) {
        throw new Error(`stopped while writing: ${String(err.stderr || err.message).trim().slice(0, 200)}`);
      }
      report.accepted.forEach((item, i) => {
        const id = ids[i];
        if (item.action === 'add' && id) state.imported = [...(state.imported ?? []), id].slice(-5000);
        appendFileSync(LEDGER, `${JSON.stringify({ at: new Date().toISOString(), id, action: item.action, status: item.status, title: item.title, project: item.project, session: item.session?.file })}\n`);
      });
      state.files = next;
      state.spent += report.cost;
      writeState(state);
    }
    await continueBackfill(config, state);

    const verdict = `${APPLY ? 'apply' : 'dry'}: ${report.sessions} sessions, ${report.chars} chars, ${report.calls} call(s), `
      + `${report.tokens[0]}+${report.tokens[1]} tokens, $${report.cost.toFixed(3)}, `
      + `${report.accepted.length} accepted, ${report.refused.length} refused`;
    log(verdict);
    if (args.includes('--json')) { console.log(JSON.stringify(report, (k, v) => (k === 'session' && v?.log ? v.ref : v), 1)); return; }
    say(`\n${verdict}`);
    for (const s of report.seen) say(`  saw: ${s}`);
    for (const it of report.accepted) {
      const where = it.session ? `${it.session.ref} ${it.session.folder.split('/').slice(-1)[0]}` : '';
      say(it.action === 'complete'
        ? `  ✓ complete  ${it.task.id} ${it.task.title}  [${where}]`
        : `  + ${it.status.padEnd(4)} ${it.title}  {${it.project ?? (it.held ? `(${it.held}?)` : '—')} · ${it.tags.join(',')} · P${it.priority}}${it.dropped?.length ? ` (dropped tags: ${it.dropped.join(',')})` : ''}  [${where}]\n           notes: ${it.notes ?? '—'}\n           said : ${it.evidence}`);
    }
    for (const [it, why] of report.refused) say(`  ✗ ${it.title} — ${why}`);
    for (const s of report.silent) say(`  ? ${s.ref} ${s.folder} — had requests but gave no task`);
    const held = [...new Set(report.accepted.map((i) => i.held).filter(Boolean))];
    if (held.length) say(`  ! new projects not created (filed with none): ${held.join(', ')}`);
  } catch (err) {
    log(`failed: ${err.message}`);
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    try { unlinkSync(LOCK); } catch { /* gone */ }
  }
}

await main();
