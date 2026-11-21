// Laufendes Workout (wichtigster Screen): Satz-Tabelle mit Vorwerten als Platzhalter, „Letztes Mal“,
// Steigerungshinweis, Satzarten, Supersaetze (abwechselnd), Notizen, Pausen-Stoppuhr, Wake Lock.
// Jede Eingabe wird entprellt (300 ms) gespeichert, zusaetzlich beim Verlassen/Sperren.

import * as db from '../db.js';
import { openSheet, confirmSheet, actionSheet } from '../components/sheet.js';
import { pickExercises } from '../components/exercise-picker.js';
import { stopwatchBar, unlockAudio } from '../components/stopwatch.js';
import { lastPerformance, progressionHint, sessionRecords, setLabel } from '../lib/stats.js';
import { sessionItem, newSet, groupInfo, normalizeGroups, moveItem } from '../lib/workout.js';
import { fmtClock, fmtKg, parseNum, numToInput } from '../lib/format.js';
import { on, esc, debounce, toast } from '../lib/dom.js';
import { swipeRows } from '../lib/swipe.js';
import { icon } from '../lib/icons.js';
import { navigate } from '../router.js';
import { prefill } from './exercise-edit.js';

// Spalten je Erfassungsart: [Feld, Beschriftung]
export const COLS = {
  gewicht_wdh: [['kg', 'kg'], ['reps', 'Wdh.']],
  zusatzgewicht_wdh: [['kg', '+kg'], ['reps', 'Wdh.']],
  wdh: [[null, ''], ['reps', 'Wdh.']],
  zeit: [[null, ''], ['seconds', 'Sek.']],
  distanz_zeit: [['km', 'km'], ['min', 'Min.']],
};
export const REQUIRED = {
  gewicht_wdh: ['kg', 'reps'],
  zusatzgewicht_wdh: ['reps'],
  wdh: ['reps'],
  zeit: ['seconds'],
  distanz_zeit: [],
};
const STUB = { id: '', name: 'Gelöschte Übung', tracking: 'gewicht_wdh', note: '', primary: [], secondary: [] };
const isWarm = (x) => x.type === 'warmup';
const hasValue = (x) => x && (x.kg != null || x.reps != null || x.seconds != null || x.km != null);

export function fieldValue(set, f) {
  if (!set) return null;
  if (f === 'min') return set.seconds != null ? Math.round((set.seconds / 60) * 100) / 100 : null;
  return set[f] ?? null;
}
export const fieldText = (v, f) => (v == null ? '' : (f === 'kg' || f === 'km' || f === 'min' ? numToInput(v) : String(v)));

function targetText(t, ex) {
  if (!t || !t.sets) return '';
  const repBased = ['gewicht_wdh', 'zusatzgewicht_wdh', 'wdh'].includes(ex.tracking);
  if (repBased && t.repsMin != null) return `${t.sets} × ${t.repsMin === t.repsMax || t.repsMax == null ? t.repsMin : `${t.repsMin}–${t.repsMax}`}`;
  return `${t.sets} ${t.sets === 1 ? 'Satz' : 'Sätze'}`;
}

/** Platzhalter: letztes Mal (gleicher Index derselben Satzart) -> vorheriger Satz heute -> letzter Satz letztes Mal -> Plan */
function placeholderFor(item, idx, last) {
  const set = item.sets[idx];
  const warm = isWarm(set);
  const k = item.sets.slice(0, idx).filter((x) => isWarm(x) === warm).length;
  const arr = last ? (warm ? last.warmup : last.work) : [];
  if (arr[k]) return arr[k];
  for (let j = idx - 1; j >= 0; j--) {
    const p = item.sets[j];
    if (isWarm(p) === warm && hasValue(p)) return p;
  }
  if (!warm && last && last.work.length) return last.work[last.work.length - 1];
  if (!warm) return { kg: item.target?.startKg ?? null, reps: item.target?.repsMax ?? null, seconds: null, km: null };
  return null;
}

