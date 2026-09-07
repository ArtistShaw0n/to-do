/**
 * The Mac that finishes what the phones start.
 *
 * A phone has no Claude CLI, so a task typed there gets only the offline pass:
 * the dates and tags are recognised, but the sentence stays as it was written.
 * The Mac is already running all day and already has the CLI, so it takes those
 * over and rewrites them properly — which is why nothing here costs anything.
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

/** How long a claim is honoured before another machine may take the job. */
const CLAIM_TIMEOUT_MS = 2 * 60 * 1000;

/** Long enough for another machine's claim to have reached us. */
const CLAIM_SETTLE_MS = 1200;

/** Breathing room between jobs, so a backlog does not saturate the CLI. */
const BETWEEN_JOBS_MS = 1500;

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
): () => void {
  let stopped = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

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

  const finish = async (task: Task) => {
    const raw = task.originalInput?.trim() || task.title;
    let rewritten = false;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const text = await invoke<string>('normalise_task', {
        prompt: buildPrompt(raw, currentVault()),
      });
      const items = parseItems(text, raw, normaliseLocally(raw, currentVault()));
      await mutate((v) => applyItems(v, task.id, 'task', items));
      rewritten = true;
    } catch {
      // No CLI, a lapsed login, or a reply that was not JSON. The task keeps
      // what the phone gave it.
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
    if (stopped || running) return;
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
