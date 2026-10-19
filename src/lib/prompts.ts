/**
 * What Claude is told when it turns a line of Banglish into a task.
 *
 * One copy, read by every path that asks. The app sends a line to `claude -p`
 * on a Mac and to the hub's API on a phone, and the two must agree about what a
 * task is — if the rules lived in two places the same sentence would come back
 * as different tasks depending on which device it was typed on.
 *
 * Pure strings and plain objects, no imports: the sync hub bundles this file
 * and has no `window` to lean on.
 *
 * `CLAUDE.md` §2 is the human-readable version of these rules. Change a time
 * word, a priority word or a module there and it has to change here too.
 */

export const NORMALISE_INTRO =
  "You convert one line of a user's mixed Bangla/Banglish/English input into task and note entries.";

export const REPLY_FORMAT = `Reply with ONE JSON object and nothing else — no prose, no markdown fence:
{"items": [ ... ]}`;

export const TASK_SHAPE =
  '{"type": "task", "title": string, "project": string|null, "tags": string[], "notes": string|null, "due": "YYYY-MM-DD"|null, "priority": 0|1|2|3}';

export const NOTE_SHAPE =
  '{"type": "note", "kind": "login"|"wifi"|"code"|"other", "title": string, "username": string|null, "secret": string|null, "url": string|null, "body": string}';

export const ITEM_SHAPES = `Each item is either a task or a note.

Task item:
${TASK_SHAPE}

Note item — for reference material the user wants to keep, NOT work to be done. Passwords, PINs, wifi keys, account names, licence keys, any value they are recording to look up later:
${NOTE_SHAPE}`;

export const HOW_MANY = `How many items:
- One line usually means one item.
- If the line clearly states several separate pieces of work, return one task each. "invoice pathate hobe ar PR review korte hobe" is two tasks. Do not merge them and do not drop any.
- Do not invent items the line does not ask for.`;

/** Shared by the typed-line prompt and the screenshot prompt: a task is a task. */
export const TASK_RULES = `Task rules:
- title: clean, imperative, specific English. "Send the invoice to the client", not "invoice". Translate Bangla to English; never echo the input back.
- project: reuse an existing project when it fits. Do not invent one for a one-off. Personal errands go to "Personal". null if genuinely none.
- tags: two kinds together.
  Kind tags say what the work is — bug, enhancement, release, design, frontend, backend, responsive, architecture, requirements, billing, docs, test. A bug is a defect; an enhancement is a "would be better if".
  Any OTHER tag names the module. For the OERP project use exactly these spellings: email, project-hub, hris, meet-chat, team-evaluation, shared-ui, property-booking, notification, portal.
  Work spanning the whole project takes no module tag.
- notes: one or two lines, under ~120 characters. Distil the point; never transcribe the input. Say what is wrong and what it should be. null if the title already says everything.
- due: only when a time is actually implied, as YYYY-MM-DD from today's date. kal/kalke/tomorrow is tomorrow; porshu is two days on; "ei week"/this week is that week's Friday; "agami week"/next week is seven days on; "shomne mash"/next month is the same day next month; a weekday name is the next such day. Time-of-day words (shokal, bikel, rat) are not dates — mention them in notes if they matter.
- priority: 0 joruri/urgent/ekhoni, 1 important/guruttopurno/must, 2 default, 3 pore holeo hobe/whenever.`;

export const NOTE_RULES = `Note rules:
- Put the confidential value in "secret", never in "title". "tab er pass 5665" is {"type":"note","kind":"code","title":"Tablet","secret":"5665"}.
- title names what the secret belongs to, in plain English.
- A line telling you to *fix* or *build* a login page is a task, not a note. Only record a note when the line states a value to remember.`;

/** Everything that does not change from one line to the next. */
export function normaliseSystem(): string {
  return [NORMALISE_INTRO, REPLY_FORMAT, ITEM_SHAPES, HOW_MANY, TASK_RULES, NOTE_RULES].join('\n\n');
}

export interface NormaliseContext {
  today: string;
  weekday: string;
  projects: string[];
  raw: string;
}

/** The part that is different every time: the date, the projects, the line. */
export function normaliseUser(c: NormaliseContext): string {
  return `Today is ${c.today} (${c.weekday}). Resolve every relative date against that.
Existing projects: ${c.projects.length ? c.projects.join(', ') : '(none yet)'}

Input: ${c.raw.trim()}`;
}

// ── Output schemas ───────────────────────────────────────────────────────────
//
// The API can be held to a schema, which turns "mostly returns JSON" into
// "always returns JSON". Anything the schema cannot say — a date being a real
// date, a tag being a known one — is still checked on the way in by
// `parseItems`, which is why that stays as strict as it was.

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] });

export const TASK_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'task' },
    title: { type: 'string' },
    project: nullable({ type: 'string' }),
    tags: { type: 'array', items: { type: 'string' } },
    notes: nullable({ type: 'string' }),
    due: nullable({ type: 'string', format: 'date' }),
    priority: { type: 'integer', enum: [0, 1, 2, 3] },
  },
  required: ['type', 'title', 'project', 'tags', 'notes', 'due', 'priority'],
  additionalProperties: false,
} as const;

export const NOTE_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'note' },
    kind: { type: 'string', enum: ['login', 'wifi', 'code', 'other'] },
    title: { type: 'string' },
    username: nullable({ type: 'string' }),
    secret: nullable({ type: 'string' }),
    url: nullable({ type: 'string' }),
    body: { type: 'string' },
  },
  required: ['type', 'kind', 'title', 'username', 'secret', 'url', 'body'],
  additionalProperties: false,
} as const;

/** A typed line: tasks and notes. */
export const NORMALISE_SCHEMA = {
  type: 'object',
  properties: {
    items: { type: 'array', items: { anyOf: [TASK_ITEM_SCHEMA, NOTE_ITEM_SCHEMA] } },
  },
  required: ['items'],
  additionalProperties: false,
} as const;

/** A screenshot: tasks only. A password in a picture is not a note to keep. */
export const IMAGE_SCHEMA = {
  type: 'object',
  properties: { items: { type: 'array', items: TASK_ITEM_SCHEMA } },
  required: ['items'],
  additionalProperties: false,
} as const;

export const STEPS_SCHEMA = {
  type: 'object',
  properties: { steps: { type: 'array', items: { type: 'string' } } },
  required: ['steps'],
  additionalProperties: false,
} as const;
