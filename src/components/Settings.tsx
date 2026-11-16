import { useEffect, useState } from 'react';
import {
  deviceId, readSyncConfig, writeSyncConfig, type SyncConfig, type SyncState,
} from '../lib/sync';
import { ACCOUNT_MESSAGES, changePassword, closeAccount, isLocalOnly, markBringFile, setLocalOnly, signOut } from '../lib/account';

/**
 * Everything that was previously unreachable.
 *
 * The hub could only be entered on a phone's very first launch, or from the CLI
 * on a Mac — so a phone pointed at the wrong hub, or one that needed moving to
 * a new one, had no way back short of clearing the browser's storage. The
 * version was nowhere at all, which makes "have you got the update?" impossible
 * to answer.
 */
export function Settings({
  sync,
  theme,
  onTheme,
  onClose,
}: {
  sync: SyncState;
  theme: 'system' | 'light' | 'dark';
  onTheme: (t: 'system' | 'light' | 'dark') => void;
  onClose: () => void;
}) {
  const [config, setConfig] = useState<SyncConfig | null>(() => readSyncConfig());
  const [url, setUrl] = useState(config?.url ?? '');
  const [key, setKey] = useState(config?.key ?? '');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const { getVersion } = await import('@tauri-apps/api/app');
        setVersion(await getVersion());
      } catch {
        // In a browser there is no bundle version to read; the app is whatever
        // the hub last served, so there is nothing meaningful to show.
      }
    })();
  }, []);

  const save = () => {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    const cleanKey = key.trim();
    if (!/^wss?:\/\//.test(cleanUrl) || !cleanKey) return;
    writeSyncConfig({ url: cleanUrl, key: cleanKey });
    setConfig({ url: cleanUrl, key: cleanKey });
    setSaved(true);
    // The connection is made once at startup, so a change only takes hold on
    // the next launch. Saying so is better than leaving it looking broken.
    setTimeout(() => setSaved(false), 4000);
  };

  const stateLabel = sync === 'online' ? 'Connected'
    : sync === 'connecting' ? 'Connecting…'
    : sync === 'offline' ? 'Offline — changes will sync later'
    : 'Not connected';

  return (
    <main className="sheet">
      <header className="sheet-head">
        <div>
          <h1 className="sheet-title">Settings</h1>
          <p className="sheet-date">{stateLabel}</p>
        </div>
        <button className="theme-btn" aria-label="Close settings" onClick={onClose}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>

      <div className="sheet-scroll">
        <div className="detail-fields">
          <div className="settings-heading">Appearance</div>
          <div className="kind-row">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <button
                key={t}
                className="kind-chip"
                aria-pressed={theme === t}
                style={{ '--kind': 'var(--tint)' } as React.CSSProperties}
                onClick={() => onTheme(t)}
              >
                {t === 'system' ? 'Auto' : t === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>

          {config?.email ? (
            <>
              <div className="settings-heading">Account</div>
              <AccountSection config={config} />
            </>
          ) : (
          <>
          {isLocalOnly() && (
            <>
              <div className="settings-heading">Account</div>
              <div className="field-note">This computer is not signed in, so its tasks reach no other device.</div>
              <button className="btn" onClick={() => { setLocalOnly(false); markBringFile(); location.reload(); }}>Sign in or create an account</button>
            </>
          )}
          <div className="settings-heading">Sync</div>

          <label className="detail-field">
            <span>Hub address</span>
            <input
              className="detail-input"
              value={url}
              placeholder="wss://vault.example.workers.dev"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>

          <label className="detail-field">
            <span>Key</span>
            <div className="detail-inline">
              <input
                className="detail-input"
                type={showKey ? 'text' : 'password'}
                value={key}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => setKey(e.target.value)}
              />
              <button className="secret-toggle" onClick={() => setShowKey((v) => !v)}>
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          <div className="detail-inline">
            <button className="btn" onClick={save}>Save</button>
            {config && (
              <button
                className="btn btn-danger"
                onClick={() => {
                  if (!confirmDisconnect) { setConfirmDisconnect(true); return; }
                  writeSyncConfig(null);
                  setConfig(null);
                  setUrl('');
                  setKey('');
                  setConfirmDisconnect(false);
                }}
              >
                {confirmDisconnect ? 'Really disconnect?' : 'Disconnect'}
              </button>
            )}
          </div>

          {saved && (
            <div className="field-note">Saved. It connects on the next launch.</div>
          )}
          <div className="field-note">
            Disconnecting leaves this device's own copy alone — the tasks stay
            here, they simply stop reaching the others.
          </div>
          </>
          )}

          <div className="settings-heading">This device</div>
          <div className="settings-row"><span>Name</span><code>{deviceId()}</code></div>
          {version && <div className="settings-row"><span>Version</span><code>{version}</code></div>}
          <div className="settings-row">
            <span>Storage</span>
            <code>{'__TAURI_INTERNALS__' in window ? 'app' : 'browser'}</code>
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * The account this device is signed in to. Signing out forgets this device's
 * copy too (see `signOut`); closing the account empties its vault on the hub.
 */
function AccountSection({ config }: { config: SyncConfig }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const [closing, setClosing] = useState(false);
  const [closePw, setClosePw] = useState('');

  const savePassword = async () => {
    const r = await changePassword(config, current, next);
    if (!r.ok) { setNote({ text: ACCOUNT_MESSAGES[r.error], error: true }); return; }
    setCurrent(''); setNext('');
    setNote({ text: 'Password changed.', error: false });
  };

  const close = async () => {
    const r = await closeAccount(config, closePw);
    if (!r.ok) { setNote({ text: ACCOUNT_MESSAGES[r.error], error: true }); return; }
    await signOut();
  };

  return (
    <div className="settings-account">
      <div className="settings-row"><span>Signed in as</span><code>{config.email}</code></div>
      <button className="btn" onClick={() => void signOut()}>Sign out</button>
      <div className="field-note">Signing out removes this device's copy. Your tasks stay in your account.</div>

      <label className="detail-field">
        <span>Current password</span>
        <input className="detail-input" type="password" autoComplete="current-password"
          value={current} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <label className="detail-field">
        <span>New password</span>
        <input className="detail-input" type="password" autoComplete="new-password"
          value={next} onChange={(e) => setNext(e.target.value)} />
      </label>
      <button className="btn" disabled={!current || !next} onClick={() => void savePassword()}>Change password</button>

      {!closing ? (
        <button className="btn btn-danger" onClick={() => setClosing(true)}>Close account…</button>
      ) : (
        <>
          <div className="field-note field-error">
            This deletes every task and note in this account, on every device. It cannot be undone.
          </div>
          <label className="detail-field">
            <span>Password to confirm</span>
            <input className="detail-input" type="password" autoComplete="current-password"
              value={closePw} onChange={(e) => setClosePw(e.target.value)} />
          </label>
          <div className="detail-inline">
            <button className="btn btn-danger" disabled={!closePw} onClick={() => void close()}>Delete everything</button>
            <button className="btn" onClick={() => { setClosing(false); setClosePw(''); }}>Keep my account</button>
          </div>
        </>
      )}
      {note && <div className={`field-note${note.error ? ' field-error' : ''}`} role="status">{note.text}</div>}
    </div>
  );
}
