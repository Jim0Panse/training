// Backup: Export als JSON-Datei (iOS-Teilen-Menue -> „In Dateien sichern“, sonst Download)
// und Import mit Pruefung + Vorschau. Es verlaesst nie etwas das Geraet ohne Zutun des Nutzers.

import * as db from '../db.js';
import { dateKey, fmtDateNum } from './format.js';

export const backupFileName = (d = new Date()) => `training-backup-${dateKey(d)}.json`;

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Muss direkt aus einem Tipp heraus aufgerufen werden (vor dem ersten await),
 * sonst blockiert iOS das Teilen-Menue.
 * -> { ok, cancelled?, shared?, name }
 */
export async function exportBackup() {
  const name = backupFileName();
  const json = JSON.stringify(db.exportData());
  const blob = new Blob([json], { type: 'application/json' });
  let shared = false;
  let file = null;
  try { file = new File([blob], name, { type: 'application/json' }); } catch (e) { file = null; }
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (file && coarse && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      shared = true;
    } catch (e) {
      if (e && e.name === 'AbortError') return { ok: false, cancelled: true, name };
      // Teilen nicht moeglich -> Download
    }
  }
  if (!shared) download(blob, name);
  await db.saveSettings({ lastBackupAt: new Date().toISOString(), backupSnoozeUntil: null });
  return { ok: true, shared, name };
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;
const isNumOrNull = (v) => v == null || (typeof v === 'number' && Number.isFinite(v));

/** Prueft ein Backup. Wirft Error mit verstaendlicher Meldung. -> { data, summary } */
export function validateBackup(d) {
  const fail = (m) => { throw new Error(m); };
  if (!isObj(d)) fail('Die Datei ist kein Backup dieser App.');
  if (d.app !== 'training') fail('Diese Datei stammt nicht aus dieser App.');
  if (d.schema !== 1) fail(`Diese Backup-Version (${esc0(d.schema)}) kennt die App nicht.`);
  for (const k of ['bodyweight', 'exercises', 'templates', 'sessions']) {
    if (!Array.isArray(d[k])) fail('Das Backup ist unvollständig.');
  }
  if (d.settings != null && !isObj(d.settings)) fail('Die Einstellungen im Backup sind beschädigt.');
  d.bodyweight.forEach((b) => {
    if (!isObj(b) || !/^\d{4}-\d{2}-\d{2}$/.test(b.date) || typeof b.kg !== 'number' || !Number.isFinite(b.kg)) fail('Ein Gewichtseintrag im Backup ist beschädigt.');
  });
  d.exercises.forEach((e) => {
    if (!isObj(e) || !isStr(e.id) || typeof e.name !== 'string' || !Array.isArray(e.primary) || !Array.isArray(e.secondary) || !isStr(e.tracking)) fail('Eine Übung im Backup ist beschädigt.');
  });
  d.templates.forEach((t) => {
    if (!isObj(t) || !isStr(t.id) || typeof t.name !== 'string' || !Array.isArray(t.items)) fail('Ein Workout im Backup ist beschädigt.');
  });
  d.sessions.forEach((s) => {
    if (!isObj(s) || !isStr(s.id) || !isStr(s.startedAt) || Number.isNaN(Date.parse(s.startedAt)) || !Array.isArray(s.items)) fail('Ein Training im Backup ist beschädigt.');
    s.items.forEach((it) => {
      if (!isObj(it) || !isStr(it.exerciseId) || !Array.isArray(it.sets)) fail('Ein Training im Backup ist beschädigt.');
      it.sets.forEach((x) => {
        if (!isObj(x) || !isNumOrNull(x.kg) || !isNumOrNull(x.reps) || !isNumOrNull(x.seconds) || !isNumOrNull(x.km)) fail('Ein Satz im Backup ist beschädigt.');
      });
    });
  });
  const ids = new Set();
  d.sessions.forEach((s) => { if (ids.has(s.id)) fail('Das Backup enthält doppelte Trainings.'); ids.add(s.id); });
  const exported = Date.parse(d.exportedAt);
  return {
    data: d,
    summary: {
      sessions: d.sessions.filter((s) => s.status === 'done').length,
      bodyweight: d.bodyweight.length,
      exercises: d.exercises.length,
      templates: d.templates.length,
      exportedAt: Number.isNaN(exported) ? null : new Date(exported),
    },
  };
}
const esc0 = (v) => String(v ?? '?').slice(0, 12);

/** Datei lesen und pruefen */
export async function readBackupFile(file) {
  if (!file) throw new Error('Keine Datei gewählt.');
  if (file.size > 50 * 1024 * 1024) throw new Error('Die Datei ist zu groß für ein Backup.');
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { throw new Error('Die Datei ist kein gültiges Backup (kein lesbares JSON).'); }
  return validateBackup(data);
}

/** „142 Workouts, 310 Gewichtseinträge, Stand 12.11.2026“ */
export function summaryText(sum) {
  const parts = [
    `${sum.sessions} ${sum.sessions === 1 ? 'Workout' : 'Workouts'}`,
    `${sum.bodyweight} ${sum.bodyweight === 1 ? 'Gewichtseintrag' : 'Gewichtseinträge'}`,
    `${sum.exercises} Übungen`,
  ];
  return parts.join(', ') + (sum.exportedAt ? `, Stand ${fmtDateNum(sum.exportedAt)}` : '');
}

/** Tage seit der letzten Sicherung (null = noch nie) */
export function daysSinceBackup(now = new Date()) {
  const t = db.state.settings.lastBackupAt;
  if (!t) return null;
  return Math.floor((now - new Date(t)) / 864e5);
}

/** Soll die Erinnerung auf der Startseite erscheinen? */
export function backupDue(now = new Date()) {
  if (!db.hasUserData()) return false;
  const snooze = db.state.settings.backupSnoozeUntil;
  if (snooze && new Date(snooze) > now) return false;
  const days = daysSinceBackup(now);
  return days == null || days >= 30;
}

