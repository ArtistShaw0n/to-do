/**
 * Turning what Shawon types into a finished task.
 *
 * He writes in a mix of Bangla, Banglish and English. CLAUDE.md documents how
 * Claude converts that into a clean English task; this module does the same job
 * for text typed straight into the app's composer, so the two entry points
 * produce the same shape.
 *
 * Two passes, and the difference between them is the whole design:
 *
 *  - `normaliseLocally` recognises *words*. It knows `kalke` is a date and
 *    `joruri` is a priority, and it can spot a project or module name. It runs
 *    instantly, offline, and never surprises anyone — but it cannot rewrite a
 *    Bangla sentence as English, because that is not word lookup.
 *  - `buildPrompt` + the `normalise_task` Rust command hand the raw text to
 *    Claude Code, which does the real thing: a clean imperative title, the
 *    right project, distilled notes.
 *
 * The composer runs the local pass first and shows the result immediately, then
 * upgrades it when Claude answers. Nothing is ever lost waiting for a model.
 */

import { addDays, todayISO } from './dates';
import {
  addNote, addTask, deleteNote, deleteTask, KIND_TAGS, updateNote, updateTask,
} from './vault';
import { NOTE_KINDS, type NoteKind, type Priority, type Vault } from './types';

export interface Draft {
  type: 'task';
  title: string;
  project?: string;
  tags: string[];
  notes?: string;
  due?: string;
  priority: Priority;
  originalInput: string;
}

/** A task as the model returned it. Same shape; the tag makes the union safe. */
export type TaskDraft = Draft;

/** Reference material — a password, a PIN, a wifi key — not work to be done. */
export interface NoteDraft {
  type: 'note';
  kind: NoteKind;
  title: string;
  username?: string;
  secret?: string;
  url?: string;
  body: string;
}

export type Item = TaskDraft | NoteDraft;

// ── Word tables (mirroring CLAUDE.md §2) ─────────────────────────────────────

/** Offsets in days from today. Order matters: longer phrases are matched first. */
const TIME_WORDS: [RegExp, number | 'friday' | 'month'][] = [
  [/\bnext month\b|\bshomne mash\b|\bsamne mash\b|\bpore mash\b/i, 'month'],
  [/\bnext week\b|\bagami week\b|\bagami soptah\b|\bporer week\b/i, 7],
  [/\bthis week\b|\bei week\b|\bei soptah\b/i, 'friday'],
  [/\bday after tomorrow\b|\bporshu\b/i, 2],
  [/\btomorrow\b|\bkalke\b|\bagamikal\b|\bkal\b/i, 1],
  [/\btoday\b|\bajke\b|\baaj\b|\baj\b/i, 0],
];

/** Weekday names, Bangla and English, resolved to the *next* such day. */
const WEEKDAYS: [RegExp, number][] = [
  [/\bsunday\b|\brobibar\b/i, 0],
  [/\bmonday\b|\bsombar\b|\bshombar\b/i, 1],
  [/\btuesday\b|\bmongolbar\b/i, 2],
  [/\bwednesday\b|\bbudhbar\b|\bbudbar\b/i, 3],
  [/\bthursday\b|\bbrihospotibar\b|\bbrishpotibar\b/i, 4],
  [/\bfriday\b|\bshukrobar\b|\bsukrobar\b/i, 5],
  [/\bsaturday\b|\bshonibar\b|\bsonibar\b/i, 6],
];

const PRIORITY_WORDS: [RegExp, Priority][] = [
  [/\blow priority\b|\bpore holeo hobe\b|\bwhenever\b|\btara nei\b/i, 3],
  [/\bjoruri\b|\burgent\b|\bekhoni\b|\basap\b|\bage eta\b|\bagey eta\b/i, 0],
  [/\bimportant\b|\bguruttopurno\b|\bgurutwopurno\b|\bmust\b/i, 1],
];

/**
 * Module tags, keyed by the words that imply them. The spellings on the right
 * are fixed — CLAUDE.md pins them so a module cannot split into two headings.
 */
