/**
 * The one place the hub talks to Claude.
 *
 * Every feature — turning a line into a task, breaking a task into steps,
 * reading a screenshot, answering a question, writing the morning brief — goes
 * through `complete`, so the choices that matter are made once: which model,
 * how it is held to a schema, what happens when it declines, and what a failure
 * is allowed to say.
 *
 * Failures are reported by kind and never by content. The client only needs to
 * know *that* it should fall back to the old path; what the API replied, or
 * what was sent, stays out of every response and every log line.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Env } from './env';

/** Opus 5.5. Change it with `AI_MODEL` in wrangler.toml — no code involved. */
export const DEFAULT_MODEL = 'claude-opus-5-5';

export type AiEnv = Pick<Env, 'ANTHROPIC_API_KEY' | 'ANTHROPIC_BASE_URL' | 'AI_MODEL'>;

export type AiFailure =
  | 'not_configured' // no key on the hub
  | 'capped'         // today's ceiling reached
  | 'refused'        // the model declined the request
  | 'truncated'      // it ran out of room before finishing
  | 'empty'          // it said nothing
  | 'rate_limited'   // the API asked us to slow down
  | 'auth'           // the key was rejected
  | 'upstream';      // anything else on the way to or from the API

export class AiError extends Error {
  constructor(readonly code: AiFailure, message: string) {
    super(message);
    this.name = 'AiError';
  }
}

export interface Ask {
  system: string;
  /** Plain text, or content blocks when a picture is involved. */
  user: string | Anthropic.Beta.Messages.BetaContentBlockParam[];
  /** How hard it thinks. Small, frequent jobs are `low`; reading a picture is not. */
  effort: 'low' | 'medium';
  maxTokens: number;
  /** Holds the reply to this JSON schema, so it is always parseable. */
  schema?: Record<string, unknown>;
}

function classify(err: unknown): AiError {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new AiError('auth', 'the hub\'s API key was rejected');
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new AiError('rate_limited', 'the API is asking for fewer requests');
  }
  if (err instanceof Anthropic.APIError) {
    // The status is useful when something is wrong; the message can quote what
    // we sent, so it stays out.
    return new AiError('upstream', `the API answered ${err.status ?? 'with an error'}`);
  }
  return new AiError('upstream', 'the API could not be reached');
}

export const isConfigured = (env: AiEnv) => !!env.ANTHROPIC_API_KEY?.trim();

/** Ask once and return the text of the answer. */
export async function complete(env: AiEnv, ask: Ask): Promise<string> {
  if (!isConfigured(env)) throw new AiError('not_configured', 'no API key on the hub');

  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    baseURL: env.ANTHROPIC_BASE_URL || undefined,
    // One retry covers a dropped connection; more would turn a slow API into a
    // slow app, and every caller has a fallback that is quicker than waiting.
    maxRetries: 1,
    timeout: 50_000,
  });

  let response;
  try {
    response = await client.beta.messages.create({
      model: env.AI_MODEL?.trim() || DEFAULT_MODEL,
      max_tokens: ask.maxTokens,
      system: ask.system,
      messages: [{ role: 'user', content: ask.user }],
      // No `thinking`, no `temperature`: this model always thinks, and effort is
      // the only dial. Sampling parameters are rejected outright.
      output_config: {
        effort: ask.effort,
        ...(ask.schema ? { format: { type: 'json_schema' as const, schema: ask.schema } } : {}),
      },
      // The safety classifiers can occasionally decline a perfectly ordinary
      // task — "fix the injection bug in the login form" is the sort of thing a
      // work list contains. `default` re-runs a declined request on the model
      // Anthropic recommends for that category instead of handing back nothing.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
  } catch (err) {
    throw classify(err);
  }

  if (response.stop_reason === 'refusal') throw new AiError('refused', 'the request was declined');
  if (response.stop_reason === 'max_tokens') throw new AiError('truncated', 'the answer was cut off');

  const text = response.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('')
    .trim();
  if (!text) throw new AiError('empty', 'the answer was empty');
  return text;
}

/** For schema-bound calls: the reply, parsed, or a failure the client can fall back from. */
export function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AiError('upstream', 'the answer was not valid JSON');
  }
}
