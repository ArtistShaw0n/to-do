import { useEffect, useRef, useState } from 'react';
import type { Note } from '../lib/types';

interface Props {
  note: Note;
  editing: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPatch: (patch: Partial<Note>) => void;
  onDelete: () => void;
}

/**
 * A note card. No checkbox and no completion — a PIN is never "done", so the
 * whole task vocabulary is absent here on purpose.
 */
export function NoteRow({ note, editing, onOpen, onClose, onPatch, onDelete }: Props) {
  const [copied, setCopied] = useState(false);

  if (editing) {
    return <NoteEditor note={note} onPatch={onPatch} onDelete={onDelete} onClose={onClose} />;
  }

  // The point of a note is to be read back and used, so copying is one click.
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(note.body || note.title);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard can be refused; the text is selectable either way.
    }
  };

  return (
    <div
      className="note"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <div className="note-main">
        <div className="note-title">{note.title}</div>
        {note.body && <div className="note-body">{note.body}</div>}
      </div>

      {note.body && (
        <button className="note-copy" onClick={copy} aria-label={`Copy ${note.title}`}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      )}
    </div>
  );
}

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
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.setSelectionRange(title.length, title.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = () => {
    const clean = title.trim();
    if (!clean) {
      onClose();
      return;
    }
    onPatch({ title: clean, body: body.trim() });
    onClose();
  };

  return (
    <div className="note note-editing" onClick={(e) => e.stopPropagation()}>
      <div className="note-main">
        <textarea
          ref={titleRef}
          className="autogrow edit-title"
          value={title}
          rows={1}
          placeholder="What is it?"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              save();
            }
            if (e.key === 'Escape') onClose();
          }}
        />

        <textarea
          className="autogrow edit-notes"
          value={body}
          rows={2}
          placeholder="The detail — PIN, password, number…"
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
