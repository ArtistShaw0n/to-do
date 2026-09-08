import { useEffect, useRef, useState } from 'react';
import {
  NOTE_KINDS, NOTE_KIND_META, SEVERITIES,
  type Note, type NoteKind, type Severity, type Task, type Vault,
} from '../lib/types';
import { checkReport, isBug, moveBug } from '../lib/bugs';
import { relativeDue } from '../lib/dates';
import { projectColor } from '../lib/vault';
import { NoteGlyph } from './glyphs';

/**
 * The third column. Passwords keeps the selected item's fields here rather than
 * expanding the row, so the list never reflows while you read or edit.
 */

export function EmptyDetail() {
  return (
    <div className="detail-empty">
      <div className="detail-empty-mark">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.6"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="17" cy="20" r="7" />
          <path d="M24 20h16M36 20v6M31 20v4" />
        </svg>
      </div>
      <div className="detail-empty-title">No Item Selected</div>
      <div className="detail-empty-sub">Pick something on the left, or add one with +.</div>
    </div>
  );
}

// ── Task ─────────────────────────────────────────────────────────────────────

export function TaskDetail({
  task,
  vault,
  onPatch,
  onToggle,
  onDelete,
}: {
  task: Task;
  vault: Vault;
  onPatch: (patch: Partial<Task>) => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? '');
  const [project, setProject] = useState(task.project ?? '');
  const [tags, setTags] = useState(task.tags.join(', '));
  const [due, setDue] = useState(task.due ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset every field when the selection moves, or the previous item's text
  // would linger in the form.
  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes ?? '');
    setProject(task.project ?? '');
    setTags(task.tags.join(', '));
    setDue(task.due ?? '');
    setConfirmDelete(false);
  }, [task.id, task.title, task.notes, task.project, task.due, task.tags]);

  const done = task.status === 'done' || task.status === 'cancelled';

  const save = () => {
    const clean = title.trim();
    if (!clean) {
      setTitle(task.title);
      return;
    }
    onPatch({
      title: clean,
      notes: notes.trim() || undefined,
      project: project.trim() || undefined,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      due: due || undefined,
    });
  };

  return (
    <div className="detail-body">
      <div className="detail-head">
        <button
          className="check"
          data-done={done}
          aria-label={done ? 'Reopen' : 'Complete'}
          onClick={onToggle}
        >
          <svg viewBox="0 0 14 14" aria-hidden="true">
            <polyline points="3,7.4 5.9,10.2 11,3.9" />
          </svg>
        </button>
        <textarea
          className="detail-title"
          value={title}
          rows={1}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      </div>

      <div className="detail-fields">
        <label className="detail-field">
          <span>Notes</span>
          <textarea
            className="detail-input detail-textarea"
            value={notes}
            rows={3}
            placeholder="—"
            onChange={(e) => setNotes(e.target.value)}
            onBlur={save}
          />
        </label>

        <label className="detail-field">
          <span>Project</span>
          <input
            className="detail-input"
            value={project}
            list="detail-projects"
            placeholder="None"
            onChange={(e) => setProject(e.target.value)}
            onBlur={save}
          />
          <datalist id="detail-projects">
            {vault.projects.map((p) => <option key={p.id} value={p.name} />)}
          </datalist>
        </label>

        <label className="detail-field">
          <span>Tags</span>
          <input
            className="detail-input"
            value={tags}
            placeholder="comma, separated"
            onChange={(e) => setTags(e.target.value)}
            onBlur={save}
          />
        </label>

        <label className="detail-field">
          <span>Due</span>
          <div className="detail-inline">
            <input
              className="detail-input"
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              onBlur={save}
            />
            {due && <span className="detail-hint">{relativeDue(due)}</span>}
          </div>
        </label>
      </div>

      {task.project && (
        <div className="detail-chips">
          <span
            className="chip"
            style={{ '--chip': projectColor(vault, task.project) } as React.CSSProperties}
          >
            <span className="chip-dot" />
            {task.project}
          </span>
          {task.tags.map((t) => <span key={t} className="chip chip-tag">{t}</span>)}
        </div>
      )}

      {isBug(task) && <BugPanel task={task} onPatch={onPatch} />}

      {task.originalInput && <div className="detail-raw">“{task.originalInput}”</div>}

      <div className="detail-foot">
        <button
          className="btn btn-danger"
          onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
        >
          {confirmDelete ? 'Really delete?' : 'Delete'}
        </button>
        <div style={{ flex: 1 }} />
        <span className="detail-hint">added {new Date(task.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

// ── Note ─────────────────────────────────────────────────────────────────────

export function NoteDetail({
  note,
  onPatch,
  onDelete,
}: {
  note: Note;
  onPatch: (patch: Partial<Note>) => void;
  onDelete: () => void;
}) {
  const [kind, setKind] = useState<NoteKind>(note.kind);
  const [title, setTitle] = useState(note.title);
  const [username, setUsername] = useState(note.username ?? '');
  const [secret, setSecret] = useState(note.secret ?? '');
  const [url, setUrl] = useState(note.url ?? '');
  const [body, setBody] = useState(note.body);
  const [reveal, setReveal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setKind(note.kind);
    setTitle(note.title);
    setUsername(note.username ?? '');
    setSecret(note.secret ?? '');
    setUrl(note.url ?? '');
    setBody(note.body);
    // A revealed secret must not stay revealed when the selection moves on.
    setReveal(false);
    setConfirmDelete(false);
  }, [note.id, note.kind, note.title, note.username, note.secret, note.url, note.body]);

  const save = (over: Partial<Note> = {}) => {
    const clean = title.trim();
    if (!clean) {
      setTitle(note.title);
      return;
    }
    onPatch({
      kind,
      title: clean,
      username: username.trim() || undefined,
      secret: secret.trim() || undefined,
      url: url.trim() || undefined,
      body: body.trim(),
      ...over,
    });
  };

  return (
    <div className="detail-body">
      <div className="detail-head">
        <span
          className="note-badge note-badge-lg"
          style={{ '--kind': NOTE_KIND_META[kind].color } as React.CSSProperties}
        >
          <NoteGlyph kind={kind} size={20} />
        </span>
        <textarea
          className="detail-title"
          value={title}
          rows={1}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => save()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      </div>

      <div className="kind-row" style={{ marginBottom: 14 }}>
        {NOTE_KINDS.map((k) => (
          <button
            key={k}
            className="kind-chip"
            aria-pressed={kind === k}
            style={{ '--kind': NOTE_KIND_META[k].color } as React.CSSProperties}
            onClick={() => {
              setKind(k);
              save({ kind: k });
            }}
          >
            <span className="kind-icon"><NoteGlyph kind={k} size={14} /></span>
            {NOTE_KIND_META[k].label}
          </button>
        ))}
      </div>

      <div className="detail-fields">
        {kind !== 'code' && (
          <Field
            label={kind === 'wifi' ? 'Router / band' : 'User name'}
            value={username}
            onChange={setUsername}
            onCommit={() => save()}
            copyable
          />
        )}

        <label className="detail-field">
          <span>{kind === 'code' ? 'Code' : 'Password'}</span>
          <div className="detail-inline">
            <input
              className="detail-input"
              type={reveal ? 'text' : 'password'}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              onBlur={() => save()}
            />
            <button className="secret-toggle" onClick={() => setReveal((r) => !r)}>
              {reveal ? 'Hide' : 'Show'}
            </button>
            {secret && <CopyButton value={secret} />}
          </div>
        </label>

        {kind === 'login' && (
          <Field label="Website" value={url} onChange={setUrl} onCommit={() => save()} copyable />
        )}

        <label className="detail-field">
          <span>Notes</span>
          <textarea
            className="detail-input detail-textarea"
            value={body}
            rows={3}
            placeholder="—"
            onChange={(e) => setBody(e.target.value)}
            onBlur={() => save()}
          />
        </label>
      </div>

      <div className="detail-foot">
        <button
          className="btn btn-danger"
          onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
        >
          {confirmDelete ? 'Really delete?' : 'Delete'}
        </button>
        <div style={{ flex: 1 }} />
        <span className="detail-hint">added {new Date(note.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  onCommit,
  copyable,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  copyable?: boolean;
}) {
  return (
    <label className="detail-field">
      <span>{label}</span>
      <div className="detail-inline">
        <input
          className="detail-input"
          value={value}
          placeholder="—"
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
        />
        {copyable && value && <CopyButton value={value} />}
      </div>
    </label>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <button
      className="secret-toggle"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          timer.current = window.setTimeout(() => setCopied(false), 1200);
        } catch {
          // Clipboard can be refused; the field is selectable either way.
        }
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}


// ── Bugs ─────────────────────────────────────────────────────────────────────

/**
 * The bug fields, and the only moves the rules allow from where it stands.
 *
 * The buttons are built from `moveBug` rather than hard-coded, so what the
 * screen offers and what the rules permit cannot drift apart — and when a move
 * is refused, the reason is shown rather than the button quietly doing nothing.
 */
function BugPanel({
  task,
  onPatch,
}: {
  task: Task;
  onPatch: (patch: Partial<Task>) => void;
}) {
  const [who, setWho] = useState('');
  const [build, setBuild] = useState(task.fixedIn ?? '');
  const [refused, setRefused] = useState<string | null>(null);

  const complaints = checkReport(task);

  const attempt = (to: Task['status']) => {
    const result = moveBug(task, { to, by: who.trim(), fixedIn: build.trim() });
    if (!result.ok) { setRefused(result.reason ?? 'Not allowed.'); return; }
    setRefused(null);
    const { id: _id, ...patch } = result.task!;
    onPatch(patch);
  };

  return (
    <div className="bug-panel">
      <div className="settings-heading">Bug</div>

      {complaints.length > 0 && (
        <div className="field-note" style={{ color: 'var(--orange)' }}>
          {complaints.map((c) => c.message).join(' ')}
        </div>
      )}

      <label className="detail-field">
        <span>Severity — how much damage, not how soon</span>
        <div className="kind-row">
          {SEVERITIES.map((sv: Severity) => (
            <button
              key={sv}
              className="kind-chip"
              aria-pressed={task.severity === sv}
              style={{ '--kind': 'var(--tint)' } as React.CSSProperties}
              onClick={() => onPatch({ severity: sv })}
            >
              {sv}
            </button>
          ))}
        </div>
      </label>

      <Field label="Screen" value={task.menu ?? ''} onChange={(v) => onPatch({ menu: v })}
        onCommit={() => {}} />

      <label className="detail-field">
        <span>Steps to reproduce</span>
        <textarea
          className="detail-input detail-textarea"
          rows={3}
          defaultValue={task.steps ?? ''}
          placeholder={'1. …\n2. …'}
          onBlur={(e) => onPatch({ steps: e.target.value.trim() || undefined })}
        />
      </label>

      <Field label="Expected instead" value={task.expected ?? ''}
        onChange={(v) => onPatch({ expected: v })} onCommit={() => {}} />
      <Field label="Browser / device / build" value={task.environment ?? ''}
        onChange={(v) => onPatch({ environment: v })} onCommit={() => {}} />
      <Field label="Evidence" value={task.evidenceUrl ?? ''}
        onChange={(v) => onPatch({ evidenceUrl: v })} onCommit={() => {}} />
      <Field label="Reported by" value={task.reportedBy ?? ''}
        onChange={(v) => onPatch({ reportedBy: v })} onCommit={() => {}} />

      <div className="settings-heading">Where it stands</div>

      <div className="settings-row">
        <span>Status</span><code>{task.status}</code>
      </div>
      {task.fixedIn && <div className="settings-row"><span>Fixed in</span><code>{task.fixedIn}</code></div>}
      {task.fixedBy && <div className="settings-row"><span>Fixed by</span><code>{task.fixedBy}</code></div>}
      {task.verifiedBy && <div className="settings-row"><span>Checked by</span><code>{task.verifiedBy}</code></div>}
      {task.reopenCount ? (
        <div className="settings-row"><span>Reopened</span><code>{task.reopenCount}×</code></div>
      ) : null}

      <label className="detail-field">
        <span>Your name</span>
        <input className="detail-input" value={who} placeholder="who is doing this"
          onChange={(e) => setWho(e.target.value)} />
      </label>

      {(task.status === 'todo' || task.status === 'doing') && (
        <label className="detail-field">
          <span>Build the fix went into</span>
          <input className="detail-input" value={build} placeholder="v2.4.1"
            onChange={(e) => setBuild(e.target.value)} />
        </label>
      )}

      <div className="detail-inline" style={{ flexWrap: 'wrap' }}>
        {task.status !== 'doing' && task.status !== 'fixed' && task.status !== 'done' && (
          <button className="btn" onClick={() => attempt('doing')}>Start</button>
        )}
        {(task.status === 'todo' || task.status === 'doing') && (
          <button className="btn" onClick={() => attempt('fixed')}>Mark fixed</button>
        )}
        {task.status === 'fixed' && (
          <button className="btn" onClick={() => attempt('done')}>I checked it — close</button>
        )}
        {(task.status === 'fixed' || task.status === 'done') && (
          <button className="btn" onClick={() => attempt('todo')}>Reopen</button>
        )}
      </div>

      {refused && <div className="field-note" style={{ color: 'var(--danger)' }}>{refused}</div>}
    </div>
  );
}
