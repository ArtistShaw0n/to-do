import { useEffect, useMemo, useState } from 'react';
import { NOTE_KIND_META, type Note, type Task } from './lib/types';
import { isOverdue, relativeDue } from './lib/dates';
import {
  addNote, addTask, deleteNote, deleteTask, isOpen, projectColor,
  searchNotes, sortNotes, sortTasks, toggleDone, updateNote, updateTask,
} from './lib/vault';
import { useVault } from './lib/useVault';
import { EmptyDetail, NoteDetail, TaskDetail } from './components/DetailPane';
import {
  CheckGlyph, NoteGlyph, PlusGlyph, SearchGlyph, SortGlyph, ViewGlyph,
  type ViewGlyphName,
} from './components/glyphs';

type ThemeMode = 'system' | 'light' | 'dark';
const THEME_ORDER: ThemeMode[] = ['system', 'light', 'dark'];

type View = 'all' | 'personal' | 'bugs' | 'notes' | 'done';

/** The project the Personal category filters to. */
const PERSONAL = 'Personal';

const CATEGORIES: { view: View; label: string; glyph: ViewGlyphName; color: string }[] = [
  { view: 'all', label: 'All', glyph: 'all', color: 'var(--blue)' },
  { view: 'personal', label: 'Personal', glyph: 'personal', color: 'var(--green)' },
  { view: 'bugs', label: 'Bugs', glyph: 'bugs', color: 'var(--pink)' },
  { view: 'notes', label: 'Notes', glyph: 'notes', color: 'var(--orange)' },
  { view: 'done', label: 'Done', glyph: 'done', color: 'var(--text-3)' },
];

export default function App() {
  const { vault, error, mutate } = useVault();
  const [view, setView] = useState<View>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [newest, setNewest] = useState(true);
  const [update, setUpdate] = useState<{ version: string; install: () => Promise<void> } | null>(null);

  const [theme, setTheme] = useState<ThemeMode>(
    () => (localStorage.getItem('todo.theme') as ThemeMode) ?? 'system',
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    localStorage.setItem('todo.theme', theme);

    // The NSVisualEffectView behind the webview follows the *window's*
    // appearance, not our CSS. Without this, choosing Light while macOS is in
    // Dark leaves light content sitting on dark system material.
    if ('__TAURI_INTERNALS__' in window) {
      void import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        void getCurrentWindow().setTheme(theme === 'system' ? null : theme);
      });
    }
  }, [theme]);

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;
    let cancelled = false;

    void (async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const found = await check();
        if (!found || cancelled) return;
        setUpdate({
          version: found.version,
          install: async () => {
            await found.downloadAndInstall();
            const { relaunch } = await import('@tauri-apps/plugin-process');
            await relaunch();
          },
        });
      } catch {
        // Offline or no release yet — never block the app for this.
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(() => {
    if (!vault) return {} as Record<View, number>;
    const live = vault.tasks.filter(isOpen);
    return {
      all: live.length,
      personal: live.filter((t) => t.project === PERSONAL).length,
      bugs: live.filter((t) => t.tags.includes('bug')).length,
      notes: vault.notes.length,
      done: vault.tasks.filter((t) => !isOpen(t)).length,
    } as Record<View, number>;
  }, [vault]);

  /** The middle column's contents for the current category. */
  const items = useMemo<(Task | Note)[]>(() => {
    if (!vault) return [];

    if (view === 'notes') {
      const found = sortNotes(searchNotes(vault.notes, query));
      return newest ? found : [...found].reverse();
    }

    const live = vault.tasks.filter(isOpen);
    let scoped: Task[];
    switch (view) {
      case 'personal': scoped = live.filter((t) => t.project === PERSONAL); break;
      case 'bugs': scoped = live.filter((t) => t.tags.includes('bug')); break;
      case 'done': scoped = vault.tasks.filter((t) => !isOpen(t)); break;
      default: scoped = live;
    }

    const q = query.trim().toLowerCase();
    if (q) {
      scoped = scoped.filter((t) =>
        `${t.title} ${t.notes ?? ''} ${t.tags.join(' ')} ${t.project ?? ''}`
          .toLowerCase()
          .includes(q),
      );
    }

    const ordered = view === 'done'
      ? [...scoped].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
      : sortTasks(scoped);
    return newest ? ordered : [...ordered].reverse();
  }, [vault, view, query, newest]);

  const selected = useMemo(() => {
    if (!vault || !selectedId) return null;
    return (
      vault.notes.find((n) => n.id === selectedId)
      ?? vault.tasks.find((t) => t.id === selectedId)
      ?? null
    );
  }, [vault, selectedId]);

  // "+" creates an item that already belongs to the category you are in.
  const addHere = () => {
    if (view === 'notes') {
      void mutate((v) => addNote(v, { title: 'New note' }));
    } else {
      void mutate((v) => addTask(v, {
        title: 'New task',
        ...(view === 'personal' ? { project: PERSONAL } : {}),
        ...(view === 'bugs' ? { tags: ['bug'] } : {}),
      }));
    }
  };

  if (error && !vault) {
    return (
      <div className="detail-empty" style={{ height: '100%' }}>
        <div className="detail-empty-title">Could not open the vault</div>
        <div className="detail-empty-sub" style={{ maxWidth: 340 }}>{error}</div>
      </div>
    );
  }
  if (!vault) return <div style={{ height: '100%' }} />;

  const label = CATEGORIES.find((c) => c.view === view)?.label ?? 'All';
  const themeLabel = theme === 'system' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark';

  return (
    <>
      <div className="aurora" aria-hidden="true">
        <span /><span /><span /><span />
      </div>

      <div className="shell">
        {/* Categories */}
        <aside className="sidebar" data-tauri-drag-region>
          <div className="tile-grid">
            {CATEGORIES.map((c) => (
              <button
                key={c.view}
                className="tile"
                aria-current={view === c.view}
                style={{ '--tile': c.color } as React.CSSProperties}
                onClick={() => {
                  setView(c.view);
                  setSelectedId(null);
                  setQuery('');
                }}
              >
                <span className="tile-top">
                  <span className="tile-icon"><ViewGlyph name={c.glyph} size={15} /></span>
                  <span className="tile-count">{counts[c.view] ?? 0}</span>
                </span>
                <span className="tile-label">{c.label}</span>
              </button>
            ))}
          </div>

          <div className="sidebar-foot">
            <button
              className="theme-btn"
              title={`Appearance: ${themeLabel}`}
              aria-label={`Appearance: ${themeLabel}. Click to change.`}
              onClick={() =>
                setTheme((t) => THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length])
              }
            >
              {theme === 'light' ? (
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="8" cy="8" r="3.1" />
                  <path d="M8 1.4v1.5M8 13.1v1.5M1.4 8h1.5M13.1 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" />
                </svg>
              ) : theme === 'dark' ? (
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M13.2 9.6A5.8 5.8 0 016.4 2.8a5.9 5.9 0 106.8 6.8z" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="8" cy="8" r="6.1" />
                  <path d="M8 1.9a6.1 6.1 0 000 12.2z" fill="currentColor" stroke="none" />
                </svg>
              )}
            </button>
          </div>
        </aside>

        {/* List */}
        <section className="list-col">
          <header className="col-head" data-tauri-drag-region>
            <div className="col-title">
              {label}
              <span className="col-sub">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <button
              className="icon-btn"
              title={newest ? 'Newest first' : 'Oldest first'}
              aria-label={newest ? 'Newest first' : 'Oldest first'}
              onClick={() => setNewest((n) => !n)}
            >
              <SortGlyph />
            </button>
            <button className="icon-btn" title="Add" aria-label="Add" onClick={addHere}>
              <PlusGlyph />
            </button>
          </header>

          <div className="list-scroll">
            {items.length === 0 ? (
              <div className="list-empty">{query ? 'No matches' : 'Nothing here'}</div>
            ) : (
              items.map((item) =>
                'kind' in item ? (
                  <NoteListRow
                    key={item.id}
                    note={item}
                    selected={item.id === selectedId}
                    onSelect={() => setSelectedId(item.id)}
                  />
                ) : (
                  <TaskListRow
                    key={item.id}
                    task={item}
                    color={projectColor(vault, item.project)}
                    selected={item.id === selectedId}
                    onSelect={() => setSelectedId(item.id)}
                    onToggle={() => void mutate((v) => toggleDone(v, item.id))}
                  />
                ),
              )
            )}
          </div>
        </section>

        {/* Detail */}
        <section className="detail-col">
          <header className="col-head detail-head-bar" data-tauri-drag-region>
            <div className="search-field">
              <SearchGlyph />
              <input
                value={query}
                placeholder="Search"
                spellCheck={false}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setQuery('');
                    e.currentTarget.blur();
                  }
                }}
              />
            </div>
          </header>

          <div className="detail-scroll">
            {!selected ? (
              <EmptyDetail />
            ) : 'kind' in selected ? (
              <NoteDetail
                note={selected}
                onPatch={(patch) => void mutate((v) => updateNote(v, selected.id, patch))}
                onDelete={() => {
                  void mutate((v) => deleteNote(v, selected.id));
                  setSelectedId(null);
                }}
              />
            ) : (
              <TaskDetail
                task={selected}
                vault={vault}
                onPatch={(patch) => void mutate((v) => updateTask(v, selected.id, patch))}
                onToggle={() => void mutate((v) => toggleDone(v, selected.id))}
                onDelete={() => {
                  void mutate((v) => deleteTask(v, selected.id));
                  setSelectedId(null);
                }}
              />
            )}
          </div>
        </section>
      </div>

      {update && (
        <div className="toast">
          Version {update.version} available
          <button className="btn-update" onClick={() => void update.install()}>Update</button>
        </div>
      )}
    </>
  );
}