const MODULE_WORDS: [RegExp, string][] = [
  [/\bproject hub\b|\bproject-hub\b|\bprojecthub\b/i, 'project-hub'],
  [/\bmeet ?(&|and) ?chat\b|\bmeet-chat\b|\bmeet chat\b/i, 'meet-chat'],
  [/\bteam evaluation\b|\bteam-evaluation\b/i, 'team-evaluation'],
  [/\bproperty booking\b|\bproperty-booking\b|\bbooking\b/i, 'property-booking'],
  [/\bshared ui\b|\bshared-ui\b/i, 'shared-ui'],
  [/\bnotification\b|\bnotif\b/i, 'notification'],
  [/\bhris\b/i, 'hris'],
  [/\bportal\b/i, 'portal'],
  [/\bemail\b|\bmail\b/i, 'email'],
];

function nextWeekday(target: number): string {
  const today = todayISO();
  const delta = (target - new Date().getDay() + 7) % 7;
  return addDays(today, delta === 0 ? 7 : delta);
}

/** Same day next month, clamped to the month's length (31 Jan → 28/29 Feb). */
function nextMonth(): string {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(now.getDate(), last));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
}

// ── The offline pass ─────────────────────────────────────────────────────────

/**
 * Recognise every attribute we can without a model, and strip the words that
 * only carried scheduling meaning out of the title. The raw text is preserved
 * whole in `originalInput`, so nothing said here is ever lost.
 */
