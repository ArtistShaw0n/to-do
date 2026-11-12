/**
 * Reading Claude Code's own session logs, a little at a time.
 *
 * Claude Code keeps every session as one JSONL file under ~/.claude/projects —
 * a line per message, tool call, tool result, attachment and bookkeeping
 * record. Some files are over a gigabyte (pasted screenshots are base64 in
 * there), so nothing here reads a file whole: each run starts at the byte
 * offset the previous run stopped at, splits on newlines itself (so an offset
 * is always exact), and decodes only the few kinds of line that say what work
 * was done — his messages, Claude's replies, files edited, commits made.
 *
 * Pure apart from file reads, so `test/sessions.ts` can hold it to its promises.
 */

import { closeSync, openSync, readSync, statSync } from 'node:fs';
import { basename } from 'node:path';

// ── Secrets never leave this machine ─────────────────────────────────────────

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bsk-ant-[A-Za-z0-9_-]{8,}/g,
  /\bsk-[A-Za-z0-9_-]{20,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // a JWT
  /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}\b/g, // any long key-shaped run
];

/** "pass 5665", "password: hunter2!", "api key = abc123…" — the value goes, the word stays. */
const LABELLED = /\b(pass(?:word|code)?|pwd|pin|otp|secret|token|api[ _-]?key|পাসওয়ার্ড|পিন)(\s*(?:is|holo|hocche|:|=)?\s*)(?=\S*[\d@#$%^&])(?![*_`])(\S{3,})/gi;

export function redact(text) {
  let out = text;
  for (const re of SECRET_PATTERNS) out = out.replace(re, '[redacted]');
  return out.replace(LABELLED, (_m, word, gap) => `${word}${gap}[redacted]`);
}

// ── Turning lines into what happened ─────────────────────────────────────────

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const oneLine = (s) => s.replace(/\s+/g, ' ').trim();

/** Commands worth recording: the ones that say work was finished or recorded. */
const NOTABLE_COMMAND = /\bgit (commit|push|tag|merge)\b|\b(deploy|release)\b|\bwrangler (deploy|publish)\b|\bnpm publish\b|bin\/todo\.mjs\s+(add|done|rm|edit|cancel)\b|\bgh (pr|release) create\b/;

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

function userText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  if (content.some((b) => b?.type === 'tool_result')) return '';
  return content.map((b) => (b?.type === 'text' ? b.text : b?.type === 'image' ? '[image]' : '')).join(' ');
}

/** Messages the app types into the conversation itself — not his words. */
const NOT_HIS = [/<task-notification>/, /^The app was quit while you were working/, /^\[Request interrupted/];

function cleanUser(raw) {
  if (NOT_HIS.some((re) => re.test(raw.trim()))) return '';
  let s = raw.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, ' ');
  const command = s.match(/<command-name>([^<]*)<\/command-name>[\s\S]*?(?:<command-args>([^<]*)<\/command-args>)?/);
  if (command) s = `${command[1]} ${command[2] ?? ''}`;
  s = s.replace(/<\/?[a-z-]+(?: [^>]*)?>/g, ' ');
  s = oneLine(s);
  if (!s || /^\[Request interrupted/.test(s) || /^Caveat:/.test(s)) return '';
  return s;
}

/**
 * Decode one JSONL line into zero or more events, or null when it is a kind of
 * line that never matters. `since` drops what happened before the window.
 */
export function eventsFrom(line, since) {
  let o;
  try { o = JSON.parse(line); } catch { return null; }
  const ts = typeof o.timestamp === 'string' ? o.timestamp : undefined;
  if (o.type === 'custom-title' && typeof o.customTitle === 'string') return [{ kind: 'title', text: o.customTitle }];
  if (!ts || (since && ts < since)) return null;
  if (o.isSidechain || o.isMeta || o.isCompactSummary) return null;
  const cwd = typeof o.cwd === 'string' ? o.cwd : undefined;

  if (o.type === 'user') {
    const text = cleanUser(userText(o.message?.content));
    return text ? [{ kind: 'user', ts, cwd, text }] : null;
  }
  if (o.type === 'assistant') {
    const out = [];
    for (const b of o.message?.content ?? []) {
      if (b?.type === 'text' && b.text?.trim()) out.push({ kind: 'claude', ts, cwd, text: oneLine(b.text) });
      else if (b?.type === 'tool_use' && EDIT_TOOLS.has(b.name) && typeof b.input?.file_path === 'string') {
        out.push({ kind: 'did', ts, cwd, text: `edited ${basename(b.input.file_path)}` });
      } else if (b?.type === 'tool_use' && b.name === 'Bash' && typeof b.input?.command === 'string'
        && NOTABLE_COMMAND.test(b.input.command)) {
        out.push({ kind: 'did', ts, cwd, text: `ran: ${clip(oneLine(b.input.command), 180)}` });
      }
    }
    return out.length ? out : null;
  }
  return null;
}

const WANTED = [Buffer.from('"type":"user"'), Buffer.from('"type":"assistant"'), Buffer.from('"type":"custom-title"')];
const TOOL_RESULT = Buffer.from('"tool_result"');
const CHUNK = 8 * 1024 * 1024;

/**
 * Everything new in one session file since `offset`.
 *
 * Returns the events and the offset to start from next time — the end of the
 * last *complete* line, so a line still being written is read whole next run.
 */
export function readNew(file, offset, since) {
  const size = statSync(file).size;
  if (offset > size) offset = 0; // the file was replaced
  const events = [];
  if (offset === size) return { events, end: size };

  const fd = openSync(file, 'r');
  let pos = offset;
  let carry = Buffer.alloc(0);
  let lineStart = offset;
  try {
    while (pos < size) {
      const buf = Buffer.alloc(Math.min(CHUNK, size - pos));
      const n = readSync(fd, buf, 0, buf.length, pos);
      if (n <= 0) break;
      pos += n;
      let data = carry.length ? Buffer.concat([carry, buf.subarray(0, n)]) : buf.subarray(0, n);
      let from = 0;
      for (let nl = data.indexOf(10, from); nl !== -1; nl = data.indexOf(10, from)) {
        const line = data.subarray(from, nl);
        lineStart += line.length + 1;
        from = nl + 1;
        if (!WANTED.some((w) => line.includes(w))) continue;
        if (line.includes(WANTED[0]) && line.includes(TOOL_RESULT)) continue; // a tool's output, not his words
        const got = eventsFrom(line.toString('utf8'), since);
        if (got) events.push(...got);
      }
      carry = Buffer.from(data.subarray(from));
    }
  } finally {
    closeSync(fd);
  }
  return { events, end: lineStart };
}

// ── One session, condensed for Claude to read ────────────────────────────────

const LIMITS = { user: 1200, claude: 500, session: 60_000 };

const hhmm = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** The events of one session as short lines: `[09:14] USER: …`, `CLAUDE: …`, `DID: …`. */
export function condense(events, { earlier } = {}) {
  const lines = [];
  if (earlier) lines.push(`[earlier] USER: ${clip(redact(earlier), 400)}`);
  let did = [];
  const flush = () => {
    if (did.length) lines.push(`[${hhmm(did[0].ts)}] DID: ${[...new Set(did.map((d) => d.text))].join(' · ')}`);
    did = [];
  };
  for (const e of events) {
    if (e.kind === 'did') { did.push(e); continue; }
    if (e.kind !== 'user' && e.kind !== 'claude') continue;
    flush();
    const limit = e.kind === 'user' ? LIMITS.user : LIMITS.claude;
    lines.push(`[${hhmm(e.ts)}] ${e.kind === 'user' ? 'USER' : 'CLAUDE'}: ${clip(redact(e.text), limit)}`);
  }
  flush();
  return fit(lines);
}

/** Keep a session under its share of the request: shorten Claude first, never his words until last. */
function fit(lines) {
  const size = (ls) => ls.reduce((n, l) => n + l.length + 1, 0);
  if (size(lines) <= LIMITS.session) return lines.join('\n');
  let ls = lines.map((l) => (l.includes('] CLAUDE: ') ? clip(l, 220) : l));
  if (size(ls) > LIMITS.session) ls = ls.filter((l) => !l.includes('] CLAUDE: '));
  if (size(ls) > LIMITS.session) {
    const keep = Math.floor(ls.length / 2);
    while (size(ls) > LIMITS.session && ls.length > 4) ls.splice(Math.floor(ls.length / 3), 1);
    if (ls.length < keep) ls.splice(Math.floor(ls.length / 3), 0, '[… some lines left out to fit …]');
  }
  return ls.join('\n');
}
