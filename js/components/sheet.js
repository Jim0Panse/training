// Bottom-Sheets: fahren von unten hoch, schliessen per Wischen nach unten oder Tipp daneben.

import { el, esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';

let kbBound = false;
function bindKeyboard() {
  // iOS: Tastatur verkleinert nur den sichtbaren Bereich -> Sheet darueber schieben
  if (kbBound || !window.visualViewport) return;
  kbBound = true;
  const vv = window.visualViewport;
  const upd = () => {
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--kb', (kb > 80 ? Math.round(kb) : 0) + 'px');
  };
  vv.addEventListener('resize', upd);
  vv.addEventListener('scroll', upd);
}

const open = [];
export const sheetOpen = () => open.length > 0;
export function closeAllSheets() { [...open].forEach((s) => s.close()); }

/**
 * openSheet({ title, body, full, cls, headRight, onClose }) -> { el, body, close(result) }
 * body: HTML-String oder Element
 */
export function openSheet({ title = '', body = '', full = false, cls = '', headRight = '', onClose } = {}) {
  bindKeyboard();
  const host = document.getElementById('sheets');
  const wrap = el(`<div class="sheet-wrap">
    <div class="sheet-backdrop"></div>
    <section class="sheet ${full ? 'full' : ''} ${cls}" role="dialog" aria-modal="true"${title ? ` aria-label="${esc(title)}"` : ''}>
      <div class="sheet-grab" aria-hidden="true"><span></span></div>
      ${title ? `<header class="sheet-head"><h2>${esc(title)}</h2>${headRight}</header>` : ''}
      <div class="sheet-body"></div>
    </section>
  </div>`);
  const sheet = wrap.querySelector('.sheet');
  const bodyEl = wrap.querySelector('.sheet-body');
  if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.append(body);
  host.append(wrap);
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));

  let closed = false;
  const api = {
    el: sheet, body: bodyEl, wrap,
    get closed() { return closed; },
    close(result) {
      if (closed) return;
      closed = true;
      if (document.activeElement && sheet.contains(document.activeElement)) document.activeElement.blur();
      wrap.classList.remove('open');
      sheet.style.transform = '';
      const i = open.indexOf(api);
      if (i >= 0) open.splice(i, 1);
      setTimeout(() => {
        wrap.remove();
        if (!open.length) document.body.classList.remove('sheet-open');
        if (onClose) onClose(result);
      }, 300);
    },
  };
  wrap.querySelector('.sheet-backdrop').addEventListener('click', () => api.close());
  enableDrag(sheet, bodyEl, () => api.close());
  open.push(api);
  return api;
}

function enableDrag(sheet, bodyEl, close) {
  let startY = 0, dy = 0, dragging = false, lastY = 0, lastT = 0, vel = 0;
  const start = (y) => { startY = y; dy = 0; lastY = y; lastT = performance.now(); vel = 0; dragging = true; sheet.classList.add('dragging'); };
  const move = (y) => {
    if (!dragging) return;
    dy = Math.max(0, y - startY);
    const now = performance.now();
    vel = (y - lastY) / Math.max(1, now - lastT);
    lastY = y; lastT = now;
    sheet.style.transform = `translateY(${dy}px)`;
  };
  const end = () => {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove('dragging');
    if (dy > 110 || (vel > 0.55 && dy > 20)) close();
    else sheet.style.transform = '';
  };

  // Griff und Kopfzeile: immer ziehbar
  sheet.querySelectorAll('.sheet-grab, .sheet-head').forEach((h) => {
    let pid = null;
    h.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button, a, input, select, textarea')) return;
      pid = e.pointerId;
      try { h.setPointerCapture(pid); } catch (err) { /* egal */ }
      start(e.clientY);
    });
    h.addEventListener('pointermove', (e) => { if (e.pointerId === pid) move(e.clientY); });
    const up = (e) => { if (e.pointerId === pid) { pid = null; end(); } };
    h.addEventListener('pointerup', up);
    h.addEventListener('pointercancel', up);
  });

  // Inhalt: nur wenn ganz oben und nach unten gezogen wird
  let ty = null, bodyDrag = false;
  bodyEl.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || e.target.closest('.no-sheet-drag, input, textarea, select')) { ty = null; return; }
    ty = e.touches[0].clientY;
    bodyDrag = false;
  }, { passive: true });
  bodyEl.addEventListener('touchmove', (e) => {
    if (ty == null) return;
    const y = e.touches[0].clientY;
    if (!bodyDrag) {
      if (bodyEl.scrollTop <= 0 && y - ty > 6) { bodyDrag = true; start(ty); }
      else if (y - ty < -2 || bodyEl.scrollTop > 0) { ty = null; return; }
    }
    if (bodyDrag) { e.preventDefault(); move(y); }
  }, { passive: false });
  const tEnd = () => { if (bodyDrag) end(); ty = null; bodyDrag = false; };
  bodyEl.addEventListener('touchend', tEnd);
  bodyEl.addEventListener('touchcancel', tEnd);
}

/** Bestaetigung: resolves true/false. cancel: null -> nur ein Knopf (Hinweis) */
export function confirmSheet({ title, message = '', confirm = 'OK', cancel = 'Abbrechen', danger = false }) {
  return new Promise((resolve) => {
    const s = openSheet({
      body: `<div class="confirm">
        <h2>${esc(title)}</h2>
        ${message ? `<p>${esc(message)}</p>` : ''}
        <div class="stack-sm">
          <button class="btn ${danger ? 'btn-danger' : ''}" data-r="1">${esc(confirm)}</button>
          ${cancel ? `<button class="btn btn-secondary" data-r="0">${esc(cancel)}</button>` : ''}
        </div></div>`,
      onClose: (r) => resolve(r === true),
    });
    s.body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]');
      if (b) s.close(b.dataset.r === '1');
    });
  });
}

/** Auswahlmenue: actions [{label, value, icon, danger}] -> resolves value | null */
export function actionSheet({ title = '', actions }) {
  return new Promise((resolve) => {
    const s = openSheet({
      body: `${title ? `<p class="action-title">${esc(title)}</p>` : ''}
        <div class="list action-list">
          ${actions.map((a, i) => `<button class="row ${a.danger ? 'danger' : ''}" data-i="${i}">${a.icon ? icon(a.icon) : ''}<span>${esc(a.label)}</span></button>`).join('')}
        </div>
        <button class="btn btn-secondary mt-12" data-i="-1">Abbrechen</button>`,
      onClose: (r) => resolve(r === undefined ? null : r),
    });
    s.body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const i = Number(b.dataset.i);
      s.close(i >= 0 ? actions[i].value : null);
    });
  });
}
