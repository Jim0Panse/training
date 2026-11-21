// Suche und Filter fuer Uebungslisten (Uebungen-Tab und Uebungsauswahl).

import * as db from '../db.js';
import { MUSCLE_GROUPS, muscleName } from '../data/muscles.js';
import { CATEGORIES, EQUIPMENT } from '../data/exercises.js';

/** Fuer die Suche: klein, ohne Umlaut-Striche („Schräg“ findet man auch mit „schrag“) */
export const normalize = (s) => String(s || '').toLowerCase().replace(/ß/g, 'ss')
  .normalize('NFD').replace(/[̀-ͯ]/g, '');

const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });
export const byName = (a, b) => collator.compare(a.name, b.name);

/** Gefilterte, alphabetisch sortierte Uebungen */
export function filterExercises({ q = '', group = null, cat = null, archived = false } = {}) {
  const words = normalize(q).trim().split(/\s+/).filter(Boolean);
  const g = group ? MUSCLE_GROUPS.find((x) => x.id === group) : null;
  return db.state.exercises.filter((ex) => {
    if (ex.archived && !archived) return false;
    if (cat && ex.category !== cat) return false;
    if (g && !ex.primary.some((m) => g.muscles.includes(m))) return false;
    if (words.length) {
      const hay = normalize(`${ex.name} ${ex.primary.map(muscleName).join(' ')} ${EQUIPMENT[ex.equipment] || ''}`);
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  }).sort(byName);
}

/** Unterzeile: „Plyometrie · Quadrizeps, Gesäß · Langhantel“ */
export function exerciseMeta(ex) {
  const parts = [];
  if (ex.category !== 'kraft') parts.push(CATEGORIES[ex.category]);
  if (ex.primary.length) parts.push(ex.primary.map(muscleName).join(', '));
  if (EQUIPMENT[ex.equipment]) parts.push(EQUIPMENT[ex.equipment]);
  return parts.join(' · ');
}

export function firstLetter(name) {
  const c = normalize(name).charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
}
