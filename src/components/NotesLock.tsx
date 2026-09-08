import { useEffect, useRef, useState } from 'react';
import { createLock, unlock, type LockConfig } from '../lib/lock';

/**
 * The gate in front of Notes.
 *
 * Two jobs in one screen: asking for a PIN that already exists, and setting one
 * that does not. They share everything except the wording, and splitting them
 * into two components would mean keeping two keypads in step.
 *
 * The derived key is handed back and held in memory only — closing the window
 * relocks, because a lock that survives a restart is a lock that is never on.
 */
export function NotesLock({
  config,
  count,
  onUnlocked,
  onCreated,
  onCancel,
}: {
  /** Absent when no PIN has been set yet. */
  config: LockConfig | null;
  /** How many notes are behind the gate, so it is clear what is being protected. */
  count: number;
  onUnlocked: (key: CryptoKey) => void;
  onCreated: (config: LockConfig, key: CryptoKey) => void;
  onCancel: () => void;
}) {
  const setting = !config;
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => { field.current?.focus(); }, []);

  /**
   * Slow down after repeated wrong PINs.
   *
   * Four digits is ten thousand possibilities; without a delay a script would
   * walk them in seconds. This does not make the PIN strong — it makes trying
   * every one of them through this screen not worth doing.
   */
  const penalty = Math.min(attempts, 6) * 400;

  const submit = async () => {
    if (busy) return;
    const value = pin.trim();

    if (value.length < 4) { setError('At least four digits.'); return; }
    if (setting && value !== confirm.trim()) { setError('The two entries do not match.'); return; }

    setBusy(true);
    setError(null);
    try {
      if (setting) {
        const made = await createLock(value);
        onCreated(made.config, made.key);
        return;
      }
      if (penalty) await new Promise((r) => setTimeout(r, penalty));
      const key = await unlock(value, config);
      if (!key) {
        setAttempts((a) => a + 1);
        setPin('');
        setError('That is not the PIN.');
        field.current?.focus();
        return;
      }
      onUnlocked(key);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="sheet">
      <header className="sheet-head">
        <div>
          <h1 className="sheet-title">{setting ? 'Protect these' : 'Notes'}</h1>
          <p className="sheet-date">
            {setting
              ? `${count} ${count === 1 ? 'note' : 'notes'} · nothing is encrypted yet`
              : 'Locked'}
          </p>
        </div>
        <button className="theme-btn" aria-label="Back" onClick={onCancel}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>

      <div className="sheet-scroll">
        <div className="lock-panel">
          <span className="lock-mark" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="22" height="22" fill="none" stroke="currentColor"
              strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="7" width="10" height="7" rx="1.8" />
              <path d="M5.6 7V5.2a2.4 2.4 0 014.8 0V7" />
            </svg>
          </span>

          <div className="detail-fields" style={{ width: '100%' }}>
            <label className="detail-field">
              <span>{setting ? 'Choose a PIN' : 'PIN'}</span>
              <input
                ref={field}
                className="detail-input"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(e) => { setPin(e.target.value); setError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
              />
            </label>

            {setting && (
              <label className="detail-field">
                <span>Again</span>
                <input
                  className="detail-input"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
                />
              </label>
            )}

            {error && <div className="field-note" style={{ color: 'var(--danger)' }}>{error}</div>}

            {setting && (
              <div className="field-note">
                Every secret is encrypted with this PIN before it is stored, so the hub
                and the other devices only ever hold the encrypted form. Titles stay
                readable — you will see <em>that</em> a PIN is recorded without seeing it.
                <br /><br />
                <strong style={{ color: 'var(--danger)' }}>There is no way to recover it.</strong>{' '}
                Forget the PIN and the secrets are gone; the notes themselves remain.
                A recovery path would be a second key, which is a second way in.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="composer">
        <button
          className="btn"
          style={{ width: '100%' }}
          disabled={busy || pin.trim().length < 4}
          onClick={() => void submit()}
        >
          {busy ? 'Working…' : setting ? 'Set the PIN and encrypt' : 'Unlock'}
        </button>
      </div>
    </main>
  );
}
