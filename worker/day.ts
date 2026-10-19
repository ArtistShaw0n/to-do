/**
 * "Today", where the user is.
 *
 * A Worker runs in UTC. At half past six in the morning in Dhaka it is half past
 * midnight UTC — the same date, by luck — but at nine at night it is already
 * tomorrow in UTC's eyes. The daily cap and the morning brief both hang off
 * "which day is it", so the day comes from the user's timezone, never the
 * machine's.
 */

export const DEFAULT_TIMEZONE = 'Asia/Dhaka';

/** A timezone name that Intl actually accepts; a typo must not take the hub down. */
export function safeZone(tz: string | undefined): string {
  const name = tz?.trim() || DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name });
    return name;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/** `YYYY-MM-DD` in that zone. `en-CA` is the locale that formats dates this way. */
export function dayIn(tz: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export function weekdayIn(tz: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(now);
}

/** The date `days` before an ISO date. Noon UTC keeps DST out of it. */
export function daysBefore(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
