// Sortieren per Ziehgriff (Pointer-Events, ohne Bibliothek).
// sortable(listEl, { item, handle, onDrop(from, to) }) -> off()

export function sortable(list, { item = '[data-idx]', handle = '.grip', onDrop }) {
  let d = null;
  const items = () => [...list.querySelectorAll(item)];
  const sibling = (el, dir) => {
    let s = dir < 0 ? el.previousElementSibling : el.nextElementSibling;
    while (s && !s.matches(item)) s = dir < 0 ? s.previousElementSibling : s.nextElementSibling;
    return s;
  };

  function update() {
    if (!d) return;
    const dy = d.lastY - d.startY + (window.scrollY - d.scroll0);
    d.el.style.transform = `translateY(${dy}px)`;
    const r = d.el.getBoundingClientRect();
    const mid = r.top + r.height / 2;
    const next = sibling(d.el, 1), prev = sibling(d.el, -1);
    let moved = false;
    if (next) {
      const nr = next.getBoundingClientRect();
      if (mid > nr.top + nr.height / 2) {
        const before = d.el.offsetTop;
        list.insertBefore(next, d.el);
        d.startY += d.el.offsetTop - before;
        moved = true;
      }
    }
    if (!moved && prev) {
      const pr = prev.getBoundingClientRect();
      if (mid < pr.top + pr.height / 2) {
        const before = d.el.offsetTop;
        list.insertBefore(d.el, prev);
        d.startY += d.el.offsetTop - before;
        moved = true;
      }
    }
    if (moved) d.el.style.transform = `translateY(${d.lastY - d.startY + (window.scrollY - d.scroll0)}px)`;
  }

  function tick() {
    if (!d) return;
    const edge = 90, h = window.innerHeight;
    let v = 0;
    if (d.lastY < edge) v = -Math.ceil((edge - d.lastY) / 7);
    else if (d.lastY > h - edge) v = Math.ceil((d.lastY - (h - edge)) / 7);
    if (v) { window.scrollBy(0, v); update(); }
    d.raf = requestAnimationFrame(tick);
  }

  const onDown = (e) => {
    const h = e.target.closest(handle);
    if (!h || !list.contains(h) || d) return;
    const el = h.closest(item);
    if (!el) return;
    e.preventDefault();
    try { h.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
    d = { el, h, pid: e.pointerId, startY: e.clientY, lastY: e.clientY, scroll0: window.scrollY, from: items().indexOf(el), raf: 0 };
    el.classList.add('dragging');
    list.classList.add('sorting');
    d.raf = requestAnimationFrame(tick);
  };
  const onMove = (e) => {
    if (!d || e.pointerId !== d.pid) return;
    e.preventDefault();
    d.lastY = e.clientY;
    update();
  };
  const onUp = (e) => {
    if (!d || e.pointerId !== d.pid) return;
    const cur = d;
    d = null;
    cancelAnimationFrame(cur.raf);
    cur.el.style.transition = 'transform 160ms ease';
    cur.el.style.transform = '';
    setTimeout(() => {
      cur.el.style.transition = '';
      cur.el.classList.remove('dragging');
      list.classList.remove('sorting');
      const to = items().indexOf(cur.el);
      if (to !== cur.from && onDrop) onDrop(cur.from, to);
    }, 170);
  };

  list.addEventListener('pointerdown', onDown);
  list.addEventListener('pointermove', onMove);
  list.addEventListener('pointerup', onUp);
  list.addEventListener('pointercancel', onUp);
  return () => {
    list.removeEventListener('pointerdown', onDown);
    list.removeEventListener('pointermove', onMove);
    list.removeEventListener('pointerup', onUp);
    list.removeEventListener('pointercancel', onUp);
    if (d) cancelAnimationFrame(d.raf);
  };
}
