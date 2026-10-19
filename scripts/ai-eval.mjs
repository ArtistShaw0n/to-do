/**
 * How well does the hub's Claude do on YOUR phrasing?
 *
 *     node scripts/ai-eval.mjs            # the 15 most recent tasks that kept their original words
 *     node scripts/ai-eval.mjs --n 30
 *
 * Every task in the vault that was typed in Banglish kept the words it was
 * typed in (`originalInput`) beside the clean title it became. That is an answer
 * key nobody had to write: feed the original words back through the hub and see
 * whether the API arrives where Claude Code did.
 *
 * Read-only. It sends the original wording of N tasks to the hub — nothing else
 * from the vault, and never a note — and prints a comparison. Nothing is saved
 * and nothing in the vault changes. Run it once the API key is set, before
 * trusting the model with your list.
 *
 * "Different" is not "wrong": a title can be better than the one it is compared
 * to. The percentages say whether the *structure* — project, kind, module,
 * priority — agrees; the titles are for you to read.
 */

import { closeSession, loadVault, openSession, readSyncConfig } from '../bin/vault.mjs';

const args = process.argv.slice(2);
const n = Number(args[args.indexOf('--n') + 1]) || 15;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

// Kept in step with KIND_TAGS in src/lib/vault.ts.
const KIND = new Set(['bug', 'enhancement', 'release', 'design', 'frontend', 'backend', 'responsive',
  'architecture', 'requirements', 'billing', 'docs', 'test']);

const config = readSyncConfig();
if (!config) { console.error('No hub configured. Run `todo sync <url> <key>` first.'); process.exit(1); }
const base = config.url.replace(/\/+$/, '').replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');

await openSession({ quiet: true });
const vault = loadVault();
await closeSession();

const samples = vault.tasks
  .filter((t) => t.originalInput && t.originalInput.trim().length > 12 && t.source !== 'app')
  .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  .slice(0, n);

if (!samples.length) { console.log('No tasks with original wording to compare against.'); process.exit(0); }

const projects = vault.projects.map((p) => p.name);
const today = new Date().toLocaleDateString('en-CA');
const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' });

const same = (a, b) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
const setOf = (xs) => [...new Set(xs.map((x) => x.toLowerCase()))].sort().join(',');
const score = { project: 0, kind: 0, module: 0, priority: 0 };
let compared = 0;

console.log(bold(`Comparing ${samples.length} tasks`), dim(`(${base})\n`));

for (const task of samples) {
  const res = await fetch(`${base}/ai/normalise`, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ text: task.originalInput, today, weekday, projects }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.log(`${yellow('✗')} ${res.status} ${body.error ?? ''} — stopping.`);
    break;
  }
  const got = JSON.parse(body.text).items.find((i) => i.type === 'task');
  if (!got) { console.log(`${yellow('·')} ${task.originalInput}\n    ${dim('the model returned no task (a note?)')}\n`); continue; }

  compared += 1;
  const kindOf = (tags) => setOf(tags.filter((t) => KIND.has(t.toLowerCase())));
  const moduleOf = (tags) => setOf(tags.filter((t) => !KIND.has(t.toLowerCase())));
  const ok = {
    project: same(task.project, got.project),
    kind: kindOf(task.tags) === kindOf(got.tags),
    module: moduleOf(task.tags) === moduleOf(got.tags),
    priority: task.priority === got.priority,
  };
  for (const k of Object.keys(ok)) if (ok[k]) score[k] += 1;

  const mark = (b) => (b ? green('✓') : yellow('≠'));
  console.log(`${dim('said  ')} ${task.originalInput}`);
  console.log(`${dim('had   ')} ${task.title}`);
  console.log(`${dim('now   ')} ${got.title}`);
  console.log(`       ${mark(ok.project)} project ${task.project ?? '—'} / ${got.project ?? '—'}   `
    + `${mark(ok.kind)} kind [${kindOf(task.tags)}] / [${kindOf(got.tags)}]   `
    + `${mark(ok.module)} module [${moduleOf(task.tags)}] / [${moduleOf(got.tags)}]   `
    + `${mark(ok.priority)} P${task.priority} / P${got.priority}\n`);
}

if (compared) {
  const pct = (x) => `${Math.round((x / compared) * 100)}%`;
  console.log(bold('Agreement with what Claude Code produced'), dim(`(${compared} tasks)`));
  console.log(`  project ${pct(score.project)}   kind tags ${pct(score.kind)}   module ${pct(score.module)}   priority ${pct(score.priority)}`);
  console.log(dim('  Titles will differ in wording; what matters is that they say the same thing.'));
}
