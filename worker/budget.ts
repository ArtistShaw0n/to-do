/**
 * The day's AI budget, in a Durable Object of its own.
 *
 * It used to live in the vault's object (`TodoSync`), and that was expensive in a
 * way nobody had priced: every AI call and every `/ai/status` question woke the
 * vault, and a wake loads the whole vault — about nine thousand rows read, for a
 * counter. On 2026-11-12 a backfill spent the free plan's five million daily reads
 * in three hours. This object holds one small SQL table and nothing else, so
 * asking it costs a row or two.
 *
 * A Durable Object handles one request at a time, so two calls cannot both read
 * "149 of 150" and both go ahead — which is why the counter is in an object at
 * all and not in the Worker, where it would race.
 */

import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env';

const SQL_USAGE = 'CREATE TABLE IF NOT EXISTS ai_usage (day TEXT PRIMARY KEY, used INTEGER NOT NULL)';

export class AiBudget extends DurableObject<Env> {
  /** Spend one unit of the day's budget, or say there is none left. */
  async reserve(day: string, cap: number): Promise<{ ok: boolean; used: number }> {
    const sql = this.ctx.storage.sql;
    sql.exec(SQL_USAGE);
    const row = sql.exec<{ used: number }>('SELECT used FROM ai_usage WHERE day = ?', day).toArray()[0];
    const used = row ? Number(row.used) : 0;
    if (used >= cap) return { ok: false, used };
    if (!row) sql.exec('DELETE FROM ai_usage WHERE day != ?', day); // a new day: yesterday's count is done
    sql.exec(
      'INSERT INTO ai_usage (day, used) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET used = excluded.used',
      day, used + 1,
    );
    return { ok: true, used: used + 1 };
  }

  async usedOn(day: string): Promise<number> {
    const sql = this.ctx.storage.sql;
    sql.exec(SQL_USAGE);
    const row = sql.exec<{ used: number }>('SELECT used FROM ai_usage WHERE day = ?', day).toArray()[0];
    return row ? Number(row.used) : 0;
  }
}

/**
 * A budget by name. `budget` (the default) is the owner's and its name never
 * changes, so every caller reaches the same counter; `guests` is shared by every
 * other account, and `user/<id>` is one account's own.
 */
export const budget = (env: Env, name = 'budget') => env.AI_BUDGET.get(env.AI_BUDGET.idFromName(name));

// ── Whose budget a call comes out of ─────────────────────────────────────────

const cap = (raw: string | undefined, fallback: number) => Math.max(1, Number(raw) || fallback);

export const dailyCap = (env: Env) => cap(env.AI_DAILY_CAP, 150);
const userCap = (env: Env) => cap(env.USER_AI_DAILY_CAP, 30);
const guestsCap = (env: Env) => cap(env.GUESTS_AI_DAILY_CAP, 150);

export interface Spender { id: string; owner: boolean }

/**
 * Spend one call for this person. The owner spends from his own budget, as
 * always. Anyone else spends from their own *and* from the pool all guests
 * share, so no number of other accounts can ever spend the owner's day.
 */
export async function reserveFor(env: Env, who: Spender, day: string): Promise<boolean> {
  if (who.owner) return (await budget(env).reserve(day, dailyCap(env))).ok;
  if (!(await budget(env, `user/${who.id}`).reserve(day, userCap(env))).ok) return false;
  return (await budget(env, 'guests').reserve(day, guestsCap(env))).ok;
}

/** What this person has used today, against their own ceiling. */
export async function usageFor(env: Env, who: Spender, day: string): Promise<{ used: number; cap: number }> {
  if (who.owner) return { used: await budget(env).usedOn(day), cap: dailyCap(env) };
  const [mine, pool] = await Promise.all([
    budget(env, `user/${who.id}`).usedOn(day),
    budget(env, 'guests').usedOn(day),
  ]);
  // When the shared pool runs dry first, say so: report it as this person's ceiling reached.
  return { used: pool >= guestsCap(env) ? userCap(env) : mine, cap: userCap(env) };
}
