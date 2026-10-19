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
   instead, so a secret never sits in a task title even briefly. **A note is made
   entirely on the device by `noteLocally` and never shown to any model** — not the
   hub's API, not `claude -p`. The Notes PIN exists so that a secret is readable by
   nobody but its owner; sending it to a model first would undo that at the door.
   (Typing into the Notes view works the same way: a line with a value in it is
   split by `noteLocally` so the part the lock encrypts is the part that needs it.)
2. The app then asks Claude, in this order: **the hub's API** (any device, no Mac
   needed — see *Claude in the hub* in §5), then `claude -p` on a Mac (the
   `normalise_task` command in `src-tauri/src/lib.rs`). `applyItems` folds the
   reply back in. Only task lines come here.

The reply is a **list**, because one typed line is not always one entry. It can
be two tasks — "invoice pathate hobe ar PR review korte hobe" — or a note rather
than a task. `applyItems` reuses the placeholder when the first item is the same
kind of thing and drops it otherwise, all in a single write.

If neither can answer, pass 1 stands and nothing is lost. A task typed where
Claude cannot be reached is flagged `needsNormalise`, and **any** device that can
reach the hub's API — the Mac, or just another phone with the app open — picks it
up later, claiming it first so two devices do not both pay for it.

**`normalise.ts` is a fourth implementation of the rules in this section.** Add
a time word, a priority word or a module here and it has to go in that file's
tables and in `src/lib/prompts.ts` too — that file holds the rules text that both
`claude -p` and the hub's API are given — or the app and the CLI will disagree
about the same sentence.

### Notes and the PIN

A note holds reference material — a PIN, a wifi key, a login. Its `secret` field
is encrypted (AES-GCM, key derived from his PIN with PBKDF2, `src/lib/lock.ts`)
so the hub and the other devices only ever hold ciphertext. **Titles, usernames
and URLs stay readable, and are not encrypted** — so a value must never sit in one.

How a secret gets to be encrypted, and the one place it cannot be:

- **Typed in the app** — the secret is encrypted *before* the first write, never
  after, so it is never readable on the hub even for a moment. With a PIN set and
  Notes locked, the app asks for the PIN to save the note (it holds the line in
  memory only, and writes it already sealed).
- **Born plaintext some other way** — added through the CLI, written by an older
  copy of the app, produced when the model reads a line the local check let
  through. The app **seals these the moment it holds the key** (`sealPending`),
  and on every unlock. Until then they are readable on the hub.
- **The CLI cannot encrypt** — it has no PIN. `note add --secret` / `note edit
  --secret` therefore print a warning when a PIN is set. **Prefer asking him to
  type a secret into the app.** If he tells you a secret in chat, say that it will
  sit readable on the hub until the app next unlocks, and offer the alternative.
- **A line is never both a secret and an input to a model.** `noteLocally` makes
  the note on the device. Its title is whatever is left once the value is taken
  out (`wifi key 8823sd91` → title `wifi key`), and never the raw line — the raw
  line is the value.

`pnpm test:lock` holds each of these as a named promise. There is no recovery: a
forgotten PIN means the secrets are gone and the notes remain, by design — a
recovery path is a second key, and a second key is a second way in.

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
starts a session, check who wrote today's digest.

```bash
node bin/todo.mjs digest --json | grep '"author"'
```

| `author` | Who | What to do |
|---|---|---|
| `auto` | the machine floor | write a proper one |
| `api` | the hub, at 06:30 (or when the app asked) | leave it unless it is stale or he asks; yours is allowed to replace it |
| `claude` | a session (you) | it stands |

Without any session at all there is still a good brief: the hub's cron trigger
(`[triggers]` in `wrangler.toml`, 06:30 Dhaka) writes one into the store itself,
from the tasks only, and it reaches every device by sync. It never overwrites an
`api` or `claude` brief — only the `auto` floor — unless the app's refresh button
asked for it.

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

### Claude in the hub

The hub (`worker/`) holds an Anthropic API key and calls Claude for every
device — which is how a phone gets the same normalising a Mac does, with no Mac
awake. The key is a Worker secret, set once in a terminal and never committed,
never in `.dev.vars` for production, and never pasted into chat:

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

Without it the hub syncs exactly as before and every AI feature switches itself
off: `GET /ai/status` says `configured: false` and the app hides the buttons.

