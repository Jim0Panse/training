// Workout-Detail (aus dem Verlauf): alle Uebungen und Saetze, Notiz, Rekorde.
// Bearbeiten: Werte korrigieren, Saetze hinzufuegen/loeschen, Satzart wechseln, Uebungen
// hinzufuegen/entfernen, Name und Notiz. Loeschen mit Bestaetigung.
// Statistiken und Rekorde werden immer live berechnet und passen sich danach automatisch an.

import * as db from '../db.js';
import { topbar } from '../components/header.js';
import { confirmSheet, actionSheet } from '../components/sheet.js';
import { pickExercises } from '../components/exercise-picker.js';
import { sessionVolume, sessionWorkSets, sessionDuration, sessionRecords } from '../lib/stats.js';
import { groupInfo, newSet, sessionItem, normalizeGroups } from '../lib/workout.js';
import { fmtDuration, fmtVolume, fmtDateFull, fmtTime, parseNum } from '../lib/format.js';
import { on, esc, toast } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { goBack, navigate } from '../router.js';
import { COLS, REQUIRED, fieldValue, fieldText } from './active-workout.js';
import { recordValue } from './summary.js';

// ‑ = geschuetzter Bindestrich, damit „Satz-Volumen“ nicht am Zeilenende getrennt wird
const SHORT_LABEL = { weight: 'Gewicht', e1rm: 'e1RM', reps: 'Wdh.', volume: 'Satz‑Volumen', seconds: 'Zeit', km: 'Distanz' };
const STUB = { id: '', name: 'Gelöschte Übung', tracking: 'gewicht_wdh', primary: [], secondary: [] };
const clone = (o) => JSON.parse(JSON.stringify(o));
const isWarm = (x) => x.type === 'warmup';
const hasValue = (x) => x.kg != null || x.reps != null || x.seconds != null || x.km != null;
const exOf = (it) => db.exercise(it.exerciseId) || STUB;

function setNo(sets, i) {
  return isWarm(sets[i]) ? 'A' : String(sets.slice(0, i + 1).filter((x) => !isWarm(x)).length);
}
function cellText(set, f, ex) {
  const v = fieldValue(set, f);
  if (v == null) return '–';
  const t = fieldText(v, f);
  return f === 'kg' && ex.tracking === 'zusatzgewicht_wdh' ? `+${t}` : t;
}

