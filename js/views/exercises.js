// Uebungen-Tab: Suche, Filter-Symbol oben (Muskelgruppe, Kategorie, Archivierte), alphabetische Liste.

import * as db from '../db.js';
import { pageHead } from '../components/header.js';
import { openSheet } from '../components/sheet.js';
import { MUSCLE_GROUPS } from '../data/muscles.js';
import { CATEGORIES } from '../data/exercises.js';
import { filterExercises, exerciseMeta, firstLetter } from '../lib/exercise-search.js';
import { on, esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { navigate } from '../router.js';
import { prefill } from './exercise-edit.js';

// Bleibt beim Zurueckkehren aus dem Detail erhalten
const ui = { q: '', group: null, cat: null, archived: false };

const activeCount = () => (ui.group ? 1 : 0) + (ui.cat ? 1 : 0) + (ui.archived ? 1 : 0);
const resetFilters = () => { ui.group = null; ui.cat = null; ui.archived = false; };

function filterSummary() {
  const parts = [];
  if (ui.group) parts.push(MUSCLE_GROUPS.find((g) => g.id === ui.group)?.name);
  if (ui.cat) parts.push(CATEGORIES[ui.cat]);
  if (ui.archived) parts.push('mit archivierten');
  return parts.filter(Boolean).join(', ');
}

const rowHTML = (ex) => `<a class="row" href="#/uebung/${esc(ex.id)}">
    <span class="grow"><span class="row-title ellipsis">${esc(ex.name)}</span><span class="row-sub ellipsis">${esc(exerciseMeta(ex))}</span></span>
    ${ex.archived ? '<span class="chip-sm">Archiviert</span>' : ''}${icon('chevronRight', 'chev')}
  </a>`;

function filterBtnHTML() {
  const n = activeCount();
  return `<button class="icon-btn filter-btn ${n ? 'on' : ''}" type="button" data-filter aria-label="Filter${n ? ` (${n} aktiv)` : ''}">${icon('sliders')}${n ? `<span class="badge">${n}</span>` : ''}</button>`;
}

function listHTML() {
  const list = filterExercises(ui);
  const n = activeCount();
  const reset = n ? `<button class="link-btn inline" type="button" data-reset>Filter löschen</button>` : '';
  if (!list.length) {
    return `<div class="empty"><strong>Keine Übung gefunden</strong>${ui.q ? 'Lege sie einfach neu an.' : 'Ändere die Filter oder lege eine neue Übung an.'}
      ${n && !ui.q ? `<div class="mt-8">${reset}</div>` : ''}
      <button class="btn btn-card mt-16" data-new>${icon('plus')}${ui.q ? `„${esc(ui.q)}“ anlegen` : 'Neue Übung'}</button></div>`;
  }
  const count = `<p class="list-count">${list.length} ${list.length === 1 ? 'Übung' : 'Übungen'}${n ? ` · ${esc(filterSummary())}${reset}` : ''}</p>`;
  if (ui.q) return `${count}<div class="list">${list.map(rowHTML).join('')}</div>`;
  const groups = new Map();
  list.forEach((ex) => {
    const l = firstLetter(ex.name);
    if (!groups.has(l)) groups.set(l, []);
    groups.get(l).push(ex);
  });
  return count + [...groups].map(([l, items]) => `<div class="letter">${l}</div><div class="list">${items.map(rowHTML).join('')}</div>`).join('');
}

/** Filter-Blatt: Aenderungen wirken sofort auf die Liste dahinter */
function openFilters(onChange) {
  const body = () => {
    const archivedCount = db.state.exercises.filter((e) => e.archived).length;
    return `
      <div class="field-label">Muskelgruppe</div>
      <div class="chips mt-8">${MUSCLE_GROUPS.map((g) => `<button class="chip ${ui.group === g.id ? 'on' : ''}" type="button" data-group="${g.id}" aria-pressed="${ui.group === g.id}">${esc(g.name)}</button>`).join('')}</div>
      <div class="field-label mt-16">Kategorie</div>
      <div class="chips mt-8">${Object.entries(CATEGORIES).map(([id, name]) => `<button class="chip ${ui.cat === id ? 'on' : ''}" type="button" data-cat="${id}" aria-pressed="${ui.cat === id}">${esc(name)}</button>`).join('')}</div>
      ${archivedCount ? `<div class="set-line">
        <label class="grow" for="f-archived"><span class="row-title">Archivierte anzeigen</span><span class="row-sub">${archivedCount} ${archivedCount === 1 ? 'Übung' : 'Übungen'}</span></label>
        <label class="switch"><input type="checkbox" id="f-archived" ${ui.archived ? 'checked' : ''}><span></span></label>
      </div>` : ''}
      <div class="btn-row mt-24">
        <button class="btn btn-secondary" type="button" data-f-reset ${activeCount() ? '' : 'disabled'}>Zurücksetzen</button>
        <button class="btn" type="button" data-f-done>Fertig</button>
      </div>`;
  };
  const s = openSheet({ title: 'Filter', body: body() });
  const changed = () => { s.body.innerHTML = body(); onChange(); };
  s.body.addEventListener('click', (e) => {
    const g = e.target.closest('[data-group]');
    if (g) { ui.group = ui.group === g.dataset.group ? null : g.dataset.group; changed(); return; }
    const c = e.target.closest('[data-cat]');
    if (c) { ui.cat = ui.cat === c.dataset.cat ? null : c.dataset.cat; changed(); return; }
    if (e.target.closest('[data-f-reset]')) { resetFilters(); changed(); return; }
    if (e.target.closest('[data-f-done]')) s.close();
  });
  s.body.addEventListener('change', (e) => {
    if (e.target.id === 'f-archived') { ui.archived = e.target.checked; changed(); }
  });
}

export function render(root) {
  if (!db.state.exercises.some((e) => e.archived)) ui.archived = false;
  root.innerHTML = `
    ${pageHead({
      title: 'Übungen',
      actions: `<span class="contents" id="ex-filter">${filterBtnHTML()}</span><a class="icon-btn" href="#/neue-uebung" aria-label="Neue Übung">${icon('plus')}</a>`,
    })}
    <label class="search">${icon('search')}
      <input class="input" type="text" inputmode="search" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Übung suchen" value="${esc(ui.q)}" aria-label="Übung suchen">
      <button class="search-clear ${ui.q ? '' : 'hidden'}" type="button" aria-label="Suche leeren">${icon('close')}</button>
    </label>
    <div id="ex-list">${listHTML()}</div>`;

  const input = root.querySelector('.search input');
  const clearBtn = root.querySelector('.search-clear');
  const listEl = root.querySelector('#ex-list');
  const filterEl = root.querySelector('#ex-filter');
  const refreshList = () => { listEl.innerHTML = listHTML(); };
  const refreshAll = () => { filterEl.innerHTML = filterBtnHTML(); refreshList(); };

  const offs = [
    on(root, 'input', '.search input', () => {
      ui.q = input.value;
      clearBtn.classList.toggle('hidden', !ui.q);
      refreshList();
    }),
    on(root, 'keydown', '.search input', (e) => { if (e.key === 'Enter') input.blur(); }),
    on(root, 'click', '.search-clear', () => {
      ui.q = ''; input.value = ''; clearBtn.classList.add('hidden'); refreshList(); input.focus();
    }),
    on(root, 'click', '[data-filter]', () => openFilters(refreshAll)),
    on(root, 'click', '[data-reset]', () => { resetFilters(); refreshAll(); }),
    on(root, 'click', '[data-new]', () => { prefill.name = ui.q.trim(); navigate('#/neue-uebung'); }),
    db.subscribe(refreshAll),
  ];
  return () => offs.forEach((f) => f());
}
