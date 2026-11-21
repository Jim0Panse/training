// Kleine DOM-Helfer – kein Framework.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Erzeugt ein Element aus HTML (erstes Element). */
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Ereignis-Delegation: handler(event, matchedElement). Gibt eine Abmeldefunktion zurueck. */
export function on(root, type, selector, handler, opts) {
  const fn = (e) => {
    const t = e.target.closest(selector);
    if (t && root.contains(t)) handler(e, t);
  };
  root.addEventListener(type, fn, opts);
  return () => root.removeEventListener(type, fn, opts);
}

export function debounce(fn, ms) {
  let t = null;
  const d = (...args) => { clearTimeout(t); t = setTimeout(() => { t = null; fn(...args); }, ms); };
  d.flush = (...args) => { if (t) { clearTimeout(t); t = null; fn(...args); } };
  d.cancel = () => { clearTimeout(t); t = null; };
  return d;
}

export const uid = () => (crypto.randomUUID
  ? crypto.randomUUID()
  : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));

let toastTimer = null;
export function toast(text, ms = 1800) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

/** Sanfter Wechsel: Klasse kurz setzen (z. B. fuer Hervorhebungen). */
export function flash(node, cls, ms = 700) {
  if (!node) return;
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
  setTimeout(() => node.classList.remove(cls), ms);
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
