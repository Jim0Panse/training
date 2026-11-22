// Hell/Dunkel: 'system' folgt der iPhone-Einstellung, sonst fest.

let pref = 'system';
const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function applyTheme(p) {
  pref = p || 'system';
  try { localStorage.setItem('training-theme', pref); } catch (e) { /* ignorieren */ }
  const dark = pref === 'dark' || (pref === 'system' && !!(mq && mq.matches));
  const root = document.documentElement;
  const next = dark ? 'dark' : 'light';
  if (root.getAttribute('data-theme') !== next) {
    // Beim Umschalten keine Farbuebergaenge (sonst blitzen Flaechen kurz hell auf)
    root.classList.add('theme-switching');
    root.setAttribute('data-theme', next);
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#090B0E' : '#F2F4F7');
}

export function watchSystemTheme() {
  if (!mq) return;
  const fn = () => { if (pref === 'system') applyTheme('system'); };
  if (mq.addEventListener) mq.addEventListener('change', fn); else if (mq.addListener) mq.addListener(fn);
}

export const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
