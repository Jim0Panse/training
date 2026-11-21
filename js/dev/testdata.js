// NUR FUER DIE ENTWICKLUNG (Einstellungen mit ?dev=1 aufrufen).
// Erzeugt 12 Wochen realistische Workouts aus den Vorlagen und Gewichtswerte mit Luecken.
// Alle erzeugten Datensaetze tragen `dev: true` und lassen sich gezielt wieder loeschen.

import * as db from '../db.js';
import { newSet } from '../lib/workout.js';
import { uid } from '../lib/dom.js';
import { dateKey, addDays, startOfDay, startOfWeek } from '../lib/format.js';

const rand = (a, b) => a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(rand(a, b + 1));
const roundTo = (v, step) => Math.round(v / step) * step;

const BASE_KG = { langhantel: 50, kurzhantel: 16, maschine: 40, kabel: 25, sonstiges: 16, koerpergewicht: 0 };

export const isDevMode = () => {
  try {
    const p = new URLSearchParams(location.search).get('dev');
    if (p === '1') localStorage.setItem('training-dev', '1');
    if (p === '0') localStorage.removeItem('training-dev');
    return localStorage.getItem('training-dev') === '1';
  } catch (e) { return false; }
};

export const devCounts = () => ({
  sessions: db.state.sessions.filter((s) => s.dev).length,
  bodyweight: db.state.bodyweight.filter((b) => b.dev).length,
});

export async function generateTestData({ weeks = 12 } = {}) {
  const now = new Date();
  const first = startOfWeek(addDays(now, -7 * weeks));
  const order = ['upper-a', 'lower-a', 'upper-b', 'lower-b'].map((id) => db.template(id)).filter(Boolean);
  const tpls = order.length ? order : db.state.templates;
  if (!tpls.length) throw new Error('Keine Vorlagen vorhanden');

  const kgOf = new Map(); // aktuelles Arbeitsgewicht je Uebung
  const sessions = [];
  let next = 0;
  const vacationWeek = Math.floor(weeks / 2) - 1;

  for (let w = 0; w <= weeks; w++) {
    if (w === vacationWeek) continue; // eine Woche Pause
    const monday = addDays(first, 7 * w);
    const days = [0, 2, 4];
    if (Math.random() < 0.3) days.push(5);
    for (const off of days) {
      if (Math.random() < 0.1) continue; // ausgefallen
      const day = addDays(monday, off);
      const start = new Date(day);
      start.setHours(irand(16, 19), irand(0, 59), 0, 0);
      if (start.getTime() > now.getTime() - 3 * 3600e3) continue;
      const t = tpls[next % tpls.length];
      next++;
      sessions.push(makeSession(t, start, kgOf));
    }
  }

  // Koerpergewicht: meist taeglich, einzelne vergessene Tage und zwei laengere Luecken
  const bodyweight = [];
  const totalDays = Math.round((startOfDay(now) - first) / 864e5);
  const gapA = [Math.round(totalDays * 0.3), 6];
  const gapB = [Math.round(totalDays * 0.65), 10];
  const have = new Set(db.state.bodyweight.map((b) => b.date));
  for (let i = 0; i < totalDays; i++) {
    if ((i >= gapA[0] && i < gapA[0] + gapA[1]) || (i >= gapB[0] && i < gapB[0] + gapB[1])) continue;
    if (Math.random() < 0.22) continue;
    const date = dateKey(addDays(first, i));
    if (have.has(date)) continue;
    const trend = 84.6 - (2.2 * i) / totalDays;
    bodyweight.push({ date, kg: Math.round((trend + rand(-0.45, 0.45)) * 10) / 10, dev: true });
  }

  await db.bulkPut({ sessions, bodyweight });
  return { sessions: sessions.length, bodyweight: bodyweight.length };
}

function makeSession(t, start, kgOf) {
  let clock = start.getTime() + irand(6, 10) * 60e3; // Aufwaermen
  let warmupDone = false;
  const items = [];
  for (const it of t.items) {
    const ex = db.exercise(it.exerciseId);
    if (!ex) continue;
    const step = ex.incrementKg || 2.5;
    if (!kgOf.has(ex.id)) {
      const plan = it.startKg ?? BASE_KG[ex.equipment] ?? 20;
      kgOf.set(ex.id, ex.tracking === 'zusatzgewicht_wdh' ? 0 : Math.max(step, roundTo(plan * 0.85, step)));
    }
    const kg = kgOf.get(ex.id);
    const sets = [];
    const lo = it.repsMin ?? 8, hi = it.repsMax ?? lo;
    if (!warmupDone && ex.category === 'kraft' && ex.tracking === 'gewicht_wdh' && Math.random() < 0.6) {
      warmupDone = true;
      clock += 90e3;
      sets.push({ ...newSet('warmup'), kg: Math.max(step, roundTo(kg * 0.5, step)), reps: 10, done: true, doneAt: new Date(clock).toISOString() });
    }
    const n = it.sets || 3;
    let allTop = true;
    for (let i = 0; i < n; i++) {
      clock += irand(80, 150) * 1000;
      const s = { ...newSet('work'), done: true, doneAt: new Date(clock).toISOString() };
      switch (ex.tracking) {
        case 'gewicht_wdh':
        case 'zusatzgewicht_wdh': {
          s.kg = kg;
          s.reps = Math.max(1, Math.min(hi, hi - Math.floor(i * 0.7) + irand(-1, 1)));
          if (s.reps < hi) allTop = false;
          break;
        }
        case 'wdh': s.reps = Math.max(1, hi + irand(-2, 1)); break;
        case 'zeit': s.seconds = irand(30, 75); break;
        case 'distanz_zeit': s.km = Math.round(rand(2.5, 5) * 100) / 100; s.seconds = irand(15, 30) * 60; break;
        default: break;
      }
      sets.push(s);
    }
    // Steigerung, wenn alle Saetze oben angekommen sind (oder ab und zu einfach so)
    if (ex.tracking === 'gewicht_wdh' && (allTop || Math.random() < 0.15)) kgOf.set(ex.id, kg + step);
    if (ex.tracking === 'zusatzgewicht_wdh' && Math.random() < 0.25) kgOf.set(ex.id, kg + 2.5);
    items.push({
      id: uid(), exerciseId: ex.id, supersetGroup: it.supersetGroup ?? null, note: it.note || '',
      target: { sets: it.sets ?? null, repsMin: it.repsMin ?? null, repsMax: it.repsMax ?? null, startKg: it.startKg ?? null },
      sets,
    });
  }
  const end = new Date(clock + irand(2, 6) * 60e3);
  return {
    id: 'dev-' + uid(), dev: true, templateId: t.id, name: t.name, status: 'done',
    startedAt: start.toISOString(), endedAt: end.toISOString(), note: '', templateNote: t.note || '',
    items, stopwatch: { startedAt: null },
  };
}

export async function removeTestData() {
  const sessions = db.state.sessions.filter((s) => s.dev).map((s) => s.id);
  const bodyweight = db.state.bodyweight.filter((b) => b.dev).map((b) => b.date);
  await db.bulkDelete({ sessions, bodyweight });
  return { sessions: sessions.length, bodyweight: bodyweight.length };
}
