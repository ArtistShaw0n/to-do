# Putting Vault on four devices

One vault, shared by two Macs, two phones and the CLI Claude drives. Everything
below is on Cloudflare's free tier: the data is 33 KB and the limits are 5
million reads a day, so there is no plausible path to a bill.

The whole thing is one deployment. The Worker holds the vault *and* serves the
app the phones use, so there is no second host to set up and nothing else to
keep alive.

---

## Once, on any Mac

### 1. A Cloudflare account

Free, at [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up). No
card. Then, from this folder:

```bash
npx wrangler login
```

That opens a browser and asks you to authorise the CLI.

### 2. A key

This is the only thing standing between the internet and your tasks, so let the
machine pick it:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

Keep it somewhere you can reach from your phone — the Notes section of this app
is not an option yet, because nothing is connected. A password manager is the
right place.

### 3. Give the key to the Worker

```bash
npx wrangler secret put SYNC_KEY
```

Paste the key when it asks. It is stored by Cloudflare and never appears in the
repo.

### 4. Deploy

```bash
pnpm build
pnpm sync:deploy
```

Wrangler prints the address, something like
`https://todo-sync.<your-subdomain>.workers.dev`. Everything below needs it.

### 5. Send your existing tasks up

This Mac still has all 47 of them in `data/tasks.json`. Point it at the hub and
the next command pushes them:

```bash
node bin/todo.mjs sync wss://todo-sync.<your-subdomain>.workers.dev <your-key>
node bin/todo.mjs list
```

Note `wss://`, not `https://` — the CLI and the apps talk over a WebSocket.

Check the list looks right before going further. If anything is wrong,
`node bin/todo.mjs sync --off` puts this machine back on its file, untouched.

---

## The second Mac

Install the app from the [latest
release](https://github.com/ArtistShaw0n/to-do/releases/latest), then, in a
checkout of this repo:

```bash
node bin/todo.mjs sync wss://todo-sync.<your-subdomain>.workers.dev <your-key>
```

The app reads the same config, so it picks the hub up on next launch.

## The phones

Open this on the phone, with your own address and key filled in:

```
https://todo-sync.<your-subdomain>.workers.dev/?hub=wss://todo-sync.<your-subdomain>.workers.dev&key=<your-key>
```

It connects itself and drops the key from the address bar. Then **Share → Add to
Home Screen** on iPhone, or **Install app** on Android, and it behaves like an
app: its own icon, no browser chrome, and it opens with no signal.

Without the link it asks for the address and key on a setup screen instead.

## Windows

Install the `.exe` from the [latest
release](https://github.com/ArtistShaw0n/to-do/releases/latest). It has no CLI,
so enter the hub on the setup screen the first time it opens.

---

## What happens when something is off

**A device with no signal** keeps working. Everything is in its own local copy;
edits queue and go up when it reconnects. A quiet line at the top of the window
says so.

**Two devices editing at once** is fine, because the vault is rows rather than
one document. Different tasks never contend at all. The same task edited in two
places within seconds of each other — vanishingly rare for one person — keeps
the later edit.

**The hub unreachable** while the CLI runs: it says so and falls back to
`data/tasks.json`, rather than refusing to record a task. Those edits stay local
until you reconnect, which is why it says so out loud.

**Losing the key** means running steps 2–4 again and re-pointing each device.
The vault survives; it lives in the Durable Object, not in the key.

---

## Cost

| | |
|---|---|
| Cloudflare Workers | free — 100,000 requests a day |
| Durable Objects | free — the vault is 33 KB against a 5 GB allowance |
| Hosting the phone app | free — the same Worker serves it |
| Anthropic API | not used; normalisation runs through the `claude` CLI on a Mac |

Nothing here sleeps or pauses for being idle.
