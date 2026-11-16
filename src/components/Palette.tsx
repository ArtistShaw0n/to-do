import { useEffect, useMemo, useRef, useState } from 'react';
import type { Task } from '../lib/types';

export interface Command {
  id: string;
  label: string;
  /** A shortcut or a word of context, shown at the right. */
  hint?: string;
  run: () => void;
}

/**
 * ⌘K — everything by keyboard.
 *
 * The apps people call fast are fast because the mouse is optional: one key
 * opens a box, a few letters find the command or the task, Enter does it. With
 * fourteen hundred tasks, scrolling to one is not a way to find it.
 */
export function Palette({ commands, tasks, onPickTask, onClose }: {
  commands: Command[];
  tasks: Task[];
  onPickTask: (task: Task) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => { input.current?.focus(); }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cmds = commands.filter((c) => !q || c.label.toLowerCase().includes(q));
    const found = q.length < 2 ? [] : tasks
      .filter((t) => t.title.toLowerCase().includes(q) || (t.project ?? '').toLowerCase() === q)
      .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done')
        || (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
      .slice(0, 12);
    return [
      ...cmds.map((c) => ({ key: `c:${c.id}`, kind: 'command' as const, command: c })),
      ...found.map((t) => ({ key: `t:${t.id}`, kind: 'task' as const, task: t })),
    ];
  }, [query, commands, tasks]);

  useEffect(() => { setIndex(0); }, [query]);
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  const choose = (i: number) => {
    const row = rows[i];
    if (!row) return;
    onClose();
    if (row.kind === 'command') row.command.run();
    else onPickTask(row.task);
  };

  return (
    <div className="palette-veil" onClick={onClose}>
      <div className="palette" role="dialog" aria-label="Command palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={input}
          className="palette-input"
          value={query}
          placeholder="Type a command, or search tasks…"
          spellCheck={false}
          autoCapitalize="off"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(rows.length - 1, i + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
            else if (e.key === 'Enter') { e.preventDefault(); choose(index); }
            else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
          }}
        />
        <div className="palette-list" ref={list} role="listbox">
          {rows.length === 0 && <div className="palette-empty">Nothing matches</div>}
          {rows.map((row, i) => (
            <button
              key={row.key}
              className="palette-row"
              role="option"
              aria-selected={i === index}
              onMouseEnter={() => setIndex(i)}
              onClick={() => choose(i)}
            >
              {row.kind === 'command' ? (
                <>
                  <span className="palette-label">{row.command.label}</span>
                  {row.command.hint && <span className="palette-hint">{row.command.hint}</span>}
                </>
              ) : (
                <>
                  <span className="palette-label" data-done={row.task.status === 'done' || undefined}>
                    {row.task.title}
                  </span>
                  <span className="palette-hint">
                    {row.task.status === 'inbox' ? 'Inbox' : row.task.status === 'done' ? 'Done' : row.task.project ?? ''}
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
        <div className="palette-foot">↑↓ to move · ↵ to choose · esc to close</div>
      </div>
    </div>
  );
}
