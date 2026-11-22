// Wochen-Saetze und Erholung pro Muskel – immer live aus den Sessions berechnet.

import * as db from '../db.js';
import { MUSCLES } from '../data/muscles.js';
import { startOfWeek, addDays } from './format.js';
import { clamp } from './dom.js';

const H = 3600e3;

/** Nur erledigte Arbeitssaetze zaehlen (keine Aufwaermsaetze). */
export const doneWorkSets = (item) => item.sets.filter((s) => s.type !== 'warmup' && s.done);

/**
 * Effektive Saetze pro Muskel in einer Session: Hauptmuskel +1, Nebenmuskel +0,5.
 * plyo: false -> nur Kraftuebungen. So bleiben die Werte mit den Richtwerten aus Studien
 * vergleichbar (die beziehen sich auf Kraftsaetze, nicht auf Spruenge). Fuer die Erholung
 * zaehlen Sprung- und Explosivsaetze dagegen mit.
 */
export function sessionMuscleSets(session, { plyo = true } = {}) {
  const out = {};
  for (const item of session.items) {
    const ex = db.exercise(item.exerciseId);
    if (!ex || !(ex.category === 'kraft' || (plyo && ex.category === 'plyometrie'))) continue;
    const n = doneWorkSets(item).length;
    if (!n) continue;
    ex.primary.forEach((m) => { out[m] = (out[m] || 0) + n; });
    ex.secondary.forEach((m) => { if (!ex.primary.includes(m)) out[m] = (out[m] || 0) + n * 0.5; });
  }
  return out;
}

function lastDoneAt(s) {
  let t = null;
  s.items.forEach((it) => it.sets.forEach((x) => { if (x.done && x.doneAt && (!t || x.doneAt > t)) t = x.doneAt; }));
  return t;
}
/** Zeitpunkt, ab dem die Erholung einer Session zaehlt */
export function sessionTime(s) { return new Date(s.endedAt || lastDoneAt(s) || s.startedAt); }

/** Saetze pro Muskel in der Woche (Mo 00:00 – So 23:59), die das Datum enthaelt. opts wie sessionMuscleSets. */
export function weekSets(date = new Date(), opts) {
  const from = startOfWeek(date).getTime();
  const to = addDays(new Date(from), 7).getTime();
  const out = {};
  for (const s of db.state.sessions) {
    const t = new Date(s.startedAt).getTime();
    if (t < from || t >= to) continue;
    const m = sessionMuscleSets(s, opts);
    for (const k in m) out[k] = (out[k] || 0) + m[k];
  }
  return out;
}

/** Effektive Saetze pro Woche fuer einen Muskel, letzte n Wochen (aelteste zuerst) */
export function weeklySeries(muscleId, n = 12, now = new Date(), opts) {
  const cur = startOfWeek(now);
  const weeks = [];
  for (let i = n - 1; i >= 0; i--) weeks.push(addDays(cur, -7 * i));
  return weeks.map((w) => ({ week: w, sets: weekSets(w, opts)[muscleId] || 0 }));
}

/**
 * Erholung pro Muskel:
 *   dauer_i = Basis × clamp(last_i / 6, 0,75, 1,5)
 *   rest_i  = max(0, 1 − Stunden_seit_i / dauer_i) × min(1, last_i / 6)
 *   ermuedung = min(1, Σ rest_i)
 * Status: >= 0,5 ermuedet, 0,15–0,5 fast erholt, < 0,15 erholt.
 */
export function recovery(now = new Date()) {
  const nowT = now.getTime();
  const since = nowT - 7 * 24 * H;
  const loads = {};
  for (const s of db.state.sessions) {
    const t = sessionTime(s).getTime();
    if (t < since || t > nowT) continue;
    const m = sessionMuscleSets(s);
    for (const k in m) (loads[k] = loads[k] || []).push({ load: m[k], t });
  }
  const result = {};
  for (const mu of MUSCLES) {
    const mine = loads[mu.id] || [];
    const fatigueAt = (T) => Math.min(1, mine.reduce((sum, l) => {
      const dur = mu.recoveryH * clamp(l.load / 6, 0.75, 1.5);
      const hours = (T - l.t) / H;
      return sum + Math.max(0, 1 - hours / dur) * Math.min(1, l.load / 6);
    }, 0));
    const f = fatigueAt(nowT);
    const status = f >= 0.5 ? 'tired' : f >= 0.15 ? 'almost' : mine.length ? 'fresh' : 'none';
    let recoveredInH = 0;
    if (f >= 0.15) {
      let lo = 0, hi = 24 * 10;
      while (hi - lo > 0.25) {
        const mid = (lo + hi) / 2;
        if (fatigueAt(nowT + mid * H) < 0.15) hi = mid; else lo = mid;
      }
      recoveredInH = hi;
    }
    result[mu.id] = { fatigue: f, status, recoveredInH, recent: mine.length };
  }
  return result;
}

export const RECOVERY_LABEL = { tired: 'Ermüdet', almost: 'Fast erholt', fresh: 'Erholt', none: 'Erholt' };

export function recoveryClasses(rec) {
  const c = {};
  for (const id in rec) c[id] = rec[id].status === 'none' ? '' : rec[id].status;
  return c;
}
