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
import { KIND_TAGS } from './vault';
import type { Priority, Vault } from './types';

export interface Draft {
  title: string;
  project?: string;
  tags: string[];
  notes?: string;
  due?: string;
  priority: Priority;
  originalInput: string;
}

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

// ── The Claude pass ──────────────────────────────────────────────────────────

/**
 * The instructions handed to `claude -p`. Deliberately a condensed copy of
 * CLAUDE.md §2 rather than a pointer to it: the command runs from wherever the
 * app was launched, so the project file may not be loaded.
 */
export function buildPrompt(raw: string, vault: Vault): string {
  const today = todayISO();
  const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const projects = vault.projects.map((p) => p.name);

  return `You convert one line of a user's mixed Bangla/Banglish/English input into a single task.

Reply with ONE JSON object and nothing else — no prose, no markdown fence.

Schema:
{"title": string, "project": string|null, "tags": string[], "notes": string|null, "due": "YYYY-MM-DD"|null, "priority": 0|1|2|3}

Today is ${today} (${weekday}). Resolve every relative date against that.
Existing projects: ${projects.length ? projects.join(', ') : '(none yet)'}

Rules:
- title: clean, imperative, specific English. "Send the invoice to the client", not "invoice". Translate Bangla to English; never echo the input back.
- project: reuse an existing project when it fits. Do not invent one for a one-off. Personal errands go to "Personal". null if genuinely none.
- tags: two kinds together.
  Kind tags say what the work is — bug, enhancement, release, design, frontend, backend, responsive, architecture, requirements, billing, docs, test. A bug is a defect; an enhancement is a "would be better if".
  Any OTHER tag names the module. For the OERP project use exactly these spellings: email, project-hub, hris, meet-chat, team-evaluation, shared-ui, property-booking, notification, portal.
  Work spanning the whole project takes no module tag.
- notes: one or two lines, under ~120 characters. Distil the point; never transcribe the input. Say what is wrong and what it should be. null if the title already says everything.
- due: only when a time is actually implied. Time-of-day words (shokal, bikel, rat) are not dates — mention them in notes if they matter.
- priority: 0 joruri/urgent/ekhoni, 1 important/guruttopurno/must, 2 default, 3 pore holeo hobe/whenever.

Input: ${raw.trim()}`;
}

/** Pull the JSON object out of whatever the CLI printed around it. */
export function parseResponse(text: string, raw: string, fallback: Draft): Draft {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in response');

  const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
  if (!title) throw new Error('response had no title');

  const priority = [0, 1, 2, 3].includes(parsed.priority as number)
    ? (parsed.priority as Priority)
    : fallback.priority;

  const due = typeof parsed.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.due)
    ? parsed.due
    : undefined;

  return {
    title,
    project: typeof parsed.project === 'string' && parsed.project.trim()
      ? parsed.project.trim()
      : undefined,
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.filter((t): t is string => typeof t === 'string' && !!t.trim())
          .map((t) => t.trim().toLowerCase())
      : [],
    notes: typeof parsed.notes === 'string' && parsed.notes.trim()
      ? parsed.notes.trim()
      : undefined,
    due,
    priority,
    originalInput: raw.trim(),
  };
}
