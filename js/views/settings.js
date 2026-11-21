// Einstellungen: Darstellung, Pausen-Stoppuhr, Daten (Backup exportieren/importieren, alles
// loeschen), Info. Mit ?dev=1 zusaetzlich Testdaten erzeugen/loeschen (nur fuer die Entwicklung).

import * as db from '../db.js';
import { topbar } from '../components/header.js';
import { confirmSheet, openSheet } from '../components/sheet.js';
import { unlockAudio, beep } from '../components/stopwatch.js';
import { applyTheme } from '../lib/theme.js';
import { exportBackup, readBackupFile, summaryText } from '../lib/backup.js';
import { fmtDateNum, fmtRelDay } from '../lib/format.js';
import { on, esc, toast } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { navigate } from '../router.js';
import { APP_VERSION } from '../version.js';

const THEMES = [['system', 'System'], ['light', 'Hell'], ['dark', 'Dunkel']];
const INTERVALS = [[30, '30 s'], [60, '60 s'], [90, '90 s'], [120, '120 s'], [0, 'Aus']];

/** Entwicklungsmodus: einmal mit ?dev=1 aufrufen (bleibt gemerkt), ?dev=0 schaltet ab. */
function devMode() {
  try {
    const p = new URLSearchParams(location.search).get('dev');
    if (p === '1') localStorage.setItem('training-dev', '1');
    if (p === '0') localStorage.removeItem('training-dev');
    return localStorage.getItem('training-dev') === '1';
  } catch (e) { return false; }
}

function lastBackupText() {
  const t = db.state.settings.lastBackupAt;
  if (!t) return 'Noch keine';
  const d = new Date(t);
  return `${fmtRelDay(d)} · ${fmtDateNum(d)}`;
}

/** Zweite Sicherheitsstufe: „LÖSCHEN“ eintippen */
function typedConfirm() {
  return new Promise((resolve) => {
    const s = openSheet({
      body: `<div class="confirm">
        <h2>Wirklich alles löschen?</h2>
        <p>Zum Bestätigen <strong>LÖSCHEN</strong> eintippen.</p>
        <input class="input mt-16" id="wipe-input" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" placeholder="LÖSCHEN" aria-label="LÖSCHEN eintippen">
        <div class="stack-sm">
          <button class="btn btn-danger" type="button" data-r="1" disabled>Alle Daten löschen</button>
          <button class="btn btn-secondary" type="button" data-r="0">Abbrechen</button>
        </div></div>`,
      onClose: (r) => resolve(r === true),
    });
    const inp = s.body.querySelector('#wipe-input');
    const btn = s.body.querySelector('[data-r="1"]');
    inp.addEventListener('input', () => { btn.disabled = inp.value.trim().toUpperCase() !== 'LÖSCHEN'; });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !btn.disabled) s.close(true); });
    s.body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]');
      if (b && !b.disabled) s.close(b.dataset.r === '1');
    });
  });
}

