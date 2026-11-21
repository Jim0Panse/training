// Koerpergewicht (Bottom-Sheet, fast vollflaechig): Kennzahlen, Graph mit 7-Tage-Mittel,
// Eingabe mit Nachtragen und Liste aller Eintraege (Tippen: bearbeiten/loeschen, Wischen: loeschen).

import * as db from '../db.js';
import { openSheet, actionSheet } from './sheet.js';
import { lineChart } from './chart.js';
import { latest, entryFor, avg7, avgChange, weightSeries, rangeDomain } from '../lib/bodyweight.js';
import { fmtKg, fmtNum, fmtSigned, parseNum, numToInput, dateKey, fromKey, addDays, fmtDateShort, fmtRelDay } from '../lib/format.js';
import { esc, on, toast, flash } from '../lib/dom.js';
import { swipeRows } from '../lib/swipe.js';
import { icon } from '../lib/icons.js';

const RANGES = [['30', '30 Tage'], ['90', '90 Tage'], ['365', '1 Jahr'], ['all', 'Alle']];
const PAGE = 30;
const MIN_KG = 20, MAX_KG = 400;
let range = '30'; // bleibt erhalten, solange die App offen ist

const today = () => dateKey(new Date());
/** „Heute“, „Gestern“, „Mi., 18. Nov.“ (+ Jahr, wenn nicht aktuell) */
function dayLabel(key) {
  if (key === today()) return 'Heute';
  if (key === dateKey(addDays(new Date(), -1))) return 'Gestern';
  return dayTitle(key);
}
function dayTitle(key) {
  const d = fromKey(key);
  const s = fmtDateShort(d);
  return d.getFullYear() === new Date().getFullYear() ? s : `${s} ${d.getFullYear()}`;
}

