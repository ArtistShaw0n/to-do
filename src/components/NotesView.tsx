import { useEffect, useMemo, useRef, useState } from 'react';
import { NOTE_KINDS, NOTE_KIND_META, type Note, type NoteKind } from '../lib/types';
import { searchNotes, sortNotes } from '../lib/vault';

/**
 * A credential store shaped after macOS Passwords: categories with counts, a
 * searchable list, and labelled fields you copy rather than select by hand.
 *
 * Passwords puts categories in a sidebar and details in a third column. At this
 * window width neither fits, so the categories become a row across the top and
 * the detail expands inside the card — the same information in one column.
 */

const KIND_ICON: Record<NoteKind, React.ReactNode> = {
  login: (
    <>
      <circle cx="8" cy="5.6" r="2.6" />
      <path d="M3.2 13.4a4.8 4.8 0 019.6 0" />
    </>
  ),
  wifi: (
    <>
      <path d="M2.2 6.2a9 9 0 0111.6 0M4.5 8.9a5.6 5.6 0 017 0" />
      <circle cx="8" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  code: (
    <>
      <rect x="3" y="7" width="10" height="7" rx="1.8" />
      <path d="M5.6 7V5.2a2.4 2.4 0 014.8 0V7" />
    </>
  ),
  other: (
    <>
      <path d="M4 2.6h8v10.8H4z" />
      <path d="M6 6h4M6 8.6h4" />
    </>
  ),
};

function KindGlyph({ kind }: { kind: NoteKind }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {KIND_ICON[kind]}
    </svg>
  );
}

interface Props {
  notes: Note[];
  editingId: string | null;
  onOpen: (id: string) => void;
  onClose: () => void;
  onPatch: (id: string, patch: Partial<Note>) => void;
  onDelete: (id: string) => void;
}

export function NotesView({ notes, editingId, onOpen, onClose, onPatch, onDelete }: Props) {
  const [kind, setKind] = useState<NoteKind | 'all'>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const map = { all: notes.length } as Record<string, number>;
    for (const k of NOTE_KINDS) map[k] = notes.filter((n) => n.kind === k).length;
    return map;
  }, [notes]);

  const shown = useMemo(() => {
    const scoped = kind === 'all' ? notes : notes.filter((n) => n.kind === kind);
    return sortNotes(searchNotes(scoped, query));
  }, [notes, kind, query]);

  // Categories that hold nothing are hidden — Passwords shows them, but with
  // four of them across a narrow row the empty ones are just noise.
  const visibleKinds = NOTE_KINDS.filter((k) => counts[k] > 0);

  return (
    <>
      <div className="note-toolbar" onClick={(e) => e.stopPropagation()}>
        <div className="kind-row">
          <button
            className="kind-chip"
            aria-pressed={kind === 'all'}
            onClick={() => setKind('all')}
          >
            All<span className="kind-count">{counts.all}</span>
          </button>
          {visibleKinds.map((k) => (
            <button
              key={k}
              className="kind-chip"
              aria-pressed={kind === k}
              style={{ '--kind': NOTE_KIND_META[k].color } as React.CSSProperties}
              onClick={() => setKind(k)}
            >
              <span className="kind-icon"><KindGlyph kind={k} /></span>
              {NOTE_KIND_META[k].plural}
              <span className="kind-count">{counts[k]}</span>
            </button>
          ))}
        </div>

        {notes.length > 3 && (
          <div className="note-search">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" aria-hidden="true">
              <circle cx="7.2" cy="7.2" r="4.4" /><path d="M10.5 10.5l3 3" />
            </svg>
            <input
              value={query}
              placeholder="Search"
              spellCheck={false}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur(); }
              }}
            />
          </div>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <div className="empty-mark">✎</div>
          <div className="empty-title">{query ? 'No matches' : 'Nothing here'}</div>
          <div>{query ? 'Try a different search.' : 'Things to look up, not to do.'}</div>
        </div>
      ) : (
        <div className="task-stack">
          {shown.map((note) =>
            editingId === note.id ? (
              <NoteEditor
                key={note.id}
                note={note}
                onPatch={(patch) => onPatch(note.id, patch)}
                onDelete={() => onDelete(note.id)}
                onClose={onClose}
              />
            ) : (
              <NoteCard key={note.id} note={note} onOpen={() => onOpen(note.id)} />
            ),
          )}
        </div>
      )}
    </>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

