// Workout auswaehlen: Vorlagen als Karten (Tipp startet sofort), „…“/langes Druecken -> Menue.
// Rahmenfarbe nach Art (Ober-/Unterkoerper, automatisch aus den Uebungen), darunter eine kurze Notiz.

import * as db from '../db.js';
import { topbar } from '../components/header.js';
import { actionSheet, confirmSheet, openSheet } from '../components/sheet.js';
import { startWorkout, lastSessionOfTemplate, templateKind, KIND_LABEL } from '../lib/workout.js';
import { fmtRelDay, fmtClock } from '../lib/format.js';
import { on, esc, uid, toast } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { navigate } from '../router.js';

function card(t) {
  const last = lastSessionOfTemplate(t.id);
  const n = t.items.length;
  const kind = templateKind(t);
  return `<div class="card card-tap tpl-pick ${kind ? `kind-${kind}` : ''}" data-start="${esc(t.id)}" role="button" tabindex="0">
    <div class="row-flex">
      <div class="grow">
        <div class="tpl-head">
          <span class="card-title">${esc(t.name)}</span>
          ${kind ? `<span class="kind-tag"><i></i>${KIND_LABEL[kind]}</span>` : ''}
        </div>
        <div class="card-sub">${n} ${n === 1 ? 'Übung' : 'Übungen'} · ${last ? `zuletzt ${fmtRelDay(new Date(last.startedAt))}` : 'noch nie trainiert'}</div>
      </div>
      <button class="icon-btn plain" data-menu="${esc(t.id)}" aria-label="Optionen für ${esc(t.name)}">${icon('more')}</button>
    </div>
    ${t.cardNote ? `<p class="tpl-note">${esc(t.cardNote)}</p>` : ''}
  </div>`;
}

/** Kurze Notiz fuer die Karte bearbeiten -> neuer Text ('' = entfernen) oder null (abgebrochen) */
function noteSheet(t) {
  return new Promise((resolve) => {
    const s = openSheet({
      title: 'Notiz',
      body: `<input class="input" id="card-note" type="text" maxlength="80" autocomplete="off" enterkeyhint="done" placeholder="z. B. Fokus: Beinpresse steigern" value="${esc(t.cardNote || '')}" aria-label="Notiz zu ${esc(t.name)}">
        <p class="field-hint mt-8">Steht klein auf der Karte von „${esc(t.name)}“. Leer lassen zum Entfernen.</p>
        <div class="btn-row mt-16">
          <button class="btn btn-secondary" type="button" data-r="cancel">Abbrechen</button>
          <button class="btn" type="button" data-r="save">Speichern</button>
        </div>`,
      onClose: (r) => resolve(typeof r === 'string' ? r : null),
    });
    const inp = s.body.querySelector('#card-note');
    const done = () => s.close(inp.value.trim().replace(/\s+/g, ' '));
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(); } });
    s.body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]');
      if (!b) return;
      if (b.dataset.r === 'save') done(); else s.close(null);
    });
  });
}

