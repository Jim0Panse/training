// Service Worker: haelt die komplette App offline verfuegbar (Cache zuerst).
// WICHTIG: Bei jeder Aenderung an App-Dateien CACHE_VERSION erhoehen!
const CACHE_VERSION = 'training-v1';

const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'js/boot.js',
  'js/app.js',
  'js/version.js',
  'js/router.js',
  'js/db.js',
  'js/data/muscles.js',
  'js/data/exercises.js',
  'js/data/templates.js',
  'js/lib/dom.js',
  'js/lib/icons.js',
  'js/lib/format.js',
  'js/lib/theme.js',
  'js/lib/muscle-load.js',
  'js/lib/stats.js',
  'js/lib/exercise-search.js',
  'js/lib/workout.js',
  'js/lib/sortable.js',
  'js/lib/swipe.js',
  'js/lib/bodyweight.js',
  'js/lib/backup.js',
  'js/components/header.js',
  'js/components/tabbar.js',
  'js/components/sheet.js',
  'js/components/body-map.js',
  'js/components/body-card.js',
  'js/components/chart.js',
  'js/components/exercise-picker.js',
  'js/components/stopwatch.js',
  'js/components/bodyweight-sheet.js',
  'js/views/home.js',
  'js/views/settings.js',
  'js/views/workout-select.js',
  'js/views/template-edit.js',
  'js/views/active-workout.js',
  'js/views/summary.js',
  'js/views/history.js',
  'js/views/session-detail.js',
  'js/views/stats.js',
  'js/views/muscles.js',
  'js/views/muscle-detail.js',
  'js/views/exercises.js',
  'js/views/exercise-detail.js',
  'js/views/exercise-edit.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
  );
  // Kein skipWaiting: Die neue Version wartet, bis der Nutzer „Neu laden“ tippt.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Seitenaufrufe immer mit der gecachten App-Huelle beantworten
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('index.html', { ignoreSearch: true }).then((hit) => hit || fetch(req))
    );
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req))
  );
});
