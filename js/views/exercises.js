// Uebungen-Tab: Suche, Filter nach Muskelgruppe und Kategorie, Archiv, alphabetische Liste.

import * as db from '../db.js';
import { pageHead } from '../components/header.js';
import { MUSCLE_GROUPS } from '../data/muscles.js';
import { CATEGORIES } from '../data/exercises.js';
import { filterExercises, exerciseMeta, firstLetter } from '../lib/exercise-search.js';
import { on, esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { navigate } from '../router.js';
import { prefill } from './exercise-edit.js';

// Bleibt beim Zurueckkehren aus dem Detail erhalten
const ui = { q: '', group: null, cat: null, archived: false };

const rowHTML = (ex) => `<a class="row" href="#/uebung/${esc(ex.id)}">
    <span class="grow"><span class="row-title ellipsis">${esc(ex.name)}</span><span class="row-sub ellipsis">${esc(exerciseMeta(ex))}</span></span>
    ${ex.archived ? '<span class="chip-sm">Archiviert</span>' : ''}${icon('chevronRight', 'chev')}
  </a>`;

function listHTML() {
  const list = filterExercises(ui);
  if (!list.length) {
    return `<div class="empty"><strong>Keine Übung gefunden</strong>${ui.q ? 'Lege sie einfach neu an.' : 'Ändere die Filter oder lege eine neue Übung an.'}
      <button class="btn btn-card mt-16" data-new>${icon('plus')}${ui.q ? `„${esc(ui.q)}“ anlegen` : 'Neue Übung'}</button></div>`;
  }
  const count = `<p class="list-count">${list.length} ${list.length === 1 ? 'Übung' : 'Übungen'}</p>`;
  if (ui.q) return `${count}<div class="list">${list.map(rowHTML).join('')}</div>`;
  const groups = new Map();
  list.forEach((ex) => {
    const l = firstLetter(ex.name);
    if (!groups.has(l)) groups.set(l, []);
    groups.get(l).push(ex);
  });
  return count + [...groups].map(([l, items]) => `<div class="letter">${l}</div><div class="list">${items.map(rowHTML).join('')}</div>`).join('');
}

function chipsHTML() {
  const archivedCount = db.state.exercises.filter((e) => e.archived).length;
  return `<div class="chips-scroll" role="group" aria-label="Muskelgruppe">
      <button class="chip ${!ui.group ? 'on' : ''}" data-group="">Alle</button>
      ${MUSCLE_GROUPS.map((g) => `<button class="chip ${ui.group === g.id ? 'on' : ''}" data-group="${g.id}">${esc(g.name)}</button>`).join('')}
    </div>
    <div class="chips-scroll" role="group" aria-label="Kategorie">
      ${Object.entries(CATEGORIES).map(([id, name]) => `<button class="chip ${ui.cat === id ? 'on' : ''}" data-cat="${id}">${esc(name)}</button>`).join('')}
      ${archivedCount ? `<button class="chip ${ui.archived ? 'on' : ''}" data-archived>${icon('layers')}Archiviert (${archivedCount})</button>` : ''}
    </div>`;
}

export function render(root) {
  if (!db.state.exercises.some((e) => e.archived)) ui.archived = false;
  root.innerHTML = `
    ${pageHead({
      title: 'Übungen',
      actions: `<a class="icon-btn" href="#/neue-uebung" aria-label="Neue Übung">${icon('plus')}</a>`,
    })}
    <label class="search">${icon('search')}
      <input class="input" type="text" inputmode="search" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Übung suchen" value="${esc(ui.q)}" aria-label="Übung suchen">
      <button class="search-clear ${ui.q ? '' : 'hidden'}" type="button" aria-label="Suche leeren">${icon('close')}</button>
    </label>
    <div class="filters" id="ex-filters">${chipsHTML()}</div>
    <div id="ex-list">${listHTML()}</div>`;

  const input = root.querySelector('.search input');
  const clearBtn = root.querySelector('.search-clear');
  const listEl = root.querySelector('#ex-list');
  const filtersEl = root.querySelector('#ex-filters');
  const refreshList = () => { listEl.innerHTML = listHTML(); };
  const refreshAll = () => { filtersEl.innerHTML = chipsHTML(); refreshList(); };

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
    on(root, 'click', '[data-group]', (e, b) => {
      const g = b.dataset.group || null;
      ui.group = ui.group === g ? null : g;
      refreshAll();
    }),
    on(root, 'click', '[data-cat]', (e, b) => { ui.cat = ui.cat === b.dataset.cat ? null : b.dataset.cat; refreshAll(); }),
    on(root, 'click', '[data-archived]', () => { ui.archived = !ui.archived; refreshAll(); }),
    on(root, 'click', '[data-new]', () => { prefill.name = ui.q.trim(); navigate('#/neue-uebung'); }),
    db.subscribe(refreshAll),
  ];
  return () => offs.forEach((f) => f());
}
