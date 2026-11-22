// Muskelbalance: Wie verteilt sich das Training auf die Muskeln – und wo fehlt es?
// Alles live aus den abgeschlossenen Workouts eines rollierenden Zeitraums (4 oder 12 Wochen).
//
// Grundlagen (die Quellen stehen auch im Info-Text der Ansicht):
// - Effektive Saetze: Hauptmuskel 1, Nebenmuskel 0,5. Diese Zaehlweise („fractional sets“) erklaert
//   die Muskelzuwaechse in Studien am besten (Pelland et al. 2024). Gezaehlt werden nur erledigte
//   Arbeitssaetze aus Kraftuebungen: Die Richtwerte stammen aus Studien mit Kraftsaetzen nahe am
//   Muskelversagen, Spruenge und Explosivuebungen sind damit nicht vergleichbar.
// - Richtwerte pro Woche je Muskel (TARGETS in data/muscles.js): Minimum 4 (Iversen et al. 2021),
//   10–20 als guter Bereich (Schoenfeld et al. 2017); stark mitarbeitende Bereiche 2 bzw. 4–12.
// - Verhaeltnisse: Druck/Zug und vordere/hintere Schulter (Freizeit-Kraftsportler vernachlaessigen
//   oft die hintere Schulter, Kolber et al. 2009), Quadrizeps/Beinbeuger, Ober-/Unterkoerper.
// - Rollierender Zeitraum statt Kalenderwoche: Bei Split-Plaenen (z. B. Upper/Lower im Wechsel)
//   zeigt eine einzelne Woche nur einen Teil des Plans und waere verzerrt.
// - Vorschlaege: hoechstens 6 Saetze mehr pro Woche und Muskel als erster Schritt, verteilt auf
//   zwei Workouts – mehr als ~11 effektive Saetze pro Muskel und Training bringen kaum zusaetzlich
//   (Remmert et al. 2025).

import * as db from '../db.js';
import { MUSCLES, MUSCLE, muscleTarget } from '../data/muscles.js';
import { sessionMuscleSets, doneWorkSets } from './muscle-load.js';
import { exerciseSeries, exerciseUseCount, isWeighted } from './stats.js';
import { templateKind } from './workout.js';
import { startOfDay, addDays, dayDiff, dateKey, fromKey, fmtNum } from './format.js';
import { clamp } from './dom.js';

export const STATUS_LABEL = { low: 'Vernachlässigt', mid: 'Ausbaufähig', ok: 'Im Ziel', high: 'Sehr hoch' };
export const STATUS_COUNT_LABEL = { low: 'vernachlässigt', mid: 'ausbaufähig', ok: 'im Ziel', high: 'sehr hoch' };
export const PAIR_LABEL = { ok: 'Ausgeglichen', mild: 'Leicht unausgeglichen', strong: 'Unausgeglichen', none: 'Noch keine Sätze' };
export const STATUS_KEYS = ['low', 'mid', 'ok', 'high'];
const RANK = { low: 0, mid: 1, ok: 2, high: 3 };

export const MIN_DAYS = 14;      // mind. 2 Wochen, damit ein Split-Plan einmal komplett drin ist
export const MIN_SESSIONS = 3;
const MAX_STEP = 6;              // erster Schritt: hoechstens 6 Saetze mehr pro Woche fuer einen Muskel
const PAUSE_DAYS = 10;           // ab so vielen Tagen ohne Training gibt es einen Hinweis
const LOW_VOLUME = 12;           // ab so vielen Muskeln unter dem Ziel: eher insgesamt zu wenig

const r1 = (v) => Math.round(v * 10) / 10;

/** Status eines Wochenwerts gegen den Richtwert { min, from, to } */
export function statusOf(v, t) {
  if (v < t.min) return 'low';
  if (v < t.from) return 'mid';
  if (v <= t.to) return 'ok';
  return 'high';
}

