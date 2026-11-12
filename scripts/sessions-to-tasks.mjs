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
import { condense, readNew } from './lib/sessions.mjs';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const SINCE_ARG = args.includes('--since') ? args[args.indexOf('--since') + 1] : undefined;
const QUIET = args.includes('--quiet');

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

function batches(sessions) {
  const out = [];
  let cur = [];
  let size = 0;
  for (const s of sessions) {
    if (cur.length && size + s.log.length > BATCH_CHARS) { out.push(cur); cur = []; size = 0; }
    cur.push(s);
    size += s.log.length;
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
function vet(items, existing, sessions, projects, allowNew, ours) {
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
    let project = it.project ? known.get(it.project.toLowerCase()) ?? it.project : null;
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

function apply(item) {
  if (item.action === 'complete') return cli(['done', item.task.id]);
  const argv = ['add', item.title, '--p', String(item.priority)];
  if (item.project) argv.push('--project', item.project);
  if (item.tags.length) argv.push('--tag', item.tags.join(','));
  if (item.notes) argv.push('--notes', item.notes);
  if (item.due) argv.push('--due', item.due);
  if (item.evidence) argv.push('--raw', item.evidence);
  if (item.status === 'done') argv.push('--status', 'done');
  return cli(argv);
}

// ── The run ──────────────────────────────────────────────────────────────────

async function main() {
  if (!takeLock()) { log('skipped: another run is in progress'); return; }
  try {
    const config = readSyncConfig();
    if (!config) throw new Error('this Mac is not pointed at a hub (`todo sync`)');

    let state = readState() ?? { since: startOfToday(), files: {}, month: '', spent: 0 };
    const month = dhakaDay().slice(0, 7);
    if (state.month !== month) { state.month = month; state.spent = 0; }
    if (APPLY && state.spent >= MONTHLY_CAP) {
      log(`stopped: this month's ceiling of $${MONTHLY_CAP} is spent ($${state.spent.toFixed(2)})`);
      return;
    }
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
      const { accepted, refused } = vet(reply.items, existing, group, projects, state.allowNewProjects ?? [], state.imported ?? []);
      // Every session with a request should account for at least one item.
      for (const s of group) {
        if (/\] USER: /.test(s.log) && !reply.items.some((i) => i.session === s.ref)) report.silent.push(s);
      }
      report.accepted.push(...accepted);
      report.refused.push(...refused);
    }

    if (APPLY) {
      for (const item of report.accepted) {
        try {
          const out = apply(item);
          // The new task's id, from the CLI's own confirmation line, so a later run may close it.
          const id = item.action === 'add'
            ? out.replace(/\x1b\[[0-9;]*m/g, '').match(/^\S*\s*([a-z0-9]{6})\s{2}/m)?.[1] : item.task.id;
          if (item.action === 'add' && id) state.imported = [...(state.imported ?? []), id].slice(-2000);
          appendFileSync(LEDGER, `${JSON.stringify({ at: new Date().toISOString(), id, action: item.action, status: item.status, title: item.title, project: item.project, session: item.session?.file })}\n`);
        } catch (err) {
          throw new Error(`stopped while writing "${item.title}": ${String(err.stderr || err.message).trim().slice(0, 200)}`);
        }
      }
      state.files = next;
      state.spent += report.cost;
      writeState(state);
    }

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
