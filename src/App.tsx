import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { NOTE_KIND_META, type Note, type Task } from './lib/types';
import { isOverdue, longDate, relativeDue, todayISO } from './lib/dates';
import {
  PERSONAL, addNote, addTask, deleteNote, deleteTask, groupByCategory, groupByModule,
  isOpen, newId, projectColor, searchNotes, searchTasks, sortNotes, sortTasks, toggleDone,
  updateNote, updateTask,
} from './lib/vault';
import {
  applyItems, buildPrompt, looksLikeSecret, noteFields, noteLocally, normaliseLocally,
  parseItems, parsePicture, taskFields,
  type NoteDraft, type TaskDraft, type ViewContext,
} from './lib/normalise';
import { useVault } from './lib/useVault';
import { NoteDetail, TaskDetail } from './components/DetailPane';
import {
  CheckGlyph, ImageGlyph, NoteGlyph, SearchGlyph, SendGlyph, ViewGlyph, type ViewGlyphName,
} from './components/glyphs';
import { SyncBadge, SyncSetup, hasSyncConfig } from './components/SyncSetup';
import { checkReport, isBug, sortBugs } from './lib/bugs';
import { Answer, Brief } from './components/Brief';
import {
  aiAsk, aiBrief, aiImage, aiNormalise, aiReady, describeAiError, prepareImage,
  refreshAiStatus, useAiStatus,
} from './lib/ai';
import { PictureReview } from './components/PictureReview';
import { briefDismissed, briefFor, dismissBrief } from './lib/digest';
import { NotesLock } from './components/NotesLock';
import {
  applySealed, encryptValue, hasLock, lockNotes, revealNotes, sealPending, unlockedSecrets,
} from './lib/lock';
import { Settings } from './components/Settings';

type ThemeMode = 'system' | 'light' | 'dark';
const THEME_ORDER: ThemeMode[] = ['system', 'light', 'dark'];

type View = 'all' | 'personal' | 'bugs' | 'notes' | 'done';

/** The project the Personal category filters to. */

const CATEGORIES: { view: View; label: string; glyph: ViewGlyphName; color: string }[] = [
  { view: 'all', label: 'All', glyph: 'all', color: 'var(--blue)' },
  { view: 'personal', label: 'Personal', glyph: 'personal', color: 'var(--green)' },
  { view: 'bugs', label: 'Bugs', glyph: 'bugs', color: 'var(--pink)' },
  { view: 'notes', label: 'Notes', glyph: 'notes', color: 'var(--orange)' },
  { view: 'done', label: 'Done', glyph: 'done', color: 'var(--text-3)' },
];