// Druck/Zug im Oberkoerper nach den Hauptmuskeln. Isolierte Arm-Uebungen und Seitheben zaehlen
// nicht – fuer die Balance der Schulter geht es ums Druecken und Ziehen.
const PUSH = new Set(['brust', 'schulter_vorne']);
const PULL = new Set(['latissimus', 'trapez', 'schulter_hinten']);
export function pattern(ex) {
  const push = ex.primary.some((m) => PUSH.has(m));
  const pull = ex.primary.some((m) => PULL.has(m));
  return push && !pull ? 'push' : pull && !push ? 'pull' : null;
}

// Paare a gegen b. ok: bis zu diesem Verhaeltnis ausgeglichen, mild: bis hier „leicht“.
// fix: Verhaeltnis, auf das ein Vorschlag hinarbeitet. oneWay: nur ein Uebergewicht von a zaehlt
// (mehr Zug als Druck ist in Ordnung, ebenso mehr hintere als vordere Schulter).
const PAIRS = [
  { id: 'pushpull', title: 'Drücken und Ziehen', a: 'Druck', b: 'Zug', ok: 1.1, mild: 1.5, fix: 1, oneWay: true,
    hint: 'z. B. Rudern oder Face Pulls – oder entsprechend weniger Drücken' },
  { id: 'shoulder', title: 'Schulter vorne und hinten', a: 'Vordere Schulter', b: 'Hintere Schulter', ma: 'schulter_vorne', mb: 'schulter_hinten', ok: 1.5, mild: 2, fix: 1.5, oneWay: true,
    hint: 'z. B. Face Pulls oder Reverse Butterfly' },
  { id: 'legs', title: 'Oberschenkel vorne und hinten', a: 'Quadrizeps', b: 'Beinbeuger', ma: 'quadrizeps', mb: 'beinbeuger', ok: 1.5, mild: 2, fix: 1.5,
    hintA: 'z. B. Kniebeugen, Beinpresse oder Beinstrecker', hint: 'z. B. Beinbeuger-Curls oder Rumänisches Kreuzheben' },
  { id: 'body', title: 'Ober- und Unterkörper', a: 'Oberkörper', b: 'Unterkörper', ok: 1.5, mild: 2, fix: 1.5 },
];

function evalPair(def, av, bv) {
  const p = { ...def, av: r1(av), bv: r1(bv), level: 'none', weak: null, need: 0 };
  if (!(p.av > 0) && !(p.bv > 0)) return p;
  const overA = p.bv > 0 ? p.av / p.bv : Infinity;
  const overB = p.av > 0 ? p.bv / p.av : Infinity;
  const aHeavy = def.oneWay || overA >= overB;
  const r = aHeavy ? overA : overB;
  p.level = r <= def.ok ? 'ok' : r <= def.mild ? 'mild' : 'strong';
  if (p.level !== 'ok') {
    p.weak = aHeavy ? 'b' : 'a';
    const strong = aHeavy ? p.av : p.bv, weak = aHeavy ? p.bv : p.av;
    p.need = Math.max(1, Math.ceil(strong / def.fix - weak - 1e-9));
  }
  return p;
}

/** Verhaeltnis als Text: „1,3 : 1“ bzw. „1 : 1,8“ */
export function ratioText(p) {
  if (!(p.av > 0) || !(p.bv > 0)) return p.av > 0 ? `nur ${p.a}` : p.bv > 0 ? `nur ${p.b}` : '–';
  return p.av >= p.bv ? `${fmtNum(p.av / p.bv, 1)} : 1` : `1 : ${fmtNum(p.bv / p.av, 1)}`;
}

/** Laengste Strecke ohne Training im Zeitraum, in Tagen (heute zaehlt noch nicht als Luecke) */
function longestGap(dayKeys, from, now) {
  let prev = addDays(from, -1), gap = 0;
  for (const d of [...dayKeys].sort().map(fromKey)) { gap = Math.max(gap, dayDiff(prev, d) - 1); prev = d; }
  return Math.max(gap, dayDiff(prev, now) - 1);
}

