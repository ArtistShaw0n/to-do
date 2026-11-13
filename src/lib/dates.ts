/** Calendar-date helpers. Everything is local-time; the vault stores `YYYY-MM-DD`. */

/** Today in the *user's* timezone — `toISOString()` alone would drift to UTC. */
export function todayISO(d = new Date()): string {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`); // midday keeps DST from shifting the date
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${to}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Short, human phrasing for a due date relative to today. */
export function relativeDue(due: string | undefined, today = todayISO()): string {
  if (!due) return '';
  const diff = daysBetween(today, due);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${-diff}d overdue`;
  if (diff <= 6) {
    return new Date(`${due}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' });
  }
  return new Date(`${due}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * When an entry was made, in the shape a mail app uses: a time today, a day
 * this week, a date before that.
 *
 * The list holds work going back months, so "which of these did I write just
 * now?" is not answerable from the order alone — two tasks entered in May and
 * this morning look identical. This is the answer, kept short enough to sit at
 * the end of the row.
 */
export function entered(iso: string | undefined, now = new Date()): string {
  if (!iso) return '';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const days = daysBetween(todayISO(at), todayISO(now));
  if (days === 0) return at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7 && days > 0) return at.toLocaleDateString(undefined, { weekday: 'short' });
  const sameYear = at.getFullYear() === now.getFullYear();
  return at.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: '2-digit' }) });
}

/** The same moment in full, for a tooltip or the detail pane. */
export function enteredLong(iso: string | undefined): string {
  if (!iso) return '';
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? '' : at.toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function isOverdue(due: string | undefined, today = todayISO()): boolean {
  return Boolean(due && due < today);
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good evening';
}

export function longDate(iso = todayISO()): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Parse the loose shorthands a person types into a quick-add box.
 * Mirrors `parseDate` in bin/vault.mjs.
 */
export function parseDateInput(input: string): string | undefined {
  const s = input.trim().toLowerCase();
  if (!s) return undefined;
  const today = todayISO();

  if (s === 'today' || s === 'aj' || s === 'aaj') return today;
  if (s === 'tomorrow' || s === 'tmr' || s === 'tom' || s === 'kal') return addDays(today, 1);
  if (s === 'yesterday') return addDays(today, -1);

  // Signed offsets: "+3d", "3d", "2w", "-1d" (backdating a missed task).
  const rel = s.match(/^([+-]?)(\d+)\s*([dw])$/);
  if (rel) {
    const n = Number(rel[2]) * (rel[1] === '-' ? -1 : 1);
    return addDays(today, n * (rel[3] === 'w' ? 7 : 1));
  }

  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const idx = days.indexOf(s.slice(0, 3));
  if (idx >= 0) {
    const delta = (idx - new Date().getDay() + 7) % 7;
    return addDays(today, delta === 0 ? 7 : delta);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return undefined;
}
