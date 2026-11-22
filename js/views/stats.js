// Statistik: Zeitraum Woche | Monat | Jahr | Alle.
// Kacheln (Workouts, Trainingszeit, Volumen, Arbeitssaetze) mit Vergleich zum gleichen Abschnitt
// des vorherigen Zeitraums, Volumen-Balken, Muskel-Mensch (Saetze | Erholung), Kurzansicht der
// Muskelbalance (eigener Zeitraum: letzte 4 Wochen) und Uebungsliste mit Mini-Trendlinie.
// Alles wird live aus den Sessions berechnet.

import * as db from '../db.js';
import { pageHead } from '../components/header.js';
import { barChart, sparkline } from '../components/chart.js';
import { bodyMapHTML, weekClasses, legendWeek, legendRecovery } from '../components/body-map.js';
import { getBodyMode, setBodyMode } from '../components/body-card.js';
import { weekSets, sessionMuscleSets, recovery, recoveryClasses, doneWorkSets } from '../lib/muscle-load.js';
import { sessionVolume, sessionWorkSets, sessionDuration, exerciseSeries, e1rmTrend, isWeighted } from '../lib/stats.js';
import { analyzeBalance, topFindings, ratioText, waitText, byNeed, STATUS_KEYS, STATUS_COUNT_LABEL } from '../lib/balance.js';
import {
  fmtNum, fmtInt, fmtVolume, fmtDuration, fmtPct, fmtDayMonth, fmtDayMonthShort, fmtMonthShort, fmtMonthLong,
  fmtMonthYear, isoWeek, startOfWeek, startOfMonth, startOfYear, addDays, addMonths,
} from '../lib/format.js';
import { on, esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { navigate } from '../router.js';

const PERIODS = [['woche', 'Woche'], ['monat', 'Monat'], ['jahr', 'Jahr'], ['alle', 'Alle']];
const WD_SHORT = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
const WEEK_MS = 7 * 864e5;
const EX_LIMIT = 8;

let period = 'woche';  // bleibt beim Wechsel zwischen den Tabs erhalten
let showAllEx = false;

// ---------- Zeitraeume ----------
/**
 * Aktueller Zeitraum ab `from` und Vergleichsabschnitt [prevFrom, prevTo): der vorherige Zeitraum
 * bis zum gleichen Zeitpunkt (Vorwoche bis heute, gleiche Uhrzeit) – sonst waere der laufende
 * Zeitraum fast immer „schlechter“.
 */
function rangeOf(p, now) {
  const done = db.doneSessions();
  const first = done.length ? new Date(done[0].startedAt) : null;
  if (p === 'woche') {
    const from = startOfWeek(now);
    return { from, prevFrom: addDays(from, -7), prevTo: addDays(now, -7), first };
  }
  if (p === 'monat') {
    const from = startOfMonth(now);
    const prevFrom = addMonths(from, -1);
    const dim = new Date(from.getFullYear(), from.getMonth(), 0).getDate(); // Tage im Vormonat
    const full = now.getDate() > dim;
    const prevTo = full ? from : new Date(prevFrom.getFullYear(), prevFrom.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
    return { from, prevFrom, prevTo, full, first };
  }
  if (p === 'jahr') {
    const from = startOfYear(now);
    const y = now.getFullYear() - 1, m = now.getMonth();
    const day = Math.min(now.getDate(), new Date(y, m + 1, 0).getDate());
    return { from, prevFrom: new Date(y, 0, 1), prevTo: new Date(y, m, day, now.getHours(), now.getMinutes(), now.getSeconds()), first };
  }
  return { from: first ? startOfWeek(first) : startOfWeek(now), prevFrom: null, prevTo: null, first };
}

function totals(from, to = null) {
  const t0 = from.getTime(), t1 = to ? to.getTime() : Infinity;
  const list = db.doneSessions().filter((s) => { const t = new Date(s.startedAt).getTime(); return t >= t0 && t < t1; });
  return {
    count: list.length,
    min: Math.round(list.reduce((a, s) => a + sessionDuration(s), 0) / 60000),
    volume: Math.round(list.reduce((a, s) => a + sessionVolume(s), 0)),
    sets: list.reduce((a, s) => a + sessionWorkSets(s), 0),
  };
}

function periodLabel(p, r, now) {
  if (p === 'woche') return `KW ${isoWeek(now).week} · ${fmtDayMonthShort(r.from)} – ${fmtDayMonthShort(addDays(r.from, 6))}`;
  if (p === 'monat') return fmtMonthYear(now);
  if (p === 'jahr') return String(now.getFullYear());
  return r.first ? `seit ${fmtDayMonth(r.first)} ${r.first.getFullYear()}` : 'Noch keine Workouts';
}

function compareText(p, r, now) {
  if (p === 'woche') {
    const d = (now.getDay() + 6) % 7; // 0 = Montag
    return `Vergleich mit der Vorwoche (${d ? `Mo.–${WD_SHORT[now.getDay()]}` : 'Mo.'})`;
  }
  if (p === 'monat') {
    const last = r.full ? new Date(r.prevFrom.getFullYear(), r.prevFrom.getMonth() + 1, 0).getDate() : now.getDate();
    return `Vergleich mit ${last > 1 ? `1.–${last}.` : '1.'} ${fmtMonthLong(r.prevFrom)}`;
  }
  return `Vergleich mit 1. Jan. – ${fmtDayMonthShort(r.prevTo)} ${r.prevFrom.getFullYear()}`;
}

// ---------- Kacheln ----------
function timeHTML(min) {
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m}<span class="unit">min</span>`;
  if (h >= 100 || !m) return `${fmtInt(h)}<span class="unit">h</span>`;
  return `${h}<span class="unit">h</span> ${m}<span class="unit">min</span>`;
}
function volumeHTML(kg) {
  return kg >= 100000 ? `${fmtNum(kg / 1000, 1)}<span class="unit">t</span>` : `${fmtInt(kg)}<span class="unit">kg</span>`;
}

function deltaHTML(cur, prev, fmt) {
  const d = cur - prev;
  if (!d) return `<div class="st-sub">${icon('minus')}<span>gleich viel</span></div>`;
  return `<div class="st-sub ${d > 0 ? 'up' : ''}">${icon(d > 0 ? 'arrowUp' : 'arrowDown')}<span>${esc(fmt(Math.abs(d)))} ${d > 0 ? 'mehr' : 'weniger'}</span></div>`;
}
const avgHTML = (text) => (text ? `<div class="st-sub"><span>${esc(text)}</span></div>` : '');

function tile(iconName, label, valueHTML, sub) {
  return `<div class="card st-tile">
    <div class="st-tile-head"><span class="icon-disc">${icon(iconName)}</span><span class="st-label">${esc(label)}</span></div>
    <div class="st-value">${valueHTML}</div>
    ${sub}
  </div>`;
}

function tilesHTML(p, r, now) {
  const cur = totals(r.from);
  let subs = ['', '', '', ''];
  if (p === 'alle') {
    const weeks = Math.max(1, (now - r.from) / WEEK_MS);
    const n = cur.count;
    subs = [
      n ? avgHTML(`Ø ${fmtNum(n / weeks, 1)} pro Woche`) : '',
      n ? avgHTML(`Ø ${fmtDuration((cur.min / n) * 60000)} pro Workout`) : '',
      n && cur.volume ? avgHTML(`Ø ${fmtVolume(cur.volume / n)} pro Workout`) : '',
      n ? avgHTML(`Ø ${fmtNum(cur.sets / n, 0)} pro Workout`) : '',
    ];
  } else if (r.first && r.first < r.from) {
    const prev = totals(r.prevFrom, r.prevTo);
    subs = [
      deltaHTML(cur.count, prev.count, (v) => String(v)),
      deltaHTML(cur.min, prev.min, (v) => fmtDuration(v * 60000)),
      deltaHTML(cur.volume, prev.volume, fmtVolume),
      deltaHTML(cur.sets, prev.sets, (v) => String(v)),
    ];
  }
  return `<div class="grid-2">
      ${tile('dumbbell', 'Workouts', String(cur.count), subs[0])}
      ${tile('clock', 'Trainingszeit', timeHTML(cur.min), subs[1])}
      ${tile('kettlebell', 'Volumen', volumeHTML(cur.volume), subs[2])}
      ${tile('layers', 'Arbeitssätze', String(cur.sets), subs[3])}
    </div>
    ${p !== 'alle' && r.first && r.first < r.from ? `<p class="st-note">${esc(compareText(p, r, now))}</p>` : ''}`;
}

// ---------- Volumen-Balken ----------
function chartData(p, now) {
  const done = db.doneSessions();
  const note = (b) => (b.count ? `${b.count} ${b.count === 1 ? 'Workout' : 'Workouts'} · ${b.sets} ${b.sets === 1 ? 'Satz' : 'Sätze'}` : 'kein Training');
  if (p === 'woche' || p === 'monat') {
    const cur = startOfWeek(now);
    // Monat: bis zu 26 Wochen, aber keine leeren Wochen vor dem ersten Workout (mind. 12)
    const since = done.length ? Math.round((cur - startOfWeek(new Date(done[0].startedAt))) / WEEK_MS) + 1 : 12;
    const n = p === 'woche' ? 12 : Math.min(26, Math.max(12, since));
    const first = addDays(cur, -7 * (n - 1));
    const buckets = Array.from({ length: n }, (_, i) => ({ start: addDays(first, 7 * i), vol: 0, count: 0, sets: 0 }));
    for (const s of done) {
      const d = new Date(s.startedAt);
      if (d < first) continue;
      const i = Math.round((startOfWeek(d) - first) / WEEK_MS); // gerundet: sommerzeitfest
      if (i < 0 || i >= n) continue;
      buckets[i].vol += sessionVolume(s); buckets[i].count++; buckets[i].sets += sessionWorkSets(s);
    }
    const m0 = startOfMonth(now);
    return {
      title: 'Volumen pro Woche',
      sub: p === 'woche' ? 'Letzte 12 Wochen' : `Letzte ${n} Wochen · ${fmtMonthLong(now)} hervorgehoben`,
      labelHl: p === 'woche',
      bars: buckets.map((b) => {
        const wk = isoWeek(b.start).week;
        const end = addDays(b.start, 6);
        return {
          label: String(wk),
          tip: `KW ${wk} · ${fmtDayMonthShort(b.start)} – ${fmtDayMonthShort(end)}`,
          value: b.vol / 1000,
          hl: p === 'woche' ? b.start.getTime() === cur.getTime() : end >= m0,
          note: note(b),
        };
      }),
    };
  }
  // pro Monat: Jahr = Jan–Dez des laufenden Jahres, Alle = seit dem ersten Workout (mind. 6 Monate)
  const curM = startOfMonth(now);
  let start, last;
  if (p === 'jahr') { start = startOfYear(now); last = new Date(now.getFullYear(), 11, 1); }
  else {
    const f = done.length ? startOfMonth(new Date(done[0].startedAt)) : curM;
    const min6 = addMonths(curM, -5);
    start = f < min6 ? f : min6;
    last = curM;
  }
  const idx = (d) => d.getFullYear() * 12 + d.getMonth();
  const months = [];
  for (let m = start; idx(m) <= idx(last); m = addMonths(m, 1)) months.push({ start: m, vol: 0, count: 0, sets: 0 });
  for (const s of done) {
    const i = idx(new Date(s.startedAt)) - idx(start);
    if (i < 0 || i >= months.length) continue;
    months[i].vol += sessionVolume(s); months[i].count++; months[i].sets += sessionWorkSets(s);
  }
  return {
    title: 'Volumen pro Monat',
    sub: p === 'jahr' ? String(now.getFullYear()) : `Seit ${fmtMonthYear(start)}`,
    labelHl: true,
    bars: months.map((b) => ({
      label: fmtMonthShort(b.start),
      tip: fmtMonthYear(b.start),
      value: b.vol / 1000,
      hl: idx(b.start) === idx(curM),
      note: note(b),
    })),
  };
}

// ---------- Muskel-Mensch ----------
function bodyHTML(p, r, now, mode) {
  let classes, sub;
  if (mode === 'week') {
    let sets;
    if (p === 'woche') {
      sets = weekSets(now);
      sub = `KW ${isoWeek(now).week} · Sätze`;
    } else {
      // Durchschnitt pro Woche ueber den Zeitraum -> gleiche Farbskala wie bei einer Woche
      const sum = {};
      const t0 = r.from.getTime();
      for (const s of db.state.sessions) {
        if (new Date(s.startedAt).getTime() < t0) continue;
        const m = sessionMuscleSets(s);
        for (const k in m) sum[k] = (sum[k] || 0) + m[k];
      }
      const weeks = Math.max(1, (now - r.from) / WEEK_MS);
      sets = {};
      for (const k in sum) sets[k] = sum[k] / weeks;
      sub = 'Ø Sätze pro Woche';
    }
    classes = weekClasses(sets);
  } else {
    classes = recoveryClasses(recovery(now));
    sub = 'Richtwert';
  }
  const btn = (m, label) => `<button type="button" data-bodymode="${m}" class="${mode === m ? 'on' : ''}" role="tab" aria-selected="${mode === m}">${label}</button>`;
  return `<div class="body-card-head">
      <div class="grow"><div class="card-title">Muskeln</div><div class="card-sub">${esc(sub)}</div></div>
      <div class="seg sm" role="tablist" aria-label="Ansicht">${btn('week', 'Sätze')}${btn('recovery', 'Erholung')}</div>
    </div>
    ${bodyMapHTML({ classes, cls: 'tappable', hit: true })}
    <div class="mt-12">${mode === 'week' ? legendWeek() : legendRecovery()}</div>
    <p class="st-hint">Muskel antippen für Details</p>`;
}

// ---------- Muskelbalance (Kurzansicht, Details unter #/muskelbalance) ----------
function findingHTML(f) {
  if (f.type === 'muscle') {
    const m = f.m;
    return `<li><i class="bdot b-${m.status}"></i><span class="grow">${esc(m.name)}</span><b>${esc(fmtNum(m.perWeek, 1))} von ${m.target.from}</b></li>`;
  }
  const p = f.p;
  return `<li><i class="bdot p-${p.level}"></i><span class="grow">${esc(p.a)} : ${esc(p.b)}</span><b>${esc(ratioText(p))}</b></li>`;
}

function balanceHTML(now) {
  const res = analyzeBalance({ weeks: 4, now, trends: false });
  const head = (sub) => `<div class="bal-head">
      <span class="icon-disc">${icon('balance')}</span>
      <span class="grow"><span class="card-title">Muskelbalance</span><span class="card-sub">${esc(sub)}</span></span>
      ${icon('chevronRight', 'chev')}
    </div>`;
  if (!res.enough) {
    return `<a class="card card-tap bal-card" href="#/muskelbalance">${head('Welche Muskeln kommen zu kurz?')}<p class="bal-wait">${esc(waitText(res))}</p></a>`;
  }
  const ms = res.muscles.slice().sort(byNeed);
  const count = {};
  ms.forEach((m) => { count[m.status] = (count[m.status] || 0) + 1; });
  const finds = topFindings(res, 3);
  return `<a class="card card-tap bal-card" href="#/muskelbalance">
    ${head('Letzte 4 Wochen · Ø Sätze pro Woche')}
    <div class="bal-strip" aria-hidden="true">${ms.map((m) => `<i class="b-${m.status}"></i>`).join('')}</div>
    <div class="bal-counts">${STATUS_KEYS.filter((k) => count[k]).map((k) => `<span><i class="bdot b-${k}"></i>${count[k]} ${STATUS_COUNT_LABEL[k]}</span>`).join('')}</div>
    ${finds.length ? `<ul class="bal-find">${finds.map(findingHTML).join('')}</ul>` : '<p class="bal-wait">Gut verteilt – kein Muskel kommt zu kurz.</p>'}
  </a>`;
}

// ---------- Uebungen ----------
function exerciseRows(r) {
  const t0 = r.from.getTime();
  const per = new Map();
  for (const s of db.doneSessions()) {
    if (new Date(s.startedAt).getTime() < t0) continue;
    const seen = new Set();
    for (const it of s.items) {
      const n = doneWorkSets(it).length;
      if (!n) continue;
      const e = per.get(it.exerciseId) || { sets: 0, sessions: 0 };
      e.sets += n;
      if (!seen.has(it.exerciseId)) { e.sessions++; seen.add(it.exerciseId); }
      per.set(it.exerciseId, e);
    }
  }
  return [...per.entries()]
    .map(([id, v]) => ({ ex: db.exercise(id), ...v }))
    .filter((x) => x.ex)
    .sort((a, b) => b.sets - a.sets || a.ex.name.localeCompare(b.ex.name, 'de'));
}

/** Werte fuer die Mini-Trendlinie: letzte 10 Einheiten */
function sparkValues(ex) {
  const series = exerciseSeries(ex.id).slice(-10);
  switch (ex.tracking) {
    case 'gewicht_wdh':
    case 'zusatzgewicht_wdh': return series.map((x) => (x.e1rm != null ? x.e1rm : x.maxReps));
    case 'wdh': return series.map((x) => x.maxReps);
    case 'zeit': return series.map((x) => x.maxSec);
    case 'distanz_zeit': return series.map((x) => Math.max(0, ...x.sets.map((s) => s.km || 0)) || null);
    default: return [];
  }
}

function exRow({ ex, sets, sessions }, now) {
  const t = isWeighted(ex) ? e1rmTrend(ex.id, now) : null;
  const trend = t == null ? '' : `<span class="trend ${Math.round(t * 100) > 0 ? 'up' : 'down'}">${esc(fmtPct(t))}</span>`;
  return `<a class="row st-ex" href="#/uebung/${esc(ex.id)}">
    <span class="grow"><span class="row-title">${esc(ex.name)}</span>
      <span class="row-sub">${sets} ${sets === 1 ? 'Satz' : 'Sätze'} · ${sessions} ${sessions === 1 ? 'Einheit' : 'Einheiten'}</span></span>
    <span class="st-ex-r">${sparkline(sparkValues(ex))}${trend}</span>${icon('chevronRight', 'chev')}
  </a>`;
}

function exercisesHTML(r, now) {
  const rows = exerciseRows(r);
  const head = `<h2 class="section-title">Übungen <span class="count">${rows.length}</span></h2>`;
  if (!rows.length) {
    return `${head}<div class="card empty"><strong>Keine Workouts</strong>In diesem Zeitraum wurde noch nicht trainiert.</div>`;
  }
  // „Alle anzeigen“ erst, wenn sich das Aufklappen lohnt (mehr als 2 versteckte Uebungen)
  const shown = showAllEx || rows.length <= EX_LIMIT + 2 ? rows : rows.slice(0, EX_LIMIT);
  return `${head}
    <div class="list">${shown.map((x) => exRow(x, now)).join('')}
      ${rows.length > shown.length ? `<button class="row st-more" type="button" data-more-ex>Alle ${rows.length} Übungen anzeigen</button>` : ''}
    </div>
    <p class="st-foot">Sortiert nach Sätzen im Zeitraum. Linie: bestes e1RM der letzten 10 Einheiten (ohne Gewicht: Wiederholungen bzw. Zeit). Prozent: letzte 4 Wochen gegenüber den 4 Wochen davor.</p>`;
}

// ---------- Seite ----------
export function render(root, params = {}, { isBack } = {}) {
  if (!isBack && params.period && PERIODS.some(([k]) => k === params.period)) period = params.period;
  let mode = getBodyMode();
  let chart = null;

  const draw = () => {
    const now = new Date();
    const r = rangeOf(period, now);
    const cd = chartData(period, now);
    if (chart) { chart.destroy(); chart = null; }
    root.innerHTML = `
      ${pageHead({ title: 'Statistik' })}
      <div class="seg" role="tablist" aria-label="Zeitraum">
        ${PERIODS.map(([k, l]) => `<button type="button" data-period="${k}" class="${k === period ? 'on' : ''}" role="tab" aria-selected="${k === period}">${l}</button>`).join('')}
      </div>
      <p class="st-period">${esc(periodLabel(period, r, now))}</p>
      <div class="stack mt-12">
        ${tilesHTML(period, r, now)}
        <section class="card st-chart-card">
          <div class="card-title">${esc(cd.title)}</div>
          <div class="card-sub">${esc(cd.sub)}</div>
          <div class="mt-12" id="st-chart"></div>
        </section>
        <section class="card body-card st-body" id="st-body">${bodyHTML(period, r, now, mode)}</section>
        ${balanceHTML(now)}
      </div>
      <div id="st-ex">${exercisesHTML(r, now)}</div>`;
    const hasVolume = cd.bars.some((b) => b.value > 0);
    chart = barChart(root.querySelector('#st-chart'), {
      bars: hasVolume ? cd.bars : [],
      height: 180,
      labelHl: cd.labelHl,
      yFormat: (v, dec) => (v === 0 ? '0' : `${fmtNum(v, dec ?? 1, dec ?? 0)} t`),
      valueFormat: (v) => fmtVolume(v * 1000),
      hlFormat: (v) => (v >= 1 ? `${fmtNum(v, 1)} t` : `${fmtInt(v * 1000)} kg`),
      empty: 'Noch kein Volumen in diesem Zeitraum',
      label: cd.title,
    });
  };

  draw();
  const offs = [
    on(root, 'click', '[data-period]', (e, b) => {
      if (b.dataset.period === period) return;
      period = b.dataset.period;
      showAllEx = false;
      draw();
    }),
    on(root, 'click', '[data-bodymode]', (e, b) => {
      mode = b.dataset.bodymode;
      setBodyMode(mode);
      const now = new Date();
      root.querySelector('#st-body').innerHTML = bodyHTML(period, rangeOf(period, now), now, mode);
    }),
    on(root, 'click', '#st-body [data-muscle]', (e, g) => navigate('#/muskel/' + g.dataset.muscle)),
    on(root, 'click', '[data-more-ex]', () => {
      showAllEx = true;
      const now = new Date();
      root.querySelector('#st-ex').innerHTML = exercisesHTML(rangeOf(period, now), now);
    }),
    db.subscribe(draw),
  ];
  return () => {
    offs.forEach((f) => f());
    if (chart) chart.destroy();
  };
}
