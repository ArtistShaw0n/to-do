/**
 * The vault schema. This is the contract shared by three implementations:
 * the Rust shell (storage), this app (UI logic) and bin/vault.mjs (the CLI
 * Claude drives). Any change here must land in all three.
 */

/**
 * `fixed` sits between `doing` and `done` on purpose.
 *
 * A bug the developer believes is fixed and a bug someone has checked on a real
 * build are not the same thing, and collapsing them into one "Done" is how a
 * regression ships. Everything else keeps its old meaning, and `fixed` counts
 * as open — the work is not finished until it has been verified.
 */
export const STATUSES = [
  'inbox', 'todo', 'doing', 'blocked', 'fixed', 'done', 'cancelled',
] as const;
export type Status = (typeof STATUSES)[number];

/** 0 = urgent … 3 = low. Lower sorts first. */
export type Priority = 0 | 1 | 2 | 3;

/** How much harm the bug does, independent of when it gets fixed. */
export const SEVERITIES = ['blocker', 'major', 'minor', 'cosmetic'] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  status: Status;
  priority: Priority;
  tags: string[];
  project?: string;
  /** Calendar dates, `YYYY-MM-DD`, in the user's local timezone. */
  due?: string;
  scheduled?: string;
  estimateMin?: number;
  subtasks: Subtask[];
  recurrence?: 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly';
  blockedReason?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  order: number;
  source: 'claude' | 'app' | 'cli';
  /** The user's original Banglish phrasing, preserved next to the clean title. */
  originalInput?: string;

  /**
   * Typed on a device that cannot run Claude — a phone, or a Mac whose CLI is
   * unreachable. A Mac picks these up and rewrites them properly.
   */
  needsNormalise?: boolean;

  // ── Bug fields ─────────────────────────────────────────────────────────────
  // Only meaningful on a task tagged `bug`.

  /**
   * How much damage it does — not how soon to fix it. That is `priority`, and
   * they are genuinely different: a typo on the front page is trivial damage
   * and urgent, a crash in an unused admin screen is severe and can wait.
   * Merging them into one number is why bug lists stop being sortable.
   */
  severity?: Severity;
  /** The screen it happens on, inside the module. */
  menu?: string;
  /** Numbered steps. A bug nobody can reproduce is a bug nobody can fix. */
  steps?: string;
  /** What should have happened instead. */
  expected?: string;
  /** Browser, device and build it was seen on. */
  environment?: string;
  /** Screenshot, recording, or the issue it was filed under. */
  evidenceUrl?: string;
  reportedBy?: string;
  fixedBy?: string;
  verifiedBy?: string;
  /** The build the fix went into, so "is it in this one?" has an answer. */
  fixedIn?: string;
  /** Reopened more than once means the diagnosis is wrong, not the fix. */
  reopenCount?: number;
  /** Which device took the job, so two Macs do not both run it. */
  claimedBy?: string;
  claimedAt?: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt?: string;
}

export interface Stats {
  date: string;
  total: number;
  open: number;
  doing: number;
  blocked: number;
  overdue: number;
  dueToday: number;
  completedToday: number;
  urgent: number;
  streak: number;
}

export interface Digest {
  date: string;
  markdown: string;
  stats: Stats;
  createdAt: string;
  author: string;
}

/**
 * A note is reference material, not work: a PIN, a wifi password, a meter
 * reading. It is deliberately *not* a Task — it has no status, no due date and
 * is never completed, so keeping it out of the task list keeps it out of the
 * counts, the tray badge and the Completed section.
 */
export const NOTE_KINDS = ['login', 'wifi', 'code', 'other'] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export const NOTE_KIND_META: Record<NoteKind, { label: string; plural: string; color: string }> = {
  login: { label: 'Login', plural: 'Logins', color: 'var(--blue)' },
  wifi: { label: 'Wi-Fi', plural: 'Wi-Fi', color: 'var(--teal)' },
  code: { label: 'Code', plural: 'Codes', color: 'var(--orange)' },
  other: { label: 'Note', plural: 'Notes', color: 'var(--text-2)' },
};

export interface Note {
  id: string;
  kind: NoteKind;
  title: string;
  /** Account name, network name, whatever the secret belongs to. */
  username?: string;
  /** The part that stays masked until revealed. */
  secret?: string;
  url?: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  order: number;
}

export interface Vault {
  version: number;
  tasks: Task[];
  notes: Note[];
  projects: Project[];
  digests: Digest[];
  meta: {
    createdAt: string;
    updatedAt: string;
    lastSeq: number;
    /**
     * The Notes PIN, as a salt and a hash of the key it derives — never the
     * PIN. It rides in the vault so every device recognises the same one; the
     * key itself is derived on each device and never leaves it.
     */
    lock?: { salt: string; verifier: string; iterations: number };
  };
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  0: 'Urgent',
  1: 'High',
  2: 'Normal',
  3: 'Low',
};

export const STATUS_LABEL: Record<Status, string> = {
  inbox: 'Inbox',
  todo: 'To Do',
  doing: 'In Progress',
  blocked: 'Blocked',
  fixed: 'Fixed, awaiting check',
  done: 'Done',
  cancelled: 'Cancelled',
};

export const PROJECT_COLORS = [
  '#0A84FF', '#BF5AF2', '#FF375F', '#FF9F0A',
  '#30D158', '#64D2FF', '#FF6482', '#5E5CE6',
];

export function emptyVault(): Vault {
  const now = new Date().toISOString();
  return {
    version: 1,
    tasks: [],
    notes: [],
    projects: [],
    digests: [],
    meta: { createdAt: now, updatedAt: now, lastSeq: 0 },
  };
}
