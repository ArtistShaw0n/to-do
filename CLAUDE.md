# Vault — operating manual for Claude

This folder is Shawon's task system. He talks to Claude Code here in a mix of
**Bangla, Banglish and English**; Claude normalises that into clean English
tasks and pushes them into a vault that the Vault apps render live.

**Your job in this repo is to be the input method.** When Shawon says something
that is a task, a status change, or a request for a summary — run the CLI. Do
not hand-edit `data/tasks.json`.

---

## 1. The one rule

```bash
node bin/todo.mjs <command> [args]
```

Every mutation goes through this CLI. It writes atomically, timestamps
correctly, and the desktop app picks the change up in under ~150 ms via a file
watcher. Editing the JSON by hand risks a torn write while the app is reading.

Check what exists before acting:

```bash
node bin/todo.mjs list
```

---

## 2. Translating what Shawon says

He writes casually. You write the task **in clean, standard English** — short,
imperative, specific. Always keep his original phrasing in `--raw` so the app
can show it underneath.

> Shawon: `kalke sokale client er jonno invoice ta pathate hobe, eta joruri`

```bash
node bin/todo.mjs add "Send the invoice to the client" \
  --p 1 --due tomorrow --project "Client Work" \
  --raw "kalke sokale client er jonno invoice ta pathate hobe, eta joruri"
```

### Time words

| He says | Means |
|---|---|
| `aj`, `aaj`, `today` | `--due today` |
| `kal`, `kalke`, `agamikal` | `--due tomorrow` |
| `porshu` | `--due +2d` |
| `ei week`, `this week` | `--due fri` |
| `agami week`, `next week` | `--due +1w` |
| `shomne mash`, `next month` | `--due +1m` |
| `sombar`…`robibar` | `--due mon`…`sun` |

`shokal` / `bikel` / `rat` (morning / afternoon / night) are time-of-day only —
the vault stores calendar dates, so put that detail in `--notes` if it matters.

### Priority words

| He says | Flag |
|---|---|
| `joruri`, `urgent`, `ekhoni`, `ASAP`, `age eta` | `--p 0` |
| `important`, `guruttopurno`, `must` | `--p 1` |
| (nothing said) | `--p 2` — the default |
| `pore holeo hobe`, `whenever`, `low priority` | `--p 3` |

Priority is stored and shown by `list`, but **the desktop app does not display
it** — Shawon had it removed, keeping the window to a plain list. Set it anyway;
just don't tell him it will be visible.

### Status words

| He says | Command |
|---|---|
| `shuru korechi`, `starting`, `working on it` | `start <id>` |
| `sesh`, `hoye gese`, `done`, `complete korechi` | `done <id>` |
| `atke ache`, `stuck`, `blocked` | `block <id> "reason"` |
| `bad dao`, `lagbe na`, `cancel` | `cancel <id>` |
| `muche dao`, `delete koro` | `rm <id> --force` |
| `abar cholu koro`, `reopen` | `reopen <id>` |

### The shape of a finished task

Every task gets all of these. Both omissions below have been called out:

- `--project` — this is what draws the coloured chip *and* highlights the
  project's name inside the title. Leaving it off makes the task look orphaned.
  If the project name isn't already in the title, put it there.
- `--tag` — two kinds, and the app tells them apart:
  - **Kind** tags say what the work *is*: `bug`, `enhancement`, `release`,
    `design`, `frontend`, `backend`, `responsive`, `architecture`,
    `requirements`, `billing`, `docs`, `test`. The list lives in `KIND_TAGS` in
    `src/lib/vault.ts` — a new kind of work must be added there, or it will be
    mistaken for a module.

    `bug` is a defect; `enhancement` is a "would be better if". The QA sheet
    separates them and so does the Bugs count, so don't tag an improvement
    request as a bug.
  - **Any other tag is read as the module.** That is the whole convention: a bug
    needs `bug` + its module and it files itself under the right heading in the
    app's Bugs view.

  OERP is the *project*; every module lives under it. Use these spellings, or one
  module will split into two headings:

  | Module | Tag |
  |---|---|
  | Email | `email` |
  | Project Hub | `project-hub` |
  | HRIS | `hris` |
  | Meet & Chat | `meet-chat` |
  | Team Evaluation | `team-evaluation` |
  | Shared UI | `shared-ui` |
  | Property Booking System | `property-booking` |
  | Notification (cuts across modules) | `notification` |

  Work belonging to the whole project rather than one module — the repo
  restructure, the design system, permissions, handover to testing — carries no
  module tag, which is correct.