export function render(root) {
  root.classList.add('has-topbar');
  let timer = null;

  const draw = () => {
    const active = db.activeSession();
    root.innerHTML = `
      ${topbar({ title: 'Workout starten', back: '#/start' })}
      ${active ? `<button class="banner mb-12" data-resume>${icon('play')}<span class="grow">Workout läuft · <span class="num" data-clock>${fmtClock(Date.now() - new Date(active.startedAt))}</span><span class="banner-sub">${esc(active.name)}</span></span><span class="banner-action">Fortsetzen</span></button>` : ''}
      ${db.state.templates.length
        ? `<div class="stack">${db.state.templates.map(card).join('')}</div>`
        : '<div class="card empty"><strong>Noch keine Workouts</strong>Lege dein erstes Workout an oder starte frei.</div>'}
      <div class="stack mt-16">
        <a class="btn btn-card" href="#/vorlage/neu">${icon('plus')}Neues Workout</a>
        <button class="btn btn-secondary" data-free>${icon('bolt')}Freies Workout</button>
      </div>
      <p class="small muted center mt-12">Tippen startet sofort. Gedrückt halten oder ⋯ zum Bearbeiten.</p>`;
    clearInterval(timer);
    if (active) {
      timer = setInterval(() => {
        const c = root.querySelector('[data-clock]');
        if (c) c.textContent = fmtClock(Date.now() - new Date(active.startedAt));
      }, 1000);
    }
  };

  async function start(t) {
    const active = db.activeSession();
    if (active) {
      const ok = await confirmSheet({ title: 'Es läuft bereits ein Workout', message: `„${active.name}“ ist noch nicht beendet. Setze es fort oder beende es zuerst.`, confirm: 'Fortsetzen' });
      if (ok) navigate('#/workout');
      return;
    }
    await startWorkout(t);
  }

  async function menu(id) {
    const t = db.template(id);
    if (!t) return;
    const v = await actionSheet({
      title: t.name,
      actions: [
        { label: t.cardNote ? 'Notiz ändern' : 'Notiz hinzufügen', value: 'note', icon: 'note' },
        { label: 'Bearbeiten', value: 'edit', icon: 'pencil' },
        { label: 'Duplizieren', value: 'dup', icon: 'layers' },
        { label: 'Löschen', value: 'del', icon: 'trash', danger: true },
      ],
    });
    if (v === 'note') {
      const txt = await noteSheet(t);
      if (txt != null && txt !== (t.cardNote || '')) {
        await db.putTemplate({ ...db.template(t.id), cardNote: txt });
        toast(txt ? 'Notiz gespeichert' : 'Notiz entfernt');
      }
    }
    if (v === 'edit') navigate(`#/vorlage/${t.id}`);
    if (v === 'dup') {
      const order = Math.max(-1, ...db.state.templates.map((x) => x.order ?? 0)) + 1;
      const copy = { ...JSON.parse(JSON.stringify(t)), id: uid(), name: `${t.name} (Kopie)`, builtIn: false, order };
      await db.putTemplate(copy);
      toast('Dupliziert');
    }
    if (v === 'del') {
      const ok = await confirmSheet({ title: `„${t.name}“ löschen?`, message: 'Deine bisherigen Workouts bleiben im Verlauf erhalten.', confirm: 'Löschen', danger: true });
      if (ok) { await db.deleteTemplate(t.id); toast('Gelöscht'); }
    }
  }

  // Langes Druecken auf eine Karte oeffnet das Menue
  let press = null, suppressClick = false;
  const onDown = (e) => {
    const c = e.target.closest('[data-start]');
    if (!c || e.target.closest('[data-menu]')) return;
    press = { x: e.clientX, y: e.clientY, t: setTimeout(() => { press = null; suppressClick = true; menu(c.dataset.start); }, 520) };
  };
  const cancelPress = (e) => {
    if (!press) return;
    if (e.type === 'pointermove' && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 10) return;
    clearTimeout(press.t); press = null;
  };
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', cancelPress);
  root.addEventListener('pointerup', cancelPress);
  root.addEventListener('pointercancel', cancelPress);
  const noMenu = (e) => { if (e.target.closest('[data-start]')) e.preventDefault(); };
  root.addEventListener('contextmenu', noMenu);

  draw();
  const offs = [
    on(root, 'click', '[data-menu]', (e, b) => { e.stopPropagation(); menu(b.dataset.menu); }),
    on(root, 'click', '[data-start]', (e, c) => {
      if (suppressClick) { suppressClick = false; return; }
      if (e.target.closest('[data-menu]')) return;
      const t = db.template(c.dataset.start);
      if (t) start(t);
    }),
    on(root, 'keydown', '[data-start]', (e, c) => { if (e.key === 'Enter') { const t = db.template(c.dataset.start); if (t) start(t); } }),
    on(root, 'click', '[data-free]', () => start(null)),
    on(root, 'click', '[data-resume]', () => navigate('#/workout')),
    db.subscribe(draw),
  ];
  return () => {
    offs.forEach((f) => f());
    clearInterval(timer);
    root.removeEventListener('pointerdown', onDown);
    root.removeEventListener('pointermove', cancelPress);
    root.removeEventListener('pointerup', cancelPress);
    root.removeEventListener('pointercancel', cancelPress);
    root.removeEventListener('contextmenu', noMenu);
  };
}
