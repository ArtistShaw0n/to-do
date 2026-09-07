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

// Chrome wants a service worker before it will install a site to the home
// screen as an app. This one caches nothing — see public/sw.js — but an older
// version of it did, so ask for an update on every load: a device still
// running that one has to be told to replace it, and until it does it keeps
// serving whatever build it cached.
if (!inTauri && 'serviceWorker' in navigator) {
  const register = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await reg.update();
    } catch (err) {
      console.warn('service worker unavailable:', err);
    }
  };
  if (document.readyState === 'complete') void register();
  else window.addEventListener('load', () => void register(), { once: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
