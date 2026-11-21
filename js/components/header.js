// Kopfbereiche: grosse Seitenueberschrift (Tabs) und Kopfleiste fuer Unterseiten.

import { esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';

export function pageHead({ title, subtitle = '', actions = '' }) {
  return `<header class="page-head">
    <div class="grow"><h1 class="title-xl">${esc(title)}</h1>${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}</div>
    ${actions ? `<div class="head-actions">${actions}</div>` : ''}
  </header>`;
}

/** Fuer Unterseiten. root muss die Klasse has-topbar bekommen. */
export function topbar({ title = '', back = '#/start', right = '', backLabel = 'Zurück' }) {
  return `<header class="topbar">
    ${back ? `<button class="icon-btn" data-back="${esc(back)}" aria-label="${esc(backLabel)}">${icon('chevronLeft')}</button>` : '<span></span>'}
    <h1 class="topbar-title">${esc(title)}</h1>
    <div class="topbar-right">${right}</div>
  </header>`;
}
