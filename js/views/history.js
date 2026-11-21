// Verlauf: Punkte-Kalender (3 Monate nebeneinander, wischen -> fruehere Monate) und Liste aller
// Workouts (neueste oben). Tipp -> Workout-Detail.

import * as db from '../db.js';
import { pageHead } from '../components/header.js';
import { actionSheet } from '../components/sheet.js';
import { sessionVolume, sessionWorkSets, sessionDuration } from '../lib/stats.js';
import { fmtDuration, fmtVolume, fmtMonthShort, fmtMonthYear, fmtDateShort, fmtTime, fmtClock, dateKey, fromKey, addMonths, startOfMonth } from '../lib/format.js';
import { on, esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { navigate } from '../router.js';

const WEEKDAY = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
let offset = 0; // Monate zurueck – bleibt beim Zurueckkehren aus dem Detail erhalten

/** Trainingstage: dateKey -> [sessions] */
function sessionsByDay() {
  const map = new Map();
  for (const s of db.doneSessions()) {
    const k = dateKey(new Date(s.startedAt));
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(s);
  }
  return map;
}

function monthHTML(m, byDay, todayKey) {
  const year = m.getFullYear(), month = m.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  let count = 0;
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<span class="cal-d blank"></span>';
  for (let d = 1; d <= days; d++) {
    const key = dateKey(new Date(year, month, d));
    const list = byDay.get(key);
    const cls = `${list ? 'on' : ''} ${key === todayKey ? 'today' : ''} ${key > todayKey ? 'future' : ''}`;
    if (list) {
      count += list.length;
      cells += `<button class="cal-d ${cls}" type="button" data-day="${key}" aria-label="${esc(fmtDateShort(fromKey(key)))}: ${esc(list.map((s) => s.name).join(', '))}"><i></i></button>`;
    } else cells += `<span class="cal-d ${cls}"><i></i></span>`;
  }
  const label = fmtMonthShort(m) + (year !== new Date().getFullYear() ? ` ’${String(year).slice(2)}` : '');
  return `<div class="cal-m">
    <div class="cal-mt">${esc(label)}</div>
    <div class="cal-grid">${cells}</div>
    <div class="cal-mc">${count ? `${count} ${count === 1 ? 'Workout' : 'Workouts'}` : '–'}</div>
  </div>`;
}

function calendarHTML() {
  const now = new Date();
  const byDay = sessionsByDay();
  const last = addMonths(startOfMonth(now), -offset);
  const months = [addMonths(last, -2), addMonths(last, -1), last];
  const first = db.doneSessions()[0];
  const canBack = first ? startOfMonth(new Date(first.startedAt)) < months[0] : false;
  const range = `${fmtMonthShort(months[0])} – ${fmtMonthShort(months[2])} ${months[2].getFullYear()}`;
  return `<div class="cal-head">
      <button class="icon-btn plain sm" type="button" data-cal="1" ${canBack ? '' : 'disabled'} aria-label="Frühere Monate">${icon('chevronLeft')}</button>
      <span class="cal-range">${esc(range)}</span>
      <button class="icon-btn plain sm" type="button" data-cal="-1" ${offset > 0 ? '' : 'disabled'} aria-label="Spätere Monate">${icon('chevronRight')}</button>
    </div>
    <div class="cal-months">${months.map((m) => monthHTML(m, byDay, dateKey(now))).join('')}</div>`;
}

function rowHTML(s) {
  const d = new Date(s.startedAt);
  const vol = sessionVolume(s);
  const sets = sessionWorkSets(s);
  return `<a class="row hist-row" href="#/verlauf/${esc(s.id)}">
    <span class="hist-date"><strong>${d.getDate()}</strong><small>${WEEKDAY[d.getDay()]}</small></span>
    <span class="grow"><span class="row-title">${esc(s.name)}</span>
      <span class="row-sub">${esc(fmtTime(d))} Uhr · ${esc(fmtDuration(sessionDuration(s)))}</span></span>
    <span class="row-value"><strong>${vol > 0 ? esc(fmtVolume(vol)) : '–'}</strong><small>${sets} ${sets === 1 ? 'Satz' : 'Sätze'}</small></span>${icon('chevronRight', 'chev')}
  </a>`;
}

function listHTML() {
  const done = [...db.doneSessions()].reverse();
  if (!done.length) {
    return `<div class="card empty mt-12"><strong>Noch keine Workouts</strong>Abgeschlossene Workouts erscheinen hier mit Dauer, Sätzen und Volumen.
      <a class="btn mt-16" href="#/workout-auswahl">${icon('play')}Workout starten</a></div>`;
  }
  let out = '', cur = '', rows = [];
  const flush = () => {
    if (!rows.length) return;
    out += `<h2 class="section-title">${esc(cur)} <span class="count">${rows.length}</span></h2><div class="list">${rows.join('')}</div>`;
    rows = [];
  };
  for (const s of done) {
    const m = fmtMonthYear(new Date(s.startedAt));
    if (m !== cur) { flush(); cur = m; }
    rows.push(rowHTML(s));
  }
  flush();
  return out;
}

export function render(root) {
  const draw = () => {
    const done = db.doneSessions();
    const active = db.activeSession();
    root.innerHTML = `
      ${pageHead({ title: 'Verlauf', subtitle: done.length ? `${done.length} ${done.length === 1 ? 'Workout' : 'Workouts'} insgesamt` : '' })}
      ${active ? `<a class="banner mb-12" href="#/workout">${icon('timer')}<span class="grow">Workout läuft · <span class="num" id="hist-clock">${fmtClock(Date.now() - new Date(active.startedAt))}</span><span class="banner-sub">${esc(active.name)}</span></span><span class="banner-action">Fortsetzen</span></a>` : ''}
      <section class="card cal-card" id="cal">${calendarHTML()}</section>
      <div id="hist-list">${listHTML()}</div>`;
  };
  const redrawCal = () => { const c = root.querySelector('#cal'); if (c) c.innerHTML = calendarHTML(); };
  const shift = (n) => {
    const first = db.doneSessions()[0];
    const now = new Date();
    const maxBack = first ? Math.max(0, (now.getFullYear() - new Date(first.startedAt).getFullYear()) * 12 + now.getMonth() - new Date(first.startedAt).getMonth() - 2) : 0;
    const next = Math.max(0, Math.min(maxBack, offset + n));
    if (next === offset) return;
    offset = next;
    redrawCal();
    const months = root.querySelector('.cal-months');
    if (months) months.classList.add(n > 0 ? 'from-left' : 'from-right');
  };

  draw();

  // Wischen ueber den Kalender: nach rechts = fruehere Monate
  let sw = null;
  const onDown = (e) => { if (e.target.closest('#cal')) sw = { x: e.clientX, y: e.clientY, pid: e.pointerId }; };
  const onUp = (e) => {
    if (!sw || e.pointerId !== sw.pid) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    sw = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      shift(dx > 0 ? 3 : -3);
      const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      root.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => root.removeEventListener('click', stop, { capture: true }), 60);
    }
  };
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointerup', onUp);
  const onCancel = () => { sw = null; };
  root.addEventListener('pointercancel', onCancel);

  const clock = setInterval(() => {
    const a = db.activeSession();
    const c = root.querySelector('#hist-clock');
    if (a && c) c.textContent = fmtClock(Date.now() - new Date(a.startedAt));
  }, 1000);

  const offs = [
    on(root, 'click', '[data-cal]', (e, b) => shift(Number(b.dataset.cal) * 3)),
    on(root, 'click', '[data-day]', async (e, b) => {
      const list = sessionsByDay().get(b.dataset.day) || [];
      if (list.length === 1) { navigate('#/verlauf/' + list[0].id); return; }
      const id = await actionSheet({
        title: fmtDateShort(fromKey(b.dataset.day)),
        actions: list.map((s) => ({ label: `${s.name} · ${fmtTime(new Date(s.startedAt))} Uhr`, value: s.id, icon: 'dumbbell' })),
      });
      if (id) navigate('#/verlauf/' + id);
    }),
    db.subscribe(draw),
  ];
  return () => {
    offs.forEach((f) => f());
    clearInterval(clock);
    root.removeEventListener('pointerdown', onDown);
    root.removeEventListener('pointerup', onUp);
    root.removeEventListener('pointercancel', onCancel);
  };
}
