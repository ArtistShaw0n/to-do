/**
 * Whoever can, finishing what could not be finished where it was typed.
 *
 * A task typed with no way to reach Claude — a phone with no signal, a hub
 * whose day's ceiling was spent — gets only the offline pass: the dates and
 * tags are recognised, but the sentence stays as it was written. It is flagged,
 * and any device that *can* reach Claude takes it over and rewrites it
 * properly. That is the Mac, which has the CLI and the hub's API, and also any
 * other device that is open and can reach the hub's API: with the Mac off, the
 * phone in your hand is enough.
 *
 * Two Macs will both see the same pending task, so a job is claimed before it
 * is run: write your device id, wait, read it back, and only proceed if it is
 * still yours. A claim that goes stale — the machine slept, the app quit
 * mid-flight — is reclaimed after a couple of minutes rather than stranding the
 * task forever.
 */

import type { Task, Vault } from './types';
import { buildPrompt, normaliseLocally, parseItems, taskFields } from './normalise';
import { applyItems } from './normalise';
import { currentVault, deviceId } from './sync';
import { aiNormalise, aiReady } from './ai';

/** How long a claim is honoured before another machine may take the job. */
const CLAIM_TIMEOUT_MS = 2 * 60 * 1000;

/** Long enough for another machine's claim to have reached us. */
const CLAIM_SETTLE_MS = 1200;

/** Breathing room between jobs, so a backlog does not saturate the CLI. */
const BETWEEN_JOBS_MS = 1500;

/** After a device finds it cannot do the work at all, how long before it tries again. */
const RETRY_AFTER_MS = 5 * 60 * 1000;

function isClaimable(task: Task, now: number): boolean {
  if (!task.needsNormalise) return false;
  if (!task.claimedAt) return true;
  const age = now - Date.parse(task.claimedAt);
  return Number.isNaN(age) || age > CLAIM_TIMEOUT_MS;
}

export function pendingTasks(vault: Vault, now = Date.now()): Task[] {
  return vault.tasks.filter((t) => isClaimable(t, now));
}

/**
 * Watch for work typed elsewhere and finish it.
 *
 * Returns a stop function. Failure is quiet on purpose: a task that cannot be
 * improved is still a perfectly usable task, and the flag is cleared either way
 * so a phrase Claude cannot parse is not retried forever.
 */
export function startNormaliseWorker(
  mutate: (fn: (v: Vault) => Vault) => Promise<void>,
  /** True on a Mac, where Claude Code is also an option behind the hub's API. */
  hasCli: boolean,
): () => void {
  let stopped = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Set when a job could not be done from here; nothing is claimed until it passes. */
  let pausedUntil = 0;

  const me = deviceId();

  const claim = async (task: Task): Promise<boolean> => {
    await mutate((v) => ({
      ...v,
      tasks: v.tasks.map((t) => (t.id === task.id
        ? { ...t, claimedBy: me, claimedAt: new Date().toISOString() }
        : t)),
    }));

    // Let the other devices' claims arrive before deciding this one won.
    await new Promise((r) => setTimeout(r, CLAIM_SETTLE_MS));
    const mine = currentVault().tasks.find((t) => t.id === task.id);
    return mine?.claimedBy === me && mine?.needsNormalise === true;
  };

  /** Hand a claimed job back untouched, for a device that can do it. */
  const release = (task: Task) => mutate((v) => ({
    ...v,
    tasks: v.tasks.map((t) => (t.id === task.id
      ? { ...t, claimedBy: undefined, claimedAt: undefined }
      : t)),
  }));

  const finish = async (task: Task): Promise<boolean> => {
    const raw = task.originalInput?.trim() || task.title;
    let rewritten = false;
    let text: string | undefined;

    // The hub's API first: it needs nothing but a connection. Then, on a Mac,
    // Claude Code — the way this worked before there was an API.
    if (aiReady()) {
      try { text = await aiNormalise(raw, currentVault()); } catch { /* next */ }
    }
    if (text === undefined && hasCli) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        text = await invoke<string>('normalise_task', { prompt: buildPrompt(raw, currentVault()) });
      } catch { /* no CLI, or a lapsed login */ }
    }

    // Nothing here can do it. On a device with no CLI that is not the task's
    // fault — the hub was out of reach, or its ceiling was spent — so the job
    // goes back to the queue still flagged, rather than being marked done and
    // lost. (A Mac clears the flag regardless, below: it has tried everything.)
    if (text === undefined && !hasCli) {
      await release(task);
      pausedUntil = Date.now() + RETRY_AFTER_MS;
      return false;
    }

    try {
      if (text !== undefined) {
        const items = parseItems(text, raw, normaliseLocally(raw, currentVault()));
        await mutate((v) => applyItems(v, task.id, 'task', items));
        rewritten = true;
      }
    } catch {
      // A reply that was not usable. The task keeps what the phone gave it.
    }

    // Clear the flag whichever way it went: retrying forever would mean a
    // phrase Claude cannot parse pins the worker to it and nothing else in the
    // queue ever runs.
    await mutate((v) => ({
      ...v,
      tasks: v.tasks.map((t) => (t.id === task.id
        ? { ...taskFields({ ...t, type: 'task' } as never),
            id: t.id,
            needsNormalise: undefined,
            claimedBy: undefined,
            claimedAt: undefined }
        : t)) as Task[],
    }));
    return rewritten;
  };

  const tick = async () => {
    if (stopped || running || Date.now() < pausedUntil) return;
    running = true;
    try {
      const [next] = pendingTasks(currentVault());
      if (next && await claim(next)) {
        await finish(next);
        // Something changed; look again promptly in case more is waiting.
        if (!stopped) timer = setTimeout(() => void tick(), BETWEEN_JOBS_MS);
      }
    } catch {
      // The loop must survive anything a single job can throw.
    } finally {
      running = false;
    }
  };

  // The store fires on every change, including one arriving from a phone.
  const poll = setInterval(() => void tick(), 8000);
  void tick();

  return () => {
    stopped = true;
    clearInterval(poll);
    clearTimeout(timer);
  };
}
