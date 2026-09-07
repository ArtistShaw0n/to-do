import { useEffect, useRef, useState } from 'react';
import { NOTE_KINDS, NOTE_KIND_META, type Note, type NoteKind, type Task, type Vault } from '../lib/types';
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