export function render(root) {
  root.classList.add('has-topbar');
  const dev = devMode();

  const draw = () => {
    const st = db.state.settings;
    const sessions = db.doneSessions().length;
    const weights = db.state.bodyweight.length;
    const devS = db.state.sessions.filter((s) => s.dev).length;
    const devB = db.state.bodyweight.filter((b) => b.dev).length;
    root.innerHTML = `
      ${topbar({ title: 'Einstellungen', back: '#/start' })}

      <h2 class="section-title">Darstellung</h2>
      <div class="seg" role="tablist" aria-label="Darstellung">
        ${THEMES.map(([v, l]) => `<button type="button" data-theme-set="${v}" class="${st.theme === v ? 'on' : ''}" role="tab" aria-selected="${st.theme === v}">${l}</button>`).join('')}
      </div>

      <h2 class="section-title">Pausen-Stoppuhr</h2>
      <div class="card set-card">
        <div class="set-label">Ton alle</div>
        <div class="seg sm mt-8" role="tablist" aria-label="Signalton-Abstand">
          ${INTERVALS.map(([v, l]) => `<button type="button" data-interval="${v}" class="${Number(st.stopwatchIntervalSec) === v ? 'on' : ''}" role="tab" aria-selected="${Number(st.stopwatchIntervalSec) === v}">${l}</button>`).join('')}
        </div>
        <div class="set-line">
          <label class="grow" for="sw-auto"><span class="row-title">Automatisch starten</span><span class="row-sub">beim Abhaken eines Satzes</span></label>
          <label class="switch"><input type="checkbox" id="sw-auto" ${st.stopwatchAutoStart ? 'checked' : ''}><span></span></label>
        </div>
        <button class="btn btn-secondary mt-12" type="button" data-test-tone>${icon('volume')}Testton abspielen</button>
      </div>
      <p class="field-hint set-hint">Die Stoppuhr zählt die Pause hoch und gibt im gewählten Abstand einen kurzen Ton. Töne gibt es nur bei geöffneter App; ist das iPhone stummgeschaltet, sind sie eventuell nicht zu hören.</p>

      <h2 class="section-title">Daten</h2>
      <div class="list">
        <div class="row"><span class="grow row-title">Workouts</span><span class="row-value">${sessions}</span></div>
        <div class="row"><span class="grow row-title">Gewichtseinträge</span><span class="row-value">${weights}</span></div>
        <div class="row"><span class="grow row-title">Letzte Sicherung</span><span class="row-value">${esc(lastBackupText())}</span></div>
      </div>
      <div class="stack-sm mt-12">
        <button class="btn" type="button" data-export>${icon('share')}Backup exportieren</button>
        <label class="btn btn-secondary" for="import-file">${icon('download')}Backup importieren</label>
        <input class="file-input" type="file" id="import-file" accept="application/json,.json">
      </div>
      <p class="field-hint set-hint">Das Backup ist eine Datei mit allen Daten. Auf dem iPhone im Teilen-Menü „In Dateien sichern“ wählen, z. B. in iCloud Drive. Beim Import werden alle aktuellen Daten ersetzt.</p>
      <button class="btn btn-text danger mt-8" type="button" data-wipe>${icon('trash')}Alle Daten löschen</button>

      <h2 class="section-title">Info</h2>
      <div class="list">
        <div class="row"><span class="grow row-title">Version</span><span class="row-value">${esc(APP_VERSION)}</span></div>
      </div>
      <div class="stack-sm mt-12">
        <div class="info-note">${icon('lock')}<span><strong>Alle Daten liegen nur auf diesem iPhone.</strong> Die App sendet nichts ins Internet. Öffne sie immer über das Symbol auf dem Home-Bildschirm – sie hat einen eigenen Speicher, getrennt vom normalen Safari.</span></div>
        <div class="info-note">${icon('shortcut')}<span><strong>Erinnerung ans Training:</strong> In der Kurzbefehle-App unter „Automation“ eine neue Automation mit „Tageszeit“ anlegen (z. B. 7:00 an Trainingstagen) und als Aktion „App öffnen“ → „Training“ wählen.</span></div>
      </div>

      ${dev ? `
        <h2 class="section-title">Entwicklung</h2>
        <div class="card set-card">
          <p class="small muted">Nur im Entwicklungsmodus sichtbar (?dev=1, abschalten mit ?dev=0). Testdaten: ${devS} Workouts, ${devB} Gewichtswerte.</p>
          <div class="btn-row mt-12">
            <button class="btn btn-secondary btn-sm" type="button" data-dev-gen ${devS ? 'disabled' : ''}>Erzeugen</button>
            <button class="btn btn-secondary btn-sm" type="button" data-dev-del ${devS || devB ? '' : 'disabled'}>Löschen</button>
          </div>
        </div>` : ''}`;
  };

  async function importFile(inp) {
    const file = inp.files && inp.files[0];
    inp.value = ''; // dieselbe Datei spaeter erneut waehlbar
    if (!file) return;
    let res;
    try {
      res = await readBackupFile(file);
    } catch (err) {
      await confirmSheet({ title: 'Import nicht möglich', message: err.message, confirm: 'OK', cancel: null });
      return;
    }
    const active = db.activeSession();
    const ok = await confirmSheet({
      title: 'Backup importieren?',
      message: `Enthält ${summaryText(res.summary)}. Alle aktuellen Daten auf diesem iPhone werden ersetzt${active ? ' – auch das laufende Workout' : ''}. Das lässt sich nicht rückgängig machen.`,
      confirm: 'Alle aktuellen Daten ersetzen',
      danger: true,
    });
    if (!ok) return;
    try {
      await db.flushAll();
      await db.replaceAll(res.data);
      // Der Datenstand entspricht genau diesem Backup
      await db.saveSettings({ lastBackupAt: (res.summary.exportedAt || new Date()).toISOString(), backupSnoozeUntil: null });
      applyTheme(db.state.settings.theme);
      toast('Backup importiert');
    } catch (err) {
      console.error(err);
      await confirmSheet({ title: 'Import fehlgeschlagen', message: 'Die Daten konnten nicht gespeichert werden. Bitte noch einmal versuchen.', confirm: 'OK', cancel: null });
    }
  }

  async function wipe() {
    const ok = await confirmSheet({
      title: 'Alle Daten löschen?',
      message: 'Alle Workouts, Gewichtseinträge, eigenen Übungen und Änderungen werden von diesem iPhone gelöscht. Die vorgespeicherten Übungen und Workouts werden wiederhergestellt. Tipp: Vorher ein Backup exportieren.',
      confirm: 'Weiter',
      danger: true,
    });
    if (!ok || !(await typedConfirm())) return;
    const st = db.state.settings;
    const keep = { theme: st.theme, stopwatchIntervalSec: st.stopwatchIntervalSec, stopwatchAutoStart: st.stopwatchAutoStart };
    await db.flushAll();
    await db.wipeAll();
    await db.saveSettings(keep); // Darstellung und Stoppuhr bleiben wie eingestellt
    applyTheme(keep.theme);
    toast('Alle Daten gelöscht');
    navigate('#/start', { replace: true });
  }

  draw();
  const offs = [
    on(root, 'click', '[data-theme-set]', async (e, b) => {
      const v = b.dataset.themeSet;
      applyTheme(v);
      await db.saveSettings({ theme: v });
    }),
    on(root, 'click', '[data-interval]', (e, b) => db.saveSettings({ stopwatchIntervalSec: Number(b.dataset.interval) })),
    on(root, 'change', '#sw-auto', (e, inp) => db.saveSettings({ stopwatchAutoStart: inp.checked })),
    on(root, 'click', '[data-test-tone]', () => { unlockAudio(); beep(); }),
    on(root, 'click', '[data-export]', async () => {
      const r = await exportBackup(); // direkt aus dem Tipp heraus (iOS-Teilen-Menue)
      if (r.ok) toast(r.shared ? 'Backup erstellt' : `Backup gespeichert: ${r.name}`);
    }),
    on(root, 'change', '#import-file', (e, inp) => importFile(inp)),
    on(root, 'click', '[data-wipe]', wipe),
    on(root, 'click', '[data-dev-gen]', async () => {
      const t = await import('../dev/testdata.js');
      const r = await t.generateTestData({ weeks: 12 });
      toast(`${r.sessions} Workouts und ${r.bodyweight} Gewichtswerte erzeugt`);
    }),
    on(root, 'click', '[data-dev-del]', async () => {
      const t = await import('../dev/testdata.js');
      const r = await t.removeTestData();
      toast(`${r.sessions} Workouts und ${r.bodyweight} Gewichtswerte gelöscht`);
    }),
    db.subscribe(draw),
  ];
  return () => offs.forEach((f) => f());
}
