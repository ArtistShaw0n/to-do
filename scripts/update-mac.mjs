#!/usr/bin/env node
/**
 * Put a released version of Vault on this Mac, without anyone clicking.
 *
 *   node scripts/update-mac.mjs            # the version in package.json
 *   node scripts/update-mac.mjs 0.26.4     # a chosen version
 *
 * Run after every release (see §7 of CLAUDE.md). It waits for the release
 * workflow to finish, downloads the same signed bundle the in-app updater
 * would, checks its signature against the public key in tauri.conf.json,
 * quits the app politely, swaps the bundle, and reopens it in the background
 * (`open -g`, so it does not jump in front of whatever he is doing).
 *
 * An unsigned or wrongly signed bundle is refused; the installed app is kept
 * and put back if anything goes wrong mid-swap.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const conf = JSON.parse(readFileSync(join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
const version = process.argv[2] ?? JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const tag = `v${version}`;
const APP = '/Applications/Vault.app';
const BUNDLE = 'Vault_universal.app.tar.gz';

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', cwd: root, ...opts }).trim();
const say = (s) => console.log(s);
const fail = (s) => { console.error(`✗ ${s}`); process.exit(1); };

function installedVersion() {
  if (!existsSync(APP)) return null;
  try { return sh('defaults', ['read', `${APP}/Contents/Info.plist`, 'CFBundleShortVersionString']); }
  catch { return null; }
}

// ── 1. Already there? ────────────────────────────────────────────────────────
if (installedVersion() === version) {
  say(`✓ Vault ${version} is already installed`);
  process.exit(0);
}

// ── 2. Wait for the release build ────────────────────────────────────────────
const runs = JSON.parse(sh('gh', ['run', 'list', '--workflow=release.yml', '--limit', '10',
  '--json', 'databaseId,headBranch,status,conclusion']));
const run = runs.find((r) => r.headBranch === tag);
if (!run) fail(`no release build found for ${tag} — was the tag pushed?`);
if (run.status !== 'completed') {
  say(`… waiting for the ${tag} build to finish`);
  spawnSync('gh', ['run', 'watch', String(run.databaseId), '--exit-status'], { cwd: root, stdio: 'ignore' });
}
const done = JSON.parse(sh('gh', ['run', 'view', String(run.databaseId), '--json', 'conclusion']));
if (done.conclusion !== 'success') fail(`the ${tag} build ended as "${done.conclusion}" — nothing installed`);

// ── 3. Download and check the signature ─────────────────────────────────────
const work = mkdtempSync(join(tmpdir(), 'vault-update-'));
try {
  sh('gh', ['release', 'download', tag, '-p', BUNDLE, '-p', `${BUNDLE}.sig`, '-D', work]);
  const bundle = readFileSync(join(work, BUNDLE));
  checkSignature(bundle, readFileSync(join(work, `${BUNDLE}.sig`), 'utf8'), conf.plugins.updater.pubkey);
  say('✓ signature matches the app\'s update key');

  sh('tar', ['-xzf', join(work, BUNDLE), '-C', work]);
  const fresh = join(work, 'Vault.app');
  if (!existsSync(fresh)) fail('the bundle holds no Vault.app');
  const freshVersion = sh('defaults', ['read', `${fresh}/Contents/Info.plist`, 'CFBundleShortVersionString']);
  if (freshVersion !== version) fail(`the bundle is ${freshVersion}, not ${version}`);

  // ── 4. Quit politely, so a save in flight finishes ─────────────────────────
  const wasRunning = spawnSync('pgrep', ['-f', `${APP}/Contents/MacOS/`]).status === 0;
  if (wasRunning) {
    spawnSync('osascript', ['-e', `tell application id "${conf.identifier}" to quit`]);
    for (let i = 0; i < 20 && spawnSync('pgrep', ['-f', `${APP}/Contents/MacOS/`]).status === 0; i++) {
      spawnSync('sleep', ['0.5']);
    }
    if (spawnSync('pgrep', ['-f', `${APP}/Contents/MacOS/`]).status === 0) {
      spawnSync('pkill', ['-TERM', '-f', `${APP}/Contents/MacOS/`]);
      spawnSync('sleep', ['1']);
    }
  }

  // ── 5. Swap, keeping the old one until the new one is in place ─────────────
  const backup = join(work, 'Vault.previous.app');
  if (existsSync(APP)) renameSync(APP, backup);
  try {
    sh('ditto', [fresh, APP]);
  } catch (e) {
    if (existsSync(backup)) { rmSync(APP, { recursive: true, force: true }); renameSync(backup, APP); }
    fail(`could not install the new bundle, the old one is back: ${e.message}`);
  }
  spawnSync('xattr', ['-dr', 'com.apple.quarantine', APP]);

  // ── 6. Reopen behind whatever he is doing ─────────────────────────────────
  if (wasRunning) spawnSync('open', ['-g', APP]);
  const now = installedVersion();
  if (now !== version) fail(`installed version reads ${now}, expected ${version}`);
  say(`✓ Vault ${version} installed${wasRunning ? ' and reopened in the background' : ''}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}

/**
 * Minisign, as Tauri signs: the .sig and the public key are each base64 of a
 * minisign text file. "ED" signatures are over the BLAKE2b-512 of the file,
 * "Ed" over the file itself; the second line pair is a signature over the
 * first signature plus the trusted comment.
 */
function checkSignature(file, sigB64, pubB64) {
  const pubLines = Buffer.from(pubB64, 'base64').toString('utf8').trim().split('\n');
  const pub = Buffer.from(pubLines[1], 'base64');                 // "Ed" | keyid(8) | key(32)
  const lines = Buffer.from(sigB64.trim(), 'base64').toString('utf8').trim().split('\n');
  const sig = Buffer.from(lines[1], 'base64');                    // alg(2) | keyid(8) | sig(64)
  const alg = sig.subarray(0, 2).toString('latin1');
  if (!sig.subarray(2, 10).equals(pub.subarray(2, 10))) fail('signed with a different key than the app trusts');

  const key = createPublicKey({
    key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), pub.subarray(10, 42)]),
    format: 'der', type: 'spki',
  });
  const message = alg === 'ED' ? createHash('blake2b512').update(file).digest() : file;
  if (!verify(null, message, key, sig.subarray(10, 74))) fail('signature does not match the bundle — refusing to install');

  const trusted = lines[2]?.replace(/^trusted comment: /, '') ?? '';
  const global = Buffer.from(lines[3] ?? '', 'base64');
  if (!verify(null, Buffer.concat([sig.subarray(10, 74), Buffer.from(trusted)]), key, global)) {
    fail('the trusted comment was altered — refusing to install');
  }
}
