/**
 * Deliberately caches nothing.
 *
 * There was a cache here, so the app would open with no signal. It cost more
 * than it was worth: every deploy left the phone running the previous build
 * until its storage was cleared by hand, so a fix shipped in the morning was
 * still missing that evening — twice this went unnoticed until Shawon said
 * nothing had changed.
 *
 * The tasks themselves have never depended on this. They live in IndexedDB and
 * sync when there is a network, which is the part that actually matters
 * offline. All the cache ever added was loading the app's own files with no
 * signal at all, and being always a version behind is the worse trade.
 *
 * The file stays because Chrome wants a service worker before it will install
 * a site to the home screen as an app. It registers, claims its clients, and
 * gets out of the way.
 */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Clear what earlier versions stored, or devices that already have it
    // would keep serving the old build from a cache nothing writes to now.
    for (const key of await caches.keys()) await caches.delete(key);
    await self.clients.claim();
  })());
});