export function openBodyweight() {
  let date = today();
  let showAll = false;
  let chart = null;

  const s = openSheet({
    title: 'Körpergewicht',
    full: true,
    cls: 'bw-sheet',
    body: `
      <div class="stat-row" id="bw-stats"></div>
      <div class="card mt-12 bw-chart-card">
        <div class="seg sm" role="tablist" aria-label="Zeitraum">${RANGES.map(([v, l]) =>
          `<button data-range="${v}" class="${v === range ? 'on' : ''}" role="tab" aria-selected="${v === range}">${l}</button>`).join('')}</div>
        <div id="bw-chart" class="mt-12"></div>
      </div>
      <div class="card mt-12 bw-entry" id="bw-entry">
        <div class="bw-entry-head">
          <span class="card-title">Eintragen</span>
          <label class="chip soft bw-date">${icon('calendar')}<span id="bw-date-label">Heute</span>${icon('chevronDown')}
            <input type="date" id="bw-date" aria-label="Datum wählen"></label>
        </div>
        <div class="bw-entry-row">
          <div class="input-unit bw-num"><input class="input" id="bw-kg" inputmode="decimal" enterkeyhint="done" autocomplete="off" aria-label="Gewicht in kg"><span>kg</span></div>
          <button class="btn bw-save" type="button" data-save>Speichern</button>
        </div>
        <div class="bw-hint" id="bw-hint" aria-live="polite"></div>
      </div>
      <h2 class="section-title">Einträge <span class="count" id="bw-count"></span></h2>
      <div id="bw-list"></div>`,
    onClose: () => cleanup(),
  });

  const $ = (sel) => s.body.querySelector(sel);
  const kgIn = $('#bw-kg'), dateIn = $('#bw-date'), hint = $('#bw-hint');

  // ---------- Kennzahlen ----------
  function drawStats() {
    const l = latest();
    const a = avg7();
    const c = avgChange(30);
    $('#bw-stats').innerHTML = `
      <div class="card stat-mini"><div class="v">${l ? esc(fmtKg(l.kg)) : '–'}<small>kg</small></div>
        <div class="l">Aktuell</div><div class="s">${l ? esc(fmtRelDay(fromKey(l.date))) : 'noch kein Wert'}</div></div>
      <div class="card stat-mini"><div class="v">${a ? esc(fmtNum(a.kg, 1)) : '–'}<small>kg</small></div>
        <div class="l">Ø 7 Tage</div><div class="s">${a ? `${a.n} ${a.n === 1 ? 'Wert' : 'Werte'}` : 'keine Werte'}</div></div>
      <div class="card stat-mini"><div class="v">${c != null ? esc(fmtSigned(c, 1)) : '–'}<small>kg</small></div>
        <div class="l">30 Tage</div><div class="s">${c != null ? 'Ø-Vergleich' : 'zu wenig Werte'}</div></div>`;
  }

  // ---------- Graph ----------
  function drawChart() {
    const { raw, avg } = weightSeries();
    const [x0, x1] = rangeDomain(range);
    const inRange = (p) => p.x >= x0 && p.x <= x1;
    const cfg = {
      series: [
        { label: 'Messwert', cls: 'soft', line: false, format: fmtKg, points: raw.filter(inRange) },
        { label: 'Ø 7 Tage', cls: 'main', dots: 'last', points: avg.filter(inRange) },
      ],
      xDomain: [x0, x1],
      snap: 1,
      height: 200,
      yFormat: (v, dec) => fmtNum(v, dec ?? 1, dec ?? 0),
      valueFormat: (v) => fmtNum(v, 1),
      unit: 'kg',
      label: 'Körpergewicht und 7-Tage-Mittel',
      empty: db.state.bodyweight.length ? 'Keine Einträge in diesem Zeitraum' : 'Noch keine Einträge – trag unten dein Gewicht ein.',
    };
    if (chart) chart.update(cfg); else chart = lineChart($('#bw-chart'), cfg);
  }

  // ---------- Eingabe ----------
  function setDate(key) {
    date = key;
    $('#bw-date-label').textContent = dayLabel(key);
    dateIn.max = today();
    dateIn.value = key;
    updateHint();
  }
  function updateHint() {
    const e = entryFor(date);
    hint.classList.remove('err');
    kgIn.classList.remove('invalid');
    hint.textContent = e ? `ersetzt ${fmtKg(e.kg)} kg` : '';
    const l = latest();
    kgIn.placeholder = l ? numToInput(l.kg) : '0,0';
  }
  function showError(text) {
    hint.textContent = text;
    hint.classList.add('err');
    kgIn.classList.add('invalid');
  }
  async function save() {
    const v = parseNum(kgIn.value);
    if (v == null) { showError('Bitte Gewicht eingeben, z. B. 82,4'); kgIn.focus(); return; }
    if (v < MIN_KG || v > MAX_KG) { showError(`Bitte ein Gewicht zwischen ${MIN_KG} und ${MAX_KG} kg eingeben`); kgIn.focus(); return; }
    const kg = Math.round(v * 100) / 100;
    const key = date;
    kgIn.value = '';
    kgIn.blur();
    await db.putBodyweight({ date: key, kg });
    toast(`${fmtKg(kg)} kg gespeichert${key === today() ? '' : ` · ${dayLabel(key)}`}`);
    setDate(today());
  }
  function editEntry(key) {
    const e = entryFor(key);
    if (!e) return;
    setDate(key);
    kgIn.value = numToInput(e.kg);
    const card = $('#bw-entry');
    card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    flash(card, 'pulse-soft', 1200);
  }
  async function remove(key) {
    const e = entryFor(key);
    if (!e) return;
    swiper.forget();
    await db.deleteBodyweight(key);
    toast(`${fmtKg(e.kg)} kg vom ${dayTitle(key)} gelöscht`);
    if (date === key) updateHint();
  }

  // ---------- Liste ----------
  function drawList() {
    const all = [...db.state.bodyweight].reverse();
    $('#bw-count').textContent = all.length || '';
    if (!all.length) {
      $('#bw-list').innerHTML = '<div class="card empty small">Noch keine Einträge. Am besten morgens nach dem Aufstehen wiegen.</div>';
      return;
    }
    const shown = showAll ? all : all.slice(0, PAGE);
    $('#bw-list').innerHTML = `<div class="list bw-list">${shown.map((b, i) => {
      const prev = all[i + 1];
      const d = prev ? b.kg - prev.kg : null;
      return `<div class="bw-row" data-date="${b.date}">
        <button class="row-del" type="button" data-del tabindex="-1">${icon('trash')}Löschen</button>
        <button class="row bw-main" type="button" data-entry>
          <span class="grow"><span class="row-title">${esc(dayTitle(b.date))}</span><span class="row-sub">${esc(fmtRelDay(fromKey(b.date)))}</span></span>
          <span class="row-value"><strong>${esc(fmtKg(b.kg))} kg</strong>${d != null ? `<small>${esc(fmtSigned(d, 1))} kg</small>` : ''}</span>
        </button>
      </div>`;
    }).join('')}</div>
    ${!showAll && all.length > PAGE ? `<button class="btn btn-text" type="button" data-more>Alle ${all.length} Einträge anzeigen</button>` : ''}`;
  }

  function drawAll() { drawStats(); drawChart(); drawList(); updateHint(); }

  // ---------- Ereignisse ----------
  const swiper = swipeRows(s.body, { row: '.bw-row', main: '.bw-main' });
  const fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  const onDateClick = () => { if (fine && dateIn.showPicker) { try { dateIn.showPicker(); } catch (e) { /* egal */ } } };
  const onDateChange = () => {
    const v = dateIn.value;
    if (!v) setDate(today());
    else if (v > today()) { toast('Das Datum liegt in der Zukunft'); setDate(today()); }
    else setDate(v);
  };
  dateIn.addEventListener('click', onDateClick);
  dateIn.addEventListener('change', onDateChange);
  dateIn.addEventListener('input', onDateChange);

  const offs = [
    on(s.body, 'click', '[data-range]', (e, b) => {
      range = b.dataset.range;
      s.body.querySelectorAll('[data-range]').forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-selected', String(x === b));
      });
      drawChart();
    }),
    on(s.body, 'click', '[data-save]', save),
    on(s.body, 'keydown', '#bw-kg', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }),
    on(s.body, 'input', '#bw-kg', () => { if (kgIn.classList.contains('invalid')) updateHint(); }),
    on(s.body, 'focusin', '#bw-kg', () => setTimeout(() => $('#bw-entry').scrollIntoView({ block: 'nearest' }), 320)),
    on(s.body, 'click', '[data-more]', () => { showAll = true; drawList(); }),
    on(s.body, 'click', '[data-del]', (e, b) => remove(b.closest('.bw-row').dataset.date)),
    on(s.body, 'click', '[data-entry]', async (e, b) => {
      const key = b.closest('.bw-row').dataset.date;
      const entry = entryFor(key);
      if (!entry) return;
      const r = await actionSheet({
        title: `${fmtKg(entry.kg)} kg · ${dayTitle(key)}`,
        actions: [
          { label: 'Bearbeiten', value: 'edit', icon: 'pencil' },
          { label: 'Löschen', value: 'del', icon: 'trash', danger: true },
        ],
      });
      if (r === 'edit') editEntry(key);
      if (r === 'del') remove(key);
    }),
    db.subscribe((store) => { if (store === 'bodyweight' || store === 'all') drawAll(); }),
  ];

  function cleanup() {
    offs.forEach((f) => f());
    swiper.destroy();
    if (chart) chart.destroy();
    dateIn.removeEventListener('click', onDateClick);
    dateIn.removeEventListener('change', onDateChange);
    dateIn.removeEventListener('input', onDateChange);
  }

  setDate(today());
  drawAll();
  return s;
}