export default function App() {
  const { vault, error, sync, mutate } = useVault();

  // A Mac reads the hub from the config file the CLI writes. A phone has no
  // such file, so it has to be told once — and until it is, it has no vault to
  // show and nowhere to put anything typed into it.
  const inTauri = '__TAURI_INTERNALS__' in window;
  const [configured] = useState(() => inTauri || !!hasSyncConfig());
  const [showSettings, setShowSettings] = useState(false);

  // The day's brief, shown once until it is dismissed. Tomorrow's arrives on
  // its own because the dismissal records the date, not a flag.
  const [briefRead, setBriefRead] = useState(() => briefDismissed(todayISO()));
  const brief = vault ? briefFor(vault) : null;

  /**
   * Whether the hub can think. Asked once the hub is reachable and again each
   * time the window comes back to the front — a day's ceiling or a newly added
   * key can change while the app sits in the menu bar.
   */
  const ai = useAiStatus();
  const aiOn = !!ai?.configured && ai.used < ai.cap;
  useEffect(() => {
    if (sync !== 'online') return;
    void refreshAiStatus();
    const again = () => { if (document.visibilityState === 'visible') void refreshAiStatus(); };
    document.addEventListener('visibilitychange', again);
    return () => document.removeEventListener('visibilitychange', again);
  }, [sync]);

  /**
   * A question about the list, and the answer. Held here, not stored: it is a
   * reply to a moment, and tomorrow's list will answer differently.
   */
  const [answer, setAnswer] = useState<
    { question: string; text?: string; error?: string } | null
  >(null);

  const ask = async () => {
    const question = query.trim();
    if (!vault || question.length < 3) return;
    setAnswer({ question });
    try {
      setAnswer({ question, text: await aiAsk(question, vault) });
    } catch (err) {
      setAnswer({ question, error: describeAiError(err) });
    }
  };

  /**
   * A picture being turned into tasks: a line of progress while it is read,
   * then the reviewed list. Neither is stored — the tasks are written only when
   * the review is accepted.
   */
  const [reading, setReading] = useState<string | null>(null);
  const [picture, setPicture] = useState<{ items: TaskDraft[]; seen?: string; hint?: string } | null>(null);

  /** Today's brief, rewritten on request. It arrives through sync like any row. */
  const [refreshingBrief, setRefreshingBrief] = useState(false);
  const refreshBrief = async () => {
    setRefreshingBrief(true);
    try { await aiBrief(true); } catch { /* the old brief stays */ } finally { setRefreshingBrief(false); }
  };

  /**
   * No brief yet today and the hub can write one: ask for it. The hub's own
   * morning job normally got there first, so this is the case where it could
   * not — a new key, a day the job failed. Once per device per day, so a hub
   * that cannot answer is not asked on every focus.
   */
  const askedForBrief = useRef('');
  useEffect(() => {
    const day = todayISO();
    if (!vault || brief || !ai?.configured || askedForBrief.current === day) return;
    askedForBrief.current = day;
    void aiBrief(false).catch(() => { /* nothing to show is not a failure */ });
  }, [vault, brief, ai?.configured]);

  /**
   * The Notes key, in memory only.
   *
   * Never persisted anywhere: closing the window relocks, which is the whole
   * point — a lock that survives a restart is a lock that is never on.
   */
  const [lockKey, setLockKey] = useState<CryptoKey | null>(null);
  const [askingPin, setAskingPin] = useState(false);
  /** Notes with their secrets decrypted, for display only — never written back. */
  const [revealed, setRevealed] = useState<Note[] | null>(null);

  useEffect(() => {
    if (!vault || !lockKey) { setRevealed(null); return; }
    let cancelled = false;
    void revealNotes(vault.notes, lockKey).then((n) => { if (!cancelled) setRevealed(n); });
    return () => { cancelled = true; };
  }, [vault, lockKey]);

  /**
   * Seal whatever arrived readable.
   *
   * A PIN protects the notes that existed when it was set and the ones edited in
   * the app since. It did not protect a secret *born* plaintext afterwards — one
   * added through the CLI, one from an older copy of the app on another device —
   * which sat in the vault and on the hub as readable text until somebody
   * happened to edit it. With the key in hand, those are sealed the moment they
   * are seen. Without it they wait, and the next unlock does this.
   */
  useEffect(() => {
    if (!vault || !lockKey || !hasLock(vault) || !unlockedSecrets(vault.notes).length) return;
    let cancelled = false;
    void sealPending(vault.notes, lockKey).then((plan) => {
      if (cancelled || !plan.length) return;
      void mutate((v) => ({ ...v, notes: applySealed(v.notes, plan) }));
    });
    return () => { cancelled = true; };
  }, [vault, lockKey, mutate]);

  /**
   * A note typed while Notes is locked, waiting for the PIN.
   *
   * It cannot be saved yet: its secret would have to be written readable, on the
   * hub, until the next unlock. So it is held here — in memory only — while the
   * PIN is asked for, and written already sealed.
   */
  const [pendingNote, setPendingNote] = useState<{ id: string; note: NoteDraft } | null>(null);

  /**
   * Write a note, sealing its secret first when a PIN exists.
   *
   * The seal happens *before* the write, not after: sealing afterwards would
   * still put the readable value on the hub for the moment in between, which is
   * the thing the PIN is there to prevent. With no key to hand — Notes is locked
   * and the line was typed somewhere else — the PIN is asked for instead.
   */
  const saveNote = async (id: string, note: NoteDraft, key: CryptoKey | null = lockKey) => {
    const fields = noteFields(note);
    if (fields.secret && vault && hasLock(vault)) {
      if (!key) {
        setPendingNote({ id, note });
        setAskingPin(true);
        return;
      }
      fields.secret = await encryptValue(fields.secret, key);
    }
    await mutate((v) => addNote(v, { id, ...fields }));
  };
  const [view, setView] = useState<View>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  /** Tapping the open card closes it again; before this it re-opened itself. */
  const toggleOpen = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  /**
   * Long-press selection.
   *
   * Empty means normal browsing. Once anything is selected a tap picks and
   * unpicks rather than opening, which is how every list on a phone behaves.
   */
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const selecting = selected.size > 0;

  const toggleSelected = (id: string) => setSelected((cur) => {
    const next = new Set(cur);
    if (!next.delete(id)) next.add(id);
    return next;
  });

  const clearSelection = () => setSelected(new Set());

  /**
   * What was just deleted, and how to put it back.
   *
   * Deleting is the one action here with no natural way back, and selecting
   * several at once makes a slip expensive. The rows are kept whole rather than
   * their ids, so restoring returns exactly what was removed.
   */
  const [undo, setUndo] = useState<{ tasks: Task[]; notes: Note[] } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const rememberForUndo = (tasks: Task[], notes: Note[]) => {
    clearTimeout(undoTimer.current);
    setUndo({ tasks, notes });
    // Long enough to notice and reach for, short enough not to sit there.
    undoTimer.current = setTimeout(() => setUndo(null), 8000);
  };

  const removeIds = (ids: string[]) => {
    if (!vault) return;
    const tasks = vault.tasks.filter((t) => ids.includes(t.id));
    const notes = vault.notes.filter((n) => ids.includes(n.id));
    void mutate((v) => ids.reduce(
      (acc, id) => (v.notes.some((n) => n.id === id) ? deleteNote(acc, id) : deleteTask(acc, id)),
      v,
    ));
    rememberForUndo(tasks, notes);
    clearSelection();
    setOpenId(null);
  };

  const restore = () => {
    if (!undo) return;
    void mutate((v) => ({
      ...v,
      tasks: [...v.tasks, ...undo.tasks],
      notes: [...v.notes, ...undo.notes],
    }));
    clearTimeout(undoTimer.current);
    setUndo(null);
  };

  /** Free-text search over everything on screen. */
  const [query, setQuery] = useState('');
  const [update, setUpdate] = useState<{ version: string; install: () => Promise<void> } | null>(null);
  /** Tasks currently being rewritten by Claude. Deliberately not persisted:
      a task interrupted by a quit is simply left as it was typed. */
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

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

  /**
   * While an answer is showing, the text in the search box is a question, not a
   * filter. Applying it as both emptied the list under the very answer that
   * talks about it — "Nothing here", beneath a reply naming five tasks.
   */
  const asking = answer !== null;

  const items = useMemo<(Task | Note)[]>(() => {
    if (!vault) return [];
    const filter = asking ? '' : query;
    if (view === 'notes') {
      return sortNotes(searchNotes(revealed ?? vault.notes, filter));
    }

    const live = vault.tasks.filter(isOpen);
    const chosen = (() => {
      switch (view) {
        case 'personal': return sortTasks(live.filter((t) => t.project === PERSONAL));
        // Worst damage first, then urgency — the order someone works through
        // a bug list in, not the order the bugs arrived in.
        case 'bugs': return sortBugs(live.filter((t) => t.tags.includes('bug')));
        case 'done':
          return vault.tasks
            .filter((t) => !isOpen(t))
            .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
        default: return sortTasks(live);
      }
    })();

    return searchTasks(chosen, filter);
  }, [vault, view, query, revealed, asking]);

  /**
   * Two lists carry headings, for the same reason and by different axes.
   *
   * **Done** because nothing chose it — it is everything that ever finished, so
   * it splits the way the tiles split the vault. **Bugs** by module, because a
   * fix ships inside a module's release: twelve bugs across four modules is
   * four releases, and a flat list hides that.
   *
   * All and Personal stay flat. A tile already answered the question there, and
   * a second set of labels would only repeat it.
   */
  const groups = useMemo(() => {
    const flat = [{ key: 'flat', label: '', items, release: undefined as Task | undefined }];
    if (!vault || (view !== 'done' && view !== 'bugs')) return flat;

    // Only the notes view holds notes, and neither of these is it.
    const tasks = items as Task[];
    const found = view === 'done' ? groupByCategory(tasks) : groupByModule(vault, tasks);
    return found.map((g) => ({
      key: g.key,
      label: g.label,
      items: g.tasks as (Task | Note)[],
      release: g.release,
    }));
  }, [items, view, vault]);

  if (error && !vault) {
    return (
      <div className="empty" style={{ height: '100%' }}>
        <div className="empty-title">Could not open the vault</div>
        <div style={{ maxWidth: 340 }}>{error}</div>
      </div>
    );
  }
  if (!configured) return <SyncSetup onDone={() => window.location.reload()} />;
  if (showSettings) {
    return (
      <Settings
        sync={sync}
        theme={theme}
        onTheme={setTheme}
        onClose={() => setShowSettings(false)}
      />
    );
  }
  if (!vault) return <div style={{ height: '100%' }} />;

  const locked = view === 'notes' && hasLock(vault) && !lockKey;

  if (locked || askingPin) {
    return (
      <NotesLock
        config={vault.meta.lock ?? null}
        count={vault.notes.length}
        saving={pendingNote?.note.title}
        onCancel={() => { setAskingPin(false); setPendingNote(null); if (locked) setView('all'); }}
        onUnlocked={(key) => {
          setLockKey(key);
          setAskingPin(false);
          if (pendingNote) {
            const waiting = pendingNote;
            setPendingNote(null);
            void saveNote(waiting.id, waiting.note, key);
          }
        }}
        onCreated={(config, key) => {
          // Encrypt what is already there in the same write that records the
          // PIN — a gap between the two is a window with a lock and no key.
          void (async () => {
            const sealed = await lockNotes(vault.notes, key);
            await mutate((v) => ({ ...v, notes: sealed, meta: { ...v.meta, lock: config } }));
            setLockKey(key);
            setAskingPin(false);
          })();
        }}
      />
    );
  }


  const themeLabel = theme === 'system' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark';

  /** The open category as context for a task that does not say where it belongs. */
  const viewContext = (): ViewContext => ({
    ...(view === 'personal' ? { project: PERSONAL } : {}),
    ...(view === 'bugs' ? { tags: ['bug'] } : {}),
  });

  const readPicture = async (file: Blob, hint?: string) => {
    if (!vault) return;
    setReading('Reading the picture…');
    try {
      const image = await prepareImage(file);
      const text = await aiImage(image, vault, hint);

      // A picture with nothing in it is a valid answer, not a failure: the
      // reviewer says so — and says what the picture was — instead of an error
      // that sounds like something broke.
      const { items, seen } = parsePicture(text, normaliseLocally('', vault));
      setReading(null);
      setPicture({ items, seen, hint });
    } catch (err) {
      setReading(describeAiError(err));
      setTimeout(() => setReading(null), 6000);
    }
  };

  const addFromPicture = (items: TaskDraft[]) => {
    const ctx = viewContext();
    void mutate((v) => items.reduce((acc, item) => addTask(acc, {
      ...taskFields(item),
      project: ctx.project ?? item.project,
      tags: ctx.tags ? [...new Set([...item.tags, ...ctx.tags])] : item.tags,
    }), v));
    setPicture(null);
  };

  /**
   * Anything typed in belongs to the category that is open.
   *
   * Two passes. The local one runs now and its result goes straight into the
   * list, so what was typed is never held hostage to a subprocess. Claude then
   * replaces it properly — translated, with a project and notes. If Claude is
   * missing, logged out or slow, what was typed simply stays.
   */
  const add = (raw: string) => {
    const text = raw.trim();
    if (!text) return;

    const id = newId();

    // A line that states a passcode is reference material, not work — and it is
    // the one kind of line that is never shown to any model, here or on the hub.
    // The Notes PIN exists so that a secret is readable by nobody but the person
    // holding it; typing one into the composer and having it go to a model first
    // would undo that at the very door. So a note is made entirely on this
    // device, by `noteLocally`, which splits a value out of the title so that the
    // part the lock encrypts is the part that needs it.
    //
    // In the Notes view a line with a value in it is split the same way; a line
    // with none keeps exactly the words it was typed in, as there is nothing in
    // it to protect.
    if (view === 'notes' || looksLikeSecret(text)) {
      const local = noteLocally(text);
      const note: NoteDraft = looksLikeSecret(text) || local.secret
        ? local
        : { type: 'note', kind: 'other', title: text, body: '' };
      void saveNote(id, note);
      return;
    }

    // The open category is context in its own right: typing under Bugs means
    // this is a bug, even when the words never say so.
    const local = normaliseLocally(text, vault);
    const fromView = {
      ...(view === 'personal' && !local.project ? { project: PERSONAL } : {}),
      ...(view === 'bugs' && !local.tags.includes('bug')
        ? { tags: [...local.tags, 'bug'] } : {}),
    };

    // A device that can reach neither the hub's Claude nor one of its own says
    // so, and a Mac picks the task up later. Without this a task typed on a
    // phone with no signal would keep the wording it was typed in for good,
    // while the same words typed anywhere else came out translated.
    const canNormalise = inTauri || aiReady();

    void mutate((v) => addTask(v, {
      id, ...taskFields(local), ...fromView,
      ...(canNormalise ? {} : { needsNormalise: true }),
    }));
    if (canNormalise) void enrich(id, text, fromView);
  };

  /**
   * Hand the raw text to Claude and fold the better version back in.
   *
   * Two places can answer, tried in this order. The hub's API works from any
   * device and needs no Mac awake; Claude Code on this machine is the old path
   * and the fallback when the hub cannot — no key yet, today's ceiling spent,
   * no signal. Only tasks come here: a line that looks like a secret is handled
   * in `add` and never leaves the device.
   *
   * One typed line is not always one entry: it can be two tasks, or — when the
   * model reads a line the local check let through — a note rather than a task.
   * So the placeholder is reused only when the first item comes back as the
   * same kind of thing, and is otherwise dropped in favour of what Claude
   * actually found. Everything lands in one write.
   */
  const enrich = async (id: string, raw: string, fromView: ViewContext) => {
    setBusy((b) => new Set(b).add(id));
    try {
      let text: string | undefined;

      if (aiReady()) {
        try { text = await aiNormalise(raw, vault); } catch { /* the old path is next */ }
      }

      if (text === undefined && inTauri) {
        const { invoke } = await import('@tauri-apps/api/core');
        text = await invoke<string>('normalise_task', { prompt: buildPrompt(raw, vault) });
      }

      // Nowhere to run it from here after all. Flag the task for a device that
      // can, exactly as if this one had known from the start.
      if (text === undefined) {
        await mutate((v) => updateTask(v, id, { needsNormalise: true }));
        return;
      }

      const items = parseItems(text, raw, normaliseLocally(raw, vault));
      await mutate((v) => applyItems(v, id, 'task', items, fromView));
    } catch {
      // No CLI, a lapsed login, offline, a reply that was not JSON — every one
      // of these leaves a perfectly usable entry behind, so none is worth
      // interrupting the user over.
    } finally {
      setBusy((b) => {
        const next = new Set(b);
        next.delete(id);
        return next;
      });
    }
  };

  if (picture) {
    return (
      <PictureReview
        items={picture.items}
        seen={picture.seen}
        hint={picture.hint}
        onAdd={addFromPicture}
        onCancel={() => setPicture(null)}
      />
    );
  }

  return (
    <>
      <div className="aurora" aria-hidden="true">
        <span /><span /><span /><span />
      </div>

      <div className="drag-strip" data-tauri-drag-region />

      <main className="sheet">
        <SyncBadge state={sync} />
        <header className="sheet-head">
          <div>
            <h1 className="sheet-title">
              {CATEGORIES.find((c) => c.view === view)?.label ?? 'Tasks'}
            </h1>
            <p className="sheet-date">{longDate()}</p>
          </div>

          <div className="head-actions">
          <button
            className="theme-btn"
            title="Settings"
            aria-label="Settings"
            onClick={() => setShowSettings(true)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="2.4" />
              <path d="M8 1.6v1.7M8 12.7v1.7M14.4 8h-1.7M3.3 8H1.6M12.5 3.5l-1.2 1.2M4.7 11.3l-1.2 1.2M12.5 12.5l-1.2-1.2M4.7 4.7L3.5 3.5" />
            </svg>
          </button>

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

        </header>

        <div className="tile-row">
          {CATEGORIES.map((c) => (
            <button
              key={c.view}
              className="tile"
              aria-current={view === c.view}
              style={{ '--tile': c.color } as React.CSSProperties}
              onClick={() => {
                setView(c.view);
                setOpenId(null);
              }}
            >
              <span className="tile-top">
                <span className="tile-icon"><ViewGlyph name={c.glyph} size={14} /></span>
                <span className="tile-count">{counts[c.view] ?? 0}</span>
              </span>
              <span className="tile-label">{c.label}</span>
            </button>
          ))}
        </div>

        {view === 'all' && brief && !briefRead && !selecting && (
          <Brief
            digest={brief}
            onDismiss={() => { dismissBrief(brief.date); setBriefRead(true); }}
            onRefresh={aiOn ? () => void refreshBrief() : undefined}
            refreshing={refreshingBrief}
          />
        )}

        {view === 'notes' && !hasLock(vault) && vault.notes.length > 0 && (
          <button className="protect-row" onClick={() => setAskingPin(true)}>
            <span className="protect-mark" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="7" width="10" height="7" rx="1.8" />
                <path d="M5.6 7V5.2a2.4 2.4 0 014.8 0V7" />
              </svg>
            </span>
            <span>Protect these with a PIN — nothing is encrypted yet</span>
          </button>
        )}

        {view === 'notes' && lockKey && (
          <button className="protect-row" data-unlocked="true" onClick={() => setLockKey(null)}>
            <span className="protect-mark" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="7" width="10" height="7" rx="1.8" />
                <path d="M5.6 7V5.2a2.4 2.4 0 014.8 0V7" />
              </svg>
            </span>
            <span>Unlocked — lock again</span>
          </button>
        )}

        <div className="search-row">
          <span className="search-icon"><SearchGlyph /></span>
          <input
            className="search-input"
            value={query}
            placeholder={`Search ${view === 'notes' ? 'notes' : 'tasks'}…`}
            spellCheck={false}
            autoCapitalize="off"
            enterKeyHint="search"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQuery('');
              else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && aiOn && view !== 'notes') void ask();
            }}
          />
          {aiOn && view !== 'notes' && query.trim().length >= 3 && (
            <button
              className="search-ask"
              title="Ask Claude about your tasks (⌘↵)"
              disabled={!!answer && !answer.text && !answer.error}
              onClick={() => void ask()}
            >
              <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor"
                strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 1.8l1.4 3.8 3.8 1.4-3.8 1.4L8 12.2 6.6 8.4 2.8 7l3.8-1.4z" />
              </svg>
              Ask
            </button>
          )}
          {query && (
            <button className="search-clear" aria-label="Clear search" onClick={() => setQuery('')}>
              ×
            </button>
          )}
        </div>

        {answer && view !== 'notes' && (
          <Answer
            question={answer.question}
            text={answer.text}
            error={answer.error}
            onDismiss={() => setAnswer(null)}
          />
        )}

        {selecting && (
          <div className="select-bar">
            <span>{selected.size} selected</span>
            <div style={{ flex: 1 }} />
            <button className="btn" onClick={clearSelection}>Cancel</button>
            <button
              className="btn btn-danger"
              onClick={() => removeIds([...selected])}
            >
              Delete {selected.size}
            </button>
          </div>
        )}

        <div className="sheet-scroll" onClick={() => { setOpenId(null); clearSelection(); }}>
          {items.length === 0 ? (
            <div className="empty">
              <div className="empty-mark">✓</div>
              <div className="empty-title">Nothing here</div>
              <div>Add one below.</div>
            </div>
          ) : (
            <div className="card-stack">
              {groups.map((group) => (
                <Fragment key={group.key}>
                  {group.label && (
                    <div className="stack-heading">
                      <div className="stack-heading-row">
                        <span>{group.label}</span>
                        <span className="stack-count">{group.items.length}</span>
                      </div>
                      {group.release && (
                        <div className="stack-note">{group.release.title}</div>
                      )}
                    </div>
                  )}
                  {group.items.map((item) => ('kind' in item ? (
                    <NoteCard
                      key={item.id}
                      note={item}
                      open={openId === item.id}
                      selecting={selecting}
                      selected={selected.has(item.id)}
                      onPick={() => toggleSelected(item.id)}
                      onOpen={() => toggleOpen(item.id)}
                      onPatch={(patch) => void (async () => {
                        // Anything typed into a secret is encrypted before it is
                        // written, so plaintext never reaches the store or the hub.
                        const sealed = lockKey && patch.secret
                          ? { ...patch, secret: await encryptValue(patch.secret, lockKey) }
                          : patch;
                        await mutate((v) => updateNote(v, item.id, sealed));
                      })()}
                      onDelete={() => removeIds([item.id])}
                    />
                  ) : (
                    <TaskCard
                      key={item.id}
                      task={item}
                      vault={vault}
                      busy={busy.has(item.id)}
                      open={openId === item.id}
                      selecting={selecting}
                      selected={selected.has(item.id)}
                      onPick={() => toggleSelected(item.id)}
                      onOpen={() => toggleOpen(item.id)}
                      onToggle={() => void mutate((v) => toggleDone(v, item.id))}
                      onPatch={(patch) => void mutate((v) => updateTask(v, item.id, patch))}
                      onDelete={() => removeIds([item.id])}
                    />
                  )))}
                </Fragment>
              ))}
            </div>
          )}
        </div>

        {undo && (
          <div className="undo-bar">
            <span>
              {undo.tasks.length + undo.notes.length} deleted
            </span>
            <div style={{ flex: 1 }} />
            <button className="btn" onClick={restore}>Undo</button>
          </div>
        )}

        {reading && (
          <div className="undo-bar" role="status">
            <span>{reading}</span>
          </div>
        )}

        {view !== 'done' && (
          <Composer
            noun={view === 'notes' ? 'note' : 'task'}
            onAdd={add}
            // Pictures become tasks, so only where tasks are typed, and only
            // when the hub can read one.
            onImage={aiOn && view !== 'notes' ? (file, hint) => void readPicture(file, hint) : undefined}
            reading={reading === 'Reading the picture…'}
          />
        )}
      </main>

      {update && (
        <div className="toast">
          Version {update.version} available
          <button className="btn-update" onClick={() => void update.install()}>Update</button>
        </div>
      )}
    </>
  );
}

