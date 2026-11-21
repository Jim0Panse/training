// Uebungs-Detail: Muskeln (Mini-Figur), Notiz, Rekorde, Verlauf (e1RM / Hoechstgewicht), alle Einheiten.

import * as db from '../db.js';
import { topbar } from '../components/header.js';
import { bodyMapHTML } from '../components/body-map.js';
import { lineChart } from '../components/chart.js';
import { confirmSheet } from '../components/sheet.js';
import { muscleName } from '../data/muscles.js';
import { CATEGORIES, EQUIPMENT, TRACKING } from '../data/exercises.js';
import { exerciseSeries, exerciseRecords, exerciseUseCount, e1rmTrend, setLabel, fmtSec, isWeighted } from '../lib/stats.js';
import { normalizeGroups } from '../lib/workout.js';
import { fmtKg, fmtNum, fmtInt, fmtDateShort, fmtDayMonthShort, fmtPct, fmtRelDay } from '../lib/format.js';
import { on, esc, toast } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { goBack } from '../router.js';

let chartMode = 'e1rm';

const dateLabel = (d) => (d.getFullYear() === new Date().getFullYear() ? fmtDateShort(d) : `${fmtDateShort(d)} ${d.getFullYear()}`);

function tile(label, value, unit, sub) {
  return `<div class="card stat-tile"><div class="card-sub">${esc(label)}</div>
    <div class="big-md">${value}${unit ? `<span class="unit">${unit}</span>` : ''}</div>
    <div class="tile-sub">${sub || '&nbsp;'}</div></div>`;
}

function recordTiles(ex, rec, series) {
  const s = rec.sets;
  const when = (key) => (s[key] ? fmtDayMonthShort(new Date(s[key].date)) : '');
  const sl = (key) => (s[key] ? setLabel(s[key].set, ex) : '');
  const last = series.length ? series[series.length - 1].date : null;
  const extra = [
    tile('Einheiten', fmtInt(series.length), '', last ? `zuletzt ${fmtRelDay(last)}` : ''),
  ];
  switch (ex.tracking) {
    case 'gewicht_wdh':
    case 'zusatzgewicht_wdh': {
      const add = ex.tracking === 'zusatzgewicht_wdh';
      return [
        tile(add ? 'Höchstes Zusatzgewicht' : 'Höchstes Gewicht', rec.weight != null ? (add ? '+' : '') + fmtKg(rec.weight) : '–', 'kg', rec.weight != null ? `${sl('weight')} · ${when('weight')}` : ''),
        tile('Bestes e1RM', rec.e1rm != null ? fmtNum(rec.e1rm, 1) : '–', 'kg', rec.e1rm != null ? `aus ${sl('e1rm')}` : ''),
        tile('Meiste Wdh.', rec.reps != null ? fmtInt(rec.reps) : '–', '', rec.reps != null ? `${sl('reps')} · ${when('reps')}` : ''),
        tile('Bestes Satz-Volumen', rec.volume != null ? fmtInt(rec.volume) : '–', 'kg', rec.volume != null ? sl('volume') : ''),
      ].join('');
    }
    case 'wdh':
      return [tile('Meiste Wdh.', rec.reps != null ? fmtInt(rec.reps) : '–', '', when('reps')), ...extra].join('');
    case 'zeit':
      return [tile('Längste Zeit', rec.seconds != null ? esc(fmtSec(rec.seconds)) : '–', '', when('seconds')), ...extra].join('');
    case 'distanz_zeit':
      return [
        tile('Längste Distanz', rec.km != null ? fmtKg(rec.km) : '–', 'km', when('km')),
        tile('Längste Zeit', rec.seconds != null ? esc(fmtSec(rec.seconds)) : '–', '', when('seconds')),
      ].join('');
    default: return extra.join('');
  }
}

/** Werte fuer den Graphen je nach Erfassungsart */
function chartSpec(ex, series) {
  if (isWeighted(ex)) {
    const hasE = series.some((x) => x.e1rm != null);
    const mode = chartMode === 'kg' || !hasE ? 'kg' : 'e1rm';
    const pts = series.filter((x) => (mode === 'e1rm' ? x.e1rm != null : x.maxKg != null)).map((x) => ({
      x: x.date,
      y: mode === 'e1rm' ? Math.round(x.e1rm * 10) / 10 : x.maxKg,
      note: mode === 'e1rm' ? `Bester Satz ${setLabel(x.bestSet, ex)}` : x.session.name,
    }));
    return { mode, hasE, pts, unit: 'kg', fmt: (v) => fmtNum(v, 1), label: mode === 'e1rm' ? 'Geschätztes Maximalgewicht (e1RM)' : (ex.tracking === 'zusatzgewicht_wdh' ? 'Höchstes Zusatzgewicht' : 'Höchstgewicht') };
  }
  if (ex.tracking === 'wdh') return { pts: series.filter((x) => x.maxReps != null).map((x) => ({ x: x.date, y: x.maxReps })), unit: 'Wdh.', fmt: (v) => fmtInt(v), label: 'Meiste Wiederholungen' };
  if (ex.tracking === 'zeit') return { pts: series.filter((x) => x.maxSec != null).map((x) => ({ x: x.date, y: x.maxSec })), unit: '', fmt: (v) => fmtSec(v), label: 'Längste Zeit' };
  return {
    pts: series.map((x) => ({ x: x.date, y: Math.max(0, ...x.sets.map((st) => st.km || 0)) })).filter((p) => p.y > 0),
    unit: 'km', fmt: (v) => fmtNum(v, 2), label: 'Längste Distanz',
  };
}