- `--notes` — **one or two lines. Distil, never transcribe.** He often describes
  a bug at length; your job is to extract the point, not to relay the paragraph.
  Aim under ~120 characters. Say what is wrong and what it should be — nothing
  a reader could work out from the title or the project chip. `"OERP module."`
  is too little; retelling his whole message is too much.
- `--raw` — his exact words.

### Bugs and releases

A live module's bugs are tracked here, one task each:

```bash
node bin/todo.mjs add "Show a preview popup before download in the OERP email Drive" \
  --project OERP --tag bug,email,frontend --notes "…" --raw "…"
```

### The bug lifecycle

A bug does not go from open to done in one step, and the CLI will not let it:

```
todo → doing → fixed (in a build) → done (checked by someone else)
                  ↓                        ↓
              wontfix                  reopen
```

```bash
node bin/todo.mjs bug              # open bugs, worst damage first
node bin/todo.mjs bug check        # handed on without the detail (see below)
node bin/todo.mjs bug fix <id> --in v2.4.1 --by Rahim
node bin/todo.mjs bug verify <id> --by Abdullah
node bin/todo.mjs bug reopen <id>
```

What it refuses, and why:

- **A bug cannot jump to done.** "Done" would then mean either "the developer
  thinks it works" or "someone checked it on a real build", and nobody could
  tell which. That is how a regression ships.
- **`fixed` needs the build.** Otherwise "is this fixed in the build I am
  testing?" has no answer.
- **The fixer cannot verify their own fix.** Marking your own work as checked
  is not checking.
- **Reopening is counted.** Three reopens is a wrong diagnosis, not a fix that
  keeps failing.

**What it does not demand.** A bug Shawon wrote down for himself needs nothing
but the line itself — no reproduce steps, no severity. He was there; he knows
what he saw. `bug check` only speaks up once a bug has a `--reporter` or a
fixer, because that is the moment the knowledge has to travel to someone who
was not there. The first version of this rule demanded steps from every bug and
turned a personal list of twelve into twelve complaints, which is a rule
inventing work for the person it was meant to serve.

Fill the fields at `add` time or later with `edit` — both take the same flags:

```bash
node bin/todo.mjs edit <id> --severity major --menu "Drive" \
  --steps "1. Open the Drive  2. Click an attachment" \
  --expected "It previews in place" --reporter Abdullah --evidence <url>
```

**Severity is not priority.** Severity is how much damage it does; priority is
how soon to fix it. A typo on the front page is cosmetic and urgent; a crash in
an unused admin screen is a blocker that can wait. `bug list` sorts by damage
first, then urgency — one blended number could answer neither question.

The rules live in `src/lib/bugs.ts` and are shared by the app and the CLI.
`test/bugs.ts` has one test per rule; run `pnpm test:bugs`.

Two lists carry headings, both from `src/lib/vault.ts` and both returning the
same `TaskGroup` shape so they cannot drift: **Bugs** by module
(`groupByModule`), **Done** by category — Bugs, Personal, then each project
(`groupByCategory`). Heaviest group first in both, and whatever has no home
last. Every other view stays flat, because a tile already answered the question
there.

Each module also gets one umbrella task tagged `release` + its module —
"Fix the reported OERP email module bugs and ship a new release". The app's
**Bugs** view groups every bug under its module and prints that release line
beneath the heading, so it is clear what the fixes are going into. A bug with
no module tag lands under **Unfiled**, which is the visible cost of forgetting
one.