/**
 * Press and hold to start selecting.
 *
 * 450ms is the usual threshold: long enough that a scroll flick does not fire
 * it, short enough not to feel stuck. Any movement cancels, since a drag on a
 * list is a scroll, not a press.
 */
function useLongPress(onLongPress: () => void, onTap: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fired = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const cancel = () => {
    clearTimeout(timer.current);
    start.current = null;
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        cancel();
        onLongPress();
      }, 450);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!start.current) return;
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      // The click that follows a long press must not also count as a tap.
      if (fired.current) { fired.current = false; return; }
      onTap();
    },
  };
}

// Cards ──────────────────────────────────────────────────────────────────────

function TaskCard({
  task, vault, busy, open, selecting, selected, onPick, onOpen, onToggle, onPatch, onDelete,
}: {
  task: Task;
  vault: Parameters<typeof TaskDetail>[0]['vault'];
  busy: boolean;
  open: boolean;
  selecting: boolean;
  selected: boolean;
  onPick: () => void;
  onOpen: () => void;
  onToggle: () => void;
  onPatch: (patch: Partial<Task>) => void;
  onDelete: () => void;
}) {
  const done = task.status === 'done' || task.status === 'cancelled';
  const bug = isBug(task);
  // A fixed bug is not a finished one — it is waiting for somebody to check it,
  // and that queue is the one that silently goes stale.
  const awaiting = bug && task.status === 'fixed';
  // Named for someone else and missing what they would need to reproduce it.
  const unworkable = bug && !done && checkReport(task).length > 0;
  // While anything is selected, a tap picks rather than opens.
  const press = useLongPress(onPick, selecting ? onPick : onOpen);
  const due = relativeDue(task.due);
  const late = !done && isOverdue(task.due);
  const color = projectColor(vault, task.project);

  return (
    <div
      className="card"
      data-open={open}
      data-done={done}
      data-busy={busy || undefined}
      data-selected={selected || undefined}
      {...press}
    >
      <div className="card-row">
        <button
          className="check"
          data-done={done}
          aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
          onClick={(e) => { e.stopPropagation(); selecting ? onPick() : onToggle(); }}
        >
          <CheckGlyph />
        </button>

        <div className="card-main">
          <div className="card-title">{task.title}</div>
          {awaiting && (
            <div className="card-state" data-kind="awaiting">
              Fixed in {task.fixedIn ?? '?'} — nobody has checked it yet
            </div>
          )}
          {unworkable && (
            <div className="card-state" data-kind="unworkable">
              {checkReport(task)[0].message}
            </div>
          )}
          {task.reopenCount ? (
            <div className="card-state" data-kind="reopened">
              Reopened {task.reopenCount}×
            </div>
          ) : null}
          {task.notes && !done && <div className="card-notes">{task.notes}</div>}
          {(task.project || task.tags.length > 0 || task.subtasks.length > 0) && !done && (
            <div className="card-meta">
              {task.project && (
                <span className="chip" style={{ '--chip': color } as React.CSSProperties}>
                  <span className="chip-dot" />{task.project}
                </span>
              )}
              {task.tags.map((t) => <span key={t} className="chip chip-tag">{t}</span>)}
              {task.subtasks.length > 0 && (
                <span className="chip chip-tag" title="Subtasks done">
                  {task.subtasks.filter((x) => x.done).length}/{task.subtasks.length} subtasks
                </span>
              )}
            </div>
          )}
        </div>

        {bug && task.severity && !done && (
          <span className="sev" data-sev={task.severity}>{task.severity}</span>
        )}
        {due && !done && <span className="card-due" data-late={late}>{due}</span>}
      </div>

      {open && (
        <div className="card-open" onClick={(e) => e.stopPropagation()}>
          <TaskDetail task={task} vault={vault} onPatch={onPatch} onToggle={onToggle} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}

function NoteCard({
  note, open, selecting, selected, onPick, onOpen, onPatch, onDelete,
}: {
  note: Note;
  open: boolean;
  selecting: boolean;
  selected: boolean;
  onPick: () => void;
  onOpen: () => void;
  onPatch: (patch: Partial<Note>) => void;
  onDelete: () => void;
}) {
  const press = useLongPress(onPick, selecting ? onPick : onOpen);
  const meta = NOTE_KIND_META[note.kind];
  const subtitle = note.username || note.url || note.body.split('\n')[0] || meta.label;

  return (
    <div className="card" data-open={open} data-selected={selected || undefined} {...press}>
      <div className="card-row">
        <span className="note-badge" style={{ '--kind': meta.color } as React.CSSProperties}>
          <NoteGlyph kind={note.kind} size={15} />
        </span>
        <div className="card-main">
          <div className="card-title">{note.title}</div>
          <div className="card-notes">{subtitle}</div>
        </div>
      </div>

      {open && (
        <div className="card-open" onClick={(e) => e.stopPropagation()}>
          <NoteDetail note={note} onPatch={onPatch} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}

// Composer ───────────────────────────────────────────────────────────────────

function Composer({
  noun, onAdd, onImage, reading,
}: {
  noun: string;
  onAdd: (raw: string) => void;
  /** Present only when a picture can be turned into tasks. `hint` is what to look for in it. */
  onImage?: (file: Blob, hint?: string) => void;
  reading?: boolean;
}) {
  const [value, setValue] = useState('');
  const picker = useRef<HTMLInputElement>(null);

  // Whatever is typed when a picture arrives says what to look for in it — "the
  // bugs on this page" — and is spent doing so: left in the box it would be
  // added as a task of its own. A line that states a passcode is never shown to a
  // model, so it is not sent as a hint; the picture is read without it.
  const handOver = (file: Blob) => {
    const typed = value.trim();
    const hint = typed && !looksLikeSecret(typed) ? typed.slice(0, 200) : undefined;
    onImage?.(file, hint);
    if (hint) setValue('');
  };

  // Hands the line over verbatim. Pulling the date out here as well would mean
  // two different parsers disagreeing about the same sentence; `normaliseLocally`
  // owns that, and it reads the whole line rather than just the last two words.
  const submit = () => {
    if (!value.trim()) return;
    onAdd(value);
    setValue('');
  };

  return (
    <div className="composer" onClick={(e) => e.stopPropagation()}>
      <div className="composer-shell">
        <input
          value={value}
          placeholder={`Add a ${noun}…`}
          spellCheck={false}
          enterKeyHint="done"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); submit(); }
            else if (e.key === 'Escape') { setValue(''); e.currentTarget.blur(); }
          }}
          // A screenshot pasted straight in is the quickest way to hand one
          // over: ⌘⇧4, then ⌘V.
          onPaste={(e) => {
            const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'));
            if (file && onImage) { e.preventDefault(); handOver(file); }
          }}
        />
        {onImage && (
          <>
            <input
              ref={picker}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = ''; // so the same picture can be chosen twice
                if (file) handOver(file);
              }}
            />
            <button
              className="composer-send"
              aria-label="Add tasks from a picture"
              title="Add tasks from a screenshot or photo — type what to look for first, if you like"
              disabled={reading}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => picker.current?.click()}
            >
              <ImageGlyph />
            </button>
          </>
        )}
        <button
          className="composer-send"
          data-ready={value.trim().length > 0}
          disabled={!value.trim()}
          aria-label={`Add this ${noun}`}
          // The keyboard steals focus from the input on mousedown, which
          // closes it on a phone before the click ever lands.
          onMouseDown={(e) => e.preventDefault()}
          onClick={submit}
        >
          <SendGlyph />
        </button>
      </div>
    </div>
  );
}
