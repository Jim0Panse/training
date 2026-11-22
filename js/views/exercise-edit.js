// Uebung anlegen / bearbeiten: Name, Muskeln per Figur (1x Haupt, 2x Neben, 3x weg) + Chips,
// Kategorie, Equipment, Erfassungsart (Vorschlag), Steigerungsschritt, Notiz.

import * as db from '../db.js';
import { bodyMapHTML, applyClasses, legendSelect } from '../components/body-map.js';
import { openMusclePicker } from '../components/muscle-picker.js';
import { MUSCLES, MUSCLE, MUSCLE_GROUPS } from '../data/muscles.js';
import { CATEGORIES, EQUIPMENT, TRACKING, DEFAULT_INCREMENT, suggestTracking } from '../data/exercises.js';
import { confirmSheet } from '../components/sheet.js';
import { on, esc, uid, toast } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { parseNum, numToInput } from '../lib/format.js';
import { navigate, goBack } from '../router.js';

/** Vorbelegung fuer „neue Uebung“ (z. B. Suchbegriff) und Rueckmeldung an die Uebungsauswahl */
export const prefill = { name: '', onSaved: null };

const NEEDS_PRIMARY = (cat) => cat === 'kraft' || cat === 'plyometrie';
const WEIGHTED = (t) => t === 'gewicht_wdh' || t === 'zusatzgewicht_wdh';
const ORDERED_MUSCLES = MUSCLE_GROUPS.flatMap((g) => g.muscles);

let figView = 'front';

