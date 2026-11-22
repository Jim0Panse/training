// Koerperfigur vorne + hinten als eigenes SVG. Jede Muskelregion ist eine <g data-muscle="…">
// mit linker und rechter Haelfte. Gezeichnet wird nur die rechte Bildhaelfte (x >= 100),
// die linke entsteht durch Spiegelung an x = 100.
// Proportionen: rund 8 Kopflaengen (Kopf 11–62, Schritt 220, Knie ~312, Sohle ~428).

import { MUSCLE } from '../data/muscles.js';
import { esc } from '../lib/dom.js';

const W = 200;

/** Spiegelt einen Pfad (nur absolute M/L/C/Q/S/T/Z-Befehle) an der Mittelachse. */
function mirrorD(d) {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  const out = [];
  let i = 0;
  for (const t of tokens) {
    if (/[A-Za-z]/.test(t)) { out.push(t); i = 0; continue; }
    let n = Number(t);
    if (i % 2 === 0) n = W - n;
    out.push(Math.round(n * 100) / 100);
    i++;
  }
  return out.join(' ');
}

// Umriss rechte Haelfte: vom Scheitel (100,11) bis zum Schritt (100,220), nur C-Kurven
const OUTLINE_RIGHT = `M100,13
  C109.4,13 115.6,18.6 116.4,27 C117.4,29.4 118.1,32.4 118,36 C117.9,39.6 117,42.6 115.8,44.6
  C114.6,48.6 112.2,52.4 110.6,57.4 C110,61.8 110.5,66 111.5,69 C116.5,73 125.5,75 133,78
  C142,79.5 151.5,84 155,93 C157.5,99.5 158.2,108 157.5,117
  C157,127 158.8,138 157.8,148 C157.2,154 156.5,159 156.3,163
  C157.8,169 160,177 160.2,186 C160.4,198 157.8,210 155.8,219
  C157.4,226 157.8,234 157,242 C156.2,251 153.5,259 149.5,262
  C145.7,260 144,254 144.2,247 C144.3,238 145.4,228 146.5,221
  C145.2,210 143.4,198 143,187 C142.7,178 143.2,171 144.2,166
  C142.6,155 141.2,143 141.6,131 C141.9,121 141.3,112 139.6,106
  C139.3,116 138.6,126 137,135 C134.8,146 131,156 130,167 C129.2,178 131,189 134.2,198
  C136.5,207 137.9,220 137.6,233 C137.3,256 134.3,281 129.6,300
  C128.6,306 128.1,312 128.4,318 C130,327 131.8,338 131.6,348
  C131.3,363 127.6,380 124,394 C123.1,399 122.6,404 122.6,408
  C124.2,413 126.4,418 125.6,423 C122.5,428.5 112.5,428.5 109.6,425.5 C108.4,421 108.8,414 110.2,409
  C108.4,393 105.2,371 104.8,347 C104.6,334 106.6,322 108.4,313
  C108.6,293 105.9,272 104.4,252 C103.3,238 101.8,227 100,220`;

