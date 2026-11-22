// Muskeln am grossen Koerper waehlen (Vollbild-Sheet): 1× tippen Haupt, 2× Neben, 3× entfernen.
// Arbeitet direkt auf dem Zustand des Aufrufers (state/cycle), damit Editor und Vollbild gleich bleiben.

import { openSheet } from './sheet.js';
import { figureSVG, applyClasses, legendSelect } from './body-map.js';
import { MUSCLES, MUSCLE, MUSCLE_GROUPS } from '../data/muscles.js';
import { esc } from '../lib/dom.js';

const ORDER = MUSCLE_GROUPS.flatMap((g) => g.muscles);
const HINT = '1× tippen Haupt · 2× Neben · 3× entfernen';

/**
 * openMusclePicker({ state(m) -> 'pri' | 'sec' | '', cycle(m) -> Statustext, view: 'front' | 'back' })
 * -> Promise, erfuellt beim Schliessen mit der zuletzt gezeigten Ansicht. Jede Aenderung gilt sofort.
 */
export function openMusclePicker({ state, cycle, view = 'front' }) {
  return new Promise((resolve) => {
    let cur = view === 'back' ? 'back' : 'front';
    const classes = () => Object.fromEntries(MUSCLES.map((m) => [m.id, state(m.id)]));
    const chosen = () => {
      const sel = ORDER.filter((m) => state(m));
      if (!sel.length) return '<span class="mp-empty">Noch kein Muskel gewählt</span>';
      return sel.map((m) => {
        const s = state(m);
        return `<button type="button" class="chip m-chip ${s}" data-mpchip="${m}">${esc(MUSCLE[m].name)}<small>${s === 'pri' ? 'Haupt' : 'Neben'}</small></button>`;
      }).join('');
    };

    const s = openSheet({
      title: 'Muskeln wählen',
      full: true,
      cls: 'mp-sheet',
      headRight: '<button type="button" class="btn btn-sm" data-mpdone>Fertig</button>',
      body: `<div class="mp">
        <div class="seg sm mp-seg" role="tablist" aria-label="Ansicht">
          <button type="button" data-mpview="front" class="${cur === 'front' ? 'on' : ''}">Vorne</button>
          <button type="button" data-mpview="back" class="${cur === 'back' ? 'on' : ''}">Hinten</button>
        </div>
        <div class="mp-fig no-sheet-drag">${figureSVG(cur, classes(), { hit: true })}</div>
        <p class="mp-status" aria-live="polite">${HINT}</p>
        ${legendSelect()}
        <div class="chips mp-sel no-sheet-drag">${chosen()}</div>
      </div>`,
      onClose: () => resolve(cur),
    });

    const root = s.el;
    const refresh = (status) => {
      applyClasses(root.querySelector('.mp-fig'), classes());
      root.querySelector('.mp-sel').innerHTML = chosen();
      if (status) root.querySelector('.mp-status').textContent = status;
    };
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-mpdone]')) { s.close(); return; }
      const v = e.target.closest('[data-mpview]');
      if (v) {
        if (v.dataset.mpview === cur) return;
        cur = v.dataset.mpview;
        root.querySelectorAll('[data-mpview]').forEach((b) => b.classList.toggle('on', b === v));
        root.querySelector('.mp-fig').innerHTML = figureSVG(cur, classes(), { hit: true });
        return;
      }
      const t = e.target.closest('.mp-fig [data-muscle], [data-mpchip]');
      if (t) refresh(cycle(t.dataset.muscle || t.dataset.mpchip));
    });
  });
}