Reproduce steps and screenshots belong in the GitLab issue, next to the fix
commit; put the issue link in `--notes`. The task here is the one line saying
what has to change.

### The composer does this too

Tasks no longer only arrive through you. Text typed into the app's composer is
normalised on the spot, in two passes:

1. `normaliseLocally` in `src/lib/normalise.ts` recognises the words — the time
   and priority tables above, existing project names, kind and module tags — and
   the entry appears immediately in Shawon's own wording. `looksLikeSecret`
   diverts a line that merely states a passcode (`tab er pass 5665`) into a Note
   instead, so a secret never sits in a task title even briefly.
2. The app then shells out to `claude -p` (the `normalise_task` command in
   `src-tauri/src/lib.rs`) with a condensed copy of the rules on this page, and
   `applyItems` folds the reply back in.

The reply is a **list**, because one typed line is not always one entry. It can
be two tasks — "invoice pathate hobe ar PR review korte hobe" — or a note rather
than a task. `applyItems` reuses the placeholder when the first item is the same
kind of thing and drops it otherwise, all in a single write.

If the CLI is missing, logged out or slow, pass 1 stands and nothing is lost.

**`normalise.ts` is a fourth implementation of the rules in this section.** Add
a time word, a priority word or a module here and it has to go in that file's
tables and in `buildPrompt` too, or the app and the CLI will disagree about the
same sentence.

### Judgement calls

- **Several tasks in one sentence → several `add` calls.** "invoice pathate hobe
  ar PR review korte hobe" is two tasks, not one.
- **Infer the project** when it's obvious from context or matches an existing
  one (`node bin/todo.mjs projects` to check). Don't invent new projects for
  one-off items.
- **Vague input** — add it anyway with your best clean phrasing, then say what
  you assumed. Don't block on a clarifying question for something this cheap.
- **Ambiguous reference** ("oi task ta done") — the CLI resolves a unique title
  substring, so `done "invoice"` works. If it's genuinely ambiguous the CLI
  errors and lists the candidates; show those to him and ask.
- He may refer to a task by its short id (`2454bx`), a prefix, or a few words of
  the title. All three work.

---

## 3. The daily brief

Shawon asked for "everyday ekta shundor update". The app always shows live
counts on its own; your job is the prose above them.

```bash
node bin/todo.mjs digest --write "…markdown…"
```

Write it **in his register** — see *Writing Bengali to him* in §8; the idiom
rule matters here most of all. Keep it short: 3–6 lines. Lead with what matters
today, name the single most important task, flag anything rotting.

Supported markdown: paragraphs, `- bullets`, `**bold**`, `` `code` ``. Nothing
else renders.

Good:

```
আজকে **৫টা কাজ** due, **১টা overdue**. সবচেয়ে জরুরি — `Finish the landing page hero`, ওটা already in progress.

- **Client Work** এ ৩টা জমেছে, invoice টা আজকেই পাঠান
- `Review PR #42` ২ দিন ধরে ঝুলে আছে
```

Rewriting the same date overwrites that day's entry, so it's safe to refine.

A digest is a written snapshot, not a live view — it will happily go on naming
tasks that have since been completed or deleted. **After any bulk change
(several completions, deletions, a re-plan), rewrite the digest** or it shows
Shawon a summary of a list that no longer exists.

Get the numbers first so the prose is true:

```bash
node bin/todo.mjs stats --json
```

### The automatic floor

`node bin/todo.mjs digest --auto` composes a serviceable brief from the vault
alone — no Claude, no network. Optionally scheduled for 06:30 daily via
`bash scripts/install-daily-digest.sh`.

So the app always has *something*. Your job is to make it better: when Shawon
starts a session, check whether today's digest was machine-written and replace
it with a real one.

```bash
node bin/todo.mjs digest --json | grep '"author"'   # "auto" means write a proper one
```

---

## 4. CLI reference

```
sync [<url> <key>]            point this machine at the hub
sync --off                    go back to the local file only

