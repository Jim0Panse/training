// Muskel-Detail: Saetze diese Woche + Erholung, effektive Saetze pro Woche (12 Wochen, Zielbereich
// des Muskels wie in der Muskelbalance), Uebungen fuer diesen Muskel, e1RM-Verlauf der wichtigsten
// Hauptuebung, letzte Einheiten. Saetze hier nur aus Kraftuebungen (vergleichbar mit dem Richtwert),
// Sprung-/Explosivsaetze werden daneben genannt.

import * as db from '../db.js';
import { topbar } from '../components/header.js';
import { barChart, lineChart } from '../components/chart.js';
import { bodyMapHTML } from '../components/body-map.js';
import { MUSCLE, muscleTarget } from '../data/muscles.js';
import { weekSets, weeklySeries, recovery, RECOVERY_LABEL, doneWorkSets } from '../lib/muscle-load.js';
import { exerciseSeries, exerciseRecords, e1rmTrend, setLabel, setE1rm, fmtSec, isWeighted } from '../lib/stats.js';
import { fmtNum, fmtKg, fmtInt, fmtPct, fmtHours, fmtDM, isoWeek, addDays, startOfWeek, fmtDayMonthShort, fmtDateShort } from '../lib/format.js';
import { on, esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { navigate } from '../router.js';

const chosen = new Map(); // Muskel -> gewaehlte Uebung fuer den e1RM-Graphen
const STRENGTH = { plyo: false };

const dateLabel = (d) => (d.getFullYear() === new Date().getFullYear() ? fmtDateShort(d) : `${fmtDateShort(d)} ${d.getFullYear()}`);

/** Bester Wert einer Uebung fuer die Tabelle */
function bestValue(ex, rec) {
  if (!rec) return '–';
  switch (ex.tracking) {
    case 'gewicht_wdh': return rec.weight != null ? fmtKg(rec.weight) : '–';
    case 'zusatzgewicht_wdh': return rec.weight != null ? `+${fmtKg(rec.weight)}` : (rec.reps != null ? `${fmtInt(rec.reps)} Wdh.` : '–');
    case 'wdh': return rec.reps != null ? `${fmtInt(rec.reps)} Wdh.` : '–';
    case 'zeit': return rec.seconds != null ? fmtSec(rec.seconds) : '–';
    case 'distanz_zeit': return rec.km != null ? `${fmtKg(rec.km)} km` : '–';
    default: return '–';
  }
}

/** Bester Satz eines Session-Eintrags */
function bestSetOf(sets, ex, date) {
  let best = null, score = -Infinity;
  for (const s of sets) {
    let v;
    if (isWeighted(ex)) v = setE1rm(s, ex, date) ?? ((s.kg || 0) * 1000 + (s.reps || 0) / 1000);
    else if (ex.tracking === 'wdh') v = s.reps || 0;
    else if (ex.tracking === 'zeit') v = s.seconds || 0;
    else v = s.km || 0;
    if (v > score) { score = v; best = s; }
  }
  return best;
}

export function render(root, { id }) {
  root.classList.add('has-topbar');
  const m = MUSCLE[id];
  if (!m) {
    root.innerHTML = `${topbar({ title: 'Muskel', back: '#/muskeln' })}<div class="empty"><strong>Muskel nicht gefunden</strong></div>`;
    return;
  }
  let bars = null, line = null, showInfo = false, showMore = false;
  const T = muscleTarget(id);

  const draw = () => {
    if (bars) { bars.destroy(); bars = null; }
    if (line) { line.destroy(); line = null; }
    const now = new Date();
    const week = weekSets(now, STRENGTH)[id] || 0;
    const plyoWeek = Math.max(0, (weekSets(now, { plyo: true })[id] || 0) - week);
    const rec = recovery(now)[id];

    // Uebungen fuer diesen Muskel
    const rows = db.state.exercises
      .filter((ex) => ex.primary.includes(id) || ex.secondary.includes(id))
      .map((ex) => {
        const series = exerciseSeries(ex.id);
        return { ex, role: ex.primary.includes(id) ? 'Haupt' : 'Neben', series, rec: series.length ? exerciseRecords(ex.id) : null, trend: series.length && isWeighted(ex) ? e1rmTrend(ex.id, now) : null };
      })
      .filter((r) => !r.ex.archived || r.series.length)
      .sort((a, b) => (b.series.length > 0) - (a.series.length > 0) || (a.role === 'Haupt' ? -1 : 0) - (b.role === 'Haupt' ? -1 : 0)
        || b.series.length - a.series.length || a.ex.name.localeCompare(b.ex.name, 'de'));
    const trained = rows.filter((r) => r.series.length);
    const untrained = rows.filter((r) => !r.series.length);

    // e1RM-Graph: wichtigste Hauptuebung (meiste Einheiten in 12 Wochen), Auswahl merkbar
    const since = addDays(startOfWeek(now), -7 * 11).getTime();
    const candidates = trained.filter((r) => isWeighted(r.ex) && r.series.some((x) => x.e1rm != null));
    const recentCount = (r) => r.series.filter((x) => x.date.getTime() >= since).length;
    const auto = [...candidates].sort((a, b) => (a.role === 'Haupt' ? -1 : 0) - (b.role === 'Haupt' ? -1 : 0) || recentCount(b) - recentCount(a) || b.series.length - a.series.length)[0];
    let pick = candidates.find((r) => r.ex.id === chosen.get(id)) || auto;

    // Letzte Einheiten (neueste zuerst)
    const recent = [];
    const done = db.doneSessions();
    for (let i = done.length - 1; i >= 0 && recent.length < 10; i--) {
      const s = done[i];
      for (const it of s.items) {
        const ex = db.exercise(it.exerciseId);
        if (!ex || !(ex.primary.includes(id) || ex.secondary.includes(id))) continue;
        const sets = doneWorkSets(it);
        if (!sets.length) continue;
        recent.push({ s, ex, n: sets.length, best: bestSetOf(sets, ex, s.startedAt) });
        if (recent.length >= 10) break;
      }
    }

    const statusCls = rec.status === 'none' ? 'fresh' : rec.status;
    const recSub = rec.status === 'tired' || rec.status === 'almost'
      ? `erholt in ca. ${fmtHours(rec.recoveredInH)}`
      : rec.recent ? 'bereit für das nächste Training' : 'keine Belastung in 7 Tagen';
    const views = m.views;

    const tableRow = (r) => `<button class="mt-row" type="button" data-ex="${esc(r.ex.id)}">
        <span class="mt-name"><span>${esc(r.ex.name)}</span><small>${r.role}${r.series.length ? ` · ${r.series.length} ${r.series.length === 1 ? 'Einheit' : 'Einheiten'}` : ''}</small></span>
        <span class="mt-num">${esc(bestValue(r.ex, r.rec))}</span>
        <span class="mt-num">${r.rec && r.rec.e1rm != null ? esc(fmtNum(r.rec.e1rm, 1)) : '–'}</span>
        <span class="mt-num">${r.trend != null ? `<span class="trend ${r.trend >= 0 ? 'up' : 'down'}">${icon(r.trend >= 0 ? 'arrowUp' : 'arrowDown')}${esc(fmtPct(r.trend).replace(/^[+−]/, '').replace(' ', ' '))}</span>` : '–'}</span>
      </button>`;

    root.innerHTML = `
      ${topbar({ title: '', back: '#/muskeln' })}
      <header class="detail-head md-head">
        <div class="grow">
          <h1 class="title-lg">${esc(m.name)}</h1>
          <p class="subtitle">${m.recoveryH} h Basis-Erholung · ${views.length === 2 ? 'vorne + hinten' : views[0] === 'front' ? 'vorne' : 'hinten'}</p>
        </div>
        <div class="md-fig">${bodyMapHTML({ classes: { [id]: 'pri' }, cls: 'mini', views: [views[0]], labels: false })}</div>
      </header>

      <div class="grid-2">
        <div class="card stat-tile">
          <div class="card-sub">Diese Woche</div>
          <div class="big-md">${esc(fmtNum(week, 1))}<span class="unit">${week === 1 ? 'Satz' : 'Sätze'}</span></div>
          <div class="tile-sub">KW ${isoWeek(now).week} · Ziel ${T.from}–${T.to}${plyoWeek > 0 ? `<br>zzgl. ${esc(fmtNum(plyoWeek, 1))} explosiv` : ''}</div>
        </div>
        <div class="card stat-tile">
          <div class="card-sub md-rec-label">Erholung <button class="icon-btn plain sm md-info" type="button" data-info aria-label="Wie wird das berechnet?">${icon('info')}</button></div>
          <div class="md-status ${statusCls}"><i></i>${esc(RECOVERY_LABEL[rec.status])}</div>
          <div class="tile-sub">${esc(recSub)}</div>
        </div>
      </div>
      ${showInfo ? `<div class="info-note mt-12">${icon('info')}<span>Richtwert auf Basis von Trainingsvolumen und typischer Erholungszeit der Muskelgruppe – dein Körpergefühl geht vor.</span></div>` : ''}

      <h2 class="section-title">Sätze pro Woche</h2>
      <section class="card">
        <div class="card-sub">Effektive Sätze der letzten 12 Wochen</div>
        <div id="md-bars" class="mt-12"></div>
        <p class="chart-foot">Nur Kraftübungen · Hauptmuskel zählt 1 Satz, Nebenmuskel 0,5 · grauer Bereich: Ziel ${T.from}–${T.to} Sätze</p>
      </section>

      <h2 class="section-title">Übungen <span class="count">${trained.length || ''}</span></h2>
      ${rows.length ? `
        <div class="card mtable">
          <div class="mt-head"><span>Übung</span><span>Bestes</span><span>e1RM</span><span>4 Wo.</span></div>
          ${trained.map(tableRow).join('')}
          ${trained.length ? '' : '<div class="mt-empty">Noch keine dieser Übungen trainiert.</div>'}
          ${untrained.length ? (showMore
            ? untrained.map(tableRow).join('')
            : `<button class="mt-more" type="button" data-more>${icon('chevronDown')}${untrained.length} weitere ${untrained.length === 1 ? 'Übung' : 'Übungen'} ohne Training</button>`) : ''}
        </div>
        <p class="chart-foot">Gewichte in kg · e1RM = geschätztes Maximalgewicht · 4 Wo. = e1RM-Trend der letzten 4 Wochen</p>` : '<div class="card empty small">Keine Übung trainiert diesen Muskel.</div>'}

      ${candidates.length ? `
        <h2 class="section-title">Kraftverlauf</h2>
        <section class="card">
          ${candidates.length > 1 ? `<div class="chips-scroll md-pick">${candidates.map((r) => `<button class="chip ${r === pick ? 'on' : ''}" type="button" data-pick="${esc(r.ex.id)}">${esc(r.ex.name)}</button>`).join('')}</div>` : ''}
          <div class="card-sub ${candidates.length > 1 ? 'mt-8' : ''}">e1RM · ${esc(pick.ex.name)}</div>
          <div id="md-line" class="mt-12"></div>
        </section>` : ''}

      <h2 class="section-title">Letzte Einheiten</h2>
      ${recent.length ? `<div class="card mtable last-table">
          <div class="mt-head"><span>Datum</span><span>Übung</span><span>Sätze</span><span>Bester Satz</span></div>
          ${recent.map((r) => `<button class="mt-row" type="button" data-session="${esc(r.s.id)}">
            <span class="mt-num left">${esc(fmtDM(new Date(r.s.startedAt)))}</span>
            <span class="mt-name"><span>${esc(r.ex.name)}</span></span>
            <span class="mt-num">${r.n}</span>
            <span class="mt-num">${esc(r.best ? setLabel(r.best, r.ex) : '–')}</span>
          </button>`).join('')}
        </div>` : '<div class="card empty small">Noch keine Einheiten für diesen Muskel.</div>'}`;

    // Balken: effektive Saetze pro Woche
    const ws = weeklySeries(id, 12, now, STRENGTH);
    bars = barChart(root.querySelector('#md-bars'), {
      bars: ws.map((w, i) => ({
        label: String(isoWeek(w.week).week),
        tip: `KW ${isoWeek(w.week).week} · ${fmtDayMonthShort(w.week)} – ${fmtDayMonthShort(addDays(w.week, 6))}`,
        value: w.sets,
        hl: i === ws.length - 1,
      })),
      band: [T.from, T.to],
      height: 180,
      yFormat: (v) => fmtNum(v, 0),
      valueFormat: (v) => fmtNum(v, 1),
      unit: 'Sätze',
      label: `Effektive Sätze pro Woche für ${m.name}`,
    });

    // Linie: e1RM der gewaehlten Uebung
    const lh = root.querySelector('#md-line');
    if (lh && pick) {
      line = lineChart(lh, {
        series: [{
          label: pick.ex.name,
          points: pick.series.filter((x) => x.e1rm != null).map((x) => ({ x: x.date, y: Math.round(x.e1rm * 10) / 10, note: `Bester Satz ${setLabel(x.bestSet, pick.ex)}` })),
        }],
        height: 170,
        unit: 'kg',
        yFormat: (v, dec) => fmtNum(v, dec ?? 1, dec ?? 0),
        valueFormat: (v) => fmtNum(v, 1),
        tipDate: dateLabel,
        label: `e1RM-Verlauf ${pick.ex.name}`,
      });
    }
  };

  draw();
  const offs = [
    on(root, 'click', '[data-info]', () => { showInfo = !showInfo; draw(); }),
    on(root, 'click', '[data-more]', () => { showMore = true; draw(); }),
    on(root, 'click', '[data-pick]', (e, b) => { chosen.set(id, b.dataset.pick); draw(); }),
    on(root, 'click', '[data-ex]', (e, b) => navigate('#/uebung/' + b.dataset.ex)),
    on(root, 'click', '[data-session]', (e, b) => navigate('#/verlauf/' + b.dataset.session)),
    db.subscribe(draw),
  ];
  return () => { offs.forEach((f) => f()); if (bars) bars.destroy(); if (line) line.destroy(); };
}
