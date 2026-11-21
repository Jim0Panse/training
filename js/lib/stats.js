// Volumen, Rekorde, e1RM, „Letztes Mal“, Steigerungshinweis – immer live aus den Sessions.

import * as db from '../db.js';
import { doneWorkSets } from './muscle-load.js';
import { dateKey, startOfDay, addDays, fmtKg } from './format.js';

export { doneWorkSets };

const round2 = (v) => Math.round(v * 100) / 100;

/** Geschaetztes Maximalgewicht (Epley), nur fuer 1–12 Wiederholungen */
export function e1rm(kg, reps) {
  if (!(kg > 0) || !(reps >= 1) || reps > 12) return null;
  return kg * (1 + reps / 30);
}

/** Koerpergewicht am Datum: letzter Eintrag am oder vor dem Datum */
export function bodyweightAt(date) {
  const k = dateKey(new Date(date));
  let v = null;
  for (const b of db.state.bodyweight) { if (b.date <= k) v = b.kg; else break; }
  return v;
}

export const isWeighted = (ex) => ex && (ex.tracking === 'gewicht_wdh' || ex.tracking === 'zusatzgewicht_wdh');

/** Last eines Satzes in kg: gewicht_wdh -> kg, zusatzgewicht_wdh -> Koerpergewicht + Zusatz */
export function setLoad(set, ex, date) {
  if (ex.tracking === 'gewicht_wdh') return set.kg || 0;
  if (ex.tracking === 'zusatzgewicht_wdh') return (bodyweightAt(date) || 0) + (set.kg || 0);
  return 0;
}
export function setVolume(set, ex, date) {
  if (!isWeighted(ex)) return 0;
  return setLoad(set, ex, date) * (set.reps || 0);
}
export function setE1rm(set, ex, date) {
  if (!isWeighted(ex)) return null;
  return e1rm(setLoad(set, ex, date), set.reps);
}

export function sessionVolume(session) {
  let v = 0;
  for (const item of session.items) {
    const ex = db.exercise(item.exerciseId);
    if (!ex) continue;
    for (const s of doneWorkSets(item)) v += setVolume(s, ex, session.startedAt);
  }
  return v;
}
export const sessionWorkSets = (session) => session.items.reduce((n, it) => n + doneWorkSets(it).length, 0);
export function sessionDuration(s) {
  return Math.max(0, (s.endedAt ? new Date(s.endedAt) : new Date()) - new Date(s.startedAt));
}

/** Alle Einheiten einer Uebung (aelteste zuerst): [{ session, sets }] – nur abgeschlossene Workouts */
export function exerciseHistory(exId, { excludeSessionId = null, before = null } = {}) {
  const out = [];
  for (const s of db.state.sessions) {
    if (s.status !== 'done' || s.id === excludeSessionId) continue;
    if (before && s.startedAt >= before) continue;
    const sets = s.items.filter((it) => it.exerciseId === exId).flatMap(doneWorkSets);
    if (sets.length) out.push({ session: s, sets });
  }
  return out;
}

/** Wie oft wurde die Uebung trainiert? (inkl. laufendem Workout) */
export function exerciseUseCount(exId) {
  return db.state.sessions.filter((s) => s.items.some((it) => it.exerciseId === exId)).length;
}

/** Letzte Einheit mit dieser Uebung, egal welches Workout */
export function lastPerformance(exId, excludeSessionId = null) {
  for (let i = db.state.sessions.length - 1; i >= 0; i--) {
    const s = db.state.sessions[i];
    if (s.status !== 'done' || s.id === excludeSessionId) continue;
    const items = s.items.filter((it) => it.exerciseId === exId);
    const all = items.flatMap((it) => it.sets.filter((x) => x.done));
    if (!all.length) continue;
    return {
      session: s,
      work: all.filter((x) => x.type !== 'warmup'),
      warmup: all.filter((x) => x.type === 'warmup'),
    };
  }
  return null;
}

