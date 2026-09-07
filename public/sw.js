/**
 * Offline shell for the phones.
 *
 * The vault itself is already offline-capable — it lives in IndexedDB and syncs
 * when there is a network. This only makes sure the app's own files are there
 * to load, so opening it on a train shows the tasks rather than a browser error
 * page.
 *
 * Network-first for navigations, so a deployed update is picked up as soon as
 * there is a connection; cache-first for hashed assets, which never change
 * under their own name.
 */
const CACHE = 'todo-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-256.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          void caches.open(CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/').then((r) => r ?? Response.error())),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => hit ?? fetch(request).then((res) => {
      if (res.ok && url.pathname.startsWith('/assets/')) {
        const copy = res.clone();
        void caches.open(CACHE).then((c) => c.put(request, copy));
      }
      return res;
    })),
  );
});
