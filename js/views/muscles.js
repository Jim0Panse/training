// Muskel-Mensch gross: Woche (mit KW-Blaettern) oder Erholung, darunter Liste aller Muskeln.

import * as db from '../db.js';
import { topbar } from '../components/header.js';
import { bodyMapHTML, weekClasses, weekLevel, legendWeek, legendRecovery } from '../components/body-map.js';
import { bodyModeSeg, getBodyMode, setBodyMode } from '../components/body-card.js';
import { weekSets, recovery, recoveryClasses, RECOVERY_LABEL } from '../lib/muscle-load.js';
import { MUSCLES } from '../data/muscles.js';
import { isoWeek, startOfWeek, addDays, fmtDayMonthShort, fmtNum, fmtHours } from '../lib/format.js';
import { on, esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { navigate } from '../router.js';

let rememberedWeek = null; // beim Zurueckkehren aus dem Muskel-Detail dieselbe Woche zeigen

export function render(root, params, { isBack } = {}) {
  root.classList.add('has-topbar');
  let mode = getBodyMode();
  let week = isBack && rememberedWeek ? rememberedWeek : startOfWeek(new Date());

  const row = (m, cls, value, sub = '') => `<button class="row muscle-row" data-muscle="${m.id}">
      <span class="dot ${cls || ''}"></span>
      <span class="grow"><span class="row-title">${esc(m.name)}</span>${sub ? `<span class="row-sub" style="display:block">${sub}</span>` : ''}</span>
      <span class="row-value">${value}</span>${icon('chevronRight', 'chev')}</button>`;

  const draw = () => {
    rememberedWeek = week;
    const isCurrent = week.getTime() === startOfWeek(new Date()).getTime();
    let classes, rows;
    if (mode === 'week') {
      const sets = weekSets(week);
      classes = weekClasses(sets);
      rows = MUSCLES.map((m) => ({ m, v: sets[m.id] || 0 }))
        .sort((a, b) => b.v - a.v || a.m.name.localeCompare(b.m.name, 'de'))
        .map(({ m, v }) => row(m, weekLevel(v), v ? `${fmtNum(v, 1)} ${v === 1 ? 'Satz' : 'Sätze'}` : '–'));
    } else {
      const rec = recovery(new Date());
      classes = recoveryClasses(rec);
      rows = MUSCLES.map((m) => ({ m, r: rec[m.id] }))
        .sort((a, b) => b.r.fatigue - a.r.fatigue || a.m.name.localeCompare(b.m.name, 'de'))
        .map(({ m, r }) => row(m, classes[m.id], RECOVERY_LABEL[r.status],
          (r.status === 'tired' || r.status === 'almost') ? `erholt in ca. ${fmtHours(r.recoveredInH)}` : ''));
    }
    const end = addDays(week, 6);
    root.innerHTML = `
      ${topbar({ title: 'Muskeln', back: '#/start' })}
      ${bodyModeSeg(mode)}
      ${mode === 'week' ? `
        <div class="week-nav mt-12">
          <button class="icon-btn" data-week="-1" aria-label="Vorherige Woche">${icon('chevronLeft')}</button>
          <div class="label"><strong>KW ${isoWeek(week).week}${isCurrent ? ' · diese Woche' : ''}</strong>
            <span>${fmtDayMonthShort(week)} – ${fmtDayMonthShort(end)}</span></div>
          <button class="icon-btn" data-week="1" ${isCurrent ? 'disabled' : ''} aria-label="Nächste Woche">${icon('chevronRight')}</button>
        </div>` : '<div class="mt-12"></div>'}
      <div class="card body-big">
        ${bodyMapHTML({ classes, cls: 'tappable' })}
        <div class="mt-12">${mode === 'week' ? legendWeek() : legendRecovery()}</div>
      </div>
      ${mode === 'recovery' ? `<div class="info-note mt-12">${icon('info')}<span>Richtwert auf Basis von Trainingsvolumen und typischer Erholungszeit der Muskelgruppe – dein Körpergefühl geht vor.</span></div>` : ''}
      <h2 class="section-title">${mode === 'week' ? 'Effektive Sätze' : 'Status'}</h2>
      <div class="list">${rows.join('')}</div>
      ${mode === 'week' ? '<p class="small muted mt-12 center">Hauptmuskel zählt 1 Satz, Nebenmuskel 0,5. Aufwärmsätze zählen nicht.</p>' : ''}`;
  };

  draw();
  const offs = [
    on(root, 'click', '[data-bodymode]', (e, b) => { mode = b.dataset.bodymode; setBodyMode(mode); draw(); }),
    on(root, 'click', '[data-week]', (e, b) => { week = addDays(week, 7 * Number(b.dataset.week)); draw(); }),
    on(root, 'click', '[data-muscle]', (e, b) => navigate('#/muskel/' + b.dataset.muscle)),
    db.subscribe(draw),
  ];
  return () => offs.forEach((f) => f());
}