/** Kurzform eines Satzes: „80 × 8“, „12 Wdh.“, „+10 × 8“, „1:30 min“, „5 km · 25:00“ */
export function setLabel(set, ex) {
  switch (ex.tracking) {
    case 'gewicht_wdh': return `${set.kg != null ? fmtKg(set.kg) : '–'} × ${set.reps ?? '–'}`;
    case 'zusatzgewicht_wdh': return set.kg ? `+${fmtKg(set.kg)} × ${set.reps ?? '–'}` : `${set.reps ?? '–'} Wdh.`;
    case 'wdh': return `${set.reps ?? '–'} Wdh.`;
    case 'zeit': return fmtSec(set.seconds);
    case 'distanz_zeit': return `${set.km != null ? fmtKg(set.km) + ' km' : '–'}${set.seconds ? ' · ' + fmtSec(set.seconds) : ''}`;
    default: return '';
  }
}
export function fmtSec(sec) {
  if (sec == null) return '–';
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return m ? `${m}:${String(s).padStart(2, '0')} min` : `${s} s`;
}

// ---------- Rekorde ----------
export const RECORD_LABEL = {
  weight: 'Höchstes Gewicht',
  e1rm: 'Bestes e1RM',
  reps: 'Meiste Wdh.',
  volume: 'Höchstes Satz-Volumen',
  seconds: 'Längste Zeit',
  km: 'Längste Distanz',
};

function emptyBest() {
  return { weight: null, e1rm: null, reps: null, volume: null, seconds: null, km: null, pairs: [], sets: {} };
}

/** Bestwerte aus einer Historie [{session, sets}] */
export function bestFromHistory(hist, ex) {
  const best = emptyBest();
  for (const h of hist) for (const s of h.sets) addToBest(best, s, ex, h.session.startedAt, h.session);
  return best;
}

function addToBest(best, s, ex, date, session) {
  const upd = (key, v) => {
    if (v == null || !Number.isFinite(v)) return;
    if (best[key] == null || v > best[key]) { best[key] = v; best.sets[key] = { set: s, date, session, value: v }; }
  };
  if (ex.tracking === 'gewicht_wdh' || ex.tracking === 'zusatzgewicht_wdh') {
    if (ex.tracking === 'gewicht_wdh' ? s.kg > 0 : s.kg != null) upd('weight', s.kg);
    upd('e1rm', setE1rm(s, ex, date));
    upd('volume', setVolume(s, ex, date) || null);
    upd('reps', s.reps);
    best.pairs.push({ kg: s.kg || 0, reps: s.reps || 0 });
  } else if (ex.tracking === 'wdh') upd('reps', s.reps);
  else if (ex.tracking === 'zeit') upd('seconds', s.seconds);
  else if (ex.tracking === 'distanz_zeit') { upd('km', s.km); upd('seconds', s.seconds); }
}

/** Welche Rekorde bricht dieser Satz gegenueber „best“? -> [{type, value, prev}] */
function recordsOf(s, ex, date, best) {
  const out = [];
  const beat = (type, v) => {
    if (v == null || !Number.isFinite(v) || best[type] == null) return;
    if (v > best[type] + 1e-9) out.push({ type, value: v, prev: best[type] });
  };
  if (ex.tracking === 'gewicht_wdh' || ex.tracking === 'zusatzgewicht_wdh') {
    if (s.kg > 0) beat('weight', s.kg);
    beat('e1rm', setE1rm(s, ex, date));
    beat('volume', setVolume(s, ex, date));
    // Meiste Wdh. bei gleichem oder hoeherem Gewicht
    const kg = s.kg || 0, reps = s.reps || 0;
    const heavier = best.pairs.filter((p) => p.kg >= kg);
    if (heavier.length && reps > 0) {
      const prev = Math.max(...heavier.map((p) => p.reps));
      if (reps > prev) out.push({ type: 'reps', value: reps, prev, kg });
    }
  } else if (ex.tracking === 'wdh') beat('reps', s.reps);
  else if (ex.tracking === 'zeit') beat('seconds', s.seconds);
  else if (ex.tracking === 'distanz_zeit') beat('km', s.km);
  return out;
}

/**
 * Rekorde einer Session (in Abhak-Reihenfolge). Ein Rekord zaehlt nur, wenn es vorher schon
 * mindestens eine Session mit dieser Uebung gab.
 * -> { bySet: Map(set -> [{type,value,prev}]), list: [{exerciseId, type, value, prev, kg}] }
 */
