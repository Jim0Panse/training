// Startseite: Hinweisleisten (laufendes Workout, Backup-Erinnerung), Kacheln Koerpergewicht
// und Diese Woche, „Workout starten“ (ohne Scrollen erreichbar), Muskel-Mensch (Woche | Erholung).

import { pageHead } from '../components/header.js';
import { bodyCardInner, getBodyMode, setBodyMode } from '../components/body-card.js';
import { openBodyweight } from '../components/bodyweight-sheet.js';
import { navigate } from '../router.js';
import * as db from '../db.js';
import { latest, avgChange } from '../lib/bodyweight.js';
import { sessionVolume, sessionWorkSets } from '../lib/stats.js';
import { exportBackup, backupDue, daysSinceBackup } from '../lib/backup.js';
import { icon } from '../lib/icons.js';
import { on, esc, toast } from '../lib/dom.js';
import { isoWeek, fmtDayMonth, fmtKg, fmtNum, fmtVolume, fmtClock, dateKey, startOfWeek, addDays } from '../lib/format.js';

/** Abgeschlossene Workouts der aktuellen Woche (Mo–So) */
export function weekSummary(now = new Date()) {
  const from = startOfWeek(now).getTime();
  const to = addDays(startOfWeek(now), 7).getTime();
  const list = db.doneSessions().filter((s) => { const t = new Date(s.startedAt).getTime(); return t >= from && t < to; });
  return {
    count: list.length,
    sets: list.reduce((n, s) => n + sessionWorkSets(s), 0),
    volume: list.reduce((v, s) => v + sessionVolume(s), 0),
  };
}

function bannersHTML() {
  let out = '';
  const a = db.activeSession();
  if (a) {
    out += `<button class="banner" type="button" data-go="#/workout">${icon('timer')}
      <span class="grow">Workout läuft · <span class="num" id="run-clock">${fmtClock(Date.now() - new Date(a.startedAt))}</span>
        <span class="banner-sub">${esc(a.name)}</span></span>
      <span class="banner-action">Fortsetzen</span></button>`;
  }
  if (backupDue()) {
    const d = daysSinceBackup();
    out += `<div class="banner banner-soft backup-banner" id="backup-banner">
      <span class="icon-disc sm">${icon('download')}</span>
      <button class="grow" type="button" data-backup>${d == null ? 'Noch keine Sicherung' : `Letzte Sicherung vor ${d} Tagen`}<span class="banner-sub">Jetzt sichern</span></button>
      <button class="icon-btn plain sm" type="button" data-snooze aria-label="Erinnerung für 7 Tage ausblenden">${icon('close')}</button>
    </div>`;
  }
  return out;
}

function tilesHTML() {
  const l = latest();
  const ch = avgChange(7);
  let lines = '';
  if (ch != null) {
    const r = Math.round(ch * 10) / 10;
    lines += `<div class="tile-line">${icon(r < 0 ? 'arrowDown' : r > 0 ? 'arrowUp' : 'minus')}<span>${r === 0 ? '±0 kg' : `${esc(fmtNum(Math.abs(r), 1))} kg`} in 7 Tagen</span></div>`;
  }
  if (!l) lines += '<div class="tile-line"><span>Tippen zum Eintragen</span></div>';
  else if (l.date !== dateKey(new Date())) lines += '<div class="tile-line"><i class="pt"></i><span>Heute noch nicht eingetragen</span></div>';

  const w = weekSummary();
  const weekLine = w.count
    ? `${w.sets} ${w.sets === 1 ? 'Satz' : 'Sätze'}${w.volume > 0 ? ` · ${esc(fmtVolume(w.volume))}` : ''}`
    : 'Noch kein Training';

  return `
    <button class="card card-tap tile" type="button" data-bw>
      <span class="card-sub">Körpergewicht</span>
      <span class="big-md">${l ? esc(fmtKg(l.kg)) : '–'}<span class="unit">kg</span></span>
      ${lines}
    </button>
    <a class="card card-tap tile" href="#/statistik/woche">
      <span class="card-sub">Diese Woche</span>
      <span class="big-md">${w.count}<span class="unit">${w.count === 1 ? 'Workout' : 'Workouts'}</span></span>
      <div class="tile-line"><span>${weekLine}</span></div>
    </a>`;
}

