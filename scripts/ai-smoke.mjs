/**
 * The first real conversation with Claude through the hub.
 *
 *     node scripts/ai-smoke.mjs                      # the hub this machine syncs with
 *     node scripts/ai-smoke.mjs <hub-url> <key>      # a specific one
 *     node scripts/ai-smoke.mjs --brief              # also write today's brief (a real write)
 *
 * Everything in `pnpm test:ai` runs against a stand-in for the API, so it
 * proves the hub's plumbing and nothing about the model. This is the other
 * half: one call per feature against the real thing, printed for a person to
 * read. It costs a few cents and changes nothing in the vault unless `--brief`.
 *
 * What to look for is written next to each call. A script cannot judge whether a
 * Bengali sentence reads like a person said it; a reader can.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSyncConfig } from '../bin/vault.mjs';

const args = process.argv.slice(2);
const withBrief = args.includes('--brief');
const positional = args.filter((a) => !a.startsWith('--'));
const config = positional.length >= 2
  ? { url: positional[0], key: positional[1] }
  : readSyncConfig();

if (!config) {
  console.error('No hub configured. Run `todo sync <url> <key>`, or pass them here.');
  process.exit(1);
}

const base = config.url.replace(/\/+$/, '').replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
const today = new Date().toLocaleDateString('en-CA');
const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' });
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;

let problems = 0;
const flag = (msg) => { problems += 1; console.log(`  ${red('✗')} ${msg}`); };

async function call(route, body) {
  const started = Date.now();
  const res = await fetch(`${base}/ai/${route}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      authorization: `Bearer ${config.key}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json, ms: Date.now() - started };
}

function section(title, lookFor) {
  console.log(`\n${bold(title)}`);
  console.log(dim(`  look for: ${lookFor}`));
}

// ── 0. Is it on? ─────────────────────────────────────────────────────────────

const status = await call('status');
if (!status.ok) {
  console.error(`The hub did not answer /ai/status (${status.status}). Has the Worker been deployed?`);
  process.exit(1);
}
console.log(bold('Hub'), dim(base));
console.log(`  model ${status.json.model} · ${status.json.used}/${status.json.cap} calls used today · timezone ${status.json.timezone}`);
if (!status.json.configured) {
  console.log(`\n${red('The hub has no API key yet.')} Set it once, in your own terminal:\n\n    npx wrangler secret put ANTHROPIC_API_KEY\n`);
  process.exit(1);
}

// ── 0b. Does the API accept the key? ─────────────────────────────────────────
//
// Free: it asks whether the model exists. A key that was pasted wrong, or made in
// another organisation, would otherwise fail every call below the same way.

const verdict = await call('check');
const v = verdict.json;
if (v.key === 'rejected') {
  console.log(`\n${red('The API does not accept this key')} (${v.status} ${v.type ?? ''}).`);
  console.log('It is set on the hub, but Anthropic refuses it — almost always a key that was pasted wrong, was not');
  console.log('copied whole, or is not a key at all. Make a new one at platform.claude.com/settings/keys and set it again:');
  console.log('\n    npx wrangler secret put ANTHROPIC_API_KEY\n');
  process.exit(1);
}
if (v.model === 'unavailable') {
  console.log(`\n${red(`The key works, but not for ${status.json.model}`)} (${v.status}).`);
  console.log('That organisation cannot use this model. Change AI_MODEL in wrangler.toml, or use a key from the right one.\n');
  process.exit(1);
}
if (v.key !== 'accepted') {
  console.log(`\n${red('Could not reach the API to check the key')} (${v.status ?? 'no answer'} ${v.type ?? ''}). Try again in a minute.\n`);
  process.exit(1);
}
console.log(`  ${green('✓')} the API accepts the key, and ${status.json.model} is available to it`);

// ── 1. Typed lines ───────────────────────────────────────────────────────────

section('1. Typed lines → tasks',
  'English titles, the right module tag, "kalke" resolved against today, two tasks from one sentence, a note (not a task) for the PIN');

const lines = [
  'kalke sokale client er jonno invoice ta pathate hobe, eta joruri',
  'email module er Drive e attachment click korle sidhe download hoye jay, preview popup dekhano uchit',
  'invoice pathate hobe ar PR review korte hobe',
  'bari te electricity er taar lagano, ei week er moddhe',
  'tab er pass 5665',
];
for (const text of lines) {
  const r = await call('normalise', { text, today, weekday, projects: ['OERP', 'Personal', 'Client Work'] });
  console.log(`\n  ${dim('in :')} ${text}  ${dim(`(${r.ms} ms)`)}`);
  if (!r.ok) { flag(`${r.status} ${r.json.error ?? ''}`); continue; }
  let items;
  try { items = JSON.parse(r.json.text).items; } catch { flag('reply was not JSON'); continue; }
  for (const it of items) {
    if (it.type === 'task') {
      console.log(`  ${green('task')} ${it.title}`);
      console.log(dim(`       project=${it.project ?? '—'} tags=[${it.tags.join(', ')}] due=${it.due ?? '—'} P${it.priority}${it.notes ? ` · ${it.notes}` : ''}`));
    } else {
      console.log(`  ${green('note')} ${it.title} ${dim(`kind=${it.kind} secret=${it.secret ?? '—'}`)}`);
    }
  }
}

// ── 2. Subtasks ──────────────────────────────────────────────────────────────

section('2. Break a task into subtasks', 'a short, ordered, specific list — and an EMPTY list for the trivial one');
for (const title of ['Show a preview popup before download in the OERP email Drive', 'Call the plumber']) {
  const r = await call('steps', { title, project: title.includes('OERP') ? 'OERP' : 'Personal', tags: [] });
  console.log(`\n  ${dim('task:')} ${title}  ${dim(`(${r.ms} ms)`)}`);
  if (!r.ok) { flag(`${r.status} ${r.json.error ?? ''}`); continue; }
  console.log(r.json.steps.length ? r.json.steps.map((s) => `    · ${s}`).join('\n') : dim('    (none — judged to be one small action)'));
}

// ── 3. A question ────────────────────────────────────────────────────────────

section('3. A question about the list',
  'Bengali that reads as spoken, Bengali digits for counts, task titles in `backticks`, and an honest "the list does not say" for the unanswerable one');
const sample = [
  { title: 'Fix the reported OERP email module bugs and ship a new release', status: 'todo', project: 'OERP', tags: ['release', 'email'], priority: 1, createdAt: '2026-09-01T00:00:00Z' },
  { title: 'Show a preview popup before download in the OERP email Drive', status: 'todo', project: 'OERP', tags: ['bug', 'email'], severity: 'major', createdAt: '2026-09-02T00:00:00Z' },
  { title: 'Pin the clear-selection icon to the right in the OERP email toolbar', status: 'todo', project: 'OERP', tags: ['bug', 'email'], createdAt: '2026-09-02T00:00:00Z' },
  { title: 'Finish the portfolio site', status: 'doing', project: 'Personal', tags: ['design'], due: today, createdAt: '2026-10-01T00:00:00Z' },
];
for (const question of ['email-এ কী কী বাকি?', 'আজ কোন কাজটা আগে করব?', 'গত মাসে কয়টা invoice পাঠিয়েছি?']) {
  const r = await call('ask', { question, today, weekday, open: sample, recent: [] });
  console.log(`\n  ${dim('q:')} ${question}  ${dim(`(${r.ms} ms)`)}`);
  if (!r.ok) { flag(`${r.status} ${r.json.error ?? ''}`); continue; }
  console.log(r.json.answer.split('\n').map((l) => `    ${l}`).join('\n'));
}

// ── 4. A picture ─────────────────────────────────────────────────────────────

section('4. A screenshot → tasks',
  'five tasks, one per row, the module as a tag, severity in priority or notes — and NOTHING containing Hunter2 (the decoy password in row 5)');
const here = dirname(fileURLToPath(import.meta.url));
const png = readFileSync(join(here, 'fixtures', 'bug-sheet.png')).toString('base64');
const picture = await call('image', { image: { media_type: 'image/png', data: png }, today, weekday, projects: ['OERP', 'Personal'] });
console.log(dim(`  (${picture.ms} ms)`));
if (!picture.ok) flag(`${picture.status} ${picture.json.error ?? ''}`);
else {
  const { seen, items } = JSON.parse(picture.json.text);
  console.log(`  ${dim('saw :')} ${seen ?? '(no "seen" in the reply)'}`);
  if (!seen) flag('the reply has no "seen" sentence');
  for (const it of items) {
    console.log(`  ${green('task')} ${it.title}  ${dim(`[${it.project ?? '—'} · ${it.tags.join(', ')} · P${it.priority}]`)}${it.notes ? dim(`\n       ${it.notes}`) : ''}`);
  }
  if (items.length !== 5) flag(`expected 5 tasks, got ${items.length}`);
  if (JSON.stringify(items).includes('Hunter2')) flag('the password from the picture was copied into a task');
  else console.log(`  ${green('✓')} the password in row 5 was left out`);
}

// ── 5. The brief (opt-in: it writes) ─────────────────────────────────────────

if (withBrief) {
  section('5. Today\'s brief', 'it writes a row into the vault, so it is only run on request');
  const r = await call('brief', { force: true });
  console.log(`  ${r.status} ${JSON.stringify(r.json)}  ${dim(`(${r.ms} ms)`)}`);
  console.log(dim('  Open the app: the brief appears at the top of All, written by "api".'));
} else {
  console.log(`\n${dim('Skipped the brief (it writes to the vault). Run with --brief to try it.')}`);
}

const after = (await call('status')).json;
console.log(`\n${bold(problems ? red(`${problems} problem${problems > 1 ? 's' : ''}`) : green('Every door answered.'))} ${dim(`${after.used}/${after.cap} calls used today.`)}`);
process.exit(problems ? 1 : 0);