add <title>       --p 0-3  --due X  --tag a,b  --project X  --notes X
                  --sub "a,b"  --repeat daily|weekdays|weekly|biweekly|monthly
                  --raw "<his original words>"   --est <minutes>
                  --severity X --menu X --steps X --expected X
                  --env X --evidence X --reporter X      # same as `edit`

start|stop|done|reopen|cancel|unblock <id...>
block <id> "reason"
rm <id...> [--force]          # --force required while a task is still open

edit <id> [new title] --title X --p N --due X|clear --project X
                      --tag a,b --notes X --status X --repeat X|none
tag <id> +work -home
sub <id> add "…" | done <n> | toggle <n> | rm <n>

list [query] [--all] [--status X] [--project X] [--tag X] [--p N]
             [--due today] [--overdue] [--json] [--flat]
show <id>          stats [--json]        projects
digest --write "<markdown>"    digest [--date YYYY-MM-DD] [--json]
export [--md]      path        init
```

Dates accept: `today`, `tomorrow`, `kal`, `mon`…`sun`, `+3d`, `2w`,
`2026-08-20`, `20/08`.

---

## 5. Architecture (why it's built this way)

```
Claude Code ──▶ bin/todo.mjs ──▶ data/tasks.json ◀── Rust fs-watcher ──▶ React UI
                                      │
                                 (inside MEGA → free backup + sync)
```

- **The vault is a TinyBase store**, one row per task, note and project. With a
  hub configured (`todo sync`) every device — both Macs, both phones, and this
  CLI — shares it and merges automatically. With no hub the CLI falls back to
  `data/tasks.json`, which is right for one machine.
- **`data/tasks.json`** is gitignored either way — the repo is public, his tasks
  are not.
- The CLI connects to the hub, pulls into memory, runs the command
  synchronously, and pushes on the way out. If the hub is unreachable it says so
  and uses the local file, rather than refusing to record a task.
- **Rust owns storage**, file-watching and native chrome. **TypeScript owns all
  task logic.** `bin/vault.mjs` is the CLI's own copy of that logic.
- The schema in `src/lib/types.ts` is a **contract shared by three
  implementations** (Rust storage, React app, Node CLI). Change one, change all
  three.
- Writes are write-then-rename, so a reader never sees half a document. The app
  also sends `expectedUpdatedAt` on save; a mismatch means the CLI wrote in the
  meantime and the app re-applies on top instead of clobbering.
- The app suppresses the file event for its *own* writes by matching
  `meta.updatedAt`, so saving doesn't cause a reload loop.

### Where things live

| Path | What |
|---|---|
| `bin/todo.mjs` | the CLI you drive |
| `bin/vault.mjs` | vault IO, date parsing, stats |
| `src/lib/` | types, vault bridge, mutations, React hook |
| `src/components/` | UI |
| `src/styles/global.css` | every token and every component's styles |
| `scripts/check-design-system.mjs` | the gate that keeps them honest |
| `src-tauri/src/lib.rs` | storage, watcher, tray, hotkey |
| `scripts/make-icon.mjs` | regenerates the icon from code |

---

## 6. The design system

Every colour, size, space and duration comes from a token in
`src/styles/global.css`. Nothing in this project types a raw number for
spacing, a font size, or a colour — and `pnpm check:design` fails the build if
anything does.

```bash
pnpm check:design            # three checks, run before every build
node scripts/check-design-system.mjs --write   # accept a token change
```

The three checks, and why each exists:

1. **No raw spacing or type values.** The stylesheet once held twenty different
   spacing values and eleven type sizes, because every number was chosen where
   it was written. Use `--s-1…--s-6` and `--t-caption…--t-hero`.
2. **No colour outside the palette.** Use the semantic names — `--primary`,
   `--success`, `--warning`, `--danger`, `--info`, and `--on-accent` for ink on
   a filled accent. The bug UI was once written against a `--red` that does not
   exist and painted nothing.
3. **The token inventory matches its snapshot.** Add or remove a token and the
   build fails until the published design system is updated to match, then
   `--write` accepts the new set. This is what stops the document quietly
   describing a system that no longer exists.

**Adding anything new means adding it to the system first.** A new component
uses existing tokens; if it genuinely needs a value none of them provide, the
token is added, the design system canvas is updated, and only then does the
snapshot move. The order matters — doing it the other way round is how the two
drift apart.

The published system: https://claude.ai/code/artifact/861f0314-d8e4-4741-b005-ef65c326b712

---

## 7. Shipping an update

The app auto-updates from GitHub Releases, verified against a minisign key.

```bash
pnpm version patch --no-git-tag-version    # or minor / major
# then set the same version in src-tauri/tauri.conf.json and src-tauri/Cargo.toml
(cd src-tauri && cargo build --release)    # refreshes Cargo.lock

