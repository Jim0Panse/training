// Muskelbalance (unter Statistik): Welche Muskeln kommen zu kurz – und wie gleicht man das aus?
// Figur nach Status, Vorschlaege passend zu den genutzten Workouts, Verhaeltnisse (Druck/Zug …),
// alle Muskeln mit Richtwert, Haeufigkeit und Kraftverlauf, dazu die Berechnung mit Quellen.

import * as db from '../db.js';
import { topbar } from '../components/header.js';
import { bodyMapHTML, legendBalance } from '../components/body-map.js';
import { analyzeBalance, byNeed, ratioText, waitText, STATUS_LABEL, PAIR_LABEL } from '../lib/balance.js';
import { MUSCLES } from '../data/muscles.js';
import { fmtNum, fmtPct, fmtDayMonthShort } from '../lib/format.js';
import { on, esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { navigate } from '../router.js';

const RANGES = [[4, '4 Wochen'], [12, '12 Wochen']];
let weeks = 4;          // bleibt beim Hin- und Herwechseln erhalten
let showInfo = false;

const trendHTML = (v) => `<span class="trend ${Math.round(v * 100) > 0 ? 'up' : 'down'}">${esc(fmtPct(v))}</span>`;
const setsWord = (n) => (n === 1 ? 'Satz' : 'Sätze');

function periodText(res) {
  if (!res.first) return 'Noch keine Workouts';
  const now = new Date();
  const year = res.from.getFullYear() !== now.getFullYear() ? ` ${res.from.getFullYear()}` : '';
  return `${fmtDayMonthShort(res.from)}${year} – heute · ${res.sessions} ${res.sessions === 1 ? 'Workout' : 'Workouts'}`;
}

// ---------- Hinweise ----------
function notesHTML(res) {
  return res.notes.map((n) => {
    if (n.type === 'pause') {
      return `<div class="info-note">${icon('info')}<span>Im Zeitraum lag eine Trainingspause von ${n.days} Tagen. Die Wochenwerte fallen dadurch niedriger aus – die Verhältnisse bleiben aussagekräftig.</span></div>`;
    }
    return `<div class="info-note">${icon('info')}<span><strong>Insgesamt eher wenig Volumen:</strong> ${n.below} von ${MUSCLES.length} Muskeln liegen unter dem Zielbereich. Ein Satz mehr pro Übung oder ein zusätzliches Workout pro Woche hebt alle an – die Vorschläge zeigen, wo es am meisten fehlt.</span></div>`;
  }).join('');
}

// ---------- Vorschlaege ----------
function actionHTML(a) {
  return `<button class="bal-act" type="button" data-tpl="${esc(a.tpl.id)}">
      <span class="bal-act-ic">${icon('plus')}</span>
      <span class="grow"><span class="bal-act-ex">${esc(a.ex.name)}</span><span class="bal-act-tpl">${esc(a.tpl.name)}</span></span>
      <span class="bal-act-sets">${a.isNew ? `neu · ${a.to} Sätze` : `${a.from} → ${a.to} Sätze`}</span>
      ${icon('chevronRight', 'chev')}
    </button>`;
}

function suggestionHTML(s) {
  const m = s.muscle, t = m.target;
  const why = m.status === 'low'
    ? `Unter dem Minimum von ${t.min} Sätzen pro Woche`
    : `Unter dem Zielbereich von ${t.from}–${t.to} Sätzen pro Woche`;
  const acts = s.actions.map(actionHTML).join('');
  const gen = s.generic ? `<div class="bal-act static">
      <span class="bal-act-ic">${icon('plus')}</span>
      <span class="grow"><span class="bal-act-ex">${esc(s.generic.ex.name)}</span><span class="bal-act-tpl">${s.generic.times}× pro Woche</span></span>
      <span class="bal-act-sets">je ${s.generic.sets} Sätze</span>
    </div>` : '';
  const has = acts || gen;
  return `<section class="card bal-sugg">
    <div class="bal-sugg-head">
      <i class="bdot b-${m.status}"></i>
      <span class="grow"><span class="card-title">${esc(m.name)}</span><span class="bal-sugg-why">${why}${m.trend ? ` · Kraft ${trendHTML(m.trend.value)}` : ''}</span></span>
      ${has ? `<span class="bal-sugg-num"><b>${fmtNum(m.perWeek, 1)} → ${fmtNum(s.after, 1)}</b><small>Sätze pro Woche</small></span>` : ''}
    </div>
    ${has ? `<div class="bal-acts">${acts}${gen}</div>` : '<p class="bal-sugg-foot">Lege eine Übung mit diesem Muskel als Hauptmuskel an.</p>'}
    ${has && s.after < t.from - 0.5 ? `<p class="bal-sugg-foot">Erster Schritt – danach weiter steigern, bis ${t.from} Sätze pro Woche erreicht sind.</p>` : ''}
  </section>`;
}

function suggestionsHTML(res) {
  const cards = res.suggestions.map(suggestionHTML);
  const high = res.muscles.filter((m) => m.status === 'high').sort((a, b) => b.perWeek - a.perWeek);
  if (high.length) {
    cards.push(`<div class="info-note">${icon('clock')}<span><strong>Hier kannst du Zeit sparen:</strong> ${high.map((m) => `${esc(m.name)} (${fmtNum(m.perWeek, 1)} Sätze)`).join(', ')}. Über ${high[0].target.to} Sätzen pro Woche bringt jeder weitere Satz nur noch wenig – die Zeit ist bei schwächeren Muskeln besser angelegt.</span></div>`);
  }
  if (!cards.length) return '<div class="card empty small"><strong>Nichts Größeres auszugleichen</strong>Alle Muskeln liegen im oder knapp am Zielbereich.</div>';
  return `<div class="stack">${cards.join('')}</div>
    ${res.suggestions.some((s) => s.actions.length) ? '<p class="st-foot">Tippe auf einen Vorschlag, um das Workout zu bearbeiten. Die Wirkung pro Woche ergibt sich daraus, wie oft du das Workout zuletzt gemacht hast.</p>' : ''}`;
}

// ---------- Verhaeltnisse ----------
function pairHint(p) {
  if (p.level !== 'mild' && p.level !== 'strong') return '';
  const ex = p.weak === 'a' ? p.hintA : p.hint;
  if (p.id === 'pushpull') return `Ca. ${p.need} Zugsätze pro Woche mehr${ex ? ` – ${ex}` : ''}.`;
  const weakName = p.weak === 'a' ? p.a : p.b;
  return `${weakName}: ca. ${p.need} ${setsWord(p.need)} pro Woche mehr${ex ? ` – ${ex}` : ''}.`;
}

function plyoNote(p) {
  const { push, pull } = p.plyo || {};
  if (!push && !pull) return '';
  const what = push && pull ? `${fmtNum(push, 1)} explosive Druck- und ${fmtNum(pull, 1)} Zugsätze`
    : push ? `${fmtNum(push, 1)} explosive Drucksätze` : `${fmtNum(pull, 1)} explosive Zugsätze`;
  return `<p class="bal-pair-note">Nicht mitgezählt: ${what} pro Woche${push ? ' – sie beanspruchen die Schulter zusätzlich' : ''}.</p>`;
}

function pairHTML(p) {
  const tot = p.av + p.bv;
  const hint = pairHint(p);
  return `<div class="bal-pair">
    <div class="bal-pair-head"><span class="bal-pair-name">${esc(p.title)}</span><span class="bal-pair-ratio">${esc(ratioText(p))}</span></div>
    <div class="bal-split" aria-hidden="true">${tot ? `<i class="a" style="flex-grow:${p.av}"></i><i class="b" style="flex-grow:${p.bv}"></i>` : '<i class="none"></i>'}</div>
    <div class="bal-pair-vals"><span><i class="bkey a"></i>${esc(p.a)} ${fmtNum(p.av, 1)}</span><span>${fmtNum(p.bv, 1)} ${esc(p.b)}<i class="bkey b"></i></span></div>
    <p class="bal-pair-verdict"><i class="bdot p-${p.level}"></i><span><strong>${PAIR_LABEL[p.level]}</strong>${hint ? ` · ${esc(hint)}` : ''}</span></p>
    ${plyoNote(p)}
  </div>`;
}

// ---------- Alle Muskeln ----------
function rowHTML(m, scale) {
  const t = m.target;
  const pct = (v) => Math.min(100, (v / scale) * 100);
  const bits = [
    `<span class="bal-st"><i class="bdot b-${m.status}"></i>${STATUS_LABEL[m.status]}</span>`,
    m.freq >= 0.05 ? `${fmtNum(m.freq, 1)}× pro Woche` : 'nicht trainiert',
    m.trend ? `Kraft ${trendHTML(m.trend.value)}` : '',
  ].filter(Boolean);
  return `<button class="row bal-row" type="button" data-muscle="${m.id}">
    <span class="grow">
      <span class="bal-row-top"><span class="row-title">${esc(m.name)}</span><span class="bal-val"><b>${fmtNum(m.perWeek, 1)}</b> / ${t.from}–${t.to}</span></span>
      <span class="bal-bar" aria-hidden="true"><i class="band" style="left:${pct(t.from).toFixed(1)}%;width:${(pct(t.to) - pct(t.from)).toFixed(1)}%"></i><i class="fill b-${m.status}" style="width:${pct(m.perWeek).toFixed(1)}%"></i><i class="min" style="left:${pct(t.min).toFixed(1)}%"></i></span>
      <span class="bal-sub">${bits.join('<span class="sep">·</span>')}</span>
    </span>${icon('chevronRight', 'chev')}
  </button>`;
}

function musclesHTML(res) {
  const ms = res.muscles.slice().sort(byNeed);
  const scale = Math.max(24, Math.ceil(Math.max(...ms.map((m) => m.perWeek)) / 4) * 4);
  return `<div class="list">${ms.map((m) => rowHTML(m, scale)).join('')}</div>
    <p class="st-foot">Ø effektive Sätze pro Woche gegenüber dem Zielbereich (grün hinterlegt), Strich = Minimum. Sortiert nach Handlungsbedarf. Kraft: e1RM-Trend der Hauptübungen.</p>`;
}

// ---------- Erklaerung ----------
function infoHTML() {
  return `<section class="card bal-info">
    <button class="bal-info-head" type="button" data-info aria-expanded="${showInfo}">${icon('info')}<span class="grow">So wird gerechnet</span>${icon(showInfo ? 'chevronUp' : 'chevronDown', 'chev')}</button>
    ${showInfo ? `<div class="bal-info-body">
      <p><strong>Gezählt</strong> werden erledigte Arbeitssätze aus Kraftübungen: Hauptmuskel 1 Satz, Nebenmuskel ½ Satz. Diese Zählweise passt laut einer großen Meta-Analyse am besten zu den gemessenen Muskelzuwächsen. Aufwärmsätze, Sprung- und Explosivübungen, Cardio und Mobilität zählen nicht – die Richtwerte stammen aus Studien mit Kraftsätzen nahe am Muskelversagen.</p>
      <p><strong>Richtwerte pro Woche:</strong> Unter 4 Sätzen ist kaum Muskelaufbau zu erwarten. Mehr Sätze bringen mehr Wachstum, 10–20 gelten als guter Bereich; darüber bringt jeder Satz nur noch wenig. Vordere Schulter, Unterarme, unterer Rücken, Adduktoren und die einzelnen Bauchbereiche arbeiten bei vielen Übungen mit – für sie gilt Minimum 2, Ziel 4–12.</p>
      <p><strong>Verhältnisse:</strong> Freizeit-Kraftsportler trainieren oft mehr Druck als Zug und vernachlässigen die hintere Schulter; Studien finden bei ihnen häufiger muskuläre Ungleichgewichte an der Schulter. Empfehlung: mindestens so viel Zug wie Druck. Druck/Zug und Ober-/Unterkörper zählen die Sätze nach den Hauptmuskeln der Übung, die übrigen Paare die effektiven Sätze.</p>
      <p><strong>Zeitraum:</strong> rollierend 4 oder 12 Wochen, damit bei Split-Plänen alle Workouts drin sind – eine einzelne Woche wäre verzerrt. Kraft: bestes e1RM der letzten 4 Wochen gegenüber dem Vergleichszeitraum, gemittelt über die Hauptübungen.</p>
      <p><strong>Vorschläge:</strong> höchstens 6 Sätze mehr pro Woche und Muskel als erster Schritt, verteilt auf zwei Workouts. Mehr als etwa 11 Sätze pro Muskel und Training bringen kaum zusätzlich.</p>
      <p><strong>Grenzen:</strong> Die Werte sind Richtwerte für Muskelaufbau, für reine Kraft reichen oft weniger Sätze. Wie nah am Muskelversagen du trainierst, kann die App nicht messen.</p>
      <p class="bal-src">Quellen: Schoenfeld, Ogborn &amp; Krieger 2017 (J Sports Sci) · Iversen et al. 2021 (Sports Med) · Pelland et al. 2024 (SportRxiv) · Remmert et al. 2025 (SportRxiv) · Kolber et al. 2009 (J Strength Cond Res)</p>
    </div>` : ''}
  </section>`;
}

function emptyHTML(res) {
  const title = !res.first ? 'Noch keine Workouts' : !res.sessions ? 'Kein Training im Zeitraum' : 'Noch zu wenig Daten';
  return `<div class="card empty bal-empty">${icon('balance')}<strong>${title}</strong>${esc(waitText(res))}
    ${res.sessions ? '<span class="bal-empty-sub">Bei einem Plan mit mehreren Workouts im Wechsel wäre eine kürzere Zeitspanne nicht aussagekräftig.</span>' : ''}</div>`;
}

function contentHTML(res) {
  const classes = Object.fromEntries(res.muscles.map((m) => [m.id, `b-${m.status}`]));
  return `
    <section class="card body-card bal-fig">
      ${bodyMapHTML({ classes, cls: 'tappable', hit: true })}
      <div class="mt-12">${legendBalance()}</div>
      <p class="st-hint">Muskel antippen für Details</p>
    </section>
    ${res.notes.length ? `<div class="stack mt-12">${notesHTML(res)}</div>` : ''}
    <h2 class="section-title">Vorschläge</h2>
    ${suggestionsHTML(res)}
    <h2 class="section-title">Verhältnisse</h2>
    <section class="card bal-pairs">${res.pairs.map(pairHTML).join('')}</section>
    <h2 class="section-title">Alle Muskeln</h2>
    ${musclesHTML(res)}`;
}

// ---------- Seite ----------
export function render(root) {
  root.classList.add('has-topbar');

  const draw = () => {
    const res = analyzeBalance({ weeks });
    root.innerHTML = `
      ${topbar({ title: 'Muskelbalance', back: '#/statistik' })}
      <div class="seg" role="tablist" aria-label="Zeitraum">
        ${RANGES.map(([w, l]) => `<button type="button" data-weeks="${w}" class="${w === weeks ? 'on' : ''}" role="tab" aria-selected="${w === weeks}">${l}</button>`).join('')}
      </div>
      <p class="st-period">${esc(periodText(res))}</p>
      <div class="mt-12">${res.enough ? contentHTML(res) : emptyHTML(res)}</div>
      <div class="mt-24">${infoHTML()}</div>`;
  };

  draw();
  const offs = [
    on(root, 'click', '[data-weeks]', (e, b) => {
      const w = Number(b.dataset.weeks);
      if (w === weeks) return;
      weeks = w;
      draw();
    }),
    on(root, 'click', '[data-info]', () => {
      showInfo = !showInfo;
      const y = window.scrollY;
      draw();
      window.scrollTo(0, y);
    }),
    on(root, 'click', '[data-muscle]', (e, b) => navigate('#/muskel/' + b.dataset.muscle)),
    on(root, 'click', '[data-tpl]', (e, b) => navigate('#/vorlage/' + b.dataset.tpl)),
    db.subscribe(draw),
  ];
  return () => offs.forEach((f) => f());
}