| Door | What it does |
|---|---|
| `POST /ai/normalise` | a typed line → tasks (and notes), as the same JSON `claude -p` returns, so `parseItems` reads both |
| `POST /ai/steps` | propose subtasks; shown for review, never written unreviewed |
| `POST /ai/image` | a screenshot → tasks, **tasks only**; shown for review before anything is added |
| `POST /ai/ask` | a question about the list, answered in his register |
| `POST /ai/brief` | write today's brief now (the 06:30 cron does the same) |
| `GET /ai/status` | configured? which model, today's calls against the ceiling |

Auth is the sync key as `Authorization: Bearer …` (a `fetch` can set a header; a
browser WebSocket cannot). The rules that are not negotiable:

- **Notes never reach a model.** The doors take tasks; `describeTasks` in
  `worker/prompts.ts` names the only fields it reads and drops the rest, so a
  client sending a whole task cannot make its notes, original wording or
  evidence links travel. And the composer never sends a note-shaped line anywhere
  (see §2), on the Mac's `claude -p` path as much as on the hub's.
- **Purposes, not a pipe.** There is no "send this prompt" route. The prompts
  live on the hub, so a leaked sync key buys four narrow doors and a ceiling,
  not the credit.
- **A ceiling.** `AI_DAILY_CAP` (150 calls a day, across every feature) is spent
  *before* the call, in the Durable Object, which handles one thing at a time so
  two requests cannot both read "149 of 150". "Today" is `TIMEZONE`.
- **The model is one line** — `AI_MODEL` in `wrangler.toml`, Opus 5.5 by
  default. This model always thinks and rejects `temperature`, so the code sends
  neither; `effort` is the only dial (low for lines and subtasks, medium for
  pictures, questions and the brief). Requests opt into
  `fallbacks: "default"`, so a safety-classifier decline on an ordinary work task
  is re-run on another model instead of coming back empty.
- **Failures are reported by kind, never by content** — `capped`, `refused`,
  `not_configured`… — and every caller has the older path to fall back to.
- **Replies are held to a JSON schema** (`src/lib/prompts.ts`), so "mostly
  returns JSON" is "always returns JSON"; `parseItems` stays as strict as before.

What the model is told lives in two places: `src/lib/prompts.ts` (the task rules,
shared with `claude -p`) and `worker/prompts.ts` (subtasks, pictures, questions,
the brief, and the Bengali register copied from §8).

Proving it:

```bash
pnpm test:ai                  # a real Worker + Durable Object against a stand-in for the API
node scripts/ai-smoke.mjs     # one real call per door, printed for a person to read
node scripts/ai-eval.mjs      # his own history fed back through, to see if it lands where Claude Code did
```

`test:ai` proves the plumbing and what is *left out* of every request; it cannot
say how the model behaves on Banglish — that needs a key, which is what the other
two are for.

### Where things live

| Path | What |
|---|---|
| `bin/todo.mjs` | the CLI you drive |
| `bin/vault.mjs` | vault IO, date parsing, stats |
| `src/lib/` | types, vault bridge, mutations, React hook |
| `src/components/` | UI |
| `src/styles/global.css` | every token and every component's styles |
| `scripts/check-design-system.mjs` | the gate that keeps them honest |
| `worker/index.ts` | the hub: routing, the Durable Object, the day's budget, the cron |
| `worker/aiRoutes.ts`, `worker/ai.ts`, `worker/brief.ts` | Claude's doors, the one place that calls it, the morning brief |
| `src/lib/prompts.ts`, `worker/prompts.ts` | what Claude is told |
| `src/lib/ai.ts` | the app's side: knocks on the hub, knows whether it is switched on |
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

**The tag builds the apps. It does not deploy the hub — and the hub is what
serves the phones.** A phone runs the copy of the app that the Worker serves, so
a release that never reaches the Worker never reaches a phone, with nothing to
say so. After any release (and any change under `worker/`):

```bash
pnpm sync:deploy        # builds first, then `wrangler deploy`
curl -s https://vault.artist-shawon.workers.dev/ | grep -o 'assets/index-[^"]*\.js'   # compare with dist/
```

Never run `pnpm test:sync` or `test:ai` against the live hub: the sync test
*deletes every task* to start from a clean slate. They run against local dev hubs.

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