export function sessionRecords(session) {
  const bySet = new Map();
  const summary = new Map(); // `${exId}|${type}` -> eintrag
  const exIds = [...new Set(session.items.map((it) => it.exerciseId))];
  for (const exId of exIds) {
    const ex = db.exercise(exId);
    if (!ex) continue;
    const hist = exerciseHistory(exId, { excludeSessionId: session.id, before: session.startedAt });
    if (!hist.length) continue;
    const best = bestFromHistory(hist, ex);
    const initial = { ...best };
    const sets = session.items.filter((it) => it.exerciseId === exId).flatMap(doneWorkSets)
      .map((s, i) => ({ s, i }))
      .sort((a, b) => (a.s.doneAt || '').localeCompare(b.s.doneAt || '') || a.i - b.i)
      .map((x) => x.s);
    for (const s of sets) {
      const recs = recordsOf(s, ex, session.startedAt, best);
      if (recs.length) {
        bySet.set(s, recs);
        for (const r of recs) {
          const key = `${exId}|${r.type}`;
          const prevInitial = r.type === 'reps' && r.kg != null ? r.prev : initial[r.type];
          const cur = summary.get(key);
          if (!cur || r.value > cur.value) summary.set(key, { exerciseId: exId, type: r.type, value: r.value, prev: cur ? cur.prev : prevInitial, kg: r.kg });
        }
      }
      addToBest(best, s, ex, session.startedAt, session);
    }
  }
  return { bySet, list: [...summary.values()] };
}

/** Rekorde einer Uebung ueber alle Zeit (fuer Detailseiten) */
export function exerciseRecords(exId) {
  const ex = db.exercise(exId);
  if (!ex) return null;
  return bestFromHistory(exerciseHistory(exId), ex);
}

// ---------- Steigerungshinweis ----------
/**
 * Wenn in der letzten Session dieser Uebung ALLE Arbeitssaetze mit demselben Gewicht
 * mindestens repsMax erreicht haben -> Gewicht + Steigerungsschritt vorschlagen.
 */
export function progressionHint(exId, repsMax, excludeSessionId = null) {
  const ex = db.exercise(exId);
  if (!ex || !repsMax || !isWeighted(ex)) return null;
  const last = lastPerformance(exId, excludeSessionId);
  if (!last || !last.work.length) return null;
  const kgs = last.work.map((s) => s.kg ?? 0);
  if (!kgs.every((k) => k === kgs[0])) return null;
  if (ex.tracking === 'gewicht_wdh' && !(kgs[0] > 0)) return null;
  if (!last.work.every((s) => (s.reps ?? 0) >= repsMax)) return null;
  return { kg: round2(kgs[0] + (ex.incrementKg || 2.5)), from: kgs[0] };
}

// ---------- Verlaeufe ----------
/** Pro Session: bestes e1RM, hoechstes Gewicht, bester Satz – fuer Graphen und Tabellen */
export function exerciseSeries(exId) {
  const ex = db.exercise(exId);
  if (!ex) return [];
  return exerciseHistory(exId).map(({ session, sets }) => {
    let bestE = null, maxKg = null, bestSet = null, vol = 0, maxReps = null, maxSec = null;
    for (const s of sets) {
      const e = setE1rm(s, ex, session.startedAt);
      if (e != null && (bestE == null || e > bestE)) { bestE = e; bestSet = s; }
      if (s.kg != null && (maxKg == null || s.kg > maxKg)) maxKg = s.kg;
      if (s.reps != null && (maxReps == null || s.reps > maxReps)) maxReps = s.reps;
      if (s.seconds != null && (maxSec == null || s.seconds > maxSec)) maxSec = s.seconds;
      vol += setVolume(s, ex, session.startedAt);
    }
    if (!bestSet) bestSet = sets.reduce((a, b) => ((b.reps || 0) > (a.reps || 0) ? b : a), sets[0]);
    return { date: new Date(session.startedAt), session, sets, e1rm: bestE, maxKg, maxReps, maxSec, volume: vol, bestSet };
  });
}

/** Trend des besten e1RM: letzte 4 Wochen gegen die 4 Wochen davor -> Anteil (0.05 = +5 %) */
export function e1rmTrend(exId, now = new Date()) {
  const series = exerciseSeries(exId);
  const t0 = startOfDay(addDays(now, -27)).getTime();
  const t1 = startOfDay(addDays(now, -55)).getTime();
  const max = (arr) => arr.reduce((m, x) => (x.e1rm != null && (m == null || x.e1rm > m) ? x.e1rm : m), null);
  const recent = max(series.filter((x) => x.date.getTime() >= t0));
  const before = max(series.filter((x) => x.date.getTime() >= t1 && x.date.getTime() < t0));
  if (recent == null || before == null || before === 0) return null;
  return recent / before - 1;
}
