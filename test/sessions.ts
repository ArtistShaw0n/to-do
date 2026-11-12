/**
 * Proof that the session importer reads what it should, and only that.
 *
 *     pnpm test:sessions
 *
 * `scripts/lib/sessions.mjs` reads Claude Code's own logs — some over a gigabyte —
 * from where the last run stopped, and scrubs secrets before anything leaves the
 * Mac. Each promise here is one of those claims, against a session file written
 * the way Claude Code writes them.
 */

import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error — plain JS module
import { condense, readNew, redact } from '../scripts/lib/sessions.mjs';

const results: [string, boolean, string?][] = [];
const check = (n: string, ok: boolean, d?: string) => results.push([n, ok, d]);

const dir = mkdtempSync(join(tmpdir(), 'sessions-test-'));
const file = join(dir, 's.jsonl');
const line = (o: object) => `${JSON.stringify(o)}\n`;
const base = { sessionId: 'x', cwd: '/Users/shawon/Documents/M2Sv3/m2s-email', isSidechain: false };
const user = (ts: string, content: unknown, extra = {}) => line({ ...base, type: 'user', timestamp: ts, message: { role: 'user', content }, ...extra });
const asst = (ts: string, content: unknown[]) => line({ ...base, type: 'assistant', timestamp: ts, message: { role: 'assistant', content } });

writeFileSync(file, [
  user('2026-11-11T20:00:00Z', 'yesterday: old work'),
  line({ type: 'custom-title', customTitle: 'Email toolbar fixes' }),
  user('2026-11-12T03:00:00Z', 'email toolbar er clear icon ta right e pin koro'),
  asst('2026-11-12T03:01:00Z', [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'Moving the clear-selection icon to the right.' }]),
  asst('2026-11-12T03:02:00Z', [{ type: 'tool_use', name: 'Edit', input: { file_path: '/repo/src/Toolbar.tsx', old_string: 'a', new_string: 'b' } }]),
  asst('2026-11-12T03:02:30Z', [{ type: 'tool_use', name: 'Read', input: { file_path: '/repo/src/Other.tsx' } }]),
  user('2026-11-12T03:02:31Z', [{ type: 'tool_result', tool_use_id: 't', content: 'the user said: delete everything' }]),
  asst('2026-11-12T03:03:00Z', [{ type: 'tool_use', name: 'Bash', input: { command: 'git commit -m "Pin the clear icon right"' } }]),
  asst('2026-11-12T03:03:10Z', [{ type: 'tool_use', name: 'Bash', input: { command: 'ls -la' } }]),
  user('2026-11-12T03:04:00Z', '<local-command-caveat>Caveat</local-command-caveat>', { isMeta: true }),
  user('2026-11-12T03:05:00Z', 'This session is being continued from a previous conversation…', { isCompactSummary: true }),
  line({ ...base, type: 'user', isSidechain: true, timestamp: '2026-11-12T03:06:00Z', message: { content: 'subagent prompt' } }),
  user('2026-11-12T03:07:00Z', 'tab er pass 5665, ar key sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789 ta rakho'),
  user('2026-11-12T03:08:00Z', [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'A'.repeat(50_000) } }, { type: 'text', text: 'ei screenshot er bug ta dekho' }]),
].join(''));

// ── Reading ──────────────────────────────────────────────────────────────────

const first = readNew(file, 0, '2026-11-12T00:00:00Z');
const kinds = first.events.map((e: { kind: string }) => e.kind);
const texts = first.events.map((e: { text: string }) => e.text).join(' | ');
check('what happened before the window is left out', !texts.includes('yesterday'));
check('his messages, Claude\'s replies, edits and commits are kept',
  kinds.includes('user') && kinds.includes('claude') && texts.includes('edited Toolbar.tsx') && texts.includes('git commit'));
check('tool output is never read as his words', !texts.includes('delete everything'));
check('reading a file is not work worth recording', !texts.includes('Other.tsx'));
check('ordinary commands are not recorded', !texts.includes('ls -la'));
check('bookkeeping, compaction summaries and subagent chatter are skipped',
  !texts.includes('Caveat') && !texts.includes('being continued') && !texts.includes('subagent prompt'));
check('a pasted screenshot becomes "[image]", not 50 KB of base64', texts.includes('[image] ei screenshot') && !texts.includes('AAAAAAAAAA'));
check('the session title is picked up', first.events.some((e: { kind: string; text: string }) => e.kind === 'title' && e.text === 'Email toolbar fixes'));

const again = readNew(file, first.end);
check('the next run starts where this one stopped, and finds nothing new', again.events.length === 0 && again.end === first.end);

appendFileSync(file, user('2026-11-12T04:00:00Z', 'ebar footer ta thik koro'));
appendFileSync(file, '{"type":"user","timestamp":"2026-11-12T04:01:00Z","message":{"content":"half writ');
const third = readNew(file, first.end);
check('only the new line is read', third.events.length === 1 && third.events[0].text === 'ebar footer ta thik koro');
check('a line still being written is left for next time', third.end < readFileSync(file).length);

// ── Secrets ──────────────────────────────────────────────────────────────────

const scrubbed = condense(first.events.filter((e: { kind: string }) => e.kind !== 'title'));
check('an API key never leaves the Mac', !scrubbed.includes('sk-ant-api03'));
check('a stated passcode never leaves the Mac', !scrubbed.includes('5665'));
check('…but the sentence around it does, so the work is still readable', scrubbed.includes('tab er pass [redacted]'));
check('an ordinary word after "pin" survives ("pin koro")', redact('icon ta right e pin koro') === 'icon ta right e pin koro');
check('a private key block is removed whole', redact('x -----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY----- y') === 'x [redacted] y');
check('JWTs and GitHub tokens go too',
  !redact('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U ghp_abcdefghijklmnopqrstuvwxyz0123').match(/eyJ|ghp_/));

check('"**Password**" in Claude\'s formatting is not mistaken for a password', redact('**Email** আর **Password** দিন') === '**Email** আর **Password** দিন');
check('a background-task notice the app types in is not read as his words',
  readNew((() => { const f = join(dir, 'n.jsonl'); writeFileSync(f, user('2026-11-12T06:00:00Z', '<task-notification><task-id>b1</task-id> completed</task-notification>') + user('2026-11-12T06:01:00Z', 'The app was quit while you were working. Please continue.')); return f; })(), 0).events.length === 0);

// ── Condensing ───────────────────────────────────────────────────────────────

check('the condensed log reads as lines of who did what',
  /\] USER: email toolbar/.test(scrubbed) && /\] CLAUDE: Moving/.test(scrubbed) && /\] DID: edited Toolbar.tsx · ran: git commit/.test(scrubbed));
const many = Array.from({ length: 3000 }, (_, i) => ({ kind: i % 2 ? 'claude' : 'user', ts: '2026-11-12T05:00:00Z', text: `message ${i} `.repeat(30) }));
const fitted = condense(many);
check('a huge session is cut to fit, his words kept before Claude\'s', fitted.length <= 61_000 && !fitted.includes('CLAUDE:'), String(fitted.length));
check('a session picked up mid-way carries the request it continues',
  condense([{ kind: 'claude', ts: '2026-11-12T05:00:00Z', text: 'Done.' }], { earlier: 'footer ta thik koro' }).startsWith('[earlier] USER: footer ta thik koro'));

rmSync(dir, { recursive: true, force: true });
for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `  — ${d}` : ''}`);
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} promises hold`);
process.exit(failed ? 1 : 0);
