import type { ReactNode } from 'react';
import type { NoteKind } from '../lib/types';

/** Inline SVG only — SF Symbols live in a private-use range and render as tofu. */
function Glyph({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const NOTE_PATHS: Record<NoteKind, ReactNode> = {
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

export function NoteGlyph({ kind, size }: { kind: NoteKind; size?: number }) {
  return <Glyph size={size}>{NOTE_PATHS[kind]}</Glyph>;
}

const VIEW_PATHS = {
  all: <path d="M2.6 4.5h10.8M2.6 8h10.8M2.6 11.5h10.8" />,
  personal: (
    <>
      <circle cx="8" cy="5.6" r="2.6" />
      <path d="M3.2 13.4a4.8 4.8 0 019.6 0" />
    </>
  ),
  bugs: (
    <>
      <rect x="5" y="5.4" width="6" height="7.2" rx="3" />
      <path d="M5 8H2.6M13.4 8H11M5.6 5.6L4 4M10.4 5.6L12 4M5.6 12.2L4 13.8M10.4 12.2L12 13.8" />
    </>
  ),
  notes: (
    <>
      <path d="M4 2.6h8v10.8H4z" />
      <path d="M6 6h4M6 8.6h4" />
    </>
  ),
  done: (
    <>
      <circle cx="8" cy="8" r="6.1" />
      <path d="M5.2 8.2l2 2 3.6-4" />
    </>
  ),
} as const;

export type ViewGlyphName = keyof typeof VIEW_PATHS;

export function ViewGlyph({ name, size }: { name: ViewGlyphName; size?: number }) {
  return <Glyph size={size}>{VIEW_PATHS[name]}</Glyph>;
}

export function SearchGlyph({ size = 14 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <circle cx="7.2" cy="7.2" r="4.4" />
      <path d="M10.5 10.5l3 3" />
    </Glyph>
  );
}

export function PlusGlyph({ size = 14 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M8 3.4v9.2M3.4 8h9.2" />
    </Glyph>
  );
}

export function SortGlyph({ size = 14 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M4.4 2.8v10.4M2.2 11l2.2 2.2L6.6 11M11.6 13.2V2.8M9.4 5l2.2-2.2L13.8 5" />
    </Glyph>
  );
}

export function CheckGlyph({ size = 11 }: { size?: number }) {
  return (
    <svg viewBox="0 0 14 14" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3,7.4 5.9,10.2 11,3.9" />
    </svg>
  );
}

/** An upward arrow, the shape every messaging app uses for "send". */
export function SendGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 13V3.6" />
      <path d="M3.8 7.8L8 3.4l4.2 4.4" />
    </svg>
  );
}
