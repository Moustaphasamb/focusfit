/* À incrémenter à chaque mise en production : c'est ce numéro qui pilote
   l'invalidation du cache chez les utilisateurs. Il suit la version de l'appli. */
const CACHE_NAME = 'focusfit-v5';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './css/variables.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/pages.css',
  './js/state.js',
  './js/utils.js',
  './js/nav.js',
  './js/dashboard.js',
  './js/planning.js',
  './js/programs.js',
  './js/nutrition.js',
  './js/progress.js',
  './js/goals.js',
  './js/timer.js',
  './js/history.js',
  './js/app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function putInCache(request, response) {
  if (!response || !response.ok || response.type === 'opaque') return;
  const copy = response.clone();
  caches.open(CACHE_NAME)
    .then(cache => cache.put(request, copy))
    .catch(() => {});
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // Navigations : le réseau fait foi, le cache ne sert que de secours hors-ligne.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => { putInCache(request, response); return response; })
        .catch(() =>
          caches.match(request).then(cached => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Ressources : affichage immédiat depuis le cache, mise à jour en arrière-plan.
  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => { putInCache(request, response); return response; })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// Permet à l'application de demander l'activation immédiate d'une nouvelle version.
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