/**
 * Kraftverlauf je Muskel: bestes e1RM der letzten 4 Wochen gegenueber 4 Wochen am Anfang des
 * Vergleichszeitraums (4-Wochen-Analyse: die 4 Wochen davor, 12 Wochen: die ersten 4 Wochen).
 * Mittel ueber die Hauptuebungen mit Gewicht, gewichtet mit ihren Saetzen im Zeitraum.
 * -> { muskel: { value: 0.05 (= +5 %), exercises } }
 */
function muscleTrends(exSets, now, weeks) {
  const span = Math.max(8, weeks) * 7;
  const r0 = startOfDay(addDays(now, -27)).getTime();
  const b0 = startOfDay(addDays(now, -(span - 1))).getTime();
  const b1 = startOfDay(addDays(now, -(span - 29))).getTime();
  const acc = {};
  for (const [id, n] of exSets) {
    const ex = db.exercise(id);
    if (!ex || !isWeighted(ex)) continue;
    let recent = 0, base = 0;
    for (const x of exerciseSeries(id)) {
      if (x.e1rm == null) continue;
      const t = x.date.getTime();
      if (t >= r0) recent = Math.max(recent, x.e1rm);
      else if (t >= b0 && t < b1) base = Math.max(base, x.e1rm);
    }
    if (!recent || !base) continue;
    const tr = recent / base - 1;
    for (const m of ex.primary) {
      const a = (acc[m] = acc[m] || { s: 0, w: 0, n: 0 });
      a.s += tr * n; a.w += n; a.n++;
    }
  }
  const out = {};
  for (const m in acc) out[m] = { value: acc[m].s / acc[m].w, exercises: acc[m].n };
  return out;
}

const tierRank = (m) => (m.tier === 'std' ? 0 : 1);
/** Nach Handlungsbedarf: Status, dann grosse vor kleinen Muskeln, dann Anteil am Zielbereich */
export const byNeed = (a, b) => RANK[a.status] - RANK[b.status] || tierRank(a) - tierRank(b)
  || a.perWeek / a.target.from - b.perWeek / b.target.from || a.name.localeCompare(b.name, 'de');

/** Passendste Uebung, um einen Muskel gezielt zu trainieren */
function bestExercise(muscleId, exSets, high) {
  const score = (e) => (exSets.has(e.id) ? 4 : exerciseUseCount(e.id) ? 2 : 0)   // bekannt vor neu
    + (e.primary.length === 1 ? 2 : 0)                                                 // gezielt vor Grunduebung
    - 2 * [...e.primary, ...e.secondary].filter((x) => x !== muscleId && high.has(x)).length;
  return db.state.exercises
    .filter((e) => !e.archived && e.category === 'kraft' && e.primary.includes(muscleId))
    .map((e) => ({ e, s: score(e) }))
    .sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name, 'de'))[0]?.e || null;
}

/**
 * Vorschlag fuer einen Muskel: zusaetzliche Saetze auf die genutzten Workouts verteilen.
 * Hat ein Workout schon eine Hauptuebung fuer den Muskel, wird sie um bis zu 2 Saetze erweitert,
 * sonst kommt die passendste Uebung mit 2–3 Saetzen dazu. Wochenwirkung = Saetze × Haeufigkeit.
 */
