// Nach links wischen legt eine „Löschen“-Fläche frei (wie in iOS-Listen).
// Aufbau je Zeile: <div class="ROW"><button data-del>…</button><div class="MAIN">…</div></div>

import { clamp } from './dom.js';

/**
 * swipeRows(root, { row, main, del, open, max })
 * row: Selektor der Zeile, main: verschobener Inhalt, del: Loesch-Knopf,
 * open: Breite im geoeffneten Zustand, max: maximale Verschiebung.
 * -> { close(), forget(), destroy() }
 */
export function swipeRows(root, { row: rowSel, main: mainSel, del: delSel = '[data-del]', open = 96, max = 110 } = {}) {
  let swipe = null, openRow = null, swallowClick = false;
  const mainOf = (r) => r.querySelector(mainSel);
  const close = () => {
    if (!openRow) return;
    const m = mainOf(openRow);
    if (m) m.style.transform = '';
    openRow.classList.remove('open');
    openRow = null;
  };

  const onDown = (e) => {
    const r = e.target.closest(rowSel);
    if (openRow && (!r || r !== openRow) && !e.target.closest(delSel)) close();
    if (!r || !root.contains(r) || e.target.closest(delSel)) return;
    swipe = { row: r, x: e.clientX, y: e.clientY, pid: e.pointerId, on: false, base: r === openRow ? -open : 0 };
  };
  const onMove = (e) => {
    if (!swipe || e.pointerId !== swipe.pid) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    if (!swipe.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { swipe = null; return; }
      if (Math.abs(dx) < 10) return;
      swipe.on = true;
      swipe.row.classList.add('swiping');
      try { swipe.row.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
      if (document.activeElement && swipe.row.contains(document.activeElement)) document.activeElement.blur();
    }
    const m = mainOf(swipe.row);
    if (m) m.style.transform = `translateX(${clamp(swipe.base + dx, -max, 0)}px)`;
  };
  const onUp = (e) => {
    if (!swipe || e.pointerId !== swipe.pid) return;
    const s = swipe;
    swipe = null;
    if (!s.on) return;
    s.row.classList.remove('swiping');
    swallowClick = true;
    setTimeout(() => { swallowClick = false; }, 50);
    const m = mainOf(s.row);
    if (!m) return;
    const hit = /translateX\((-?[\d.]+)px\)/.exec(m.style.transform);
    const x = hit ? Number(hit[1]) : 0;
    if (x < -open / 2) {
      if (openRow && openRow !== s.row) close();
      m.style.transform = `translateX(-${open}px)`;
      s.row.classList.add('open');
      openRow = s.row;
    } else {
      m.style.transform = '';
      s.row.classList.remove('open');
      if (openRow === s.row) openRow = null;
    }
  };
  // Nach einem Wisch keinen Klick ausloesen
  const onClickCapture = (e) => { if (swallowClick) { e.stopPropagation(); e.preventDefault(); swallowClick = false; } };

  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp);
  root.addEventListener('pointercancel', onUp);
  root.addEventListener('click', onClickCapture, true);
  return {
    close,
    /** Zeile wurde geloescht/neu gezeichnet: nichts mehr offen */
    forget() { openRow = null; },
    destroy() {
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', onUp);
      root.removeEventListener('click', onClickCapture, true);
    },
  };
}
