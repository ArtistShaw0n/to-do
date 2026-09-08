/**
 * The daily brief, and the small amount of markdown it is allowed.
 *
 * Shawon asked for "everyday ekta shundor update" on the first day. Claude has
 * been able to write one into the vault for months; nothing ever showed it, so
 * it was a promise kept in a file nobody opened.
 *
 * The markdown is parsed into React elements rather than an HTML string. The
 * text comes out of a vault that four devices and a CLI can write to — it is
 * content, not markup, and building HTML from it would make every writer of a
 * task a writer of this page.
 */

import type { Digest, Vault } from './types';
import { todayISO } from './dates';

export function briefFor(vault: Vault, date = todayISO()): Digest | null {
  return vault.digests.find((d) => d.date === date) ?? null;
}

/** A run of text: plain, bold, or code. */
export interface Span {
  text: string;
  bold?: boolean;
  code?: boolean;
}

export type Block =
  | { kind: 'paragraph'; spans: Span[] }
  | { kind: 'bullets'; items: Span[][] };

/**
 * Split one line into spans of plain, `code` and **bold**.
 *
 * Code is matched first: a backtick run should stay literal even when it holds
 * asterisks, which is exactly what a task id or a CLI flag can contain.
 */
function spansOf(line: string): Span[] {
  const out: Span[] = [];
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*/g;
  let at = 0;

  for (const m of line.matchAll(pattern)) {
    const start = m.index ?? 0;
    if (start > at) out.push({ text: line.slice(at, start) });
    if (m[1] !== undefined) out.push({ text: m[1], code: true });
    else out.push({ text: m[2], bold: true });
    at = start + m[0].length;
  }

  if (at < line.length) out.push({ text: line.slice(at) });
  return out.length ? out : [{ text: line }];
}

/**
 * Paragraphs and bullet lists — the whole grammar, matching what CLAUDE.md
 * promises Claude may write. Anything else stays literal text rather than
 * being silently dropped, so a heading written by mistake is visible as a
 * mistake instead of vanishing.
 */
export function parseBrief(markdown: string): Block[] {
  const blocks: Block[] = [];
  let bullets: Span[][] | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ kind: 'paragraph', spans: spansOf(paragraph.join(' ')) });
    paragraph = [];
  };
  const flushBullets = () => {
    if (!bullets?.length) return;
    blocks.push({ kind: 'bullets', items: bullets });
    bullets = null;
  };

  for (const raw of markdown.split('\n')) {
    const line = raw.trim();

    if (!line) { flushParagraph(); flushBullets(); continue; }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      bullets ??= [];
      bullets.push(spansOf(bullet[1]));
      continue;
    }

    flushBullets();
    paragraph.push(line);
  }

  flushParagraph();
  flushBullets();
  return blocks;
}

// ── Dismissal ────────────────────────────────────────────────────────────────

const KEY = 'todo.briefRead';

/**
 * A brief is dismissed for its own day, not forever.
 *
 * Storing the date rather than a flag means tomorrow's arrives on its own
 * without anything having to clear yesterday's.
 */
export function briefDismissed(date: string): boolean {
  try {
    return localStorage.getItem(KEY) === date;
  } catch {
    return false;
  }
}

export function dismissBrief(date: string): void {
  try {
    localStorage.setItem(KEY, date);
  } catch {
    // A browser with site data blocked simply shows it again tomorrow.
  }
}
