// Workout-Vorlage anlegen / bearbeiten: Name, Hinweis, Uebungen (Ziehgriff sortieren),
// pro Uebung Saetze, Wdh. von–bis, Notiz; Supersatz zwischen zwei Uebungen verbinden/loesen.

import * as db from '../db.js';
import { actionSheet, confirmSheet } from '../components/sheet.js';
import { pickExercises } from '../components/exercise-picker.js';
import { groupInfo, toggleLink, moveItem, normalizeGroups } from '../lib/workout.js';
import { sortable } from '../lib/sortable.js';
import { on, esc, uid, toast, clamp } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { navigate, goBack } from '../router.js';
import { prefill } from './exercise-edit.js';

// Entwurf bleibt erhalten, waehrend man zwischendurch eine neue Uebung anlegt
let draft = null;

const REP_BASED = new Set(['gewicht_wdh', 'zusatzgewicht_wdh', 'wdh']);

function newItem(exerciseId) {
  const ex = db.exercise(exerciseId);
  const plyo = ex && ex.category === 'plyometrie';
  const reps = ex && REP_BASED.has(ex.tracking);
  return {
    exerciseId, sets: 3,
    repsMin: reps ? (plyo ? 5 : 8) : null,
    repsMax: reps ? (plyo ? 5 : 10) : null,
    supersetGroup: null, note: '', startKg: null,
  };
}

const intOrNull = (v) => {
  const s = String(v ?? '').replace(/\D/g, '');
  return s ? Math.min(999, parseInt(s, 10)) : null;
};