let wakeLock = null;
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible' && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch (e) { wakeLock = null; }
}
function releaseWakeLock() { try { if (wakeLock) wakeLock.release(); } catch (e) { /* egal */ } wakeLock = null; }

export function render(root) {
  const s = db.activeSession();
  root.classList.add('wk-view');
  if (!s) {
    root.classList.add('has-topbar');
    root.innerHTML = `<header class="topbar"><button class="icon-btn" data-back="#/start" aria-label="Zurück">${icon('chevronLeft')}</button><h1 class="topbar-title">Workout</h1><span></span></header>
      <div class="card empty mt-12"><strong>Kein laufendes Workout</strong>Starte ein Workout aus deinen Vorlagen oder frei.
        <a class="btn mt-16" href="#/workout-auswahl">${icon('play')}Workout starten</a></div>`;
    return;
  }

  let finished = false;
  let sw = null;
  const exOf = (it) => db.exercise(it.exerciseId) || STUB;
  const save = debounce(() => { if (!finished) db.putSession(s, { silent: true }); }, 300);
  const offFlush = db.onFlush(() => save.flush());
  const itemById = (id) => s.items.find((it) => it.id === id);
  const locate = (el) => {
    const row = el.closest('.set-row');
    if (!row) return {};
    const item = itemById(row.dataset.item);
    const idx = Number(row.dataset.idx);
    return { row, item, idx, set: item ? item.sets[idx] : null };
  };

  // ---------- Darstellung ----------
  let ctx = null;
  function buildCtx() {
    const c = { last: new Map(), hints: new Map(), prs: new Set() };
    s.items.forEach((it) => {
      c.last.set(it.id, lastPerformance(it.exerciseId, s.id));
      const h = progressionHint(it.exerciseId, it.target ? it.target.repsMax : null, s.id);
      if (h) c.hints.set(it.id, h);
    });
    sessionRecords(s).bySet.forEach((v, set) => c.prs.add(set));
    return c;
  }

  const setHeader = (tracking) => {
    const cols = COLS[tracking] || COLS.gewicht_wdh;
    return `<div class="set-head"><span>Satz</span>${cols.map(([f, l]) => `<span>${f ? l : ''}</span>`).join('')}<span>${icon('check')}</span></div>`;
  };

  function rowHTML(item, idx, ex, badge) {
    const set = item.sets[idx];
    const warm = isWarm(set);
    const no = warm ? 'A' : String(item.sets.slice(0, idx + 1).filter((x) => !isWarm(x)).length);
    const ph = placeholderFor(item, idx, ctx.last.get(item.id));
    const cols = COLS[ex.tracking] || COLS.gewicht_wdh;
    const inputs = cols.filter(([f]) => f).length;
    let n = 0;
    const cell = ([f, label]) => {
      if (!f) return '<span></span>';
      n += 1;
      const phv = fieldText(fieldValue(ph, f), f);
      const mode = f === 'reps' || f === 'seconds' ? 'numeric' : 'decimal';
      return `<input class="set-in" data-f="${f}" type="text" inputmode="${mode}" autocomplete="off" enterkeyhint="${n < inputs ? 'next' : 'done'}"
        value="${esc(fieldText(fieldValue(set, f), f))}" placeholder="${esc(phv || label)}" aria-label="${esc(label)}">`;
    };
    return `<div class="set-row ${set.done ? 'done' : ''} ${warm ? 'warm' : ''} ${ctx.prs.has(set) ? 'pr' : ''}" data-item="${item.id}" data-idx="${idx}">
      <button class="set-del" type="button" data-del tabindex="-1">${icon('trash')}Löschen</button>
      <div class="set-main">
        <button class="set-no" type="button" data-type aria-label="Satzart wechseln (Arbeitssatz/Aufwärmsatz)">${badge ? `<small>${badge}</small>` : ''}${no}</button>
        ${cols.map(cell).join('')}
        <button class="set-check" type="button" data-check aria-label="Satz abhaken">${icon('check')}<span class="pr-badge" title="Rekord">${icon('trophy')}</span></button>
      </div>
    </div>`;
  }

  function exHead(item, ex, badge) {
    const last = ctx.last.get(item.id);
    const t = item.target || {};
    const target = targetText(t, ex);
    const lastTxt = last && last.work.length
      ? `Letztes Mal: ${last.work.map((x) => setLabel(x, ex)).join(' · ')}`
      : (t.startKg ? `Erstes Mal · Plan: ${fmtKg(t.startKg)} kg` : 'Erstes Mal – noch keine Vorwerte');
    const hint = ctx.hints.get(item.id);
    const applied = hint && item.sets.filter((x) => !isWarm(x) && !x.done).every((x) => x.kg === hint.kg) && item.sets.some((x) => !isWarm(x) && !x.done);
    return `<div class="ex-head" data-item="${item.id}">
      <div class="ex-title">
        <div class="grow">
          <h3 class="ex-name">${badge ? `<span class="ss-badge">${badge}</span>` : ''}${esc(ex.name)}</h3>
          ${target ? `<div class="ex-target">Ziel ${target}</div>` : ''}
        </div>
        <button class="icon-btn plain sm" type="button" data-ex-menu aria-label="Optionen für ${esc(ex.name)}">${icon('more')}</button>
      </div>
      ${item.note ? `<p class="ex-plan-note">${icon('info')}<span>${esc(item.note)}</span></p>` : ''}
      ${ex.id ? `<button class="ex-note ${ex.note ? '' : 'empty'}" type="button" data-ex-note>${icon('note')}<span>${ex.note ? esc(ex.note) : 'Notiz'}</span></button>` : ''}
      <p class="ex-last">${esc(lastTxt)}</p>
      ${hint ? `<button class="chip chip-accent prog-chip ${applied ? 'applied' : ''}" type="button" data-prog="${hint.kg}">${icon(applied ? 'check' : 'arrowUp')}${esc(fmtKg(hint.kg))} kg ${applied ? 'eingetragen' : 'versuchen'}</button>` : ''}
    </div>`;
  }

  function blockHTML(block) {
    if (block.length === 1) {
      const item = block[0], ex = exOf(item);
      return `<section class="card ex-card">
        ${exHead(item, ex, '')}
        ${item.sets.length ? setHeader(ex.tracking) : ''}
        <div class="sets">${item.sets.map((x, i) => rowHTML(item, i, ex, '')).join('')}</div>
        <button class="add-set" type="button" data-add-set="${item.id}">${icon('plus')}Satz</button>
      </section>`;
    }
    const letter = block[0].supersetGroup;
    const rows = [];
    const max = Math.max(...block.map((it) => it.sets.length));
    for (let r = 0; r < max; r++) block.forEach((it, k) => { if (it.sets[r]) rows.push(rowHTML(it, r, exOf(it), `${letter}${k + 1}`)); });
    const tr = exOf(block[0]).tracking;
    const same = block.every((it) => exOf(it).tracking === tr);
    return `<section class="card ex-card ss-card">
      <div class="ss-title">${icon('link')}Supersatz ${letter} · abwechselnd</div>
      ${block.map((it, k) => exHead(it, exOf(it), `${letter}${k + 1}`)).join('<div class="ss-sep"></div>')}
      ${same && rows.length ? setHeader(tr) : ''}
      <div class="sets">${rows.join('')}</div>
      <button class="add-set" type="button" data-add-set="${block.map((it) => it.id).join(',')}">${icon('plus')}Satz für alle</button>
    </section>`;
  }

  function blocks() {
    const info = groupInfo(s.items);
    const out = [];
    s.items.forEach((it, i) => {
      if (info[i] && !info[i].first) out[out.length - 1].push(it);
      else out.push([it]);
    });
    return out;
  }

  const elapsed = () => fmtClock(Date.now() - new Date(s.startedAt));
  function draw() {
    if (sw) { sw.destroy(); sw = null; }
    ctx = buildCtx();
    root.innerHTML = `
      <header class="wk-head">
        <button class="icon-btn" data-back="#/start" aria-label="Zur Startseite – das Workout läuft weiter">${icon('chevronLeft')}</button>
        <div class="wk-title"><div class="wk-name ellipsis">${esc(s.name)}</div><div class="wk-clock" id="wk-clock">${elapsed()}</div></div>
        <button class="btn btn-sm wk-finish" type="button" data-finish>Beenden</button>
      </header>
      ${s.templateNote ? `<div class="info-note mb-12">${icon('info')}<span>${esc(s.templateNote)}</span></div>` : ''}
      ${s.items.length
        ? `<div class="stack">${blocks().map(blockHTML).join('')}</div>`
        : '<div class="card empty"><strong>Freies Workout</strong>Füge deine erste Übung hinzu.</div>'}
      <button class="btn btn-card mt-12" type="button" data-add-ex>${icon('plus')}Übung hinzufügen</button>
      <label class="field mt-24">
        <span class="field-label">Notiz zum Workout</span>
        <textarea class="input" data-session-note rows="2" placeholder="Wie lief’s? (optional)">${esc(s.note || '')}</textarea>
      </label>
      <div class="sw-dock" id="sw-dock"></div>`;
    sw = stopwatchBar(root.querySelector('#sw-dock'), { session: s, save });
  }

  function refreshRow(item, idx) {
    const row = root.querySelector(`.set-row[data-item="${item.id}"][data-idx="${idx}"]`);
    if (!row) return;
    const set = item.sets[idx];
    row.classList.toggle('done', !!set.done);
    row.querySelectorAll('.set-in').forEach((inp) => { inp.value = fieldText(fieldValue(set, inp.dataset.f), inp.dataset.f); });
  }
  function refreshPRs() {
    const prs = sessionRecords(s).bySet;
    root.querySelectorAll('.set-row').forEach((row) => {
      const item = itemById(row.dataset.item);
      const set = item && item.sets[Number(row.dataset.idx)];
      row.classList.toggle('pr', !!set && prs.has(set));
    });
  }
  const refreshPRsSoon = debounce(refreshPRs, 400);

  // ---------- Aktionen ----------
  function check(item, idx) {
    const set = item.sets[idx];
    const ex = exOf(item);
    if (set.done) {
      set.done = false;
      set.doneAt = null;
    } else {
      const ph = placeholderFor(item, idx, ctx.last.get(item.id)) || {};
      (COLS[ex.tracking] || COLS.gewicht_wdh).forEach(([f]) => {
        if (!f) return;
        const key = f === 'min' ? 'seconds' : f;
        if (set[key] == null && ph[key] != null) set[key] = ph[key];
      });
      const missing = (REQUIRED[ex.tracking] || []).find((f) => set[f] == null)
        || (ex.tracking === 'distanz_zeit' && set.km == null && set.seconds == null ? 'km' : null);
      if (missing) {
        refreshRow(item, idx);
        const inp = root.querySelector(`.set-row[data-item="${item.id}"][data-idx="${idx}"] .set-in[data-f="${missing === 'seconds' && ex.tracking === 'distanz_zeit' ? 'min' : missing}"]`);
        if (inp) inp.focus();
        toast(missing === 'kg' ? 'Bitte Gewicht eintragen' : missing === 'reps' ? 'Bitte Wiederholungen eintragen' : 'Bitte Wert eintragen');
        return;
      }
      set.done = true;
      set.doneAt = new Date().toISOString();
      unlockAudio();
      if (sw && (db.state.settings.stopwatchAutoStart || sw.running())) sw.restart();
    }
    refreshRow(item, idx);
    refreshPRs();
    save();
  }

  function itemFor(exerciseId) {
    const tpl = s.templateId ? db.template(s.templateId) : null;
    const tItem = tpl ? tpl.items.find((x) => x.exerciseId === exerciseId) : null;
    const last = lastPerformance(exerciseId, s.id);
    const count = (tItem && tItem.sets) || (last && last.work.length) || 3;
    return sessionItem(exerciseId, tItem ? { ...tItem, supersetGroup: null } : {}, count);
  }

  async function addExercises() {
    save.flush();
    const res = await pickExercises({ title: 'Übung hinzufügen', multi: true });
    res.ids.forEach((id) => s.items.push(itemFor(id)));
    if (res.create != null) {
      prefill.name = res.create;
      prefill.onSaved = (id) => { s.items.push(itemFor(id)); db.putSession(s, { silent: true }); };
      await db.putSession(s, { silent: true });
      navigate('#/neue-uebung');
      return;
    }
    if (res.ids.length) {
      save();
      draw();
      const cards = root.querySelectorAll('.ex-card');
      if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function doSwap(item, id) {
    item.exerciseId = id;
    item.sets = item.sets.map((x) => newSet(x.type));
    item.note = '';
    item.target = { ...(item.target || {}), startKg: null };
  }
  async function swap(item) {
    const res = await pickExercises({ title: 'Übung tauschen', multi: false });
    if (!res.ids[0] && res.create == null) return;
    if (item.sets.some((x) => x.done)) {
      const ok = await confirmSheet({ title: 'Übung tauschen?', message: 'Abgehakte Sätze dieser Übung werden zurückgesetzt.', confirm: 'Tauschen', danger: true });
      if (!ok) return;
    }
    if (res.create != null) {
      prefill.name = res.create;
      prefill.onSaved = (id) => { doSwap(item, id); db.putSession(s, { silent: true }); };
      save.flush();
      navigate('#/neue-uebung');
      return;
    }
    doSwap(item, res.ids[0]);
    save();
    draw();
  }

  async function itemMenu(item) {
    const ex = exOf(item);
    const i = s.items.indexOf(item);
    const v = await actionSheet({
      title: ex.name,
      actions: [
        { label: 'Übung tauschen', value: 'swap', icon: 'swap' },
        ...(i > 0 ? [{ label: 'Nach oben', value: 'up', icon: 'arrowUp' }] : []),
        ...(i < s.items.length - 1 ? [{ label: 'Nach unten', value: 'down', icon: 'arrowDown' }] : []),
        ...(ex.id ? [{ label: 'Verlauf ansehen', value: 'history', icon: 'chart' }] : []),
        ...(item.sets.length ? [{ label: 'Letzten Satz löschen', value: 'delset', icon: 'minus' }] : []),
        { label: 'Übung entfernen', value: 'remove', icon: 'trash', danger: true },
      ],
    });
    if (v === 'swap') return swap(item);
    if (v === 'up' || v === 'down') { moveItem(s.items, i, v === 'up' ? i - 1 : i + 1); save(); draw(); }
    if (v === 'history') { save.flush(); navigate(`#/uebung/${ex.id}`); }
    if (v === 'delset') { item.sets.pop(); save(); draw(); }
    if (v === 'remove') {
      if (item.sets.some((x) => x.done)) {
        const ok = await confirmSheet({ title: 'Übung entfernen?', message: 'Abgehakte Sätze dieser Übung gehen verloren.', confirm: 'Entfernen', danger: true });
        if (!ok) return;
      }
      s.items.splice(s.items.indexOf(item), 1);
      normalizeGroups(s.items);
      save();
      draw();
    }
  }

  function editExerciseNote(ex) {
    const sh = openSheet({
      title: 'Notiz zur Übung',
      body: `<p class="small muted mb-12">${esc(ex.name)} – gilt für alle Workouts (z. B. Geräteeinstellung).</p>
        <textarea class="input" rows="4" maxlength="300" placeholder="z. B. Sitz Stufe 4, Griff eng">${esc(ex.note || '')}</textarea>
        <button class="btn mt-12" data-ok>${icon('check')}Speichern</button>`,
    });
    const ta = sh.body.querySelector('textarea');
    setTimeout(() => ta.focus(), 320);
    sh.body.querySelector('[data-ok]').addEventListener('click', async () => {
      const note = ta.value.trim();
      sh.close();
      await db.putExercise({ ...db.exercise(ex.id), note });
      draw();
    });
  }

  function templateChanged(tpl) {
    return tpl.items.map((x) => x.exerciseId).join('|') !== s.items.map((x) => x.exerciseId).join('|');
  }
  function applyToTemplate(tpl) {
    const pool = tpl.items.map((x) => ({ ...x }));
    const items = s.items.map((it) => {
      const k = pool.findIndex((p) => p.exerciseId === it.exerciseId);
      if (k >= 0) return pool.splice(k, 1)[0];
      const t = it.target || {};
      return {
        exerciseId: it.exerciseId,
        sets: t.sets || Math.max(1, it.sets.filter((x) => !isWarm(x)).length) || 3,
        repsMin: t.repsMin ?? null, repsMax: t.repsMax ?? null,
        supersetGroup: it.supersetGroup, note: it.note || '', startKg: null,
      };
    });
    return { ...tpl, items: normalizeGroups(items) };
  }

  async function finish() {
    save.flush();
    const doneCount = s.items.reduce((n, it) => n + it.sets.filter((x) => x.done).length, 0);
    if (!doneCount) {
      const ok = await confirmSheet({ title: 'Workout verwerfen?', message: 'Du hast noch keinen Satz abgehakt. Das Workout wird nicht gespeichert.', confirm: 'Verwerfen', cancel: 'Weiter trainieren', danger: true });
      if (!ok) return;
      finished = true;
      await db.deleteSession(s.id);
      navigate('#/start', { replace: true });
      return;
    }
    const open = s.items.reduce((n, it) => n + it.sets.filter((x) => !x.done).length, 0);
    const ok = await confirmSheet({
      title: 'Workout beenden?',
      message: open ? `${open} ${open === 1 ? 'offener Satz wird' : 'offene Sätze werden'} verworfen.` : 'Alle Sätze sind abgehakt – stark!',
      confirm: 'Beenden', cancel: 'Weiter trainieren',
    });
    if (!ok) return;
    const tpl = s.templateId ? db.template(s.templateId) : null;
    if (tpl && templateChanged(tpl)) {
      const take = await confirmSheet({
        title: 'Änderungen in Vorlage übernehmen?',
        message: `Du hast Übungen hinzugefügt, entfernt, getauscht oder umsortiert. Soll „${tpl.name}“ künftig so aussehen?`,
        confirm: 'Übernehmen', cancel: 'Nur dieses Mal',
      });
      if (take) await db.putTemplate(applyToTemplate(tpl));
    }
    s.items.forEach((it) => { it.sets = it.sets.filter((x) => x.done); });
    s.items = s.items.filter((it) => it.sets.length);
    normalizeGroups(s.items);
    s.status = 'done';
    s.endedAt = new Date().toISOString();
    s.stopwatch = { startedAt: null };
    finished = true;
    await db.putSession(s);
    navigate(`#/zusammenfassung/${s.id}`, { replace: true });
  }

  // Waehrend der Eingabe die Stoppuhr-Leiste ausblenden (Tastatur)
  const onFocusIn = (e) => { if (e.target.matches('input, textarea')) document.body.classList.add('typing'); };
  const onFocusOut = () => setTimeout(() => {
    const a = document.activeElement;
    if (!a || !a.matches || !a.matches('input, textarea')) document.body.classList.remove('typing');
  }, 50);

  // ---------- Start ----------
  draw();
  requestWakeLock();
  const clock = setInterval(() => { const c = root.querySelector('#wk-clock'); if (c) c.textContent = elapsed(); }, 1000);
  const onVis = () => {
    if (document.visibilityState === 'visible') {
      requestWakeLock();
      const c = root.querySelector('#wk-clock');
      if (c) c.textContent = elapsed();
    } else save.flush();
  };
  document.addEventListener('visibilitychange', onVis);
  // Satz nach links wischen -> „Löschen“
  const swiper = swipeRows(root, { row: '.set-row', main: '.set-main' });
  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);

  const offs = [
    on(root, 'input', '.set-in', (e, inp) => {
      const { item, set, idx } = locate(inp);
      if (!set) return;
      const f = inp.dataset.f;
      const v = f === 'reps' || f === 'seconds' ? (inp.value.replace(/\D/g, '') ? parseInt(inp.value.replace(/\D/g, ''), 10) : null) : parseNum(inp.value);
      if (f === 'min') set.seconds = v == null ? null : Math.round(v * 60);
      else set[f] = v;
      save();
      if (set.done) refreshPRsSoon();
      // Platzhalter der folgenden Saetze haengen evtl. von diesem Satz ab
      if (!ctx.last.get(item.id) || !ctx.last.get(item.id).work.length) {
        item.sets.forEach((x, j) => {
          if (j <= idx) return;
          const ph = placeholderFor(item, j, ctx.last.get(item.id));
          const r = root.querySelector(`.set-row[data-item="${item.id}"][data-idx="${j}"]`);
          if (!r) return;
          r.querySelectorAll('.set-in').forEach((el) => {
            const t = fieldText(fieldValue(ph, el.dataset.f), el.dataset.f);
            if (t) el.placeholder = t;
          });
        });
      }
    }),
    on(root, 'change', '.set-in', (e, inp) => {
      const { set } = locate(inp);
      if (set) inp.value = fieldText(fieldValue(set, inp.dataset.f), inp.dataset.f);
    }),
    on(root, 'keydown', '.set-in', (e, inp) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const next = inp.parentElement.querySelectorAll('.set-in');
      const i = [...next].indexOf(inp);
      if (i >= 0 && next[i + 1]) next[i + 1].focus(); else inp.blur();
    }),
    on(root, 'click', '[data-check]', (e, b) => { const { item, idx } = locate(b); if (item) check(item, idx); }),
    on(root, 'click', '[data-type]', (e, b) => {
      const { item, set } = locate(b);
      if (!set) return;
      set.type = isWarm(set) ? 'work' : 'warmup';
      save();
      draw();
      toast(isWarm(set) ? 'Aufwärmsatz – zählt nicht für die Statistik' : 'Arbeitssatz');
    }),
    on(root, 'click', '[data-del]', (e, b) => {
      const { item, idx } = locate(b);
      if (!item) return;
      item.sets.splice(idx, 1);
      swiper.forget();
      save();
      draw();
    }),
    on(root, 'click', '[data-add-set]', (e, b) => {
      b.dataset.addSet.split(',').forEach((id) => {
        const it = itemById(id);
        if (it) it.sets.push(newSet('work'));
      });
      save();
      draw();
    }),
    on(root, 'click', '[data-prog]', (e, b) => {
      const item = itemById(b.closest('[data-item]').dataset.item);
      const kg = Number(b.dataset.prog);
      item.sets.forEach((x) => { if (!x.done && !isWarm(x)) x.kg = kg; });
      save();
      draw();
    }),
    on(root, 'click', '[data-ex-menu]', (e, b) => { const it = itemById(b.closest('[data-item]').dataset.item); if (it) itemMenu(it); }),
    on(root, 'click', '[data-ex-note]', (e, b) => { const it = itemById(b.closest('[data-item]').dataset.item); if (it && db.exercise(it.exerciseId)) editExerciseNote(db.exercise(it.exerciseId)); }),
    on(root, 'click', '[data-add-ex]', () => addExercises()),
    on(root, 'click', '[data-finish]', () => finish()),
    on(root, 'input', '[data-session-note]', (e, ta) => { s.note = ta.value; save(); }),
  ];

  return () => {
    offs.forEach((f) => f());
    save.flush();
    offFlush();
    clearInterval(clock);
    if (sw) sw.destroy();
    releaseWakeLock();
    document.body.classList.remove('typing');
    document.removeEventListener('visibilitychange', onVis);
    swiper.destroy();
    root.removeEventListener('focusin', onFocusIn);
    root.removeEventListener('focusout', onFocusOut);
  };
}