export function render(root, { id }) {
  root.classList.add('has-topbar');
  let draft = null;        // Arbeitskopie beim Bearbeiten
  let original = '';       // fuer „Änderungen verwerfen?“
  let errors = new Set();  // "item:satz:feld"

  const session = () => db.session(id);

  // ---------- Ansicht ----------
  function viewHTML(s) {
    const start = new Date(s.startedAt);
    const end = s.endedAt ? new Date(s.endedAt) : null;
    const recs = sessionRecords(s).list;
    const recEx = [...new Set(recs.map((r) => r.exerciseId))];
    const groups = groupInfo(s.items);
    const vol = sessionVolume(s);
    return `
      ${topbar({ title: '', back: '#/verlauf', right: `<button class="icon-btn" type="button" data-menu aria-label="Mehr">${icon('more')}</button>` })}
      <header class="detail-head">
        <h1 class="title-lg">${esc(s.name)}</h1>
        <p class="subtitle">${esc(fmtDateFull(start))} · ${esc(fmtTime(start))}${end ? `–${esc(fmtTime(end))}` : ''} Uhr</p>
      </header>
      <div class="stat-row">
        <div class="card stat-mini"><div class="v">${esc(fmtDuration(sessionDuration(s)))}</div><div class="l">Dauer</div></div>
        <div class="card stat-mini"><div class="v">${sessionWorkSets(s)}</div><div class="l">Arbeitssätze</div></div>
        <div class="card stat-mini"><div class="v">${vol > 0 ? esc(fmtVolume(vol)) : '–'}</div><div class="l">Volumen</div></div>
      </div>
      ${recs.length ? `
        <h2 class="section-title">Rekorde <span class="count">${recEx.length}</span></h2>
        <div class="list">${recEx.map((exId) => {
          const ex = db.exercise(exId);
          const mine = recs.filter((r) => r.exerciseId === exId);
          return `<div class="row rec-row"><span class="icon-disc gold">${icon('trophy')}</span>
            <span class="grow"><span class="row-title">${esc(ex ? ex.name : '–')}</span>
              <span class="row-sub">${mine.map((r) => `${esc(SHORT_LABEL[r.type] || '')} ${esc(recordValue(r, ex))}`).join(' · ')}</span></span></div>`;
        }).join('')}</div>` : ''}
      <h2 class="section-title">Übungen <span class="count">${s.items.length}</span></h2>
      <div class="stack">
        ${s.items.map((it, ii) => {
          const ex = exOf(it);
          const cols = COLS[ex.tracking] || COLS.gewicht_wdh;
          const g = groups[ii];
          return `<section class="card sd-card">
            <div class="sd-title">
              ${g ? `<span class="ss-badge">${g.letter}${g.pos}</span>` : ''}
              ${ex.id ? `<a class="sd-name" href="#/uebung/${esc(ex.id)}">${esc(ex.name)}</a>` : `<span class="sd-name">${esc(ex.name)}</span>`}
            </div>
            ${it.note ? `<div class="ex-plan-note">${icon('note')}<span>${esc(it.note)}</span></div>` : ''}
            <div class="sd-grid sd-head"><span>Satz</span>${cols.map(([f, l]) => `<span>${f ? esc(l) : ''}</span>`).join('')}</div>
            ${it.sets.map((set, si) => `<div class="sd-grid sd-row ${isWarm(set) ? 'warm' : ''}">
              <span class="sd-no">${setNo(it.sets, si)}</span>
              ${cols.map(([f]) => `<span>${f ? esc(cellText(set, f, ex)) : ''}</span>`).join('')}
            </div>`).join('')}
          </section>`;
        }).join('')}
      </div>
      ${s.note ? `<h2 class="section-title">Notiz</h2><div class="card sd-note">${esc(s.note)}</div>` : ''}
      <div class="stack mt-24">
        <button class="btn btn-secondary" type="button" data-edit>${icon('pencil')}Bearbeiten</button>
        <button class="btn btn-text danger" type="button" data-delete>${icon('trash')}Workout löschen</button>
      </div>`;
  }

  // ---------- Bearbeiten ----------
  function editRow(it, ii, si, ex) {
    const set = it.sets[si];
    const cols = COLS[ex.tracking] || COLS.gewicht_wdh;
    return `<div class="set-row ed ${isWarm(set) ? 'warm' : ''}" data-ii="${ii}" data-si="${si}">
      <div class="set-main">
        <button class="set-no" type="button" data-type aria-label="Satzart wechseln (Arbeitssatz/Aufwärmsatz)">${setNo(it.sets, si)}</button>
        ${cols.map(([f, label]) => (f
          ? `<input class="set-in ${errors.has(`${ii}:${si}:${f}`) ? 'invalid' : ''}" data-f="${f}" type="text" inputmode="${f === 'reps' || f === 'seconds' ? 'numeric' : 'decimal'}" autocomplete="off" value="${esc(fieldText(fieldValue(set, f), f))}" placeholder="${esc(label)}" aria-label="${esc(label)}">`
          : '<span></span>')).join('')}
        <button class="set-check ed-del" type="button" data-del-set aria-label="Satz löschen">${icon('trash')}</button>
      </div>
    </div>`;
  }

  function editHTML() {
    const d = draft;
    const groups = groupInfo(d.items);
    return `
      <header class="topbar">
        <button class="icon-btn" type="button" data-cancel aria-label="Abbrechen">${icon('close')}</button>
        <h1 class="topbar-title">Workout bearbeiten</h1>
        <div class="topbar-right"></div>
      </header>
      <div class="field mt-8">
        <label class="field-label" for="sd-name">Name</label>
        <input class="input" id="sd-name" value="${esc(d.name)}" maxlength="60" autocomplete="off">
      </div>
      <p class="field-hint mt-8">Satznummer antippen wechselt zwischen Arbeits- und Aufwärmsatz („A“).</p>
      <div class="stack mt-12">
        ${d.items.map((it, ii) => {
          const ex = exOf(it);
          const cols = COLS[ex.tracking] || COLS.gewicht_wdh;
          const g = groups[ii];
          return `<section class="card ex-card" data-ii="${ii}">
            <div class="ex-title">
              <div class="grow ex-name">${g ? `<span class="ss-badge">${g.letter}${g.pos}</span>` : ''}${esc(ex.name)}</div>
              <button class="icon-btn plain sm" type="button" data-item-menu aria-label="Optionen">${icon('more')}</button>
            </div>
            <div class="set-head"><span>Satz</span>${cols.map(([f, l]) => `<span>${f ? esc(l) : ''}</span>`).join('')}<span></span></div>
            <div class="sets">${it.sets.map((_, si) => editRow(it, ii, si, ex)).join('')}</div>
            <button class="add-set" type="button" data-add-set>${icon('plus')}Satz</button>
          </section>`;
        }).join('')}
      </div>
      <button class="btn btn-card mt-12" type="button" data-add-ex>${icon('plus')}Übung hinzufügen</button>
      <div class="field mt-16">
        <label class="field-label" for="sd-note">Notiz</label>
        <textarea class="input" id="sd-note" rows="3" placeholder="z. B. wie es lief">${esc(d.note || '')}</textarea>
      </div>
      <div class="sticky-actions"><button class="btn" type="button" data-save>${icon('check')}Speichern</button></div>`;
  }

  function draw() {
    const s = session();
    if (!s) {
      root.innerHTML = `${topbar({ title: 'Workout', back: '#/verlauf' })}<div class="empty"><strong>Workout nicht gefunden</strong>Vielleicht wurde es gelöscht.</div>`;
      return;
    }
    if (s.status === 'active' && !draft) { navigate('#/workout', { replace: true }); return; }
    root.classList.toggle('editing', !!draft);
    document.body.classList.toggle('no-tabbar', !!draft);
    root.innerHTML = draft ? editHTML() : viewHTML(s);
  }

  function startEdit() {
    const s = session();
    if (!s) return;
    draft = clone(s);
    original = JSON.stringify(draft);
    errors = new Set();
    draw();
    window.scrollTo(0, 0);
  }
  async function cancelEdit() {
    if (draft && JSON.stringify(draft) !== original) {
      const ok = await confirmSheet({ title: 'Änderungen verwerfen?', confirm: 'Verwerfen', cancel: 'Weiter bearbeiten', danger: true });
      if (!ok) return;
    }
    draft = null;
    draw();
  }

  async function saveEdit() {
    const d = draft;
    errors = new Set();
    // Leere Saetze fallen weg, unvollstaendige werden markiert
    d.items.forEach((it, ii) => {
      const ex = exOf(it);
      const req = REQUIRED[ex.tracking] || [];
      it.sets.forEach((set, si) => {
        if (!hasValue(set)) return;
        req.forEach((f) => { if (set[f] == null) errors.add(`${ii}:${si}:${f === 'seconds' && ex.tracking === 'distanz_zeit' ? 'min' : f}`); });
      });
    });
    if (errors.size) { draw(); toast('Bitte die markierten Felder ausfüllen'); return; }

    const doneAt = d.endedAt || d.startedAt;
    const items = d.items
      .map((it) => ({ ...it, sets: it.sets.filter(hasValue).map((x) => ({ ...x, done: true, doneAt: x.doneAt || doneAt })) }))
      .filter((it) => it.sets.length);
    if (!items.length) {
      const ok = await confirmSheet({ title: 'Keine Sätze mehr', message: 'Ein Workout ohne Sätze wird gelöscht. Stattdessen löschen?', confirm: 'Workout löschen', cancel: 'Zurück', danger: true });
      if (!ok) return;
      draft = null;
      await db.deleteSession(id);
      toast('Workout gelöscht');
      goBack('#/verlauf');
      return;
    }
    d.items = normalizeGroups(items);
    d.name = (d.name || '').trim() || 'Workout';
    draft = null;
    await db.putSession(d);
    toast('Gespeichert');
  }

  const locate = (el) => {
    const row = el.closest('.set-row');
    if (!row || !draft) return {};
    const it = draft.items[Number(row.dataset.ii)];
    return { row, it, ii: Number(row.dataset.ii), si: Number(row.dataset.si), set: it ? it.sets[Number(row.dataset.si)] : null };
  };
  const itemOf = (el) => {
    const card = el.closest('[data-ii]');
    return card && draft ? { it: draft.items[Number(card.dataset.ii)], ii: Number(card.dataset.ii) } : {};
  };

  async function removeSession() {
    const s = session();
    if (!s) return;
    const ok = await confirmSheet({
      title: 'Workout löschen?',
      message: `„${s.name}“ vom ${fmtDateFull(new Date(s.startedAt))} wird endgültig gelöscht. Statistiken und Rekorde werden neu berechnet.`,
      confirm: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    await db.deleteSession(id);
    toast('Workout gelöscht');
    goBack('#/verlauf');
  }

  draw();
  const offs = [
    on(root, 'click', '[data-edit]', startEdit),
    on(root, 'click', '[data-delete]', removeSession),
    on(root, 'click', '[data-menu]', async () => {
      const r = await actionSheet({ actions: [
        { label: 'Bearbeiten', value: 'edit', icon: 'pencil' },
        { label: 'Workout löschen', value: 'del', icon: 'trash', danger: true },
      ] });
      if (r === 'edit') startEdit();
      if (r === 'del') removeSession();
    }),
    on(root, 'click', '[data-cancel]', cancelEdit),
    on(root, 'click', '[data-save]', saveEdit),
    on(root, 'input', '#sd-name', (e, inp) => { if (draft) draft.name = inp.value; }),
    on(root, 'input', '#sd-note', (e, inp) => { if (draft) draft.note = inp.value; }),
    on(root, 'input', '.set-in', (e, inp) => {
      const { set } = locate(inp);
      if (!set) return;
      const f = inp.dataset.f;
      const digits = inp.value.replace(/\D/g, '');
      const v = f === 'reps' || f === 'seconds' ? (digits ? parseInt(digits, 10) : null) : parseNum(inp.value);
      if (f === 'min') set.seconds = v == null ? null : Math.round(v * 60);
      else set[f] = v;
      inp.classList.remove('invalid');
    }),
    on(root, 'change', '.set-in', (e, inp) => {
      const { set } = locate(inp);
      if (set) inp.value = fieldText(fieldValue(set, inp.dataset.f), inp.dataset.f);
    }),
    on(root, 'click', '[data-type]', (e, b) => {
      const { set } = locate(b);
      if (!set) return;
      set.type = isWarm(set) ? 'work' : 'warmup';
      draw();
    }),
    on(root, 'click', '[data-del-set]', (e, b) => {
      const { it, si } = locate(b);
      if (!it) return;
      it.sets.splice(si, 1);
      errors = new Set();
      draw();
    }),
    on(root, 'click', '[data-add-set]', (e, b) => {
      const { it, ii } = itemOf(b);
      if (!it) return;
      const prev = it.sets[it.sets.length - 1];
      const set = newSet('work');
      if (prev) { set.kg = prev.kg; set.reps = prev.reps; set.seconds = prev.seconds; set.km = prev.km; }
      it.sets.push(set);
      draw();
      const inp = root.querySelector(`.set-row[data-ii="${ii}"][data-si="${it.sets.length - 1}"] .set-in`);
      if (inp) inp.focus();
    }),
    on(root, 'click', '[data-item-menu]', async (e, b) => {
      const { ii } = itemOf(b);
      if (ii == null) return;
      const r = await actionSheet({ title: exOf(draft.items[ii]).name, actions: [{ label: 'Übung entfernen', value: 'rm', icon: 'trash', danger: true }] });
      if (r === 'rm' && draft) { draft.items.splice(ii, 1); errors = new Set(); draw(); }
    }),
    on(root, 'click', '[data-add-ex]', async () => {
      const { ids, create } = await pickExercises({ title: 'Übung hinzufügen' });
      if (!draft) return;
      if (create != null) toast('Neue Übungen bitte im Tab „Übungen“ anlegen');
      ids.forEach((exId) => draft.items.push(sessionItem(exId, {}, 1)));
      if (ids.length) {
        draw();
        const last = root.querySelector('.ex-card:last-of-type .set-in');
        if (last) last.scrollIntoView({ block: 'center' });
      }
    }),
    db.subscribe(() => { if (!draft) draw(); }),
  ];
  return () => {
    offs.forEach((f) => f());
    document.body.classList.remove('no-tabbar');
  };
}
