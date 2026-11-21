// Koerpergewicht: 7-Tage-Mittel, Trend und Reihen fuer den Graphen.
// Ein Eintrag pro Tag ({ date: 'YYYY-MM-DD', kg }). Fehlende Tage werden nie aufgefuellt.

import * as db from '../db.js';
import { dateKey, fromKey, addDays, startOfDay } from './format.js';

const DAY = 864e5;
/** Abstand zwischen zwei Messungen, ab dem die Linie gestrichelt wird (Tage) */
export const GAP_DAYS = 3;

export const latest = () => db.state.bodyweight[db.state.bodyweight.length - 1] || null;
export const entryFor = (key) => db.state.bodyweight.find((b) => b.date === key) || null;

/** Mittel aller Werte im Fenster [Tag − 6, Tag] -> { kg, n } oder null */
export function avg7(day = new Date()) {
  const to = dateKey(day), from = dateKey(addDays(day, -6));
  let sum = 0, n = 0;
  for (const b of db.state.bodyweight) {
    if (b.date > to) break;
    if (b.date >= from) { sum += b.kg; n++; }
  }
  return n ? { kg: sum / n, n } : null;
}

/** Veraenderung des 7-Tage-Mittels gegenueber vor `days` Tagen -> kg oder null */
export function avgChange(days, now = new Date()) {
  const a = avg7(now), b = avg7(addDays(now, -days));
  return a && b ? a.kg - b.kg : null;
}

/** Vorheriger Eintrag (aelter) zu einem Datum */
export function previousEntry(key) {
  let prev = null;
  for (const b of db.state.bodyweight) { if (b.date >= key) break; prev = b; }
  return prev;
}

/**
 * Reihen fuer den Graphen:
 * raw: alle Messwerte, avg: 7-Tage-Mittel – ein Punkt pro Tag, an dem mindestens ein Wert
 * im Fenster liegt (bis zur letzten Messung). Liegt ein Linienstueck in einer Messluecke
 * von mehr als GAP_DAYS Tagen, wird es gestrichelt (point.gap).
 */
export function weightSeries() {
  const list = db.state.bodyweight;
  if (!list.length) return { raw: [], avg: [] };
  const mt = list.map((b) => fromKey(b.date).getTime());
  const raw = list.map((b, i) => ({ x: mt[i], y: b.kg }));

  const avg = [];
  let lo = 0, hi = 0, j = 0;
  const last = fromKey(list[list.length - 1].date);
  for (let d = fromKey(list[0].date); d <= last; d = addDays(d, 1)) {
    const k = dateKey(d), kFrom = dateKey(addDays(d, -6));
    while (hi < list.length && list[hi].date <= k) hi++;
    while (lo < hi && list[lo].date < kFrom) lo++;
    if (hi === lo) continue;
    let sum = 0;
    for (let i = lo; i < hi; i++) sum += list[i].kg;
    const x = d.getTime();
    while (j + 1 < mt.length && mt[j + 1] <= x) j++;
    avg.push({ x, y: sum / (hi - lo), n: hi - lo, lastM: mt[j], nextM: mt[j] === x ? x : mt[j + 1] });
  }
  for (let i = 1; i < avg.length; i++) {
    const gap = Math.round((avg[i].nextM - avg[i - 1].lastM) / DAY);
    if (gap > GAP_DAYS) avg[i].gap = true;
  }
  return { raw, avg };
}

/** Zeitraum fuer den Graphen -> [von, bis] in ms */
export function rangeDomain(range, now = new Date()) {
  const end = startOfDay(now).getTime();
  const days = { '30': 30, '90': 90, '365': 365 }[range];
  if (days) return [addDays(startOfDay(now), -(days - 1)).getTime(), end];
  const first = db.state.bodyweight[0];
  return [first ? Math.min(fromKey(first.date).getTime(), end) : end - 29 * DAY, end];
}