export function normaliseLocally(raw: string, vault: Vault): Draft {
  let rest = raw.trim();
  const consume = (re: RegExp) => { rest = rest.replace(re, ' '); };

  let due: string | undefined;
  for (const [re, offset] of TIME_WORDS) {
    if (!re.test(rest)) continue;
    due = offset === 'friday' ? nextWeekday(5)
      : offset === 'month' ? nextMonth()
      : addDays(todayISO(), offset);
    consume(re);
    break;
  }
  if (!due) {
    for (const [re, day] of WEEKDAYS) {
      if (!re.test(rest)) continue;
      due = nextWeekday(day);
      consume(re);
      break;
    }
  }

  let priority: Priority = 2;
  for (const [re, p] of PRIORITY_WORDS) {
    if (!re.test(rest)) continue;
    priority = p;
    consume(re);
    break;
  }

  // Existing projects win over guessing: longest name first, so "Project Hub"
  // is not shadowed by a project merely called "Project".
  let project: string | undefined;
  const known = [...vault.projects].sort((a, b) => b.name.length - a.name.length);
  for (const p of known) {
    const re = new RegExp(`\\b${p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(rest)) { project = p.name; break; }
  }

  const tags: string[] = [];
  for (const kind of KIND_TAGS) {
    if (new RegExp(`\\b${kind}s?\\b`, 'i').test(rest)) tags.push(kind);
  }
  for (const [re, tag] of MODULE_WORDS) {
    if (re.test(rest) && !tags.includes(tag)) { tags.push(tag); break; }
  }

  // Lifting a word out of the middle of a sentence leaves its punctuation
  // stranded — "…kaj kore na, joruri, eta…" becomes "…kaj kore na, , eta…".
  // Close those gaps before the text is shown to anyone.
  const title = rest
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .replace(/([,.;])(\s*[,.;])+/g, '$1')
    .replace(/^[\s,.;-]+|[\s,.;-]+$/g, '')
    .trim();

  return {
    type: 'task',
    // Falling back to the raw text matters: stripping a date word can empty a
    // one-word entry, and a task with no title at all is worse than a rough one.
    title: title || raw.trim(),
    project,
    tags,
    due,
    priority,
    originalInput: raw.trim(),
  };
}

// ── Telling a note from a task ───────────────────────────────────────────────

const SECRET_WORDS = /\b(pass|passcode|password|pin|otp|wifi|wi-?fi|login|username|account|key|code)\b/i;
/** The same words, for stripping every occurrence out of a note's title. */
const SECRET_WORDS_ALL = new RegExp(SECRET_WORDS.source, 'gi');

/** A bare value, not prose: "5665", "Abc12345", "192.168.0.1". */
const VALUE_TOKEN = /(?:^|\s)(?=\S*\d)[A-Za-z0-9@._:-]{3,}(?:\s|$)/;

/**
 * Verbs that make a line an instruction rather than a statement of fact.
 * "portal er login page ta thik korte hobe" mentions a login and is plainly a
 * task; "tab er pass 5665" mentions one and is plainly a note. The verb is what
 * separates them.
 */
const TASK_VERBS = /\b(hobe|korte|kore|kora|dite|nite|pathate|banate|dekhte|lagbe|thik|sesh|suru|fix|add|update|remove|delete|check|review|make|build|send|call|write|design|ship|test)\b/i;

/**
 * Does this line record a secret rather than ask for work?
 *
 * Worth catching locally rather than leaving to Claude: a passcode would
 * otherwise sit in a plain task title for the fifteen seconds the model takes,
 * and a task title is not where a secret belongs even briefly.
 */
export function looksLikeSecret(raw: string): boolean {
  return SECRET_WORDS.test(raw) && VALUE_TOKEN.test(raw) && !TASK_VERBS.test(raw);
}

/** Best guess at which of the four note kinds this is. */
export function guessNoteKind(raw: string): NoteKind {
  if (/\bwi-?fi\b|\brouter\b|\bssid\b/i.test(raw)) return 'wifi';
  if (/\bpin\b|\bpass\b|\bpasscode\b|\botp\b|\bcode\b/i.test(raw)) return 'code';
  if (/\blogin\b|\busername\b|\baccount\b|\bemail\b|\bpassword\b/i.test(raw)) return 'login';
  return 'other';
}

/**
 * Split the raw line into a note, keeping the value out of the title.
 * "tab er pass 5665" becomes a Code note titled "tab", secret "5665".
 */
export function noteLocally(raw: string): NoteDraft {
  const text = raw.trim();
  const value = text.match(/(?:^|\s)((?=\S*\d)[A-Za-z0-9@._:-]{3,})(?:\s|$)/);
  const secret = value?.[1];
  const title = (secret ? text.replace(secret, ' ') : text)
    .replace(SECRET_WORDS_ALL, ' ')
    .replace(/\b(er|ta|the|my|amar)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    type: 'note',
    kind: guessNoteKind(text),
    title: title || text,
    secret,
    body: '',
  };
}

// ── The Claude pass ──────────────────────────────────────────────────────────

/**
 * The instructions handed to `claude -p`. Deliberately a condensed copy of
 * CLAUDE.md §2 rather than a pointer to it: the command runs from wherever the
 * app was launched, so the project file may not be loaded.
 *
 * It returns a *list*, because one typed line is not always one task. "invoice
 * pathate hobe ar PR review korte hobe" is two, and answering with a single
 * object silently threw the second one away.
 */
export function buildPrompt(raw: string, vault: Vault): string {
  const today = todayISO();
  const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const projects = vault.projects.map((p) => p.name);

  return `You convert one line of a user's mixed Bangla/Banglish/English input into task and note entries.

Reply with ONE JSON object and nothing else — no prose, no markdown fence:
{"items": [ ... ]}

Each item is either a task or a note.

Task item:
{"type": "task", "title": string, "project": string|null, "tags": string[], "notes": string|null, "due": "YYYY-MM-DD"|null, "priority": 0|1|2|3}

Note item — for reference material the user wants to keep, NOT work to be done. Passwords, PINs, wifi keys, account names, licence keys, any value they are recording to look up later:
{"type": "note", "kind": "login"|"wifi"|"code"|"other", "title": string, "username": string|null, "secret": string|null, "url": string|null, "body": string}

Today is ${today} (${weekday}). Resolve every relative date against that.
Existing projects: ${projects.length ? projects.join(', ') : '(none yet)'}

How many items:
- One line usually means one item.
- If the line clearly states several separate pieces of work, return one task each. "invoice pathate hobe ar PR review korte hobe" is two tasks. Do not merge them and do not drop any.
- Do not invent items the line does not ask for.

Task rules:
- title: clean, imperative, specific English. "Send the invoice to the client", not "invoice". Translate Bangla to English; never echo the input back.
- project: reuse an existing project when it fits. Do not invent one for a one-off. Personal errands go to "Personal". null if genuinely none.
- tags: two kinds together.
  Kind tags say what the work is — bug, enhancement, release, design, frontend, backend, responsive, architecture, requirements, billing, docs, test. A bug is a defect; an enhancement is a "would be better if".
  Any OTHER tag names the module. For the OERP project use exactly these spellings: email, project-hub, hris, meet-chat, team-evaluation, shared-ui, property-booking, notification, portal.
  Work spanning the whole project takes no module tag.
- notes: one or two lines, under ~120 characters. Distil the point; never transcribe the input. Say what is wrong and what it should be. null if the title already says everything.
- due: only when a time is actually implied. Time-of-day words (shokal, bikel, rat) are not dates — mention them in notes if they matter.
- priority: 0 joruri/urgent/ekhoni, 1 important/guruttopurno/must, 2 default, 3 pore holeo hobe/whenever.

Note rules:
- Put the confidential value in "secret", never in "title". "tab er pass 5665" is {"type":"note","kind":"code","title":"Tablet","secret":"5665"}.
- title names what the secret belongs to, in plain English.
- A line telling you to *fix* or *build* a login page is a task, not a note. Only record a note when the line states a value to remember.

Input: ${raw.trim()}`;
}

// ── Reading the reply ────────────────────────────────────────────────────────

function asTask(o: Record<string, unknown>, raw: string, fallback: Draft): TaskDraft | null {
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  if (!title) return null;

  return {
    type: 'task',
    title,
    project: typeof o.project === 'string' && o.project.trim() ? o.project.trim() : undefined,
    tags: Array.isArray(o.tags)
      ? o.tags.filter((t): t is string => typeof t === 'string' && !!t.trim())
          .map((t) => t.trim().toLowerCase())
      : [],
    notes: typeof o.notes === 'string' && o.notes.trim() ? o.notes.trim() : undefined,
    due: typeof o.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.due) ? o.due : undefined,
    priority: [0, 1, 2, 3].includes(o.priority as number)
      ? (o.priority as Priority)
      : fallback.priority,
    originalInput: raw.trim(),
  };
}

function asNote(o: Record<string, unknown>): NoteDraft | null {
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  if (!title) return null;

  const str = (k: string) => {
    const v = o[k];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };
  const kind = NOTE_KINDS.includes(o.kind as NoteKind) ? (o.kind as NoteKind) : 'other';

  return {
    type: 'note',
    kind,
    title,
    username: str('username'),
    secret: str('secret'),
    url: str('url'),
    body: str('body') ?? '',
  };
}

/**
 * Pull the items out of whatever the CLI printed around them.
 *
 * The model is asked for bare JSON and mostly obliges, but it sometimes wraps
 * the object in a ```json fence or adds a sentence either side — so the object
 * is located by its braces rather than by assuming the whole reply is JSON.
 * A single bare task object is still accepted, since that is what earlier
 * versions of this prompt returned.
 */
export function parseItems(text: string, raw: string, fallback: Draft): Item[] {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in response');

  const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  const raws = Array.isArray(parsed.items) ? parsed.items : [parsed];

  const items = raws
    .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
    .map((o) => (o.type === 'note' ? asNote(o) : asTask(o, raw, fallback)))
    .filter((i): i is Item => i !== null);

  if (!items.length) throw new Error('response held no usable item');
  return items;
}

// ── Folding the reply back into the vault ────────────────────────────────────

/** The category the composer was open on. A model guess never overrules it. */
export interface ViewContext {
  project?: string;
  tags?: string[];
}

/** Strip the union tag; it discriminates the parsed reply, it is not stored. */
export function taskFields({ type: _t, ...rest }: TaskDraft) { return rest; }
export function noteFields({ type: _t, ...rest }: NoteDraft) { return rest; }

/**
 * Replace the placeholder entry with what Claude actually found.
 *
 * One typed line is not always one entry. It can be two tasks, or a note rather
 * than a task — so the placeholder is reused only when the first item is the
 * same kind of thing, and is otherwise dropped in favour of what came back.
 * Everything happens in one pass, so the vault is written once.
 */
export function applyItems(
  vault: Vault,
  id: string,
  placeholder: 'task' | 'note',
  items: Item[],
  view: ViewContext = {},
): Vault {
  if (!items.length) return vault;

  const reuse = items[0].type === placeholder;
  let next = vault;

  items.forEach((item, i) => {
    const first = i === 0 && reuse;
    if (item.type === 'task') {
      const fields = {
        ...taskFields(item),
        project: view.project ?? item.project,
        tags: view.tags ? [...new Set([...item.tags, ...view.tags])] : item.tags,
      };
      next = first ? updateTask(next, id, fields) : addTask(next, fields);
    } else {
      const fields = noteFields(item);
      next = first ? updateNote(next, id, fields) : addNote(next, fields);
    }
  });

  // Typed as one kind, came back as the other: the placeholder was superseded
  // rather than updated, so it must not be left behind.
  if (!reuse) {
    next = placeholder === 'task' ? deleteTask(next, id) : deleteNote(next, id);
  }
  return next;
}
