const CACHE = 'gestion-tecnica-shell-v50';
const ASSETS = ['./', './index.html', './styles.css', './manifest.webmanifest', './src/app.js', './src/db.js', './src/clients.js', './src/properties.js', './src/jobs.js', './src/dpms.js', './src/srt.js', './src/instruments.js', './src/labor.js'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))));
self.addEventListener('fetch', event => { if (event.request.method !== 'GET') return; event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match('./index.html')))); });
