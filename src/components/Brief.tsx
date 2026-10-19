import { parseBrief, type Span } from '../lib/digest';
import type { Digest } from '../lib/types';

/**
 * A short piece of prose said *to* you, above the list — the day's brief, and
 * the answer to a question you asked about it.
 *
 * They share one card because they are the same kind of thing: something
 * written for you rather than another row to work through. Both go through the
 * same four-form markdown reader, which builds elements and never HTML, since
 * the text may have come from a model reading a vault four devices can write to.
 */
function Card({
  label, markdown, lead, notice, onDismiss, dismissLabel, children, busy,
}: {
  label: string;
  markdown?: string;
  /** A quiet line above the body — the question an answer belongs to. */
  lead?: string;
  /** Plain text in place of the body: a wait, or a failure. Never parsed. */
  notice?: { text: string; error?: boolean };
  onDismiss: () => void;
  dismissLabel: string;
  /** Extra controls for the header, left of the close button. */
  children?: React.ReactNode;
  busy?: boolean;
}) {
  const blocks = markdown ? parseBrief(markdown) : [];

  return (
    <section className="brief" aria-label={label} aria-busy={busy || undefined}>
      <div className="brief-head">
        <span className="brief-mark" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 1.9v2.4M8 11.7v2.4M1.9 8h2.4M11.7 8h2.4M3.7 3.7l1.7 1.7M10.6 10.6l1.7 1.7M12.3 3.7l-1.7 1.7M5.4 10.6l-1.7 1.7" />
            <circle cx="8" cy="8" r="2.2" />
          </svg>
        </span>
        <span className="brief-title">{label}</span>
        <div style={{ flex: 1 }} />
        {children}
        <button className="brief-close" aria-label={dismissLabel} onClick={onDismiss}>
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
          </svg>
        </button>
      </div>

      <div className="brief-body">
        {lead && <p className="brief-lead">{lead}</p>}
        {notice && (
          <p className="brief-notice" data-error={notice.error || undefined}>{notice.text}</p>
        )}
        {blocks.map((block, i) => (block.kind === 'paragraph' ? (
          <p key={i} className="brief-p">{block.spans.map(renderSpan)}</p>
        ) : (
          <ul key={i} className="brief-list">
            {block.items.map((spans, j) => <li key={j}>{spans.map(renderSpan)}</li>)}
          </ul>
        )))}
      </div>
    </section>
  );
}

/**
 * The day's brief. It sits at the top of All only: it is a summary of
 * everything, so it has no business above a filtered view — and putting it on
 * every screen would make the thing you came to read the second thing on the
 * page.
 */
export function Brief({
  digest, onDismiss, onRefresh, refreshing,
}: {
  digest: Digest;
  onDismiss: () => void;
  /** Present only when the hub can write one; absent means no button. */
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  if (!parseBrief(digest.markdown).length) return null;

  return (
    <Card
      label="Today"
      markdown={digest.markdown}
      onDismiss={onDismiss}
      dismissLabel="Dismiss today's brief"
      busy={refreshing}
    >
      {onRefresh && (
        <button
          className="brief-close"
          aria-label="Write today's brief again"
          title="Write it again"
          disabled={refreshing}
          onClick={onRefresh}
        >
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M13.2 8a5.2 5.2 0 11-1.6-3.7M13.4 2.4v2.6h-2.6" />
          </svg>
        </button>
      )}
    </Card>
  );
}

/**
 * The answer to a question about the list. Three states, because a reply takes
 * a few seconds and a silent gap reads as "nothing happened".
 */
export function Answer({
  question, text, error, onDismiss,
}: {
  question: string;
  text?: string;
  error?: string;
  onDismiss: () => void;
}) {
  return (
    <Card
      label="Answer"
      lead={`“${question}”`}
      markdown={error ? undefined : text}
      notice={error ? { text: error, error: true } : text ? undefined : { text: 'Thinking…' }}
      onDismiss={onDismiss}
      dismissLabel="Dismiss the answer"
      busy={!text && !error}
    />
  );
}

function renderSpan(span: Span, i: number) {
  if (span.code) return <code key={i} className="brief-code">{span.text}</code>;
  if (span.bold) return <strong key={i}>{span.text}</strong>;
  return <span key={i}>{span.text}</span>;
}
