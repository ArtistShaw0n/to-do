import { useEffect, useMemo, useState } from 'react';
import { longDate } from './lib/dates';
import {
  addTask, deleteTask, groupBugsByModule, isOpen, sortTasks, toggleDone, updateTask,
} from './lib/vault';
import { useVault } from './lib/useVault';
import { TaskRow } from './components/TaskRow';
import { Composer } from './components/Composer';

/** Keep the completed list from growing without bound in the UI. */
const RECENT_DONE = 50;

type ThemeMode = 'system' | 'light' | 'dark';
const THEME_ORDER: ThemeMode[] = ['system', 'light', 'dark'];

type View = 'all' | 'bugs';

export default function App() {
  const { vault, error, mutate } = useVault();
  const [view, setView] = useState<View>('all');
  const [showDone, setShowDone] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
    // Dark leaves light cards floating on dark system material — the CSS and
    // the vibrancy disagree and the result looks broken.
    if ('__TAURI_INTERNALS__' in window) {
      void import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        void getCurrentWindow().setTheme(theme === 'system' ? null : theme);
      });
    }
  }, [theme]);

  // Auto-update stays — invisible until there is actually a new version.
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

    return () => {
      cancelled = true;
    };
  }, []);

  const open = useMemo(() => (vault ? sortTasks(vault.tasks.filter(isOpen)) : []), [vault]);
  const bugGroups = useMemo(() => (vault ? groupBugsByModule(vault) : []), [vault]);
  const openBugCount = useMemo(
    () => bugGroups.reduce((n, g) => n + g.bugs.length, 0),
    [bugGroups],
  );

  const done = useMemo(() => {
    if (!vault) return [];
    const finished = vault.tasks
      .filter((t) => !isOpen(t))
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
    // The Completed section belongs to whichever view you're in.
    return (view === 'bugs' ? finished.filter((t) => t.tags.includes('bug')) : finished)
      .slice(0, RECENT_DONE);
  }, [vault, view]);

  if (error && !vault) {
    return (
      <div className="empty" style={{ height: '100%' }}>
        <div className="empty-mark">⚠</div>
        <div className="empty-title">Could not open the vault</div>
        <div style={{ maxWidth: 320 }}>{error}</div>
      </div>
    );
  }

  if (!vault) return <div className="empty" style={{ height: '100%' }} />;

  const rowProps = (id: string) => ({
    vault,
    editing: editingId === id,
    onToggle: () => void mutate((v) => toggleDone(v, id)),
    onOpen: () => setEditingId(id),
    onClose: () => setEditingId(null),
    onPatch: (patch: Parameters<typeof updateTask>[2]) => void mutate((v) => updateTask(v, id, patch)),
    onDelete: () => {
      void mutate((v) => deleteTask(v, id));
      setEditingId(null);
    },
  });

  const themeLabel = theme === 'system' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark';

  return (
    <>
      <div className="aurora" aria-hidden="true">
        <span /><span /><span /><span />
      </div>

      <div className="drag-strip" data-tauri-drag-region />

      <main className="sheet">
        <header className="sheet-head">
          <div>
            <h1 className="sheet-title">{view === 'bugs' ? 'Bugs' : 'Tasks'}</h1>
            <p className="sheet-date">{longDate()}</p>
          </div>

          <div className="head-controls">
            <div className="view-seg" role="tablist">
              <button
                role="tab"
                aria-selected={view === 'all'}
                onClick={() => {
                  setView('all');
                  setEditingId(null);
                }}
              >
                All
              </button>
              <button
                role="tab"
                aria-selected={view === 'bugs'}
                onClick={() => {
                  setView('bugs');
                  setEditingId(null);
                }}
              >
                Bugs
                {openBugCount > 0 && <span className="seg-count">{openBugCount}</span>}
              </button>
            </div>

            <button
              className="theme-btn"
              title={`Appearance: ${themeLabel}`}
              aria-label={`Appearance: ${themeLabel}. Click to change.`}
              onClick={() => setTheme((t) => THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length])}
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
        </header>

        <div className="sheet-scroll" onClick={() => setEditingId(null)}>
          {view === 'all' ? (
            open.length === 0 ? (
              <div className="empty">
                <div className="empty-mark">✓</div>
                <div className="empty-title">All clear</div>
                <div>Add one below.</div>
              </div>
            ) : (
              <div className="task-stack">
                {open.map((task) => (
                  <TaskRow key={task.id} task={task} {...rowProps(task.id)} />
                ))}
              </div>
            )
          ) : bugGroups.length === 0 ? (
            <div className="empty">
              <div className="empty-mark">✓</div>
              <div className="empty-title">No open bugs</div>
              <div>Tag a task `bug` plus its module to file one here.</div>
            </div>
          ) : (
            bugGroups.map((group) => (
              <section key={group.module} className="bug-group">
                <div className="bug-group-head">
                  <span className="bug-module">{group.module}</span>
                  <span className="bug-count">
                    {group.bugs.length} {group.bugs.length === 1 ? 'bug' : 'bugs'}
                  </span>
                </div>

                {/* What these fixes are heading into. */}
                {group.release && (
                  <button
                    className="bug-release"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(group.release!.id);
                    }}
                  >
                    ↳ {group.release.title}
                  </button>
                )}

                <div className="task-stack">
                  {group.bugs.map((task) => (
                    <TaskRow key={task.id} task={task} {...rowProps(task.id)} />
                  ))}
                </div>
              </section>
            ))
          )}

          {done.length > 0 && (
            <>
              <button
                className="done-toggle"
                aria-expanded={showDone}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDone((s) => !s);
                }}
              >
                <span className="done-caret">▶</span>
                {view === 'bugs' ? 'Fixed' : 'Completed'}
                <span className="done-count">{done.length}</span>
              </button>

              {showDone && (
                <div className="task-stack">
                  {done.map((task) => (
                    <TaskRow key={task.id} task={task} {...rowProps(task.id)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <Composer
          projects={vault.projects.map((p) => p.name)}
          // Anything added from the Bugs view is a bug; the placeholder says so
          // rather than tagging silently.
          forceTags={view === 'bugs' ? ['bug'] : undefined}
          onAdd={(draft) => void mutate((v) => addTask(v, draft))}
        />
      </main>

      {update && (
        <div className="toast">
          Version {update.version} available
          <button className="btn-update" onClick={() => void update.install()}>
            Update
          </button>
        </div>
      )}
    </>
  );
}
