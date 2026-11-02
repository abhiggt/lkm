// Linkmery service worker. Version is stamped by tools/build.mjs.
// The page (which carries the link data) is network first, so it is never
// stale for longer than one offline stretch. Static assets are cache first.
const VERSION = 'lm-7621b686';
const SHELL = ['./', 'assets/css/tokens.css', 'assets/css/site.css', 'favicon.svg', 'manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === 'navigate' || req.destination === 'document' || req.url.endsWith('.json');
  if (isPage) {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req.mode === 'navigate' ? './' : req, copy));
      return res;
    }).catch(() => caches.match(req.mode === 'navigate' ? './' : req)));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  })));
});
