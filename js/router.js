// Hash-Router (#/start, #/verlauf/…) – funktioniert auf GitHub Pages ohne Server-Konfiguration.

import { setActiveTab } from './components/tabbar.js';

const routes = [];
const navStack = [];            // besuchte Hashes (fuer Zurueck + Scroll-Position)
const scrollMemory = new Map();
let viewEl = null;
let current = null;
let token = 0;
let replacing = false;

export function defineRoutes(list) {
  list.forEach((r) => {
    const keys = [];
    const re = new RegExp('^' + r.pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ ...r, re, keys });
  });
}

function match(path) {
  for (const r of routes) {
    const m = r.re.exec(path);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { route: r, params };
    }
  }
  return null;
}

export const currentHash = () => location.hash || '#/start';

export function navigate(hash, { replace = false } = {}) {
  if (!hash.startsWith('#')) hash = '#' + hash;
  if (hash === location.hash) { render(); return; }
  if (replace) { replacing = true; location.replace(hash); } else location.hash = hash;
}

export function goBack(fallback = '#/start') {
  if (navStack.length > 1) history.back();
  else navigate(fallback, { replace: true });
}

/** Aktuelle Ansicht neu zeichnen (z. B. nach Datenimport). */
export function rerender() { render({ keepScroll: true }); }

export function startRouter(el) {
  viewEl = el;
  window.addEventListener('hashchange', () => render());
  // Zurueck-Knoepfe ueberall: <button data-back="#/fallback">
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-back]');
    if (b) { e.preventDefault(); goBack(b.dataset.back || '#/start'); }
  });
  render();
}

async function render({ keepScroll = false } = {}) {
  const hash = currentHash();
  const path = hash.slice(1) || '/start';

  let isBack = false;
  if (replacing) {
    replacing = false;
    if (navStack.length) navStack[navStack.length - 1] = hash; else navStack.push(hash);
  } else if (navStack.length > 1 && navStack[navStack.length - 2] === hash) {
    navStack.pop();
    isBack = true;
  } else if (navStack[navStack.length - 1] !== hash) {
    navStack.push(hash);
  }

  const prevScroll = window.scrollY;
  if (current) scrollMemory.set(current.hash, prevScroll);

  const m = match(path) || match('/start');
  try { current && current.cleanup && current.cleanup(); } catch (e) { console.error(e); }
  current = null;

  const my = ++token;
  viewEl.className = 'view';
  viewEl.replaceChildren();
  document.body.classList.toggle('no-tabbar', m.route.tabbar === false);
  if (m.route.tab) setActiveTab(m.route.tab);

  let cleanup = null;
  try {
    cleanup = await m.route.view.render(viewEl, m.params, { isBack });
  } catch (e) {
    console.error(e);
    viewEl.innerHTML = `<div class="placeholder">Diese Ansicht konnte nicht geladen werden.<br><small>${String(e && e.message || e)}</small></div>`;
  }
  if (my !== token) { if (typeof cleanup === 'function') cleanup(); return; }
  current = { hash, cleanup: typeof cleanup === 'function' ? cleanup : null };

  const y = keepScroll ? prevScroll : isBack ? (scrollMemory.get(hash) || 0) : 0;
  window.scrollTo(0, y);
}