export function render(root, params) {
  root.classList.add('has-topbar');
  const existing = params.id ? db.exercise(params.id) : null;
  if (params.id && !existing) {
    root.innerHTML = `<header class="topbar"><button class="icon-btn" data-back="#/uebungen" aria-label="Zurück">${icon('chevronLeft')}</button><h1 class="topbar-title">Übung</h1><span></span></header>
      <div class="empty"><strong>Übung nicht gefunden</strong></div>`;
    return;
  }
  const onSaved = prefill.onSaved;
  const d = existing
    ? { ...existing, primary: [...existing.primary], secondary: [...existing.secondary] }
    : { name: prefill.name || '', primary: [], secondary: [], category: 'kraft', equipment: 'langhantel', tracking: 'gewicht_wdh', incrementKg: 2.5, note: '' };
  prefill.name = ''; prefill.onSaved = null;
  let trackingTouched = !!existing && d.tracking !== suggestTracking(d.category, d.equipment);
  let incTouched = !!existing && d.incrementKg !== DEFAULT_INCREMENT[d.equipment];
  const original = JSON.stringify(d);
  let showErrors = false;
  let lastTap = '';

  const state = (m) => (d.primary.includes(m) ? 'pri' : d.secondary.includes(m) ? 'sec' : '');
  const classes = () => Object.fromEntries(MUSCLES.map((m) => [m.id, state(m.id)]));
  const cycle = (m) => {
    const s = state(m);
    d.primary = d.primary.filter((x) => x !== m);
    d.secondary = d.secondary.filter((x) => x !== m);
    if (s === '') d.primary.push(m);
    else if (s === 'pri') d.secondary.push(m);
    const now = state(m);
    lastTap = `${MUSCLE[m].name}: ${now === 'pri' ? 'Hauptmuskel' : now === 'sec' ? 'Nebenmuskel' : 'entfernt'}`;
    return lastTap;
  };
  const errors = () => ({
    name: !d.name.trim() ? 'Bitte gib einen Namen ein.' : '',
    muscles: NEEDS_PRIMARY(d.category) && !d.primary.length ? 'Wähle mindestens einen Hauptmuskel.' : '',
  });

  const chip = (attr, val, label, on) => `<button type="button" class="chip ${on ? 'on' : ''}" ${attr}="${val}">${esc(label)}</button>`;
  const muscleChips = () => ORDERED_MUSCLES.map((m) => {
    const s = state(m);
    return `<button type="button" class="chip m-chip ${s}" data-mchip="${m}" aria-pressed="${!!s}">${esc(MUSCLE[m].name)}${s ? `<small>${s === 'pri' ? 'Haupt' : 'Neben'}</small>` : ''}</button>`;
  }).join('');
  const summary = () => {
    const names = (arr) => arr.map((m) => MUSCLE[m].name).join(', ') || '–';
    return `<div><span class="field-label">Haupt</span> ${esc(names(d.primary))}</div><div><span class="field-label">Neben</span> ${esc(names(d.secondary))}</div>`;
  };

  const draw = () => {
    const err = showErrors ? errors() : {};
    root.innerHTML = `
      <header class="topbar">
        <button class="icon-btn" data-cancel aria-label="Abbrechen">${icon('chevronLeft')}</button>
        <h1 class="topbar-title">${existing ? 'Übung bearbeiten' : 'Neue Übung'}</h1><span></span>
      </header>
      <form class="stack form" novalidate>
        <label class="field">
          <span class="field-label">Name</span>
          <input class="input ${err.name ? 'invalid' : ''}" name="name" type="text" autocomplete="off" enterkeyhint="done" value="${esc(d.name)}" placeholder="z. B. Schrägbankdrücken" maxlength="80">
          ${err.name ? `<span class="field-error">${err.name}</span>` : ''}
        </label>

        <section class="card muscle-pick ${err.muscles ? 'invalid' : ''}">
          <div class="row-flex">
            <div class="grow"><div class="card-title">Muskeln</div><div class="card-sub">1× tippen Haupt · 2× Neben · 3× entfernen</div></div>
            <button type="button" class="btn btn-secondary btn-sm mp-open" data-bigpick>${icon('expand')}Vollbild</button>
          </div>
          <div class="seg sm mt-12" role="tablist" aria-label="Ansicht">
            <button type="button" data-view="front" class="${figView === 'front' ? 'on' : ''}">Vorne</button>
            <button type="button" data-view="back" class="${figView === 'back' ? 'on' : ''}">Hinten</button>
          </div>
          <div class="edit-fig mt-12">${bodyMapHTML({ classes: classes(), cls: 'tappable single', views: [figView], labels: false, hit: true })}</div>
          <p class="tap-status" aria-live="polite">${esc(lastTap)}</p>
          ${legendSelect()}
          <div class="chips m-chips mt-12">${muscleChips()}</div>
          <div class="muscle-summary mt-12">${summary()}</div>
          ${err.muscles ? `<p class="field-error mt-8">${err.muscles}</p>` : ''}
        </section>

        <div class="field">
          <span class="field-label">Kategorie</span>
          <div class="chips">${Object.entries(CATEGORIES).map(([k, v]) => chip('data-cat', k, v, d.category === k)).join('')}</div>
        </div>
        <div class="field">
          <span class="field-label">Equipment</span>
          <div class="chips">${Object.entries(EQUIPMENT).map(([k, v]) => chip('data-eq', k, v, d.equipment === k)).join('')}</div>
        </div>
        <div class="field">
          <span class="field-label">Erfassung ${trackingTouched ? '' : '<span class="hint-inline">· Vorschlag</span>'}</span>
          <div class="chips">${Object.entries(TRACKING).map(([k, v]) => chip('data-tr', k, v, d.tracking === k)).join('')}</div>
        </div>
        ${WEIGHTED(d.tracking) ? `
        <label class="field">
          <span class="field-label">Steigerungsschritt</span>
          <div class="input-unit"><input class="input" name="inc" type="text" inputmode="decimal" autocomplete="off" value="${esc(numToInput(d.incrementKg))}"><span>kg</span></div>
          <span class="field-hint">So viel schlägt die App vor draufzupacken, wenn du alle Sätze geschafft hast.</span>
        </label>` : ''}
        <label class="field">
          <span class="field-label">Notiz</span>
          <textarea class="input" name="note" rows="2" placeholder="z. B. Sitz Stufe 4">${esc(d.note)}</textarea>
        </label>
        <div class="info-note">${icon('info')}<span>Ob du Maximalkraft oder Muskelaufbau trainierst, legst du im Workout über Sätze und Wiederholungen fest – nicht hier.</span></div>
      </form>
      <div class="sticky-actions"><button class="btn" data-save>${icon('check')}Speichern</button></div>`;
  };

  const refreshMuscles = () => {
    applyClasses(root.querySelector('.edit-fig'), classes());
    root.querySelector('.m-chips').innerHTML = muscleChips();
    root.querySelector('.muscle-summary').innerHTML = summary();
    root.querySelector('.tap-status').textContent = lastTap;
    if (showErrors) {
      const errMuscles = errors().muscles;
      const box = root.querySelector('.muscle-pick');
      box.classList.toggle('invalid', !!errMuscles);
      const p = box.querySelector('.field-error');
      if (p && !errMuscles) p.remove();
    }
  };
  const readInputs = () => {
    const f = root.querySelector('form');
    d.name = f.elements.name.value;
    d.note = f.elements.note.value;
    if (f.elements.inc) {
      const v = parseNum(f.elements.inc.value);
      if (v != null && v > 0) d.incrementKg = v;
    }
  };
  const isDirty = () => { readInputs(); return JSON.stringify(d) !== original; };

  async function save() {
    readInputs();
    const err = errors();
    if (err.name || err.muscles) {
      showErrors = true;
      draw();
      const first = root.querySelector('.invalid');
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const ex = {
      ...(existing || { id: uid(), builtIn: false, archived: false }),
      name: d.name.trim().replace(/\s+/g, ' '),
      primary: d.primary,
      secondary: d.secondary.filter((m) => !d.primary.includes(m)),
      category: d.category,
      equipment: d.equipment,
      tracking: d.tracking,
      incrementKg: d.incrementKg,
      note: d.note.trim(),
    };
    await db.putExercise(ex);
    toast(existing ? 'Gespeichert' : 'Übung angelegt');
    if (onSaved) { onSaved(ex.id); goBack('#/uebungen'); return; }
    if (existing) goBack(`#/uebung/${ex.id}`);
    else navigate(`#/uebung/${ex.id}`, { replace: true });
  }

  draw();
  const offs = [
    on(root, 'click', '[data-view]', (e, b) => { readInputs(); figView = b.dataset.view; draw(); }),
    on(root, 'click', '[data-bigpick]', async () => {
      await openMusclePicker({ state, cycle, view: figView });
      refreshMuscles();
    }),
    on(root, 'click', '.edit-fig [data-muscle]', (e, g) => { cycle(g.dataset.muscle); refreshMuscles(); }),
    on(root, 'click', '[data-mchip]', (e, b) => { cycle(b.dataset.mchip); refreshMuscles(); }),
    on(root, 'click', '[data-cat]', (e, b) => {
      readInputs();
      d.category = b.dataset.cat;
      if (!trackingTouched) d.tracking = suggestTracking(d.category, d.equipment);
      draw();
    }),
    on(root, 'click', '[data-eq]', (e, b) => {
      readInputs();
      d.equipment = b.dataset.eq;
      if (!trackingTouched) d.tracking = suggestTracking(d.category, d.equipment);
      if (!incTouched) d.incrementKg = DEFAULT_INCREMENT[d.equipment];
      draw();
    }),
    on(root, 'click', '[data-tr]', (e, b) => { readInputs(); d.tracking = b.dataset.tr; trackingTouched = true; draw(); }),
    on(root, 'input', 'input[name="inc"]', () => { incTouched = true; }),
    on(root, 'input', 'input[name="name"]', () => {
      if (showErrors && root.querySelector('input[name="name"]').value.trim()) {
        root.querySelector('input[name="name"]').classList.remove('invalid');
        const p = root.querySelector('input[name="name"] + .field-error');
        if (p) p.remove();
      }
    }),
    on(root, 'submit', 'form', (e) => { e.preventDefault(); }),
    on(root, 'keydown', 'input', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }),
    on(root, 'click', '[data-save]', () => save()),
    on(root, 'click', '[data-cancel]', async () => {
      if (isDirty() && !(await confirmSheet({ title: 'Änderungen verwerfen?', confirm: 'Verwerfen', cancel: 'Weiter bearbeiten', danger: true }))) return;
      goBack(existing ? `#/uebung/${existing.id}` : '#/uebungen');
    }),
  ];
  return () => offs.forEach((f) => f());
}
