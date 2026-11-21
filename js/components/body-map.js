// Koerperfigur vorne + hinten als eigenes SVG. Jede Muskelregion ist eine <g data-muscle="…">
// mit linker und rechter Haelfte. Gezeichnet wird nur die rechte Bildhaelfte (x >= 100),
// die linke entsteht durch Spiegelung an x = 100.

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

// Umriss rechte Haelfte: von Scheitel (100,11) bis Schritt (100,240), nur C-Kurven
const OUTLINE_RIGHT = `M100,11
  C109,11 115.5,19 115.5,30 C115.5,40 111.8,48 108,51.5 C108.6,54 109.2,56 110,58.5
  C113,62 122,66 133,68 C147,69.5 158.5,78 159,95 C159.8,112 161.2,134 161.5,152
  C161.5,160 162,165 163,170 C167,186 168,206 166,226 C165.5,232 165.5,236 165.5,240
  C169,248 170.5,258 168.5,268 C166.5,276 160,279 157,273 C154.5,266 153,254 154,243
  C152,226 148,206 146,190 C145.5,182 145,176 145,172 C143,158 141,138 140,124
  C139.5,117 139,112 138,108 C139.5,126 138.5,144 134,160 C131,171 128,181 128,192
  C128.5,202 132,210 133.5,222 C136,250 132.5,280 127.5,306 C125.5,316 124.5,323 124.5,330
  C127.5,344 127.5,362 123.5,380 C121.5,392 118.5,402 117.5,410 C121.5,414 124.5,420 122.5,424
  C116.5,427.5 108,427.5 104.5,424 C103.5,418 104,413 105,410 C104,396 103.5,376 103.5,360
  C103.5,346 104.5,336 105,330 C105,312 104,290 103,270 C102,256 101,246 100,240`;

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
const DELT_SIDE = 'M152.4,77.4 C156,81 157.6,88 157.6,97 C157.6,105.5 155.6,112 153.2,117 C152.4,104 151.9,90 152.4,77.4 Z';
const FOREARM = 'M147,174 C152.5,171.5 159,172.5 163.5,176.5 C166,190 165.5,210 163,233 C160.5,236 157.5,236 155.5,233.5 C153,215 149,193 147,174 Z';

const FRONT = [
  { id: 'brust', d: ['M101.5,74 C112,71 125,70 134,72.5 C138.5,82 140.5,94 140,104 C134,114.5 120,121 104,121.5 C101.5,118 101.5,90 101.5,74 Z'] },
  { id: 'schulter_vorne', d: ['M137.2,71 C142.5,69.2 148,71 150.8,75.5 C150,89 150.6,103 151.6,117 C147,112.5 143.4,108 142.6,103 C142.6,92 140.6,80 137.2,71 Z'] },
  { id: 'schulter_seite', d: [DELT_SIDE] },
  { id: 'bizeps', d: ['M142,113 C146,111 151,115 154.5,122 C157.5,136 158,151 155.5,163 C152.5,167 148.5,167 146.5,163.5 C143.5,150 141.5,130 142,113 Z'] },
  { id: 'unterarme', d: [FOREARM] },
  {
    id: 'bauch', d: [
      'M101.5,125.5 C106,124 110.5,124.5 113,126.5 C113.5,131 113.5,136 113,140.5 C109,141.8 105,142 101.5,141.5 Z',
      'M101.5,144.5 C105,144.8 109,144.6 113,143.6 C113.5,149 113.5,154 113,159 C109,160 105,160.3 101.5,160 Z',
      'M101.5,163 C105,163.3 109,163.1 113,162.2 C113.5,168 113.3,174 112.6,179.5 C109,180.4 105,180.6 101.5,180.5 Z',
      'M101.5,183.5 C105,183.7 108.8,183.5 112.4,182.8 C112.4,194 110,204 103.5,212 C102.5,212.5 101.8,212 101.5,211 Z',
    ],
  },
  { id: 'seitl_bauch', d: ['M116.2,128 C123,129.5 129.5,133 134.2,138.5 C133.2,154 130.6,170 127,186 C124.3,195 120.3,203 115.8,209 C116.5,192 116.8,170 116.6,150 C116.5,140 116.3,133 116.2,128 Z'] },
  { id: 'quadrizeps', d: ['M110.5,216 C117.5,211.5 125.5,210.5 130.5,213.5 C134,232 133.5,262 129.2,290 C127.3,301.5 124,310.5 120,315.5 C116.3,318 111.5,317.5 108.2,314.3 C105.2,304 104.8,291 106.4,280 C108.6,258 110.6,237 110.5,216 Z'] },
  { id: 'adduktoren', d: ['M101.8,240 C104.2,230 106.5,222 108.6,216.5 C109,236 107.8,258 105.4,278 C103.8,268 102.3,254 101.8,240 Z'] },
  {
    id: 'waden', d: [
      'M105.6,337 C108.8,335 110.8,338.5 111,346 C111.2,361 109.7,377 107.8,391 C105.6,386 104.6,372 104.5,358 C104.4,349 104.6,341 105.6,337 Z',
      'M119.8,337 C124,342 125.8,352 125.4,364 C124.8,377 121.4,390 118.6,397 C117.6,383 117.4,366 118.2,351 C118.5,345 119,340 119.8,337 Z',
    ],
  },
];
const FRONT_SEPS = [
  'M127.6,222 C127.9,248 125,276 119.6,301',   // Quadrizeps: aussen / Mitte
  'M108.4,283 C112.5,292 116,302 117.6,312',   // Quadrizeps: innerer Tropfen
];

