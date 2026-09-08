import { parseBrief, type Span } from '../lib/digest';
import type { Digest } from '../lib/types';

/**
 * The day's brief, above the list.
 *
 * It sits at the top of All only. It is a summary of everything, so it has no
 * business above a filtered view — and putting it on every screen would make
 * the thing you came to read the second thing on the page.
 */
export function Brief({ digest, onDismiss }: { digest: Digest; onDismiss: () => void }) {
  const blocks = parseBrief(digest.markdown);
  if (!blocks.length) return null;

  return (
    <section className="brief" aria-label="Today's brief">
      <div className="brief-head">
        <span className="brief-mark" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 1.9v2.4M8 11.7v2.4M1.9 8h2.4M11.7 8h2.4M3.7 3.7l1.7 1.7M10.6 10.6l1.7 1.7M12.3 3.7l-1.7 1.7M5.4 10.6l-1.7 1.7" />
            <circle cx="8" cy="8" r="2.2" />
          </svg>
        </span>
        <span className="brief-title">Today</span>
        <div style={{ flex: 1 }} />
        <button className="brief-close" aria-label="Dismiss today's brief" onClick={onDismiss}>
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
          </svg>
        </button>
      </div>

      <div className="brief-body">
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

function renderSpan(span: Span, i: number) {
  if (span.code) return <code key={i} className="brief-code">{span.text}</code>;
  if (span.bold) return <strong key={i}>{span.text}</strong>;
  return <span key={i}>{span.text}</span>;
}
