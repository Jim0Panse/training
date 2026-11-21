// Uebungsauswahl als Bottom-Sheet: Suche + Muskelfilter, Mehrfach- oder Einzelauswahl.
// pickExercises({ title, multi, confirmLabel }) -> Promise<{ ids: string[], create: string|null }>

import { openSheet } from './sheet.js';
import { MUSCLE_GROUPS } from '../data/muscles.js';
import { filterExercises, exerciseMeta } from '../lib/exercise-search.js';
import { esc, on } from '../lib/dom.js';
import { icon } from '../lib/icons.js';

export function pickExercises({ title = 'Übung hinzufügen', multi = true, confirmLabel = 'Hinzufügen' } = {}) {
  return new Promise((resolve) => {
    const ui = { q: '', group: null };
    const picked = [];
    let result = { ids: [], create: null };

    const rows = () => {
      const list = filterExercises(ui);
      const create = `<button class="row pick-create" data-create>${icon('plus')}<span class="grow">${ui.q.trim() ? `„${esc(ui.q.trim())}“ als neue Übung anlegen` : 'Neue Übung anlegen'}</span></button>`;
      if (!list.length) return `<div class="empty">Keine Übung gefunden.</div><div class="list">${create}</div>`;
      return `<div class="list">${list.map((ex) => {
        const n = picked.indexOf(ex.id);
        return `<button class="row pick-row ${n >= 0 ? 'sel' : ''}" data-pick="${esc(ex.id)}" aria-pressed="${n >= 0}">
          <span class="grow"><span class="row-title ellipsis">${esc(ex.name)}</span><span class="row-sub ellipsis">${esc(exerciseMeta(ex))}</span></span>
          ${multi ? `<span class="pick-check">${n >= 0 ? (picked.length > 1 ? n + 1 : icon('check')) : ''}</span>` : icon('chevronRight', 'chev')}
        </button>`;
      }).join('')}</div><div class="list mt-12">${create}</div>`;
    };
    const chips = () => `<button class="chip ${!ui.group ? 'on' : ''}" data-group="">Alle</button>${MUSCLE_GROUPS.map((g) => `<button class="chip ${ui.group === g.id ? 'on' : ''}" data-group="${g.id}">${esc(g.name)}</button>`).join('')}`;
    const footer = () => `${icon('plus')}${esc(confirmLabel)}${picked.length ? ` (${picked.length})` : ''}`;

    const s = openSheet({
      title,
      full: true,
      cls: 'picker-sheet',
      body: `<div class="picker-top">
          <label class="search">${icon('search')}<input class="input" type="text" inputmode="search" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Übung suchen" aria-label="Übung suchen"></label>
          <div class="chips-scroll picker-chips">${chips()}</div>
        </div>
        <div class="picker-list">${rows()}</div>
        ${multi ? `<div class="picker-foot"><button class="btn" data-done disabled>${footer()}</button></div>` : ''}`,
      onClose: () => resolve(result),
    });
    const body = s.body;
    const input = body.querySelector('input');
    const listEl = body.querySelector('.picker-list');
    const doneBtn = body.querySelector('[data-done]');
    const refresh = () => {
      listEl.innerHTML = rows();
      if (doneBtn) { doneBtn.innerHTML = footer(); doneBtn.disabled = !picked.length; }
    };

    on(body, 'input', 'input', () => { ui.q = input.value; refresh(); });
    on(body, 'keydown', 'input', (e) => { if (e.key === 'Enter') input.blur(); });
    on(body, 'click', '[data-group]', (e, b) => {
      const g = b.dataset.group || null;
      ui.group = ui.group === g ? null : g;
      body.querySelector('.picker-chips').innerHTML = chips();
      refresh();
    });
    on(body, 'click', '[data-pick]', (e, b) => {
      const id = b.dataset.pick;
      if (!multi) { result = { ids: [id], create: null }; s.close(); return; }
      const i = picked.indexOf(id);
      if (i >= 0) picked.splice(i, 1); else picked.push(id);
      refresh();
    });
    on(body, 'click', '[data-done]', () => { result = { ids: [...picked], create: null }; s.close(); });
    on(body, 'click', '[data-create]', () => { result = { ids: [...picked], create: ui.q.trim() }; s.close(); });
  });
}
