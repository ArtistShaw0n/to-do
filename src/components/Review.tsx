import type { Task, Vault } from '../lib/types';
import { NO_PROJECT, weekReview } from '../lib/views';
import { projectColor } from '../lib/vault';
import { relativeDue } from '../lib/dates';

/**
 * The week, read in one screen.
 *
 * A list that fills itself from Claude Code sessions needs a place where the
 * pattern shows: how much got finished, where it went, and what has been sitting
 * untouched. The daily brief answers "what now"; this answers "how did the week
 * go, and what is quietly rotting".
 */
export function Review({ vault, onOpen }: { vault: Vault; onOpen: (task: Task) => void }) {
  const w = weekReview(vault);
  const peak = Math.max(1, ...w.byDay.map((d) => d.count));
  const topProject = Math.max(1, ...w.byProject.map((p) => p.count));

  return (
    <div className="week">
      <div className="week-stats">
        <Stat label="Finished" value={w.finished.length} />
        <Stat label="Added" value={w.added} />
        <Stat label="Open" value={w.open} />
        <Stat label="Overdue" value={w.overdue.length} tone={w.overdue.length ? 'danger' : undefined} />
        <Stat label="In Inbox" value={w.inbox} tone={w.inbox ? 'info' : undefined} />
      </div>

      <section className="week-section">
        <h2 className="week-heading">Finished each day</h2>
        <div className="week-bars" role="img" aria-label="Tasks finished on each of the last seven days">
          {w.byDay.map((d) => (
            <div className="week-bar" key={d.day}>
              <span className="week-bar-n">{d.count || ''}</span>
              <span className="week-bar-track">
                <span className="week-bar-fill" style={{ height: `${(d.count / peak) * 100}%` }} />
              </span>
              <span className="week-bar-day">
                {new Date(`${d.day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}
              </span>
            </div>
          ))}
        </div>
      </section>

      {w.byProject.length > 0 && (
        <section className="week-section">
          <h2 className="week-heading">Where it went</h2>
          <div className="week-meters">
            {w.byProject.map((p) => (
              <div
                className="week-row"
                key={p.project}
                style={{ '--chip': p.project === NO_PROJECT ? 'var(--text-3)' : projectColor(vault, p.project) } as React.CSSProperties}
              >
                <span className="chip">
                  <span className="chip-dot" />{p.project}
                </span>
                <span className="week-meter">
                  <span style={{ width: `${(p.count / topProject) * 100}%` }} />
                </span>
                <span className="week-count">{p.count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {w.overdue.length > 0 && (
        <TaskList title="Overdue" tasks={w.overdue} onOpen={onOpen}
          side={(t) => <span className="week-late">{relativeDue(t.due)}</span>} />
      )}

      {w.stuck.length > 0 && (
        <TaskList title="Untouched for two weeks or more" tasks={w.stuck} onOpen={onOpen}
          side={(t) => (
            <span className="week-side">
              {new Date(t.updatedAt || t.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
            </span>
          )} />
      )}

      {w.finished.length === 0 && w.overdue.length === 0 && w.stuck.length === 0 && (
        <div className="empty">
          <div className="empty-title">A quiet week</div>
          <div>Nothing finished, nothing overdue, nothing forgotten.</div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'danger' | 'info' }) {
  return (
    <div className="week-stat" data-tone={tone}>
      <span className="week-stat-value">{value}</span>
      <span className="week-stat-label">{label}</span>
    </div>
  );
}

function TaskList({ title, tasks, onOpen, side }: {
  title: string; tasks: Task[]; onOpen: (t: Task) => void; side: (t: Task) => React.ReactNode;
}) {
  return (
    <section className="week-section">
      <h2 className="week-heading">{title}</h2>
      {tasks.map((t) => (
        <button className="week-task" key={t.id} onClick={() => onOpen(t)}>
          <span className="week-task-title">{t.title}</span>
          {side(t)}
        </button>
      ))}
    </section>
  );
}
