import { useState } from 'react';
import type { Subtask, Task } from '../lib/types';
import { newId } from '../lib/vault';
import { aiSteps, describeAiError, useAiStatus } from '../lib/ai';

/**
 * The subtasks inside a task.
 *
 * Called "Subtasks" and not "Steps" because a bug has a field of its own named
 * "Steps to reproduce", and two sections both called Steps on one screen is a
 * mistake waiting to be made.
 *
 * Subtasks have been part of the data since the first version and the CLI can
 * add them, but nothing in the app ever drew them — a task with five steps
 * looked identical to one with none. This draws them, lets them be ticked off,
 * added and removed, and — when the hub can think — offers to propose them.
 *
 * Proposed steps are *proposals*. They arrive as a short list with a tick beside
 * each, and nothing is written until one is accepted: a model's idea of how to
 * do your work is useful as a first draft and wrong often enough that it should
 * never land unreviewed.
 */

type Suggestion =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; steps: string[]; picked: boolean[] };

export function Steps({ task, onPatch }: { task: Task; onPatch: (patch: Partial<Task>) => void }) {
  const ai = useAiStatus();
  const aiOn = !!ai?.configured && ai.used < ai.cap;

  const [draft, setDraft] = useState('');
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  const steps = task.subtasks;
  const finished = steps.filter((s) => s.done).length;
  const write = (next: Subtask[]) => onPatch({ subtasks: next });

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    write([...steps, { id: newId(), title, done: false }]);
    setDraft('');
  };

  const suggest = async () => {
    setSuggestion({ state: 'loading' });
    try {
      const proposed = await aiSteps(task);
      setSuggestion({ state: 'ready', steps: proposed, picked: proposed.map(() => true) });
    } catch (err) {
      setSuggestion({ state: 'error', message: describeAiError(err) });
    }
  };

  const accept = () => {
    if (suggestion?.state !== 'ready') return;
    const chosen = suggestion.steps.filter((_, i) => suggestion.picked[i]);
    if (chosen.length) {
      write([...steps, ...chosen.map((title) => ({ id: newId(), title, done: false }))]);
    }
    setSuggestion(null);
  };

  return (
    <div className="steps">
      <div className="steps-head">
        <span>Subtasks</span>
        {steps.length > 0 && <span className="steps-count">{finished}/{steps.length}</span>}
      </div>

      {steps.map((step) => (
        <div key={step.id} className="step" data-done={step.done || undefined}>
          <button
            className="check"
            data-done={step.done}
            aria-label={step.done ? `Mark “${step.title}” not done` : `Mark “${step.title}” done`}
            onClick={() => write(steps.map((s) => (s.id === step.id ? { ...s, done: !s.done } : s)))}
          >
            <svg viewBox="0 0 14 14" aria-hidden="true">
              <polyline points="3,7.4 5.9,10.2 11,3.9" />
            </svg>
          </button>
          <span className="step-text">{step.title}</span>
          <button
            className="step-del"
            aria-label={`Remove “${step.title}”`}
            onClick={() => write(steps.filter((s) => s.id !== step.id))}
          >
            ×
          </button>
        </div>
      ))}

      <input
        className="detail-input"
        value={draft}
        placeholder="Add a subtask"
        enterKeyHint="done"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        onBlur={add}
      />

      {aiOn && !suggestion && (
        <button className="btn steps-suggest" onClick={() => void suggest()}>
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 1.8l1.4 3.8 3.8 1.4-3.8 1.4L8 12.2 6.6 8.4 2.8 7l3.8-1.4z" />
          </svg>
          Suggest subtasks
        </button>
      )}

      {suggestion?.state === 'loading' && <div className="field-note">Thinking it through…</div>}

      {suggestion?.state === 'error' && (
        <div className="field-note" style={{ color: 'var(--danger)' }}>
          {suggestion.message}{' '}
          <button className="step-link" onClick={() => setSuggestion(null)}>Dismiss</button>
        </div>
      )}

      {suggestion?.state === 'ready' && (
        suggestion.steps.length === 0 ? (
          <div className="field-note">
            That is already one small task — nothing worth splitting.{' '}
            <button className="step-link" onClick={() => setSuggestion(null)}>Dismiss</button>
          </div>
        ) : (
          <div className="step-proposal">
            <div className="field-note">Suggested — untick any you do not want.</div>
            {suggestion.steps.map((text, i) => (
              <label key={text} className="step-pick">
                <input
                  type="checkbox"
                  checked={suggestion.picked[i]}
                  onChange={() => setSuggestion({
                    ...suggestion,
                    picked: suggestion.picked.map((p, j) => (j === i ? !p : p)),
                  })}
                />
                <span>{text}</span>
              </label>
            ))}
            <div className="step-proposal-actions">
              <button className="btn" onClick={accept} disabled={!suggestion.picked.some(Boolean)}>
                Add {suggestion.picked.filter(Boolean).length}
              </button>
              <button className="btn" onClick={() => setSuggestion(null)}>Dismiss</button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
