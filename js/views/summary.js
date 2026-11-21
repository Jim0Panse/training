// Zusammenfassung nach „Beenden“: Dauer, Arbeitssaetze, Volumen, neue Rekorde,
// Vergleich mit dem letzten Mal derselben Vorlage, Mini-Figur der trainierten Muskeln.

import * as db from '../db.js';
import { bodyMapHTML } from '../components/body-map.js';
import { sessionVolume, sessionWorkSets, sessionDuration, sessionRecords, setLabel, fmtSec, RECORD_LABEL, doneWorkSets } from '../lib/stats.js';
import { sessionMuscleSets } from '../lib/muscle-load.js';
import { fmtDuration, fmtVolume, fmtInt, fmtKg, fmtNum, fmtPct, fmtDateShort, fmtTime, fmtDayMonthShort } from '../lib/format.js';
import { esc, on } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { navigate } from '../router.js';

/** Rekordwert lesbar: „82,5 kg“, „10 Wdh. bei 80 kg“, „1:30 min“ … */
export function recordValue(r, ex) {
  switch (r.type) {
    case 'weight': return `${ex && ex.tracking === 'zusatzgewicht_wdh' ? '+' : ''}${fmtKg(r.value)} kg`;
    case 'e1rm': return `${fmtNum(r.value, 1)} kg`;
    case 'volume': return `${fmtInt(r.value)} kg`;
    case 'reps': return r.kg != null && r.kg > 0 ? `${fmtInt(r.value)} Wdh. bei ${fmtKg(r.kg)} kg` : `${fmtInt(r.value)} Wdh.`;
    case 'seconds': return fmtSec(r.value);
    case 'km': return `${fmtKg(r.value)} km`;
    default: return fmtNum(r.value, 1);
  }
}
export function recordPrev(r, ex) {
  if (r.prev == null) return '';
  const prev = { ...r, value: r.prev };
  if (r.type === 'reps') return `vorher ${fmtInt(r.prev)} Wdh.`;
  return `vorher ${recordValue(prev, ex)}`;
}

/** Einstufung fuer die Mini-Figur (Saetze in einer Einheit) */
function sessionLevel(sets) {
  if (!sets) return '';
  if (sets >= 6) return 'l4';
  if (sets >= 4) return 'l3';
  if (sets >= 2) return 'l2';
  return 'l1';
}

export function render(root, { id }) {
  root.classList.add('has-topbar');
  const s = db.session(id);
  if (!s) {
    root.innerHTML = `<header class="topbar"><span></span><h1 class="topbar-title">Zusammenfassung</h1><span></span></header>
      <div class="empty"><strong>Workout nicht gefunden</strong></div><a class="btn mt-16" href="#/start">Zur Startseite</a>`;
    return;
  }
  const volume = sessionVolume(s);
  const sets = sessionWorkSets(s);
  const recs = sessionRecords(s).list;
  const prev = s.templateId
    ? [...db.state.sessions].reverse().find((x) => x.status === 'done' && x.id !== s.id && x.templateId === s.templateId && x.startedAt < s.startedAt)
    : null;
  const prevVol = prev ? sessionVolume(prev) : 0;
  const muscles = sessionMuscleSets(s);
  const classes = Object.fromEntries(Object.entries(muscles).map(([m, n]) => [m, sessionLevel(n)]));
  const start = new Date(s.startedAt);

  let cmp = '';
  if (prev && prevVol > 0 && volume > 0) {
    const d = volume / prevVol - 1;
    cmp = `<div class="card cmp-card">
      <span class="icon-disc ${d >= 0 ? 'good' : ''}">${icon(d >= 0 ? 'trendUp' : 'arrowDown')}</span>
      <div class="grow"><div class="card-title">Volumen ${esc(fmtPct(d))}</div>
        <div class="card-sub">gegenüber dem letzten Mal (${esc(fmtDayMonthShort(new Date(prev.startedAt)))}: ${esc(fmtVolume(prevVol))})</div></div>
    </div>`;
  } else if (prev) {
    cmp = `<div class="card cmp-card"><span class="icon-disc">${icon('repeat')}</span><div class="grow"><div class="card-title">Letztes Mal</div><div class="card-sub">${esc(fmtDateShort(new Date(prev.startedAt)))} · ${sessionWorkSets(prev)} Sätze</div></div></div>`;
  }

  root.innerHTML = `
    <header class="topbar"><span></span><h1 class="topbar-title">Zusammenfassung</h1><div class="topbar-right"></div></header>
    <section class="sum-hero">
      <span class="icon-disc big good">${icon('check')}</span>
      <h2 class="title-lg">Workout beendet</h2>
      <p class="subtitle">${esc(s.name)} · ${esc(fmtDateShort(start))}, ${esc(fmtTime(start))} Uhr</p>
    </section>
    <div class="stat-row">
      <div class="card stat-mini"><div class="v">${esc(fmtDuration(sessionDuration(s)))}</div><div class="l">Dauer</div></div>
      <div class="card stat-mini"><div class="v">${sets}</div><div class="l">Arbeitssätze</div></div>
      <div class="card stat-mini"><div class="v">${esc(fmtVolume(volume))}</div><div class="l">Volumen</div></div>
    </div>
    ${cmp ? `<div class="mt-12">${cmp}</div>` : ''}

    <h2 class="section-title">Neue Rekorde <span class="count">${recs.length || ''}</span></h2>
    ${recs.length ? `<div class="list">${recs.map((r) => {
      const ex = db.exercise(r.exerciseId);
      return `<div class="row rec-row"><span class="icon-disc gold">${icon('trophy')}</span>
        <span class="grow"><span class="row-title">${esc(ex ? ex.name : '–')}</span><span class="row-sub">${esc(RECORD_LABEL[r.type] || '')}</span></span>
        <span class="row-value"><strong>${esc(recordValue(r, ex))}</strong><small>${esc(recordPrev(r, ex))}</small></span></div>`;
    }).join('')}</div>` : '<div class="card empty small">Diesmal keine neuen Rekorde. Rekorde zählen ab dem zweiten Mal pro Übung.</div>'}

    <h2 class="section-title">Trainierte Muskeln</h2>
    <div class="card">${bodyMapHTML({ classes, cls: 'small' })}</div>

    <h2 class="section-title">Übungen</h2>
    <div class="list">${s.items.map((it) => {
      const ex = db.exercise(it.exerciseId);
      const done = it.sets.filter((x) => x.done);
      const work = doneWorkSets(it).length;
      return `<div class="row"><span class="grow"><span class="row-title">${esc(ex ? ex.name : '–')}</span>
        <span class="row-sub sets-line">${done.map((x) => `${x.type === 'warmup' ? 'A: ' : ''}${esc(ex ? setLabel(x, ex) : '')}`).join(' · ')}</span></span>
        <span class="row-value">${work} ${work === 1 ? 'Satz' : 'Sätze'}</span></div>`;
    }).join('')}</div>
    ${s.note ? `<div class="info-note mt-12">${icon('note')}<span>${esc(s.note)}</span></div>` : ''}
    <div class="sticky-actions"><button class="btn" data-done>${icon('check')}Fertig</button></div>`;

  const off = on(root, 'click', '[data-done]', () => navigate('#/start', { replace: true }));
  return off;
}