git commit -am "Release v0.18.1"
git tag -a v0.18.1 -m "Release v0.18.1"    # annotated, see below
git push && git push origin v0.18.1
```

`--no-git-tag-version` is deliberate: plain `pnpm version` commits and tags on
the spot, before the other two version numbers have been changed.

**pnpm refuses to bump a dirty tree at all** — `--no-git-tag-version` turns off
the commit, not the cleanliness check. So commit the work first and let the
version bump be its own commit, or set the three numbers by hand.

**Tag with `-a`.** `git push --follow-tags` pushes *annotated* tags only — it
skips a plain `git tag v…` without a word of complaint, so the push succeeds,
no workflow runs, and nothing looks wrong until you go hunting for the release.
Pushing the tag by name avoids the trap entirely.

The tag push triggers `.github/workflows/release.yml`, which builds a universal
binary, signs it, and publishes `latest.json`.

`check()` runs once on mount in `src/App.tsx`, so an app that is already running
will not notice — and closing the window only parks it in the menu bar. Shawon
has to actually **quit** (tray → Quit, or ⌘Q) and reopen before the update toast
appears.

**The version in `package.json`, `src-tauri/tauri.conf.json`,
`src-tauri/Cargo.toml` and the git tag must all match**, or the updater will not
offer the release.

Confirm it actually shipped rather than assuming:

```bash
gh run list --workflow=release.yml --limit 1
gh release view v0.18.1 --json assets --jq '.assets[].name'   # expect .dmg, .tar.gz, .sig, latest.json
```

The private signing key lives at `~/.tauri/todo.key` and in the repo secret
`TAURI_SIGNING_PRIVATE_KEY`. **If it is lost, auto-update breaks permanently for
every installed copy** — there is no recovery, only a manual reinstall.

---

## 8. Style

- Task titles: English, imperative, specific. "Send the invoice to the client",
  not "invoice".
- Don't ask permission to add a task he clearly just asked for. Add it, then
  confirm what you did in one line.

### Writing Bengali to him

Bengali prose, English technical terms (CMS, upload, storage, commit,
backdrop-filter). That much is easy. The part that goes wrong is **idiom**.

Write the sentence as it is *said* in Bengali. Do not translate an English
figure of speech word-for-word — it parses, but no Bengali speaker says it, and
it reads as machine output rather than as someone talking.

| Wrong (translated) | What was meant | Say instead |
|---|---|---|
| রঙ ধুয়ে দিচ্ছে | "washing out the colour" | রঙ ফ্যাকাশে হয়ে যাচ্ছে |
| border টা চেঁচাচ্ছে | "the border shouts" | border টা বড্ড বেশি চোখে লাগছে |
| কাদা রঙ | "muddy" | ঘোলাটে |

Test: if a phrase only makes sense once you mentally translate it back to
English, rewrite it. This applies to the digest as much as to conversation.