export function render(root, { id }) {
  root.classList.add('has-topbar');
  let chart = null;

  const draw = () => {
    if (chart) { chart.destroy(); chart = null; }
    const ex = db.exercise(id);
    if (!ex) {
      root.innerHTML = `${topbar({ title: 'Übung', back: '#/uebungen' })}<div class="empty"><strong>Übung nicht gefunden</strong>Vielleicht wurde sie gelöscht.</div>`;
      return;
    }
    const series = exerciseSeries(id);
    const rec = exerciseRecords(id);
    const spec = chartSpec(ex, series);
    const lastPt = spec.pts[spec.pts.length - 1];
    const trend = spec.mode === 'e1rm' ? e1rmTrend(id) : null;
    const classes = Object.fromEntries([...ex.primary.map((m) => [m, 'pri']), ...ex.secondary.filter((m) => !ex.primary.includes(m)).map((m) => [m, 'sec'])]);
    const used = exerciseUseCount(id) > 0;
    const names = (arr) => arr.map((m) => esc(muscleName(m))).join(', ');

    root.innerHTML = `
      ${topbar({ title: '', back: '#/uebungen', right: `<a class="icon-btn" href="#/uebung/${esc(id)}/bearbeiten" aria-label="Bearbeiten">${icon('pencil')}</a>` })}
      <header class="detail-head">
        <h1 class="title-lg">${esc(ex.name)}</h1>
        <div class="chips mt-8">
          <span class="chip-sm">${esc(CATEGORIES[ex.category] || '')}</span>
          <span class="chip-sm">${esc(EQUIPMENT[ex.equipment] || '')}</span>
          <span class="chip-sm">${esc(TRACKING[ex.tracking] || '')}</span>
          ${ex.archived ? '<span class="chip-sm chip-warn">Archiviert</span>' : ''}
        </div>
      </header>

      <section class="card ex-muscles">
        <div class="ex-fig">${bodyMapHTML({ classes, cls: 'small', labels: false })}</div>
        <div class="ex-muscle-text">
          <div class="field-label">Hauptmuskeln</div><div class="mt-2">${names(ex.primary) || '–'}</div>
          <div class="field-label mt-12">Nebenmuskeln</div><div class="mt-2">${names(ex.secondary.filter((m) => !ex.primary.includes(m))) || '–'}</div>
        </div>
      </section>
      ${ex.note ? `<div class="info-note mt-12">${icon('note')}<span>${esc(ex.note)}</span></div>` : ''}

      ${series.length ? `
        <h2 class="section-title">Rekorde</h2>
        <div class="grid-2">${recordTiles(ex, rec, series)}</div>

        <h2 class="section-title">Verlauf</h2>
        <section class="card">
          ${spec.mode ? `<div class="seg sm" role="tablist" aria-label="Graph">
              <button data-mode="e1rm" class="${spec.mode === 'e1rm' ? 'on' : ''}" ${spec.hasE ? '' : 'disabled'}>e1RM</button>
              <button data-mode="kg" class="${spec.mode === 'kg' ? 'on' : ''}">${ex.tracking === 'zusatzgewicht_wdh' ? 'Zusatzgewicht' : 'Höchstgewicht'}</button>
            </div>` : ''}
          <div class="chart-head ${spec.mode ? 'mt-12' : ''}">
            <div class="card-sub">${esc(spec.label)}</div>
            <div class="big-md mt-4">${lastPt ? esc(spec.fmt(lastPt.y)) : '–'}${spec.unit ? `<span class="unit">${esc(spec.unit)}</span>` : ''}</div>
            <div class="chart-meta">${lastPt ? `Letzte Einheit · ${esc(dateLabel(lastPt.x))}` : ''}
              ${trend != null ? `<span class="trend ${trend >= 0 ? 'up' : 'down'}">${icon(trend >= 0 ? 'arrowUp' : 'arrowDown')}${esc(fmtPct(trend))} in 4 Wochen</span>` : ''}</div>
          </div>
          <div class="chart-host mt-12" id="ex-chart"></div>
          ${spec.mode === 'e1rm' ? '<p class="chart-foot">e1RM = geschätztes Maximalgewicht für 1 Wiederholung (Epley), aus Sätzen mit 1–12 Wdh.</p>' : ''}
        </section>

        <h2 class="section-title">Alle Einheiten <span class="count">${series.length}</span></h2>
        <div class="list">${[...series].reverse().map((x) => {
          const right = isWeighted(ex)
            ? (x.e1rm != null ? `<span class="row-value"><strong>${esc(fmtNum(x.e1rm, 1))}</strong><small>e1RM</small></span>` : '')
            : `<span class="row-value"><strong>${esc(setLabel(x.bestSet, ex))}</strong><small>Bester Satz</small></span>`;
          return `<a class="row" href="#/verlauf/${esc(x.session.id)}">
            <span class="grow"><span class="row-title">${esc(dateLabel(x.date))} <span class="row-tag">${esc(x.session.name)}</span></span>
              <span class="row-sub sets-line">${x.sets.map((st) => esc(setLabel(st, ex))).join(' · ')}</span></span>
            ${right}${icon('chevronRight', 'chev')}</a>`;
        }).join('')}</div>
      ` : `<div class="card empty mt-12"><strong>Noch nicht trainiert</strong>Sobald du Sätze dieser Übung im Workout abhakst, erscheinen hier Rekorde und Verlauf.</div>`}

      <div class="stack mt-24">
        <a class="btn btn-secondary" href="#/uebung/${esc(id)}/bearbeiten">${icon('pencil')}Bearbeiten</a>
        ${ex.archived
          ? `<button class="btn btn-text" data-restore>${icon('repeat')}Wiederherstellen</button>`
          : `<button class="btn btn-text danger" data-remove>${icon(used ? 'layers' : 'trash')}${used ? 'Archivieren' : 'Löschen'}</button>`}
      </div>`;

    const host = root.querySelector('#ex-chart');
    if (host) {
      chart = lineChart(host, {
        series: [{ label: spec.label, points: spec.pts }],
        unit: spec.unit, yFormat: (v, dec) => (spec.unit === 'kg' && dec != null ? fmtNum(v, dec, dec) : spec.fmt(v)), valueFormat: spec.fmt, height: 180,
        label: `${spec.label} über die Zeit`,
      });
    }
  };

  async function removeFromTemplates(exId) {
    const tpls = db.state.templates.filter((t) => t.items.some((it) => it.exerciseId === exId));
    for (const t of tpls) {
      await db.putTemplate({ ...t, items: normalizeGroups(t.items.filter((it) => it.exerciseId !== exId).map((it) => ({ ...it }))) });
    }
  }

  draw();
  const offs = [
    on(root, 'click', '[data-mode]', (e, b) => { if (b.disabled) return; chartMode = b.dataset.mode; draw(); }),
    on(root, 'click', '[data-restore]', async () => {
      const ex = db.exercise(id);
      await db.putExercise({ ...ex, archived: false });
      toast('Wiederhergestellt');
    }),
    on(root, 'click', '[data-remove]', async () => {
      const ex = db.exercise(id);
      const used = exerciseUseCount(id) > 0;
      const tpls = db.state.templates.filter((t) => t.items.some((it) => it.exerciseId === id));
      const tplNote = tpls.length ? ` Sie wird auch aus ${tpls.length === 1 ? 'dem Workout' : 'den Workouts'} „${tpls.map((t) => t.name).join('“, „')}“ entfernt.` : '';
      if (used) {
        const ok = await confirmSheet({ title: 'Übung archivieren?', message: `Sie verschwindet aus der Auswahl, dein Verlauf bleibt vollständig erhalten.${tplNote}`, confirm: 'Archivieren', danger: true });
        if (!ok) return;
        await removeFromTemplates(id);
        await db.putExercise({ ...ex, archived: true });
        toast('Archiviert');
      } else {
        const ok = await confirmSheet({ title: 'Übung löschen?', message: `Sie wurde noch nie trainiert und wird endgültig gelöscht.${tplNote}`, confirm: 'Löschen', danger: true });
        if (!ok) return;
        await removeFromTemplates(id);
        await db.deleteExercise(id);
        toast('Gelöscht');
        goBack('#/uebungen');
      }
    }),
    db.subscribe(() => { if (db.exercise(id)) draw(); }),
  ];
  return () => { offs.forEach((f) => f()); if (chart) chart.destroy(); };
}