function NoteCard({ note, onOpen }: { note: Note; onOpen: () => void }) {
  const meta = NOTE_KIND_META[note.kind];
  // What to show under the title: whoever the secret belongs to, else the note.
  const subtitle = note.username || note.url || note.body.split('\n')[0];

  return (
    <div
      className="note"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <span className="note-badge" style={{ '--kind': meta.color } as React.CSSProperties}>
        <KindGlyph kind={note.kind} />
      </span>

      <div className="note-main">
        <div className="note-title">{note.title}</div>
        {subtitle && <div className="note-sub">{subtitle}</div>}
      </div>

      {note.secret && <CopyButton value={note.secret} label={`Copy ${note.title}`} />}
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className="note-copy"
      aria-label={label}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        } catch {
          // Clipboard access can be refused; the value is selectable anyway.
        }
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// ── Editor ───────────────────────────────────────────────────────────────────

function NoteEditor({
  note,
  onPatch,
  onDelete,
  onClose,
}: {
  note: Note;
  onPatch: (patch: Partial<Note>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<NoteKind>(note.kind);
  const [title, setTitle] = useState(note.title);
  const [username, setUsername] = useState(note.username ?? '');
  const [secret, setSecret] = useState(note.secret ?? '');
  const [url, setUrl] = useState(note.url ?? '');
  const [body, setBody] = useState(note.body);
  const [reveal, setReveal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  const save = () => {
    const clean = title.trim();
    if (!clean) {
      onClose();
      return;
    }
    onPatch({
      kind,
      title: clean,
      username: username.trim() || undefined,
      secret: secret.trim() || undefined,
      url: url.trim() || undefined,
      body: body.trim(),
    });
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      save();
    }
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="note note-editing" onClick={(e) => e.stopPropagation()}>
      <div className="note-main">
        <div className="kind-row" style={{ marginBottom: 10 }}>
          {NOTE_KINDS.map((k) => (
            <button
              key={k}
              className="kind-chip"
              aria-pressed={kind === k}
              style={{ '--kind': NOTE_KIND_META[k].color } as React.CSSProperties}
              onClick={() => setKind(k)}
            >
              <span className="kind-icon"><KindGlyph kind={k} /></span>
              {NOTE_KIND_META[k].label}
            </button>
          ))}
        </div>

        <div className="edit-grid">
          <label className="edit-field edit-field-wide">
            <span>{kind === 'wifi' ? 'Network' : 'Title'}</span>
            <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={onKey} />
          </label>

          {kind !== 'code' && (
            <label className="edit-field edit-field-wide">
              <span>{kind === 'wifi' ? 'Router / band' : 'User name'}</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={onKey} />
            </label>
          )}

          <label className="edit-field edit-field-wide">
            <span>{kind === 'code' ? 'Code' : 'Password'}</span>
            <div className="secret-row">
              <input
                type={reveal ? 'text' : 'password'}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                onKeyDown={onKey}
              />
              <button
                className="secret-toggle"
                aria-label={reveal ? 'Hide' : 'Reveal'}
                onClick={() => setReveal((r) => !r)}
              >
                {reveal ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          {kind === 'login' && (
            <label className="edit-field edit-field-wide">
              <span>Website</span>
              <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={onKey} />
            </label>
          )}
        </div>

        <textarea
          className="edit-notes"
          value={body}
          rows={2}
          placeholder="Notes…"
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              save();
            }
            if (e.key === 'Escape') onClose();
          }}
        />

        <div className="edit-actions">
          <button
            className="btn btn-danger"
            onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
          >
            {confirmDelete ? 'Really delete?' : 'Delete'}
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
