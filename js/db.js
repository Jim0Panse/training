// IndexedDB-Wrapper mit Arbeitskopie im Speicher.
// Alle Daten werden beim Start einmal geladen (die Mengen sind klein) und bei jeder
// Aenderung sofort in IndexedDB geschrieben. Statistiken werden immer live berechnet.

import { EXERCISES } from './data/exercises.js';
import { TEMPLATES } from './data/templates.js';
import { upgradeExerciseMuscles } from './data/muscles.js';

const DB_NAME = 'training';
const DB_VERSION = 1;
const DATA_STORES = ['bodyweight', 'exercises', 'templates', 'sessions'];
export const SEED_VERSION = 1;

export const DEFAULT_SETTINGS = {
  theme: 'system',
  stopwatchIntervalSec: 60,
  stopwatchAutoStart: false,
  lastBackupAt: null,
  backupSnoozeUntil: null,
  seedVersion: SEED_VERSION,
  createdAt: null,
};

export const state = {
  settings: { ...DEFAULT_SETTINGS },
  bodyweight: [],   // aufsteigend nach Datum
  exercises: [],
  templates: [],    // nach order
  sessions: [],     // aufsteigend nach startedAt
};

let idb = null;
const exIndex = new Map();
const listeners = new Set();

// ---------- Grundfunktionen ----------
const req = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
const done = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error || new Error('Transaktion abgebrochen'));
});

function openDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      if (!db.objectStoreNames.contains('bodyweight')) db.createObjectStore('bodyweight', { keyPath: 'date' });
      if (!db.objectStoreNames.contains('exercises')) db.createObjectStore('exercises', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('templates')) db.createObjectStore('templates', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('sessions')) {
        const s = db.createObjectStore('sessions', { keyPath: 'id' });
        s.createIndex('startedAt', 'startedAt');
        s.createIndex('status', 'status');
      }
    };
    r.onsuccess = () => {
      const db = r.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('Datenbank ist blockiert'));
  });
}

async function write(store, fn) {
  const tx = idb.transaction(store, 'readwrite');
  fn(tx.objectStore(store));
  await done(tx);
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(store) { listeners.forEach((fn) => { try { fn(store); } catch (e) { console.error(e); } }); }

// Ausstehende (entprellte) Speichervorgaenge, die vor Neuladen/Schliessen sofort laufen muessen
const flushers = new Set();
export function onFlush(fn) { flushers.add(fn); return () => flushers.delete(fn); }
export async function flushAll() {
  for (const fn of flushers) { try { await fn(); } catch (e) { console.error(e); } }
}

const clone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

// ---------- Start & Seed ----------
async function seed(tx) {
  const now = new Date().toISOString();
  for (const ex of EXERCISES) tx.objectStore('exercises').put(clone(ex));
  for (const t of TEMPLATES) tx.objectStore('templates').put(clone(t));
  tx.objectStore('settings').put({ ...DEFAULT_SETTINGS, createdAt: now }, 'app');
}

export async function init() {
  idb = await openDB();
  let settings = await req(idb.transaction('settings').objectStore('settings').get('app'));
  let firstRun = false;
  if (!settings) {
    // Allererster Start: Uebungen + Vorlagen einmalig anlegen, danach nie wieder ueberschreiben.
    const tx = idb.transaction(['settings', 'exercises', 'templates'], 'readwrite');
    await seed(tx);
    await done(tx);
    firstRun = true;
    settings = await req(idb.transaction('settings').objectStore('settings').get('app'));
  }
  state.settings = { ...DEFAULT_SETTINGS, ...settings };
  await loadAll();
  await upgradeData();
  if (firstRun && navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
  return { firstRun };
}

async function loadAll() {
  const tx = idb.transaction(DATA_STORES);
  const [bw, ex, tp, se] = await Promise.all(DATA_STORES.map((s) => req(tx.objectStore(s).getAll())));
  state.bodyweight = bw.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  state.exercises = ex;
  reindex();
  state.templates = tp.sort(byOrder);
  state.sessions = se.sort(byStart);
}

/** Aeltere Datenstaende angleichen (z. B. „Bauch“ -> obere/untere Bauchmuskeln). Laeuft bei jedem Start, aendert nur Veraltetes. */
async function upgradeData() {
  const changed = state.exercises.map(upgradeExerciseMuscles).filter(Boolean);
  if (!changed.length) return;
  const tx = idb.transaction('exercises', 'readwrite');
  changed.forEach((ex) => tx.objectStore('exercises').put(ex));
  await done(tx);
  const byId = new Map(changed.map((ex) => [ex.id, ex]));
  state.exercises = state.exercises.map((ex) => byId.get(ex.id) || ex);
  reindex();
}

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'de');
const byStart = (a, b) => (a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0);
function reindex() { exIndex.clear(); state.exercises.forEach((e) => exIndex.set(e.id, e)); }

// ---------- Lesen ----------
export const exercise = (id) => exIndex.get(id);
export const template = (id) => state.templates.find((t) => t.id === id);
export const session = (id) => state.sessions.find((s) => s.id === id);
export const activeSession = () => state.sessions.find((s) => s.status === 'active') || null;
export const doneSessions = () => state.sessions.filter((s) => s.status === 'done');
/** Gibt es etwas zu sichern? Erst abgeschlossene Workouts oder Gewichtswerte zaehlen, ein laufendes Workout noch nicht. */
export const hasUserData = () => state.sessions.some((s) => s.status === 'done') || state.bodyweight.length > 0;

// ---------- Schreiben ----------
export async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  await write('settings', (s) => s.put(state.settings, 'app'));
  emit('settings');
}