function suggestFor(m, used, exSets, high) {
  const step = Math.min(MAX_STEP, m.target.from - m.perWeek);
  const primaryItem = (t) => (t.items || []).find((it) => {
    const e = db.exercise(it.exerciseId);
    return e && e.category === 'kraft' && e.primary.includes(m.id);
  });
  const fits = (t) => {
    if (m.region === 'core') return true;
    const k = templateKind(t);
    return !k || k === 'full' || k === m.region;
  };
  let pool = used.filter((x) => fits(x.t));
  if (!pool.length) pool = used.slice();
  pool.sort((a, b) => (primaryItem(b.t) ? 1 : 0) - (primaryItem(a.t) ? 1 : 0) || b.f - a.f || a.t.name.localeCompare(b.t.name, 'de'));
  const pick = pool.slice(0, step >= 3 && pool.length > 1 ? 2 : 1);
  const best = bestExercise(m.id, exSets, high);
  const actions = [];
  let gain = 0;
  if (pick.length) {
    const sumF = pick.reduce((a, x) => a + x.f, 0);
    const k = clamp(Math.round(step / sumF), 2, 3);
    for (const { t, f } of pick) {
      const it = primaryItem(t);
      const cur = it ? it.sets || 0 : 0;
      const add = it ? Math.min(k, 2, Math.max(0, 5 - cur)) : 0;
      if (add > 0) {
        actions.push({ tpl: t, ex: db.exercise(it.exerciseId), from: cur, to: cur + add });
        gain += add * f;
      } else if (best && (!it || it.exerciseId !== best.id)) {
        actions.push({ tpl: t, ex: best, isNew: true, to: k });
        gain += k * f;
      }
    }
  }
  // Ohne Vorlagen (freie Workouts): allgemein 2× pro Woche
  const generic = !actions.length && best ? { ex: best, times: 2, sets: clamp(Math.ceil(step / 2), 2, 3) } : null;
  if (generic) gain = generic.times * generic.sets;
  return { muscle: m, step: r1(step), gain: r1(gain), after: r1(m.perWeek + gain), actions, generic };
}

function buildSuggestions(muscles, exSets, tplFreq) {
  const used = [...tplFreq].map(([id, f]) => ({ t: db.template(id), f })).filter((x) => x.t);
  const high = new Set(muscles.filter((m) => m.status === 'high').map((m) => m.id));
  return muscles
    .filter((m) => RANK[m.status] < RANK.ok && m.target.from - m.perWeek >= 1)
    .sort(byNeed)
    .slice(0, 3)
    .map((m) => suggestFor(m, used, exSets, high));
}

/**
 * Analyse eines rollierenden Zeitraums (weeks Wochen bis heute, bei kuerzerer Trainingshistorie
 * ab dem ersten Workout). trends: Kraftverlauf berechnen (fuer die Detailansicht).
 */
export function analyzeBalance({ weeks = 4, now = new Date(), trends = true } = {}) {
  const done = db.doneSessions();
  const first = done.length ? new Date(done[0].startedAt) : null;
  const windowStart = startOfDay(addDays(now, -(weeks * 7 - 1)));
  const from = first && first > windowStart ? startOfDay(first) : windowStart;
  const days = dayDiff(from, now) + 1;
  const wk = Math.max(7, days) / 7;
  const t0 = from.getTime(), tn = now.getTime();
  const list = done.filter((s) => { const t = new Date(s.startedAt).getTime(); return t >= t0 && t <= tn; });

  const sum = {}, freq = {}, maxS = {};
  let push = 0, pull = 0, upper = 0, lower = 0;
  const plyo = { push: 0, pull: 0 };
  const exSets = new Map();     // Uebung -> Arbeitssaetze im Zeitraum
  const tplCount = new Map();   // Vorlage -> Workouts im Zeitraum
  const dayKeys = new Set();

  for (const s of list) {
    dayKeys.add(dateKey(new Date(s.startedAt)));
    if (s.templateId) tplCount.set(s.templateId, (tplCount.get(s.templateId) || 0) + 1);
    const per = sessionMuscleSets(s, { plyo: false });
    for (const m in per) {
      sum[m] = (sum[m] || 0) + per[m];
      if (per[m] >= 1) freq[m] = (freq[m] || 0) + 1;
      if (per[m] > (maxS[m] || 0)) maxS[m] = per[m];
    }
    for (const it of s.items) {
      const ex = db.exercise(it.exerciseId);
      const n = ex ? doneWorkSets(it).length : 0;
      if (!n) continue;
      const p = pattern(ex);
      if (ex.category === 'plyometrie') { if (p) plyo[p] += n; continue; }
      if (ex.category !== 'kraft') continue;
      exSets.set(ex.id, (exSets.get(ex.id) || 0) + n);
      if (p === 'push') push += n; else if (p === 'pull') pull += n;
      if (ex.primary.length) {
        const w = n / ex.primary.length; // Satz anteilig auf die Hauptmuskeln
        for (const m of ex.primary) {
          const r = MUSCLE[m]?.region;
          if (r === 'upper') upper += w; else if (r === 'lower') lower += w;
        }
      }
    }
  }

  const trend = trends && list.length ? muscleTrends(exSets, now, weeks) : {};
  const muscles = MUSCLES.map((m) => {
    const target = muscleTarget(m.id);
    const v = r1((sum[m.id] || 0) / wk);
    return {
      id: m.id, name: m.name, region: m.region, tier: m.tier, target,
      perWeek: v,
      status: statusOf(v, target),
      freq: (freq[m.id] || 0) / wk,      // Workouts pro Woche mit mind. 1 effektiven Satz
      maxSession: maxS[m.id] || 0,
      trend: trend[m.id] || null,
    };
  });
  const byId = Object.fromEntries(muscles.map((m) => [m.id, m]));
  const pairs = PAIRS.map((d) => {
    if (d.ma) return evalPair(d, byId[d.ma].perWeek, byId[d.mb].perWeek);
    if (d.id === 'pushpull') return { ...evalPair(d, push / wk, pull / wk), plyo: { push: r1(plyo.push / wk), pull: r1(plyo.pull / wk) } };
    return evalPair(d, upper / wk, lower / wk);
  });

  const notes = [];
  if (list.length) {
    const gap = longestGap(dayKeys, from, now);
    if (gap >= PAUSE_DAYS) notes.push({ type: 'pause', days: gap });
    const below = muscles.filter((m) => RANK[m.status] < RANK.ok).length;
    if (below >= LOW_VOLUME) notes.push({ type: 'volume', below });
  }

  const tplFreq = new Map([...tplCount].map(([id, c]) => [id, c / wk]));
  return {
    weeks, from, days, weeksEff: wk, first, sessions: list.length,
    enough: days >= MIN_DAYS && list.length >= MIN_SESSIONS,
    muscles, pairs, notes, tplFreq,
    suggestions: list.length ? buildSuggestions(muscles, exSets, tplFreq) : [],
  };
}