// List rows ──────────────────────────────────────────────────────────────────

function TaskListRow({
  task,
  color,
  selected,
  onSelect,
  onToggle,
}: {
  task: Task;
  color: string;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const done = task.status === 'done' || task.status === 'cancelled';
  const due = relativeDue(task.due);
  const late = !done && isOverdue(task.due);
  const subtitle = task.project ?? task.notes ?? '';

  return (
    <div className="row" data-selected={selected} data-done={done} onClick={onSelect}>
      <button
        className="check"
        data-done={done}
        aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        onClick={(e) => {
          e.stopPropagation(); // the row itself only selects
          onToggle();
        }}
      >
        <CheckGlyph />
      </button>

      <div className="row-main">
        <div className="row-title">{task.title}</div>
        <div className="row-sub">
          {task.project && <span className="row-dot" style={{ background: color }} />}
          <span className="row-sub-text">{subtitle}</span>
          {due && !done && <span className="row-due" data-late={late}>{due}</span>}
        </div>
      </div>
    </div>
  );
}

function NoteListRow({
  note,
  selected,
  onSelect,
}: {
  note: Note;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = NOTE_KIND_META[note.kind];
  const subtitle = note.username || note.url || note.body.split('\n')[0] || meta.label;

  return (
    <div className="row" data-selected={selected} onClick={onSelect}>
      <span className="note-badge" style={{ '--kind': meta.color } as React.CSSProperties}>
        <NoteGlyph kind={note.kind} size={15} />
      </span>
      <div className="row-main">
        <div className="row-title">{note.title}</div>
        <div className="row-sub"><span className="row-sub-text">{subtitle}</span></div>
      </div>
    </div>
  );
}
