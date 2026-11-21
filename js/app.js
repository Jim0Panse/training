// Start der App: Datenbank, Theme, Tab-Leiste, Router, Service Worker.

import * as db from './db.js';
import { defineRoutes, startRouter, navigate } from './router.js';
import { renderTabbar } from './components/tabbar.js';
import { applyTheme, watchSystemTheme } from './lib/theme.js';
import { el } from './lib/dom.js';
import { icon } from './lib/icons.js';

import * as home from './views/home.js';
import * as settings from './views/settings.js';
import * as workoutSelect from './views/workout-select.js';
import * as templateEdit from './views/template-edit.js';
import * as activeWorkout from './views/active-workout.js';
import * as summary from './views/summary.js';
import * as historyView from './views/history.js';
import * as sessionDetail from './views/session-detail.js';
import * as stats from './views/stats.js';
import * as muscles from './views/muscles.js';
import * as muscleDetail from './views/muscle-detail.js';
import * as exercises from './views/exercises.js';
import * as exerciseDetail from './views/exercise-detail.js';
import * as exerciseEdit from './views/exercise-edit.js';

export { APP_VERSION } from './version.js';

defineRoutes([
  { pattern: '/start', view: home, tab: 'start' },
  { pattern: '/einstellungen', view: settings, tab: 'start' },
  { pattern: '/workout-auswahl', view: workoutSelect, tab: 'start' },
  { pattern: '/vorlage/:id', view: templateEdit, tabbar: false },
  { pattern: '/workout', view: activeWorkout, tabbar: false },
  { pattern: '/zusammenfassung/:id', view: summary, tabbar: false },
  { pattern: '/muskeln', view: muscles },
  { pattern: '/muskel/:id', view: muscleDetail },
  { pattern: '/verlauf', view: historyView, tab: 'verlauf' },
  { pattern: '/verlauf/:id', view: sessionDetail, tab: 'verlauf' },
  { pattern: '/statistik', view: stats, tab: 'statistik' },
  { pattern: '/statistik/:period', view: stats, tab: 'statistik' },
  { pattern: '/uebungen', view: exercises, tab: 'uebungen' },
  { pattern: '/neue-uebung', view: exerciseEdit, tabbar: false },
  { pattern: '/uebung/:id', view: exerciseDetail, tab: 'uebungen' },
  { pattern: '/uebung/:id/bearbeiten', view: exerciseEdit, tabbar: false },
]);

async function main() {
  watchSystemTheme();
  try {
    await db.init();
  } catch (e) {
    console.error(e);
    document.getElementById('view').innerHTML =
      '<div class="placeholder"><strong>Speicher nicht verfügbar</strong><br>Die App braucht IndexedDB. Im privaten Safari-Modus funktioniert sie nicht.</div>';
    return;
  }
  applyTheme(db.state.settings.theme);
  renderTabbar(document.getElementById('tabbar'));

  // Beim App-Start ein laufendes Workout direkt wieder oeffnen
  const h = location.hash;
  if (db.activeSession() && (!h || h === '#' || h === '#/' || h === '#/start')) {
    history.replaceState(null, '', '#/workout');
  } else if (!h || h === '#' || h === '#/') {
    history.replaceState(null, '', '#/start');
  }
  startRouter(document.getElementById('view'));

  // Vor dem Verlassen ausstehende Speichervorgaenge erledigen
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') db.flushAll(); });
  window.addEventListener('pagehide', () => db.flushAll());

  registerServiceWorker();
}

// ---------- Service Worker / Updates ----------
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const params = new URLSearchParams(location.search);
  try {
    if (params.get('sw') === '1') localStorage.setItem('training-sw', '1');
    if (params.get('sw') === '0') localStorage.removeItem('training-sw');
  } catch (e) { /* egal */ }
  let localSw = false;
  try { localSw = localStorage.getItem('training-sw') === '1'; } catch (e) { /* egal */ }

  if (isLocal && !localSw) {
    // Beim Entwickeln kein Cache, damit Aenderungen sofort sichtbar sind
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
    return;
  }

  let updateRequested = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updateRequested) window.location.reload();
  });

  navigator.serviceWorker.register('sw.js').then((reg) => {
    const offer = (worker) => {
      if (!worker || !navigator.serviceWorker.controller) return;
      showUpdateBar(async () => {
        updateRequested = true;
        await db.flushAll();
        worker.postMessage('SKIP_WAITING');
      });
    };
    if (reg.waiting) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch((e) => console.warn('Service Worker nicht registriert', e));
}

function showUpdateBar(onReload) {
  if (document.querySelector('.update-bar')) return;
  const bar = el(`<button class="banner update-bar">${icon('download')}
    <span class="grow">Update verfügbar<span class="banner-sub">Dein laufendes Workout bleibt gespeichert.</span></span>
    <span class="banner-action">Neu laden</span></button>`);
  bar.addEventListener('click', onReload);
  document.body.append(bar);
}

export { navigate };
main();
