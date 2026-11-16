/** What the hub is configured with. Secrets are set with `wrangler secret put`. */

import type { WsServerDurableObject } from 'tinybase/synchronizers/synchronizer-ws-server-durable-object';
import type { AiBudget } from './budget';
import type { Accounts } from './accounts';

export interface Env {
  // Typed as the base class, not TodoSync: the routing helper only needs the
  // contract TinyBase defines, and the narrower type is not assignable to it.
  // wrangler.toml is what binds this name to the concrete class.
  TODO_SYNC: DurableObjectNamespace<WsServerDurableObject>;
  /** The day's AI budget, kept apart from the vault so counting does not wake it (see budget.ts). */
  AI_BUDGET: DurableObjectNamespace<AiBudget>;
  /** Who has an account, and the key to each one's vault (see accounts.ts). */
  ACCOUNTS: DurableObjectNamespace<Accounts>;
  /** The built app. The Worker serves it so the phones need no separate host. */
  ASSETS: Fetcher;
  /** The shared secret every client must present. Set with `wrangler secret`. */
  SYNC_KEY: string;

  /**
   * The Anthropic API key. Optional on purpose: without it the hub still syncs,
   * and every AI feature reports itself unavailable instead of failing.
   * Set with `wrangler secret put ANTHROPIC_API_KEY`; never in this repo.
   */
  ANTHROPIC_API_KEY?: string;
  /** Tests point this at a local stand-in. Never set in production. */
  ANTHROPIC_BASE_URL?: string;
  /** Which model answers. One line in wrangler.toml to change. */
  AI_MODEL?: string;
  /** Calls per day across every feature — the ceiling on what a leaked key can spend. */
  AI_DAILY_CAP?: string;
  /** Where "today" is for the daily cap and the morning brief. */
  TIMEZONE?: string;
  /** AI calls a day for each account other than the owner's. */
  USER_AI_DAILY_CAP?: string;
  /** AI calls a day for all other accounts together, so they can never spend the owner's. */
  GUESTS_AI_DAILY_CAP?: string;
  /** How many accounts may be opened (the owner's not counted). */
  MAX_ACCOUNTS?: string;
}