export function render(root, params, { isBack } = {}) {
  root.classList.add('has-topbar');
  const isNew = params.id === 'neu';
  const existing = isNew ? null : db.template(params.id);
  if (!isNew && !existing) {
    root.innerHTML = `<header class="topbar"><button class="icon-btn" data-back="#/workout-auswahl" aria-label="Zurück">${icon('chevronLeft')}</button><h1 class="topbar-title">Workout</h1><span></span></header>
      <div class="empty"><strong>Workout nicht gefunden</strong></div>`;
    return;
  }
  if (!(isBack && draft && draft.key === params.id)) {
    const t = existing
      ? JSON.parse(JSON.stringify(existing))
      : { id: uid(), name: '', builtIn: false, order: Math.max(-1, ...db.state.templates.map((x) => x.order ?? 0)) + 1, note: '', cardNote: '', items: [] };
    t.cardNote = t.cardNote || '';
    t.items.forEach((it) => { it.note = it.note || ''; });
    draft = { key: params.id, t, original: JSON.stringify(t), showErrors: false };
  }
  const D = draft;
  const t = D.t;
  let offSort = null;

  const itemHTML = (it, i, info) => {
    const ex = db.exercise(it.exerciseId);
    const g = info[i];
    const linked = info[i] && info[i + 1] && it.supersetGroup === t.items[i + 1].supersetGroup;
    const reps = !ex || REP_BASED.has(ex.tracking);
    return `<div class="tpl-item ${g ? 'in-ss' : ''} ${g && g.first ? 'ss-first' : ''} ${g && g.last ? 'ss-last' : ''}" data-idx="${i}">
      <div class="card tpl-card">
        <div class="tpl-top">
          <button class="grip" type="button" aria-label="Verschieben">${icon('grip')}</button>
          <div class="grow">
            <div class="tpl-name">${g ? `<span class="ss-badge">${g.letter}${g.pos}</span>` : ''}${esc(ex ? ex.name : 'Unbekannte Übung')}</div>
            ${ex && ex.archived ? '<div class="row-sub">Archiviert</div>' : ''}
          </div>
          <button class="icon-btn plain sm" type="button" data-more="${i}" aria-label="Optionen">${icon('more')}</button>
        </div>
        <div class="tpl-fields">
          <div class="tpl-field"><span class="field-label">Sätze</span>
            <div class="stepper">
              <button type="button" data-step="-1" data-i="${i}" aria-label="Ein Satz weniger">${icon('minus')}</button>
              <output data-sets="${i}">${it.sets}</output>
              <button type="button" data-step="1" data-i="${i}" aria-label="Ein Satz mehr">${icon('plus')}</button>
            </div></div>
          ${reps ? `<div class="tpl-field"><span class="field-label">Wdh. von – bis</span>
            <div class="reps-range">
              <input class="input input-sm" data-reps="repsMin" data-i="${i}" type="text" inputmode="numeric" pattern="[0-9]*" value="${it.repsMin ?? ''}" placeholder="–" aria-label="Wiederholungen von">
              <span>–</span>
              <input class="input input-sm" data-reps="repsMax" data-i="${i}" type="text" inputmode="numeric" pattern="[0-9]*" value="${it.repsMax ?? ''}" placeholder="–" aria-label="Wiederholungen bis">
            </div></div>` : ''}
        </div>
        <input class="input input-sm tpl-note" data-note="${i}" type="text" value="${esc(it.note)}" placeholder="Notiz (optional)" aria-label="Notiz" enterkeyhint="done">
      </div>
      ${i < t.items.length - 1 ? `<div class="link-zone"><button type="button" class="ss-link ${linked ? 'on' : ''}" data-link="${i}">${icon(linked ? 'unlink' : 'link')}${linked ? 'Supersatz lösen' : 'Supersatz'}</button></div>` : ''}
    </div>`;
  };

  const draw = () => {
    if (offSort) { offSort(); offSort = null; }
    const info = groupInfo(t.items);
    const nameErr = D.showErrors && !t.name.trim();
    const itemsErr = D.showErrors && !t.items.length;
    root.innerHTML = `
      <header class="topbar">
        <button class="icon-btn" data-cancel aria-label="Abbrechen">${icon('chevronLeft')}</button>
        <h1 class="topbar-title">${isNew ? 'Neues Workout' : 'Workout bearbeiten'}</h1><span></span>
      </header>
      <div class="stack">
        <label class="field">
          <span class="field-label">Name</span>
          <input class="input ${nameErr ? 'invalid' : ''}" name="name" type="text" autocomplete="off" enterkeyhint="done" maxlength="60" value="${esc(t.name)}" placeholder="z. B. Oberkörper A">
          ${nameErr ? '<span class="field-error">Bitte gib einen Namen ein.</span>' : ''}
        </label>
        <label class="field">
          <span class="field-label">Notiz auf der Auswahlkarte (optional)</span>
          <input class="input" name="cardNote" type="text" autocomplete="off" enterkeyhint="done" maxlength="80" value="${esc(t.cardNote)}" placeholder="z. B. Fokus: Beinpresse steigern">
        </label>
        <label class="field">
          <span class="field-label">Hinweis beim Training (optional)</span>
          <textarea class="input" name="note" rows="2" placeholder="z. B. Aufwärmen: 5 min Crosstrainer">${esc(t.note || '')}</textarea>
        </label>
      </div>
      <h2 class="section-title">Übungen <span class="count">${t.items.length || ''}</span></h2>
      ${t.items.length ? `<div class="tpl-list" id="tpl-list">${t.items.map((it, i) => itemHTML(it, i, info)).join('')}</div>` : `<div class="card empty ${itemsErr ? 'invalid' : ''}"><strong>Noch keine Übungen</strong>Füge Übungen hinzu und sortiere sie per Ziehgriff.</div>`}
      <button class="btn btn-card mt-12" data-add>${icon('plus')}Übung hinzufügen</button>
      ${t.items.length > 1 ? '<p class="small muted center mt-12">Ziehgriff ≡ zum Sortieren · „Supersatz“ verbindet zwei Übungen</p>' : ''}
      ${existing ? `<button class="btn btn-text danger mt-12" data-delete>${icon('trash')}Workout löschen</button>` : ''}
      <div class="sticky-actions"><button class="btn" data-save>${icon('check')}Speichern</button></div>`;
    const list = root.querySelector('#tpl-list');
    if (list) {
      offSort = sortable(list, {
        item: '.tpl-item', handle: '.grip',
        onDrop: (from, to) => { moveItem(t.items, from, to); draw(); },
      });
    }
  };

  const readTop = () => {
    const n = root.querySelector('input[name="name"]');
    const no = root.querySelector('textarea[name="note"]');
    const cn = root.querySelector('input[name="cardNote"]');
    if (n) t.name = n.value;
    if (no) t.note = no.value;
    if (cn) t.cardNote = cn.value;
  };
  const isDirty = () => { readTop(); return JSON.stringify(t) !== D.original; };

  async function addExercises() {
    readTop();
    const res = await pickExercises({ title: 'Übungen hinzufügen', multi: true });
    res.ids.forEach((id) => t.items.push(newItem(id)));
    if (res.create != null) {
      prefill.name = res.create;
      prefill.onSaved = (id) => { t.items.push(newItem(id)); };
      navigate('#/neue-uebung');
      return;
    }
    if (res.ids.length) {
      draw();
      const last = root.querySelector('.tpl-item:last-child');
      if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  async function itemMenu(i) {
    readTop();
    const it = t.items[i];
    const ex = db.exercise(it.exerciseId);
    const v = await actionSheet({
      title: ex ? ex.name : '',
      actions: [
        { label: 'Übung tauschen', value: 'swap', icon: 'swap' },
        ...(i > 0 ? [{ label: 'Nach oben', value: 'up', icon: 'arrowUp' }] : []),
        ...(i < t.items.length - 1 ? [{ label: 'Nach unten', value: 'down', icon: 'arrowDown' }] : []),
        { label: 'Entfernen', value: 'remove', icon: 'trash', danger: true },
      ],
    });
    if (v === 'swap') {
      const res = await pickExercises({ title: 'Übung tauschen', multi: false });
      if (res.ids[0]) {
        const fresh = newItem(res.ids[0]);
        t.items[i] = { ...it, exerciseId: res.ids[0], startKg: null, repsMin: it.repsMin ?? fresh.repsMin, repsMax: it.repsMax ?? fresh.repsMax };
        draw();
      } else if (res.create != null) {
        prefill.name = res.create;
        prefill.onSaved = (id) => { t.items[i] = { ...it, exerciseId: id, startKg: null }; };
        navigate('#/neue-uebung');
      }
    }
    if (v === 'up') { moveItem(t.items, i, i - 1); draw(); }
    if (v === 'down') { moveItem(t.items, i, i + 1); draw(); }
    if (v === 'remove') { t.items.splice(i, 1); normalizeGroups(t.items); draw(); }
  }

  async function save() {
    readTop();
    if (!t.name.trim() || !t.items.length) {
      D.showErrors = true;
      draw();
      if (!t.name.trim()) root.querySelector('input[name="name"]').focus();
      else toast('Füge mindestens eine Übung hinzu');
      return;
    }
    t.items.forEach((it) => {
      if (it.repsMin != null && it.repsMax == null) it.repsMax = it.repsMin;
      if (it.repsMax != null && it.repsMin == null) it.repsMin = it.repsMax;
      if (it.repsMin != null && it.repsMax != null && it.repsMin > it.repsMax) [it.repsMin, it.repsMax] = [it.repsMax, it.repsMin];
    });
    normalizeGroups(t.items);
    t.name = t.name.trim().replace(/\s+/g, ' ');
    t.note = (t.note || '').trim();
    t.cardNote = (t.cardNote || '').trim().replace(/\s+/g, ' ');
    const before = db.template(t.id);
    await db.putTemplate(t);
    // Umbenannt: bisherige Workouts aus dieser Vorlage zeigen im Verlauf den neuen Namen
    // (nur die, deren Name nicht von Hand geaendert wurde)
    if (before && before.name !== t.name) {
      const renamed = db.state.sessions
        .filter((s) => s.templateId === t.id && s.name === before.name)
        .map((s) => ({ ...s, name: t.name }));
      if (renamed.length) await db.bulkPut({ sessions: renamed });
    }
    draft = null;
    toast('Gespeichert');
    goBack('#/workout-auswahl');
  }

  draw();
  const offs = [
    on(root, 'input', 'input[name="name"]', (e, n) => {
      t.name = n.value;
      if (D.showErrors && n.value.trim()) { n.classList.remove('invalid'); const p = n.parentElement.querySelector('.field-error'); if (p) p.remove(); }
    }),
    on(root, 'input', 'textarea[name="note"]', (e, n) => { t.note = n.value; }),
    on(root, 'input', 'input[name="cardNote"]', (e, n) => { t.cardNote = n.value; }),
    on(root, 'input', '[data-reps]', (e, inp) => {
      const clean = inp.value.replace(/\D/g, '').slice(0, 3);
      if (clean !== inp.value) inp.value = clean;
      t.items[Number(inp.dataset.i)][inp.dataset.reps] = intOrNull(clean);
    }),
    on(root, 'change', '[data-reps]', (e, inp) => {
      const it = t.items[Number(inp.dataset.i)];
      if (it.repsMin != null && it.repsMax != null && it.repsMin > it.repsMax) {
        [it.repsMin, it.repsMax] = [it.repsMax, it.repsMin];
        const wrap = inp.closest('.reps-range');
        wrap.querySelector('[data-reps="repsMin"]').value = it.repsMin;
        wrap.querySelector('[data-reps="repsMax"]').value = it.repsMax;
      }
    }),
    on(root, 'input', '[data-note]', (e, inp) => { t.items[Number(inp.dataset.note)].note = inp.value; }),
    on(root, 'keydown', 'input', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }),
    on(root, 'click', '[data-step]', (e, b) => {
      const i = Number(b.dataset.i);
      const it = t.items[i];
      it.sets = clamp((it.sets || 0) + Number(b.dataset.step), 1, 20);
      root.querySelector(`[data-sets="${i}"]`).textContent = it.sets;
    }),
    on(root, 'click', '[data-link]', (e, b) => { readTop(); toggleLink(t.items, Number(b.dataset.link)); draw(); }),
    on(root, 'click', '[data-more]', (e, b) => itemMenu(Number(b.dataset.more))),
    on(root, 'click', '[data-add]', () => addExercises()),
    on(root, 'click', '[data-save]', () => save()),
    on(root, 'click', '[data-delete]', async () => {
      const ok = await confirmSheet({ title: `„${existing.name}“ löschen?`, message: 'Deine bisherigen Workouts bleiben im Verlauf erhalten.', confirm: 'Löschen', danger: true });
      if (!ok) return;
      await db.deleteTemplate(existing.id);
      draft = null;
      toast('Gelöscht');
      goBack('#/workout-auswahl');
    }),
    on(root, 'click', '[data-cancel]', async () => {
      if (isDirty() && !(await confirmSheet({ title: 'Änderungen verwerfen?', confirm: 'Verwerfen', cancel: 'Weiter bearbeiten', danger: true }))) return;
      draft = null;
      goBack('#/workout-auswahl');
    }),
  ];
  return () => { offs.forEach((f) => f()); if (offSort) offSort(); };
}
