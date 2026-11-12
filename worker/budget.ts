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

/** The one budget object. Its name never changes, so every caller reaches the same counter. */
export const budget = (env: Env) => env.AI_BUDGET.get(env.AI_BUDGET.idFromName('budget'));
