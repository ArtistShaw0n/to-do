import { useState } from 'react';
import type { TaskDraft } from '../lib/normalise';

/**
 * Tasks read out of a picture, held for a look before they exist.
 *
 * A screenshot of a bug sheet can yield twelve tasks at once, and a model
 * reading small print will get some of them wrong — a merged row, a misread
 * word. Typing a line into the composer creates one task you can see you made;
 * a picture creates a dozen you did not write. So these wait here, each with a
 * tick and an editable title, and only the ticked ones are added.
 *
 * It takes the whole screen like Settings and the Notes lock do, because a
 * review that shares the screen with the list invites scrolling past it.
 */
export function PictureReview({
  items,
  seen,
  hint,
  onAdd,
  onCancel,
}: {
  items: TaskDraft[];
  /** One sentence on what the picture was — what makes an empty answer readable. */
  seen?: string;
  /** What the person asked it to look for, if they said. */
  hint?: string;
  onAdd: (items: TaskDraft[]) => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState(() => items.map((item) => ({ item, on: true })));
  const picked = rows.filter((r) => r.on && r.item.title.trim());

  return (
    <main className="sheet">
      <header className="sheet-head">
        <div>
          <h1 className="sheet-title">From the picture</h1>
          <p className="sheet-date">
            {rows.length === 0
              ? 'Nothing to do in it'
              : `${rows.length} ${rows.length === 1 ? 'task' : 'tasks'} found — check them before they are added`}
          </p>
        </div>
        <button className="theme-btn" aria-label="Back" onClick={onCancel}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>

      <div className="sheet-scroll">
        {rows.length === 0 ? (
          <div className="empty">
            <div className="empty-mark">✓</div>
            <div className="empty-title">No tasks in that picture</div>
            {seen && <div>Claude saw: {seen}</div>}
            <div>
              {hint
                ? `Nothing in it matched “${hint}”.`
                : 'If there is work in it, type what to look for in the box first, then add the picture again.'}
            </div>
          </div>
        ) : (
          <div className="review-list">
            {rows.map(({ item, on }, i) => (
              <div key={i} className="review-row" data-off={!on || undefined}>
                <input
                  type="checkbox"
                  className="review-tick"
                  checked={on}
                  aria-label={`Include “${item.title}”`}
                  onChange={() => setRows(rows.map((r, j) => (j === i ? { ...r, on: !r.on } : r)))}
                />
                <div className="review-main">
                  <input
                    className="detail-input"
                    value={item.title}
                    aria-label="Task title"
                    onChange={(e) => setRows(rows.map((r, j) => (
                      j === i ? { ...r, item: { ...r.item, title: e.target.value } } : r
                    )))}
                  />
                  {(item.project || item.tags.length > 0 || item.notes) && (
                    <div className="review-meta">
                      {item.project && <span className="chip">{item.project}</span>}
                      {item.tags.map((t) => <span key={t} className="chip chip-tag">{t}</span>)}
                      {item.notes && <span className="review-note">{item.notes}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="composer">
        <button
          className="btn"
          style={{ width: '100%' }}
          disabled={rows.length > 0 && picked.length === 0}
          onClick={() => (rows.length === 0 ? onCancel() : onAdd(picked.map((r) => r.item)))}
        >
          {rows.length === 0 ? 'Back' : `Add ${picked.length} ${picked.length === 1 ? 'task' : 'tasks'}`}
        </button>
      </div>
    </main>
  );
}
