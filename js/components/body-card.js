// Karte mit Muskel-Mensch (vorne + hinten) und Umschalter Woche | Erholung.

import { bodyMapHTML, weekClasses, legendWeek, legendRecovery } from './body-map.js';
import { weekSets, recovery, recoveryClasses } from '../lib/muscle-load.js';
import { isoWeek } from '../lib/format.js';
import { icon } from '../lib/icons.js';

const KEY = 'training-bodymode';
export function getBodyMode() { try { return localStorage.getItem(KEY) === 'recovery' ? 'recovery' : 'week'; } catch (e) { return 'week'; } }
export function setBodyMode(m) { try { localStorage.setItem(KEY, m); } catch (e) { /* egal */ } }

export function bodyModeSeg(mode) {
  return `<div class="seg sm" role="tablist" aria-label="Ansicht">
    <button data-bodymode="week" class="${mode === 'week' ? 'on' : ''}" role="tab" aria-selected="${mode === 'week'}">Woche</button>
    <button data-bodymode="recovery" class="${mode === 'recovery' ? 'on' : ''}" role="tab" aria-selected="${mode === 'recovery'}">Erholung</button>
  </div>`;
}

/** Inhalt der Karte (ohne Kartenrahmen). */
export function bodyCardInner(mode, { title = 'Muskeln', hint = true } = {}) {
  const now = new Date();
  const classes = mode === 'week' ? weekClasses(weekSets(now)) : recoveryClasses(recovery(now));
  return `<div class="body-card-head">
      <div class="grow">
        <div class="card-title">${title}</div>
        <div class="card-sub">${mode === 'week' ? `KW ${isoWeek(now).week} · Sätze` : 'Richtwert'}</div>
      </div>
      ${bodyModeSeg(mode)}
    </div>
    <div class="body-card-fig" data-open-body>${bodyMapHTML({ classes, cls: 'tappable' })}</div>
    <div class="mt-12">${mode === 'week' ? legendWeek() : legendRecovery()}</div>
    ${hint ? `<div class="body-card-more">${icon('chevronRight')}</div>` : ''}`;
}