export async function putBodyweight(entry) {
  const i = state.bodyweight.findIndex((b) => b.date === entry.date);
  if (i >= 0) state.bodyweight[i] = entry; else state.bodyweight.push(entry);
  state.bodyweight.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  await write('bodyweight', (s) => s.put(entry));
  emit('bodyweight');
}
export async function deleteBodyweight(date) {
  state.bodyweight = state.bodyweight.filter((b) => b.date !== date);
  await write('bodyweight', (s) => s.delete(date));
  emit('bodyweight');
}

export async function putExercise(ex) {
  const i = state.exercises.findIndex((e) => e.id === ex.id);
  if (i >= 0) state.exercises[i] = ex; else state.exercises.push(ex);
  reindex();
  await write('exercises', (s) => s.put(ex));
  emit('exercises');
}
export async function deleteExercise(id) {
  state.exercises = state.exercises.filter((e) => e.id !== id);
  reindex();
  await write('exercises', (s) => s.delete(id));
  emit('exercises');
}

export async function putTemplate(t) {
  const i = state.templates.findIndex((x) => x.id === t.id);
  if (i >= 0) state.templates[i] = t; else state.templates.push(t);
  state.templates.sort(byOrder);
  await write('templates', (s) => s.put(t));
  emit('templates');
}
export async function putTemplates(list) {
  const tx = idb.transaction('templates', 'readwrite');
  list.forEach((t) => tx.objectStore('templates').put(t));
  await done(tx);
  state.templates.sort(byOrder);
  emit('templates');
}
export async function deleteTemplate(id) {
  state.templates = state.templates.filter((t) => t.id !== id);
  await write('templates', (s) => s.delete(id));
  emit('templates');
}

export async function putSession(sess, { silent = false } = {}) {
  const i = state.sessions.findIndex((s) => s.id === sess.id);
  if (i >= 0) state.sessions[i] = sess; else { state.sessions.push(sess); state.sessions.sort(byStart); }
  await write('sessions', (s) => s.put(sess));
  if (!silent) emit('sessions');
}
export async function deleteSession(id) {
  state.sessions = state.sessions.filter((s) => s.id !== id);
  await write('sessions', (s) => s.delete(id));
  emit('sessions');
}

// ---------- Backup / Loeschen ----------
export function exportData() {
  return {
    app: 'training',
    schema: 1,
    exportedAt: new Date().toISOString(),
    settings: clone(state.settings),
    bodyweight: clone(state.bodyweight),
    exercises: clone(state.exercises),
    templates: clone(state.templates),
    sessions: clone(state.sessions),
  };
}

/** Ersetzt ALLE Daten (Backup-Import). */
export async function replaceAll(dump) {
  const tx = idb.transaction(['settings', ...DATA_STORES], 'readwrite');
  ['settings', ...DATA_STORES].forEach((s) => tx.objectStore(s).clear());
  tx.objectStore('settings').put({ ...DEFAULT_SETTINGS, ...(dump.settings || {}) }, 'app');
  dump.bodyweight.forEach((x) => tx.objectStore('bodyweight').put(x));
  dump.exercises.forEach((x) => tx.objectStore('exercises').put(x));
  dump.templates.forEach((x) => tx.objectStore('templates').put(x));
  dump.sessions.forEach((x) => tx.objectStore('sessions').put(x));
  await done(tx);
  state.settings = { ...DEFAULT_SETTINGS, ...(dump.settings || {}) };
  await loadAll();
  await upgradeData(); // aeltere Backups
  emit('all');
}

/** Loescht alles und legt die vorgespeicherten Uebungen/Workouts neu an. */
export async function wipeAll() {
  const tx = idb.transaction(['settings', ...DATA_STORES], 'readwrite');
  ['settings', ...DATA_STORES].forEach((s) => tx.objectStore(s).clear());
  await seed(tx);
  await done(tx);
  state.settings = { ...DEFAULT_SETTINGS, ...(await req(idb.transaction('settings').objectStore('settings').get('app'))) };
  await loadAll();
  emit('all');
}

/** Schreibt viele Datensaetze auf einmal (Testdaten). */
export async function bulkPut({ sessions = [], bodyweight = [] }) {
  const tx = idb.transaction(['sessions', 'bodyweight'], 'readwrite');
  sessions.forEach((x) => tx.objectStore('sessions').put(x));
  bodyweight.forEach((x) => tx.objectStore('bodyweight').put(x));
  await done(tx);
  await loadAll();
  emit('all');
}

/** Loescht viele Datensaetze auf einmal (Testdaten entfernen). */
export async function bulkDelete({ sessions = [], bodyweight = [] }) {
  const tx = idb.transaction(['sessions', 'bodyweight'], 'readwrite');
  sessions.forEach((id) => tx.objectStore('sessions').delete(id));
  bodyweight.forEach((d) => tx.objectStore('bodyweight').delete(d));
  await done(tx);
  await loadAll();
  emit('all');
}