function buildOutline() {
  const nums = OUTLINE_RIGHT.match(/-?\d*\.?\d+/g).map(Number);
  const pts = [];
  for (let i = 0; i < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  const left = pts.map(([x, y]) => [W - x, y]).reverse();
  const all = pts.concat(left.slice(1));
  let d = `M${all[0]}`;
  for (let i = 1; i < all.length; i += 3) d += ` C${all[i]} ${all[i + 1]} ${all[i + 2]}`;
  return d + ' Z';
}
const OUTLINE = buildOutline();

// Gemeinsame Formen (vorne und hinten gleich)
const DELT_SIDE = 'M149.6,86.6 C152.6,89 154.4,93 154.9,98 C155.4,104 155,110.2 153.7,116.4 C153.3,118 152.9,119.2 152.5,119.8 C151.4,108.6 150.5,97.4 149.6,86.6 Z';
const FOREARM = 'M145.4,168.6 C149.6,165.6 155,166 157.6,170.6 C159,179.2 158.8,190 157.2,200.4 C156,207.4 154.7,212.4 153.4,215.4 C151.3,216.9 149.3,216.9 147.8,215.4 C145.9,201.6 144.9,184.6 145.4,168.6 Z';

const FRONT = [
  { id: 'brust', d: ['M101.6,81.5 C110.5,79.6 122,79.8 131.5,82.6 C134.4,89 136.4,96.5 137.2,103.5 C132.6,113.4 123.5,121.5 112.8,123.2 C108,123.8 104,123 101.6,121.5 Z'] },
  { id: 'schulter_vorne', d: ['M134.2,82 C139.8,80.9 144.4,81.8 147.2,84.8 C148.4,95.8 149.6,107.4 151,119.4 C146.5,114.4 142.2,107.6 139.5,100.4 C137.7,94.3 136.2,88 134.2,82 Z'] },
  { id: 'schulter_seite', d: [DELT_SIDE] },
  { id: 'bizeps', d: ['M143.8,124.8 C147,121.2 152.2,122.4 154.6,128 C156.3,137.4 156.5,148.2 155,157.4 C152.4,161.8 148.3,162.2 146,158.8 C143.5,148.4 142.8,135.6 143.8,124.8 Z'] },
  { id: 'unterarme', d: [FOREARM] },
  // Gerader Bauchmuskel: oben die ersten zwei Reihen, unten die dritte Reihe und der Teil unter dem Nabel
  {
    id: 'bauch_oben', d: [
      'M101.8,127 C105.5,125.4 109.8,125.6 112.6,127.4 C113.2,132.2 113.3,137.2 113,141.8 C109.4,143 105.5,143.3 101.8,143 Z',
      'M101.8,146.4 C105.4,146.6 109.3,146.3 113,145.3 C113.5,150.6 113.6,155.8 113.3,161 C109.6,162 105.6,162.3 101.8,162.1 Z',
    ],
  },
  {
    id: 'bauch_unten', d: [
      'M101.8,165.4 C105.6,165.6 109.5,165.3 113.2,164.4 C113.6,170 113.4,175.6 112.8,181 C109.3,181.8 105.5,182.1 101.8,182 Z',
      'M101.8,188.6 C105.5,188.6 109.2,188.2 112.6,187.4 C112.6,197 110.2,206 103.8,213.6 C103,214.2 102.2,213.8 101.8,212.8 Z',
    ],
  },
  { id: 'seitl_bauch', d: ['M116,129.4 C122.6,128.8 129.4,131.6 134.6,136 C133,146 130.2,156.2 128.6,166.4 C128.1,175.4 129,184 130.6,191.2 C126.8,197.4 121.8,202.8 116.8,207.6 C117,190 117.1,170 116.9,150 C116.7,141 116.4,134.4 116,129.4 Z'] },
  { id: 'quadrizeps', d: ['M114.6,218.4 C120.6,212.6 128.8,206.6 133.6,202.4 C136.2,214.4 136.5,232 135.6,250 C134.6,267.6 132,283.6 128.2,296.4 C126.2,302.4 122.4,305.6 118.4,305.2 C114,305.6 110.6,303 109,298.6 C107.6,288.4 107.9,279 109.2,268.4 C110.6,256.4 112.6,240.2 114.6,218.4 Z'] },
  { id: 'adduktoren', d: ['M102.6,226 C106,222.6 109.6,221.2 112.4,221.6 C111.8,236 110.6,252 108.2,270.4 C107,262 106,254 105.2,247 C104.4,239.6 103.5,232.6 102.6,226 Z'] },
  {
    id: 'waden', d: [
      'M107.4,327 C109.8,329.2 110.8,335.2 110.8,343 C110.8,357 109.8,371 108.6,384 C106.9,378 106.2,365 106.3,353 C106.4,343 106.7,334 107.4,327 Z',
      'M125.2,324 C128.6,330 130,340 129.8,351 C129.4,364 127,377 124.4,388 C123.6,376 123.4,361 123.8,348 C124,339 124.5,331 125.2,324 Z',
    ],
  },
];
const FRONT_SEPS = [
  'M108.8,58.6 C107.6,64.6 105.6,70.6 102.6,76.8',                     // Halsmuskel
  'M133.4,110.6 C134.8,112.2 135.8,114 136.4,115.8',                    // Saegemuskel
  'M132.2,116.6 C133.8,118.2 135,120.2 135.7,122.4',
  'M131,122.6 C132.6,124.2 133.8,126.2 134.6,128.4',
  'M100,182.6 C101.2,182.6 101.8,183.8 101.8,184.8 C101.8,185.8 101.1,187 100,187', // Bauchnabel
  'M127.4,222 C128.4,246 126.4,272 121.4,298',                          // Quadrizeps aussen / Mitte
  'M109.6,284 C113.6,290 116.6,297 117.6,303.2',                        // Quadrizeps innen (Tropfen)
  'M114.4,311.2 C115.4,308.8 117,307.8 118.6,307.8 C120.2,307.8 121.8,308.8 122.8,311.2', // Kniescheibe oben
  'M115.2,316 C116.6,317.6 120.6,317.6 122.2,316',                      // Kniescheibe unten
  'M117.2,322 C118,348 117.4,374 116.2,398',                            // Schienbein
  'M146.4,226 C147.8,232 148.2,239 147.2,246',                          // Daumen
  'M152.4,170.4 C150.8,182 150,195 150.6,208',                          // Unterarm
];

const BACK = [
  {
    id: 'trapez', d: [
      'M101.6,58.5 C104.4,64.6 108.4,69.6 114.2,73 C121.6,76.8 128.6,78.6 134.4,80.8 C131,86 126.8,92.4 123.4,99 C117.6,110.4 110.6,124.8 102.4,141.6 C101.8,119 101.6,88 101.6,58.5 Z',
      'M127.6,97.6 C131.4,95.8 135.4,96.6 137.8,100 C139,105.2 138.4,110.8 136,115.4 C132.6,118.8 128.2,118.8 125.2,116 C123.8,110.4 124.6,103 127.6,97.6 Z',
    ],
  },
  { id: 'schulter_hinten', d: ['M136.6,83.4 C141.4,82 145.4,82.6 147.8,85.2 C149,96 150.2,107.6 151.4,119.4 C146.8,114.6 142.6,108 140.2,101 C138.6,95.4 137.4,89.4 136.6,83.4 Z'] },
  { id: 'schulter_seite', d: [DELT_SIDE] },
  { id: 'trizeps', d: ['M143.6,123.6 C147.4,120.2 152.6,121.6 154.8,127.4 C156.6,137.2 156.7,148.4 155.2,157.6 C152.6,162 148.2,162.4 145.8,159 C143.2,148.6 142.6,135 143.6,123.6 Z'] },
  { id: 'unterarme', d: [FOREARM] },
  { id: 'latissimus', d: ['M114.4,147.6 C119.2,132.6 125.2,120.4 131.6,110.4 C134.4,111.2 136.4,113 137.4,115.6 C137.4,126 135.6,140 132.2,151.6 C129.4,161.6 123,174.6 114,182.4 C113.4,170.6 113.6,159 114.4,147.6 Z'] },
  { id: 'unterer_ruecken', d: ['M102.4,148.6 C106.4,147.8 110.2,150 111,155.6 C111.8,170.6 111.8,186.4 110.8,200.4 C108.8,204.8 104.8,205.8 102.4,204.4 C101.8,185.6 101.8,166.6 102.4,148.6 Z'] },
  { id: 'gesaess', d: ['M102.2,209.6 C112,204.8 125.4,206 132.6,213.6 C135.4,224.4 135.4,238 131.6,248.2 C125.2,256.8 112.2,257.8 102.4,251.4 C101.6,238 101.6,221.4 102.2,209.6 Z'] },
  { id: 'beinbeuger', d: ['M107.8,262.8 C114.8,259.4 125.2,259.2 132.4,263.2 C133.6,276.4 132.4,291.6 127.8,303.6 C125,309.8 121.4,312.8 118.6,313 C115.8,312.8 113.2,310.4 111.4,306.6 C108.6,293.8 107.4,277.4 107.8,262.8 Z'] },
  { id: 'waden', d: ['M107.8,327 C112.8,322.4 122.4,322.4 128,327.6 C130.6,338.4 130.2,353 126.6,366 C123.4,377 119.6,385 116.6,389 C112.6,384 107.8,371 106.6,358 C105.8,346 106.2,334.6 107.8,327 Z'] },
];
const BACK_SEPS = [
  'M150.4,126 C151.8,137 152,148 150.6,158',      // Trizeps-Koepfe
  'M117.6,265 C118,280 117.6,296 116.6,309',      // Beinbeuger
  'M111.8,315.6 C116,317.6 121.4,317.6 126,315.6', // Kniekehle
  'M116.4,329 C116.8,345 116.4,362 115.2,378',    // Wade (zwei Koepfe)
  'M116.4,392 C116.6,398 116.8,403 116.8,408',    // Achillessehne
];

function prepare(list) {
  return list.map((m) => ({ id: m.id, paths: m.d.flatMap((p) => [p, mirrorD(p)]) }));
}
const VIEWS = {
  front: { muscles: prepare(FRONT), seps: FRONT_SEPS.flatMap((p) => [p, mirrorD(p)]), label: 'Vorne' },
  back: { muscles: prepare(BACK), seps: BACK_SEPS.flatMap((p) => [p, mirrorD(p)]), label: 'Hinten' },
};

// Verlaeufe fuer die Plastik (einmal pro Dokument, Farben kommen aus dem CSS):
// Haut hell in der Brustmitte, dunkler nach aussen; jeder Muskel als Woelbung mit Glanz oben
// und Schatten am Rand; weicher Bodenschatten unter den Fuessen.
let defsReady = false;
function ensureDefs() {
  if (defsReady || typeof document === 'undefined' || !document.body) return;
  defsReady = true;
  document.body.insertAdjacentHTML('beforeend', `<svg class="body-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
    <radialGradient id="bf-skin" cx=".5" cy=".28" r=".8"><stop offset="0" class="bf-skin-hi"/><stop offset="1" class="bf-skin-lo"/></radialGradient>
    <radialGradient id="bf-dome" cx=".5" cy=".42" r=".66" fx=".5" fy=".18">
      <stop offset="0" stop-color="#fff" class="bf-dome-hi"/>
      <stop offset=".5" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".8" stop-color="#000" class="bf-dome-mid"/>
      <stop offset="1" stop-color="#000" class="bf-dome-lo"/>
    </radialGradient>
    <radialGradient id="bf-floor"><stop offset="0" stop-color="#000" class="bf-floor-c"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  </defs></svg>`);
}

/**
 * Ein SVG fuer eine Ansicht. classes: { muscleId: 'l1' | 'tired' | 'pri' … }
 * hit: unsichtbar vergroesserte Tippflaechen (liegen unter den Muskeln, schlucken also nur Tipps daneben).
 */
export function figureSVG(view, classes = {}, { hit = false } = {}) {
  ensureDefs();
  const v = VIEWS[view];
  const paths = (m, cls = '') => m.paths.map((p) => `<path${cls ? ` class="${cls}"` : ''} d="${p}"/>`).join('');
  return `<svg class="body-fig" viewBox="26 6 148 426" role="img" aria-label="Körper ${v.label.toLowerCase()}">
    <ellipse class="floor" cx="100" cy="428.6" rx="38" ry="3.4"/>
    <path class="silhouette" d="${OUTLINE}"/>
    ${hit ? `<g class="hits">${v.muscles.map((m) => `<g class="hit" data-muscle="${m.id}">${paths(m)}</g>`).join('')}</g>` : ''}
    ${v.muscles.map((m) => `<g class="m ${classes[m.id] || ''}" data-muscle="${m.id}"><title>${esc(MUSCLE[m.id].name)}</title>${paths(m)}${paths(m, 'sh')}</g>`).join('')}
    <g class="seps">${v.seps.map((p) => `<path d="${p}"/>`).join('')}</g>
    <path class="rim" d="${OUTLINE}"/>
  </svg>`;
}

/** Vorder- und Rueckansicht nebeneinander. */
export function bodyMapHTML({ classes = {}, labels = true, cls = '', views = ['front', 'back'], hit = false } = {}) {
  return `<div class="body-map ${cls}">${views.map((v) => `<figure>${figureSVG(v, classes, { hit })}${labels ? `<figcaption>${VIEWS[v].label}</figcaption>` : ''}</figure>`).join('')}</div>`;
}

/** Faerbt eine bestehende Figur neu, ohne sie neu aufzubauen. */
export function applyClasses(root, classes = {}) {
  root.querySelectorAll('.m[data-muscle]').forEach((g) => {
    g.setAttribute('class', `m ${classes[g.dataset.muscle] || ''}`);
  });
}

// ---------- Farbstufen ----------
/** Woche: 0 / 1–5 / 6–10 / 11–15 / 16+ effektive Saetze */
export function weekLevel(sets) {
  if (!sets || sets <= 0) return '';
  if (sets < 6) return 'l1';
  if (sets < 11) return 'l2';
  if (sets < 16) return 'l3';
  return 'l4';
}
export function weekClasses(setsByMuscle) {
  const c = {};
  Object.entries(setsByMuscle || {}).forEach(([id, s]) => { c[id] = weekLevel(s); });
  return c;
}
export const RECOVERY_CLASS = { tired: 'tired', almost: 'almost', fresh: 'fresh', none: '' };

export function legendWeek() {
  const items = [['', '0'], ['l1', '1–5'], ['l2', '6–10'], ['l3', '11–15'], ['l4', '16+']];
  return `<div class="legend" aria-label="Legende: Sätze pro Woche">
    ${items.map(([c, t]) => `<span class="pill"><i class="sw ${c}"></i>${t}</span>`).join('')}
  </div>`;
}
export function legendRecovery() {
  const items = [['tired', 'Ermüdet'], ['almost', 'Fast erholt'], ['fresh', 'Erholt']];
  return `<div class="legend" aria-label="Legende: Erholung">
    ${items.map(([c, t]) => `<span class="pill"><i class="sw ${c}"></i>${t}</span>`).join('')}
  </div>`;
}
export function legendSelect() {
  return `<div class="legend"><span class="pill"><i class="sw pri"></i>Hauptmuskel</span><span class="pill"><i class="sw sec"></i>Nebenmuskel</span></div>`;
}
