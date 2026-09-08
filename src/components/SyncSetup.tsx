import { useState } from 'react';
import { readSyncConfig, writeSyncConfig, type SyncConfig, type SyncState } from '../lib/sync';

/**
 * First run on a device that has no vault of its own.
 *
 * Only shown outside Tauri — a Mac gets its hub from the config file the CLI
 * writes, but a phone has no such file and nothing to read it with.
 */
export function SyncSetup({ onDone }: { onDone: () => void }) {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    const cleanKey = key.trim();
    if (!/^wss?:\/\//.test(cleanUrl)) {
      setError('The address should start with wss://');
      return;
    }
    if (!cleanKey) {
      setError('The key is missing.');
      return;
    }
    writeSyncConfig({ url: cleanUrl, key: cleanKey });
    onDone();
  };

  return (
    <main className="sheet">
      <header className="sheet-head">
        <div>
          <h1 className="sheet-title">Connect</h1>
          <p className="sheet-date">This device has no tasks yet</p>
        </div>
      </header>

      <div className="sheet-scroll">
        <div className="detail-fields" style={{ paddingTop: 4 }}>
          <label className="detail-field">
            <span>Hub address</span>
            <input
              className="detail-input"
              value={url}
              placeholder="wss://todo-sync.example.workers.dev"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>

          <label className="detail-field">
            <span>Key</span>
            <input
              className="detail-input"
              value={key}
              type="password"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            />
          </label>

          {error && <div className="field-note" style={{ color: 'var(--danger)' }}>{error}</div>}

          <div className="field-note">
            Both come from the machine that set the hub up — run <code>todo sync</code> there.
            Opening a link with them in it fills this in for you.
          </div>
        </div>
      </div>

      <div className="composer">
        <button className="btn" style={{ width: '100%' }} onClick={submit}>Connect</button>
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
