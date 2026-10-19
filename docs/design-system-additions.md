# What the Vault Design System canvas is missing

The published canvas (see `CLAUDE.md` §6) predates v0.26.0. Everything below
shipped in code, uses **only existing tokens** (so `pnpm check:design` passes and
the token inventory did not move), and is not yet drawn on the canvas.

Run `/design` and point it here. Delete this file once the canvas has caught up.

## Components to add

### Ask — a search action (`.search-ask`, `App.tsx`)
A pill inside the search field that sends the typed text as a question.
- Anatomy: sparkle glyph (12px) + label "Ask", tinted with `--primary` at 14%.
- Appears only when the hub can answer **and** the text is ≥ 3 characters.
  Hidden in the Notes view. ⌘↵ / Ctrl↵ does the same.
- States: default · disabled while an answer is loading (opacity 0.5).
- Tokens: `--s-1 --s-2 --r-pill --primary --t-caption`.

### Answer card (`Answer` in `Brief.tsx`, classes `.brief*`)
The reply to a question, drawn as the daily brief is — "something said to you",
not another row. Shares one `Card` with the brief.
- Anatomy: sparkle mark · label "Answer" · close; a quiet **lead** line with the
  question in “quotes”; the body.
- Three states: **loading** ("Thinking…", plain text) · **answer** (4-form
  markdown: paragraph, bullets, **bold**, `code`) · **error** (one sentence, `--danger`).
- While it shows, the search text is the question, not a filter.
- Tokens: `--s-1 --t-small --t-body --text-2 --text-3 --danger`.

### Subtasks (`Steps.tsx`, classes `.steps*`, `.step*`)
The checklist inside a task. Named **Subtasks**, not Steps — a bug has a field
called "Steps to reproduce".
- Anatomy: caps label + `n/m` count · rows (round check · text · remove ×) ·
  "Add a subtask" field · "Suggest subtasks" button (only when the hub can answer).
- Row states: open · done (text `--text-3`, struck through).
- **Proposal** (`.step-proposal`): a review panel — "Suggested — untick any you do
  not want", a tick per suggestion, **Add N** / **Dismiss**. States: loading ·
  ready · empty ("already one small task") · error.
- Card summary: a `chip chip-tag` reading `n/m subtasks`.
- Tokens: `--s-1 --s-2 --s-3 --t-caption --t-body --text-1 --text-3 --danger
  --primary --field --stroke --r-control`.

### Picture review (`PictureReview.tsx`, classes `.review*`)
Tasks read from a screenshot, held for a look **before they exist**. Full-sheet,
like Settings and the Notes lock.
- Anatomy: header "From the picture" + "n tasks found — check them before they
  are added" + back · rows (tick · editable title · project/tag chips · note) ·
  footer button "Add n tasks".
- States: normal · row unticked (content 45% opacity) · **empty** ("No tasks in
  that picture") with a "Back" footer · button disabled when nothing is ticked.
- Tokens: `--s-1 --s-2 --s-3 --t-small --text-3 --primary`.

### Smaller pieces
- **Composer image button** (`.composer-send`, `ImageGlyph`): left of send; only
  when the hub can read pictures; accepts a pasted screenshot as well.
- **Brief refresh** (`.brief-close` with a circular-arrow): re-writes today's
  brief; disabled while it works.
- **Lock screen, saving variant**: "Enter the PIN to save “locker”" under the
  title, when a note was typed while Notes was locked.

## Patterns to add
- **The model proposes, you confirm.** Subtasks and pictures are shown as a short
  reviewable list and nothing is written until accepted. Typed lines are the
  exception because a person can see they made them.
- **Hidden, not disabled.** Every Claude feature is absent — not greyed — when the
  hub has no key or the day's ceiling is spent; the app behaves exactly as before.
- **Waiting is stated.** A reply takes seconds; "Thinking…" / "Reading the
  picture…" always appear so a gap never reads as nothing happening.

## Language to add (all from `describeAiError`, `src/lib/ai.ts`)
- "Today's limit for Claude is reached. It resets tomorrow."
- "The hub has no API key yet, so Claude isn't switched on."
- "Claude declined that one." · "Claude is busy right now. Try again in a moment."
- "Couldn't reach the hub." · "Claude couldn't answer that. Try again."
- "That picture couldn't be opened." · "That picture is too large to send, even shrunk."

## Accessibility notes to add
- Every icon-only control has an `aria-label` ("Add tasks from a picture",
  "Write today's brief again", "Remove “…”", "Include “…”").
- The card sets `aria-busy` while waiting; the picture progress line is `role="status"`.
- Ticks are native checkboxes (keyboard and screen-reader complete).
- The Ask pill and ⌘↵ are equivalent; neither is the only way to reach a feature
  that matters.