/** Warum es noch keine Auswertung gibt (fuer Karte und Detailseite) */
export function waitText(res) {
  if (!res.first) return 'Nach etwa 2 Wochen Training zeigt die Analyse, welche Muskeln zu kurz kommen.';
  if (!res.sessions) return `In den letzten ${res.weeks} Wochen gab es kein Training.`;
  const parts = [];
  const d = MIN_DAYS - res.days, n = MIN_SESSIONS - res.sessions;
  if (d > 0) parts.push(`${d} ${d === 1 ? 'Tag' : 'Tage'}`);
  if (n > 0) parts.push(`${n} ${n === 1 ? 'Workout' : 'Workouts'}`);
  return `Noch ${parts.join(' und ')}, dann ist genug Training für eine verlässliche Auswertung da.`;
}

/**
 * Wichtigste Befunde fuer die Kurzansicht: zuerst vernachlaessigte grosse Muskeln, dann starke
 * Ungleichgewichte, kleinere Bereiche, leichte Ungleichgewichte und ausbaufaehige Muskeln.
 * Ein Paar entfaellt, wenn seine schwache Seite schon als Muskel genannt ist.
 */
export function topFindings(res, n = 3) {
  const ms = res.muscles.slice().sort(byNeed);
  const shown = new Set();
  const out = [];
  const muscle = (m) => { if (out.length < n) { out.push({ type: 'muscle', m }); shown.add(m.id); } };
  const pair = (p) => {
    const weakMuscle = p.weak === 'a' ? p.ma : p.mb;
    if (out.length < n && !(weakMuscle && shown.has(weakMuscle))) out.push({ type: 'pair', p });
  };
  ms.filter((m) => m.status === 'low' && m.tier === 'std').forEach(muscle);
  res.pairs.filter((p) => p.level === 'strong').forEach(pair);
  ms.filter((m) => m.status === 'low' && m.tier !== 'std').forEach(muscle);
  res.pairs.filter((p) => p.level === 'mild').forEach(pair);
  ms.filter((m) => m.status === 'mid').forEach(muscle);
  return out;
}
