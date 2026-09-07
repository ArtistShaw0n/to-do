import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { writeSyncConfig } from './lib/sync';

const inTauri = '__TAURI_INTERNALS__' in window;

// The 44px of headroom in the sheet exists to clear macOS traffic lights.
// Windows puts its controls top-right and needs none of it, so the stylesheet
// is told which platform it is on rather than guessing from the viewport.
if (inTauri) {
  void import('@tauri-apps/plugin-os')
    .then(({ platform }) => document.documentElement.setAttribute('data-platform', platform()))
    .catch(() => document.documentElement.setAttribute('data-platform', 'macos'));
} else {
  document.documentElement.setAttribute('data-platform', 'web');
}

// Setting a phone up by typing a long key on a touch keyboard is miserable, so
// a link can carry it instead. It is removed from the address bar immediately
// afterwards so it does not sit in history or get shared by accident.
if (!inTauri) {
  const params = new URLSearchParams(window.location.search);
  const url = params.get('hub');
  const key = params.get('key');
  if (url && key) {
    writeSyncConfig({ url, key });
    window.history.replaceState({}, '', window.location.pathname);
  }
}

// The vault is already offline-capable in IndexedDB; this only ensures the
// app's own files are present, so opening it with no signal shows the tasks
// rather than a browser error page. Pointless inside Tauri, where the files
// are on disk already.
if (!inTauri && 'serviceWorker' in navigator) {
  const register = () => {
    void navigator.serviceWorker.register('/sw.js').catch((err: unknown) => {
      // Losing the offline shell is smaller than failing to start, so this is
      // never fatal — but it must not be silent either. Without the reason,
      // "the app won't open on the train" has nowhere to begin.
      console.warn('offline shell unavailable:', err);
    });
  };
  // A module script can run after `load` has already fired, in which case the
  // listener would never call back and registration would simply never happen.
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

// The webview's own context menu and drag-to-navigate feel wrong in a native
// window, so suppress them.
window.addEventListener('contextmenu', (e) => {
  const target = e.target as HTMLElement;
  const editable = target.closest('input, textarea, [contenteditable]');
  if (!editable) e.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
