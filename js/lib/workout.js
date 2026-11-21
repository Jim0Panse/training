// Workout starten, Bausteine fuer Sessions, Supersatz-Gruppen (A1/A2 …).

import * as db from '../db.js';
import { uid } from './dom.js';
import { navigate } from '../router.js';

export const newSet = (type = 'work') => ({ type, kg: null, reps: null, seconds: null, km: null, done: false, doneAt: null });

/** Uebung in einer Session; t = Vorlagen-Eintrag (Saetze, Wdh.-Bereich, Notiz, Startgewicht) */
export function sessionItem(exerciseId, t = {}, setCount = null) {
  const n = Math.max(1, Math.min(20, setCount ?? t.sets ?? 3));
  return {
    id: uid(),
    exerciseId,
    supersetGroup: t.supersetGroup ?? null,
    note: t.note || '',
    target: { sets: t.sets ?? null, repsMin: t.repsMin ?? null, repsMax: t.repsMax ?? null, startKg: t.startKg ?? null },
    sets: Array.from({ length: n }, () => newSet()),
  };
}

export function newSession(template = null) {
  return {
    id: uid(),
    templateId: template ? template.id : null,
    name: template ? template.name : 'Freies Workout',
    status: 'active',
    startedAt: new Date().toISOString(),
    endedAt: null,
    note: '',
    templateNote: template ? template.note || '' : '',
    items: template ? template.items.filter((it) => db.exercise(it.exerciseId)).map((it) => sessionItem(it.exerciseId, it)) : [],
    stopwatch: { startedAt: null },
  };
}

/** Startet ein Workout (nur eines gleichzeitig) und oeffnet es */
export async function startWorkout(template = null) {
  const active = db.activeSession();
  if (active) { navigate('#/workout'); return active; }
  const s = newSession(template);
  await db.putSession(s);
  navigate('#/workout');
  return s;
}

/** Letztes abgeschlossenes Workout einer Vorlage */
export function lastSessionOfTemplate(templateId) {
  for (let i = db.state.sessions.length - 1; i >= 0; i--) {
    const s = db.state.sessions[i];
    if (s.status === 'done' && s.templateId === templateId) return s;
  }
  return null;
}

// ---------- Ober- / Unterkoerper ----------
const LOWER = new Set(['quadrizeps', 'beinbeuger', 'adduktoren', 'waden', 'gesaess']);
const UPPER = new Set(['brust', 'schulter_vorne', 'schulter_seite', 'schulter_hinten', 'bizeps', 'trizeps', 'unterarme', 'trapez', 'latissimus']);
export const KIND_LABEL = { upper: 'Oberkörper', lower: 'Unterkörper', full: 'Ganzkörper' };

/** Art eines Workouts aus den Hauptmuskeln seiner Uebungen, gewichtet mit der Satzzahl.
 *  Bauch und unterer Ruecken zaehlen nicht mit. -> 'upper' | 'lower' | 'full' | null */
export function templateKind(t) {
  let up = 0, low = 0;
  for (const it of t.items || []) {
    const ex = db.exercise(it.exerciseId);
    if (!ex || !ex.primary.length) continue;
    const w = (it.sets || 1) / ex.primary.length;
    ex.primary.forEach((m) => { if (UPPER.has(m)) up += w; else if (LOWER.has(m)) low += w; });
  }
  const sum = up + low;
  if (!sum) return null;
  if (low / sum >= 0.7) return 'lower';
  if (up / sum >= 0.7) return 'upper';
  return 'full';
}

// ---------- Supersaetze ----------
/** Pro Eintrag: null oder { letter, pos, size, first, last } (nur zusammenhaengende Gruppen ab 2) */
export function groupInfo(items) {
  const out = items.map(() => null);
  let i = 0;
  while (i < items.length) {
    const g = items[i].supersetGroup;
    let j = i + 1;
    if (g) while (j < items.length && items[j].supersetGroup === g) j++;
    if (g && j - i >= 2) {
      for (let k = i; k < j; k++) out[k] = { letter: g, pos: k - i + 1, size: j - i, first: k === i, last: k === j - 1 };
    }
    i = j;
  }
  return out;
}

/** Gruppen aufraeumen: Einzelne -> keine Gruppe, Buchstaben der Reihe nach A, B, C … */
export function normalizeGroups(items) {
  let n = 0;
  let i = 0;
  while (i < items.length) {
    const g = items[i].supersetGroup;
    let j = i + 1;
    if (g) while (j < items.length && items[j].supersetGroup === g) j++;
    const letter = g && j - i >= 2 ? String.fromCharCode(65 + (n++ % 26)) : null;
    for (let k = i; k < j; k++) items[k].supersetGroup = letter;
    i = j;
  }
  return items;
}

/** Verbindung zwischen Eintrag i und i+1 umschalten (verbinden bzw. Gruppe dort teilen) */
export function toggleLink(items, i) {
  const a = items[i], b = items[i + 1];
  if (!a || !b) return items;
  const info = groupInfo(items);
  const linked = info[i] && info[i + 1] && a.supersetGroup === b.supersetGroup;
  if (linked) {
    const g = a.supersetGroup;
    for (let k = i + 1; k < items.length && items[k].supersetGroup === g; k++) items[k].supersetGroup = '~split';
  } else {
    const gA = info[i] ? a.supersetGroup : null;
    const gB = info[i + 1] ? b.supersetGroup : null;
    if (gA) for (let k = i; k >= 0 && items[k].supersetGroup === gA; k--) items[k].supersetGroup = '~merge';
    else a.supersetGroup = '~merge';
    if (gB) for (let k = i + 1; k < items.length && items[k].supersetGroup === gB; k++) items[k].supersetGroup = '~merge';
    else b.supersetGroup = '~merge';
  }
  return normalizeGroups(items);
}

/** Eintrag verschieben und Gruppen aufraeumen */
export function moveItem(items, from, to) {
  const [x] = items.splice(from, 1);
  items.splice(to, 0, x);
  return normalizeGroups(items);
}