const BACK = [
  { id: 'trapez', d: ['M101.5,52 C104.5,57.5 108.5,61.5 115,64.5 C124,67.8 133,70 140.5,73.4 C135.5,78 129.5,83.5 125.5,89.5 C119.5,101.5 111.5,119.5 101.5,139 Z'] },
  { id: 'schulter_hinten', d: ['M137.4,74.6 C142.6,72.6 148,73.8 150.8,77.6 C150,91 150.6,104 151.6,117 C146.6,111.5 142.2,104 140.2,96 C138.8,89 137.8,81 137.4,74.6 Z'] },
  { id: 'schulter_seite', d: [DELT_SIDE] },
  { id: 'trizeps', d: ['M141.8,114 C146,112 151.5,115.5 155,122.5 C157.8,136 158,151 155.5,163 C152.5,167 148,167 145.8,163.5 C143,150 141.2,131 141.8,114 Z'] },
  { id: 'unterarme', d: [FOREARM] },
  { id: 'latissimus', d: ['M113,141 C118.5,127 123.5,115 129.5,104.5 C132.8,106 135.3,108.6 136.8,112 C136.8,130 134,149 129.2,165 C125,171 119.5,175 113.2,177.5 C112.3,166 112.3,153 113,141 Z'] },
  { id: 'unterer_ruecken', d: ['M102.2,146 C106,145.5 109.6,147.5 110,153 C110.6,169 110.6,186 109.8,199.5 C107.8,203 104.5,203.8 102.2,202.5 C101.6,184 101.6,165 102.2,146 Z'] },
  { id: 'gesaess', d: ['M102,207.5 C111.5,203 123.5,204.5 130.5,212 C133,222.5 133,236 129.5,246 C123.5,253.5 111.5,254 102.2,248.5 C101.4,236 101.4,219 102,207.5 Z'] },
  { id: 'beinbeuger', d: ['M104.2,257 C112,254.5 123.5,254.5 130,258.5 C130.8,276 128,296 122.8,311.5 C119,317 113,317.5 109.2,312 C105.5,296 103.6,276 104.2,257 Z'] },
  { id: 'waden', d: ['M106.4,337 C111,333 119.5,333 124.4,338.5 C127.2,350 126.4,366 121.6,378.5 C118,387.5 114.5,392 112.2,394 C109.2,388 105.4,374 104.5,360 C104,350 104.6,342 106.4,337 Z'] },
];
const BACK_SEPS = [
  'M150.5,125 C151.8,137 151.8,150 150.2,160',  // Trizeps-Kopf
  'M116.6,259.5 C116.9,276 116.5,296 115.7,312.5', // Beinbeuger
  'M114.6,339.5 C114.7,356 113.9,374 112.7,390.5', // Wade (zwei Koepfe)
];

function prepare(list) {
  return list.map((m) => ({ id: m.id, paths: m.d.flatMap((p) => [p, mirrorD(p)]) }));
}
const VIEWS = {
  front: { muscles: prepare(FRONT), seps: FRONT_SEPS.flatMap((p) => [p, mirrorD(p)]), label: 'Vorne' },
  back: { muscles: prepare(BACK), seps: BACK_SEPS.flatMap((p) => [p, mirrorD(p)]), label: 'Hinten' },
};

/** Ein SVG fuer eine Ansicht. classes: { muscleId: 'l1' | 'tired' | 'pri' … } */
export function figureSVG(view, classes = {}) {
  const v = VIEWS[view];
  return `<svg class="body-fig" viewBox="26 6 148 426" role="img" aria-label="Körper ${v.label.toLowerCase()}">
    <path class="silhouette" d="${OUTLINE}"/>
    ${v.muscles.map((m) => `<g class="m ${classes[m.id] || ''}" data-muscle="${m.id}"><title>${esc(MUSCLE[m.id].name)}</title>${m.paths.map((p) => `<path d="${p}"/>`).join('')}</g>`).join('')}
    <g class="seps">${v.seps.map((p) => `<path d="${p}"/>`).join('')}</g>
  </svg>`;
}

/** Vorder- und Rueckansicht nebeneinander. */
export function bodyMapHTML({ classes = {}, labels = true, cls = '', views = ['front', 'back'] } = {}) {
  return `<div class="body-map ${cls}">${views.map((v) => `<figure>${figureSVG(v, classes)}${labels ? `<figcaption>${VIEWS[v].label}</figcaption>` : ''}</figure>`).join('')}</div>`;
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