export function render(root) {
  const now = new Date();
  let mode = getBodyMode();
  const active = db.activeSession();
  root.innerHTML = `
    ${pageHead({
      title: 'Training',
      subtitle: `KW ${isoWeek(now).week} · ${fmtDayMonth(now)}`,
      actions: `<a class="icon-btn" href="#/einstellungen" aria-label="Einstellungen">${icon('gear')}</a>`,
    })}
    <div class="stack">
      <div class="contents" id="home-banners">${bannersHTML()}</div>
      <div class="grid-2" id="home-tiles">${tilesHTML()}</div>
      <div class="contents" id="home-start">${startHTML(active)}</div>
      <section class="card body-card" id="body-card">${bodyCardInner(mode)}</section>
      <div class="contents" id="home-new">${newHTML(active)}</div>
    </div>`;

  const card = root.querySelector('#body-card');
  const redraw = () => {
    const a = db.activeSession();
    root.querySelector('#home-banners').innerHTML = bannersHTML();
    root.querySelector('#home-tiles').innerHTML = tilesHTML();
    root.querySelector('#home-start').innerHTML = startHTML(a);
    root.querySelector('#home-new').innerHTML = newHTML(a);
    card.innerHTML = bodyCardInner(mode);
  };

  // Laufende Dauer im Banner
  const clock = setInterval(() => {
    const a = db.activeSession();
    const c = root.querySelector('#run-clock');
    if (a && c) c.textContent = fmtClock(Date.now() - new Date(a.startedAt));
  }, 1000);

  // Backup-Banner wegwischen (= 7 Tage ausblenden)
  let drag = null;
  const snooze = async () => {
    await db.saveSettings({ backupSnoozeUntil: addDays(new Date(), 7).toISOString() });
    toast('Erinnerung für 7 Tage ausgeblendet');
  };
  const onDown = (e) => {
    const b = e.target.closest('#backup-banner');
    if (!b || e.target.closest('[data-snooze]')) return;
    drag = { b, x: e.clientX, y: e.clientY, pid: e.pointerId, on: false, dx: 0 };
  };
  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
      if (Math.abs(dx) < 10) return;
      drag.on = true;
      drag.b.classList.add('dragging');
      try { drag.b.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
    }
    drag.dx = dx;
    drag.b.style.transform = `translateX(${dx}px)`;
    drag.b.style.opacity = String(Math.max(0.2, 1 - Math.abs(dx) / 260));
  };
  const onUp = (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag;
    drag = null;
    if (!d.on) return;
    d.b.classList.remove('dragging');
    if (Math.abs(d.dx) > 90) {
      d.b.style.transform = `translateX(${d.dx > 0 ? 120 : -120}%)`;
      d.b.style.opacity = '0';
      setTimeout(snooze, 180);
    } else {
      d.b.style.transform = '';
      d.b.style.opacity = '';
    }
    // Klick nach dem Wischen unterdruecken
    const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    d.b.addEventListener('click', stop, { capture: true, once: true });
    setTimeout(() => d.b.removeEventListener('click', stop, { capture: true }), 60);
  };
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp);
  root.addEventListener('pointercancel', onUp);

  const offs = [
    on(card, 'click', '[data-bodymode]', (e, b) => {
      e.stopPropagation();
      mode = b.dataset.bodymode;
      setBodyMode(mode);
      card.innerHTML = bodyCardInner(mode);
    }),
    on(card, 'click', '[data-open-body], .body-card-more', () => navigate('#/muskeln')),
    on(root, 'click', '[data-go]', (e, b) => navigate(b.dataset.go)),
    on(root, 'click', '[data-bw]', () => openBodyweight()),
    on(root, 'click', '[data-snooze]', snooze),
    on(root, 'click', '[data-backup]', async () => {
      const r = await exportBackup();
      if (r.ok) toast(r.shared ? 'Backup erstellt' : `Backup gespeichert: ${r.name}`);
    }),
    db.subscribe(redraw),
  ];
  return () => {
    offs.forEach((f) => f());
    clearInterval(clock);
    root.removeEventListener('pointerdown', onDown);
    root.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerup', onUp);
    root.removeEventListener('pointercancel', onUp);
  };
}

// Laeuft ein Workout, uebernimmt die Leiste oben das „Fortsetzen“.
function startHTML(active) {
  return active ? '' : `<a class="btn" href="#/workout-auswahl">${icon('play')}Workout starten</a>`;
}

function newHTML(active) {
  return active ? '' : `<a class="btn btn-text" href="#/vorlage/neu">${icon('plus')}Neues Workout</a>`;
}
