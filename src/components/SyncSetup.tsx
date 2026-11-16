import { useState } from 'react';
import { readSyncConfig, writeSyncConfig, type SyncConfig, type SyncState } from '../lib/sync';
import {
  ACCOUNT_MESSAGES, defaultHub, enter, isLocalOnly, markBringFile, setLocalOnly,
} from '../lib/account';

/**
 * First run on a device with no vault yet: sign in, or open an account.
 *
 * A person given the app has only an email and a password to think about —
 * the hub's address is built in. Underneath, "Other ways" keeps the owner's
 * door (a hub key, as `todo sync` prints it) and, on a desktop, using the app
 * on that one machine with no account at all.
 */
export function SyncSetup({ onDone }: { onDone: () => void }) {
  const inTauri = '__TAURI_INTERNALS__' in window;
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [more, setMore] = useState(false);
  const [hub, setHub] = useState(defaultHub());
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and a password.');
      return;
    }
    setBusy(true);
    const wasLocal = isLocalOnly();
    const r = await enter(mode, { hub, email, password });
    setBusy(false);
    if (!r.ok) {
      setError(ACCOUNT_MESSAGES[r.error]);
      return;
    }
    if (wasLocal) markBringFile();
    setLocalOnly(false);
    onDone();
  };

  const useKey = () => {
    const url = hub.trim().replace(/\/+$/, '').replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
    if (!/^wss?:\/\//.test(url)) { setError('The hub address should start with https:// or wss://'); return; }
    if (!key.trim()) { setError('The key is missing.'); return; }
    writeSyncConfig({ url, key: key.trim() });
    setLocalOnly(false);
    onDone();
  };

  const thisMacOnly = () => {
    setLocalOnly(true);
    onDone();
  };

  return (
    <main className="sheet">
      <header className="sheet-head account-head">
        <div>
          <h1 className="sheet-title">{mode === 'signup' ? 'Create your account' : 'Sign in'}</h1>
          <p className="sheet-date">Your tasks, on every device you sign in on</p>
        </div>
      </header>

      <div className="sheet-scroll">
        <div className="detail-fields account-fields">
          <div className="kind-row" role="tablist">
            {(['signup', 'signin'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                className="kind-chip"
                aria-pressed={mode === m}
                style={{ '--kind': 'var(--tint)' } as React.CSSProperties}
                onClick={() => { setMode(m); setError(null); }}
              >
                {m === 'signup' ? 'New account' : 'I have an account'}
              </button>
            ))}
          </div>

          <label className="detail-field">
            <span>Email</span>
            <input
              className="detail-input"
              type="email"
              autoComplete="email"
              autoCapitalize="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="detail-field">
            <span>Password</span>
            <input
              className="detail-input"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
            />
          </label>

          {mode === 'signup' && <div className="field-note">At least 8 characters. There is no reset by email, so keep it somewhere safe.</div>}
          {error && <div className="field-note field-error" role="alert">{error}</div>}

          <button className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
            {busy ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>

          <button className="link-btn" onClick={() => setMore((v) => !v)} aria-expanded={more}>
            {more ? 'Hide other ways' : 'Other ways'}
          </button>

          {more && (
            <>
              <label className="detail-field">
                <span>Hub address</span>
                <input
                  className="detail-input"
                  value={hub}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => setHub(e.target.value)}
                />
              </label>
              <label className="detail-field">
                <span>Hub key (instead of an account)</span>
                <input
                  className="detail-input"
                  type="password"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                />
              </label>
              <button className="btn" onClick={useKey}>Connect with the key</button>
              <div className="field-note">The key comes from the machine that set the hub up — <code>todo sync</code> prints it.</div>
              {inTauri && (
                <>
                  <button className="btn" onClick={thisMacOnly}>Use on this computer only</button>
                  <div className="field-note">No account, no sync: the tasks stay on this computer. You can sign in later from Settings.</div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

/** A quiet indicator; only worth showing when something is wrong. */
export function SyncBadge({ state }: { state: SyncState }) {
  if (state === 'online' || state === 'off') return null;
  const label = state === 'connecting' ? 'Connecting…' : 'Offline — changes will sync later';
  return <div className="sync-badge" data-state={state}>{label}</div>;
}

export function hasSyncConfig(): SyncConfig | null {
  return readSyncConfig();
}
