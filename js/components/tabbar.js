// Tab-Leiste unten: Start · Verlauf · Statistik · Uebungen

import { icon } from '../lib/icons.js';

export const TABS = [
  { id: 'start', label: 'Start', href: '#/start', icon: 'grid' },
  { id: 'verlauf', label: 'Verlauf', href: '#/verlauf', icon: 'calendar' },
  { id: 'statistik', label: 'Statistik', href: '#/statistik', icon: 'chart' },
  { id: 'uebungen', label: 'Übungen', href: '#/uebungen', icon: 'dumbbell' },
];

export function renderTabbar(nav) {
  nav.innerHTML = TABS.map((t) =>
    `<a class="tab" href="${t.href}" data-tab="${t.id}" aria-label="${t.label}">${icon(t.icon)}<span>${t.label}</span></a>`).join('');
  nav.addEventListener('click', (e) => {
    const a = e.target.closest('.tab');
    if (!a) return;
    // Erneutes Tippen auf den aktiven Tab: nach oben scrollen
    if (location.hash === a.getAttribute('href')) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

export function setActiveTab(id) {
  document.querySelectorAll('.tab').forEach((t) => {
    const on = t.dataset.tab === id;
    t.classList.toggle('on', on);
    if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  });
}
