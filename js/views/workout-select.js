// Workout auswaehlen: Vorlagen als Karten (Tipp startet sofort), „…“/langes Druecken -> Menue.

import * as db from '../db.js';
import { topbar } from '../components/header.js';
import { actionSheet, confirmSheet } from '../components/sheet.js';
import { MUSCLE_SHORT } from '../data/muscles.js';
import { startWorkout, lastSessionOfTemplate } from '../lib/workout.js';
import { fmtRelDay, fmtClock } from '../lib/format.js';
import { on, esc, uid, toast } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { navigate } from '../router.js';

function muscleChips(t) {
  const names = [];
  t.items.forEach((it) => {
    const ex = db.exercise(it.exerciseId);
    if (!ex) return;
    ex.primary.forEach((m) => { const n = MUSCLE_SHORT[m]; if (n && !names.includes(n)) names.push(n); });
  });
  const shown = names.slice(0, 5);
  return shown.map((n) => `<span class="chip-sm">${esc(n)}</span>`).join('') + (names.length > 5 ? `<span class="chip-sm">+${names.length - 5}</span>` : '');
}

function card(t) {
  const last = lastSessionOfTemplate(t.id);
  const n = t.items.length;
  return `<div class="card card-tap tpl-pick" data-start="${esc(t.id)}" role="button" tabindex="0">
    <div class="row-flex">
      <div class="grow">
        <div class="card-title">${esc(t.name)}</div>
        <div class="card-sub">${n} ${n === 1 ? 'Übung' : 'Übungen'} · ${last ? `zuletzt ${fmtRelDay(new Date(last.startedAt))}` : 'noch nie trainiert'}</div>
      </div>
      <button class="icon-btn plain" data-menu="${esc(t.id)}" aria-label="Optionen für ${esc(t.name)}">${icon('more')}</button>
    </div>
    ${n ? `<div class="chips mt-12">${muscleChips(t)}</div>` : ''}
  </div>`;
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
        { label: 'Bearbeiten', value: 'edit', icon: 'pencil' },
        { label: 'Duplizieren', value: 'dup', icon: 'layers' },
        { label: 'Löschen', value: 'del', icon: 'trash', danger: true },
      ],
    });
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
