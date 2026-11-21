// Eigene SVG-Diagramme ohne Bibliothek: Linie ueber Zeit, Balken, Mini-Trendlinie.
// Regeln: 2-px-Linien mit runden Enden, Punkte mit Ring in Kartenfarbe, dezente
// durchgehende Gitterlinien, nur eine y-Achse, Legende erst ab zwei Reihen.
// Antippen/Ziehen zeigt einen Tooltip; das Fadenkreuz rastet am naechsten Punkt ein.

import { esc, clamp } from '../lib/dom.js';
import { fmtNum, fmtDM, fmtMonthShort, fmtDateShort, addDays, startOfDay } from '../lib/format.js';

const DAY = 864e5;
const r1 = (v) => Math.round(v * 10) / 10;

/** „Schoene“ Achsenwerte (Schritte 1 / 2 / 2,5 / 5 × 10^n) */
export function niceTicks(min, max, count = 4) {
  if (!(max > min)) { const p = Math.abs(max) * 0.05 || 1; min -= p; max += p; }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  const start = Math.floor(min / step + 1e-9) * step;
  const end = Math.ceil(max / step - 1e-9) * step;
  const out = [];
  for (let v = start; v <= end + step / 2; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

/** Datums-Beschriftung der x-Achse: Tage bzw. Monatsanfaenge */
function timeTicks(min, max, maxTicks) {
  const span = max - min;
  const out = [];
  if (span > 75 * DAY) {
    const all = [];
    let m = new Date(new Date(min).getFullYear(), new Date(min).getMonth(), 1);
    if (m.getTime() < min) m = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    while (m.getTime() <= max) { all.push(m); m = new Date(m.getFullYear(), m.getMonth() + 1, 1); }
    const need = Math.ceil(all.length / maxTicks);
    const k = [1, 2, 3, 6, 12, 24, 48].find((x) => x >= need) || need;
    all.forEach((d) => {
      const idx = d.getFullYear() * 12 + d.getMonth();
      if (idx % k === 0) out.push({ x: d.getTime(), label: d.getMonth() === 0 ? String(d.getFullYear()) : fmtMonthShort(d) });
    });
    return out;
  }
  const steps = [1, 2, 3, 7, 14, 21, 28];
  const step = steps.find((s) => Math.floor(span / (s * DAY)) + 1 <= maxTicks) || 28;
  let d = startOfDay(min);
  if (d.getTime() < min) d = addDays(d, 1);
  if (step >= 7) while (d.getDay() !== 1) d = addDays(d, 1);
  while (d.getTime() <= max) { out.push({ x: d.getTime(), label: fmtDM(d) }); d = addDays(d, step); }
  return out;
}

const defaultTipDate = (d) => {
  const s = fmtDateShort(d);
  return d.getFullYear() === new Date().getFullYear() ? s : `${s} ${d.getFullYear()}`;
};

function legendHTML(series) {
  const items = series.filter((s) => s.label);
  if (items.length < 2) return '';
  return `<div class="chart-legend">${items.map((s) => `<span><i class="key ${s.line === false ? 'dot' : 'line'} ${s.cls || 'main'}"></i>${esc(s.label)}</span>`).join('')}</div>`;
}

/** Gemeinsame Bedienung: Tippen/Ziehen -> pick(x), Tipp ausserhalb -> hide() */
function interact(host, { pick, hide, render }) {
  let active = false;
  let width = 0;
  const svgX = (clientX) => {
    const svg = host.querySelector('svg');
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return (clientX - rect.left) * (svg.viewBox.baseVal.width / rect.width);
  };
  const onDown = (e) => { if (e.button > 0) return; active = true; const x = svgX(e.clientX); if (x != null) pick(x); };
  const onMove = (e) => { if (!active && e.pointerType !== 'mouse') return; const x = svgX(e.clientX); if (x != null) pick(x); };
  const onUp = () => { active = false; };
  const onLeave = (e) => { if (e.pointerType === 'mouse') hide(); };
  const onDoc = (e) => {
    if (!host.isConnected) { destroy(); return; }
    if (!host.contains(e.target)) hide();
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
    if (!host.isConnected) { destroy(); return; }
    const w = Math.round(host.clientWidth);
    if (w && w !== width) { width = w; render(); }
  }) : null;
  host.addEventListener('pointerdown', onDown);
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerup', onUp);
  host.addEventListener('pointercancel', onUp);
  host.addEventListener('pointerleave', onLeave);
  document.addEventListener('pointerdown', onDoc, true);
  if (ro) ro.observe(host);
  function destroy() {
    host.removeEventListener('pointerdown', onDown);
    host.removeEventListener('pointermove', onMove);
    host.removeEventListener('pointerup', onUp);
    host.removeEventListener('pointercancel', onUp);
    host.removeEventListener('pointerleave', onLeave);
    document.removeEventListener('pointerdown', onDoc, true);
    if (ro) ro.disconnect();
  }
  return { destroy, setWidth: (w) => { width = w; } };
}

function placeTip(tip, anchorX, halfW, top, width) {
  tip.hidden = false;
  const tw = tip.offsetWidth;
  let left = anchorX + halfW + 10;
  if (left + tw > width - 2) left = anchorX - halfW - 10 - tw;
  left = clamp(left, 0, Math.max(0, width - tw));
  tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}

/** Nachkommastellen, die die Achsenwerte brauchen (max. 2) – fuer einheitliche Beschriftung */
function tickDecimals(ticks) {
  let dec = 0;
  for (const t of ticks) {
    let d = 0;
    while (d < 2 && Math.abs(Math.round(t * 10 ** d) - t * 10 ** d) > 1e-6) d++;
    dec = Math.max(dec, d);
  }
  return dec;
}

/** fmt(wert, nachkommastellen) – der zweite Wert darf ignoriert werden */
function yAxis(ticks, fmt) {
  const dec = tickDecimals(ticks);
  const labels = ticks.map((t) => fmt(t, dec));
  const w = Math.max(...labels.map((l) => l.length)) * 6.6 + 4;
  return { labels, padL: Math.ceil(w) + 8 };
}

/**
 * Liniendiagramm ueber die Zeit.
 * cfg.series: [{ label, cls: 'main'|'soft', line: true|false, dots: 'all'|'last'|'none', format (Tooltip),
 *                points: [{ x: Date|ms, y, gap?: true (Segment davor gestrichelt), note? }] }]
 * cfg: height, yFormat(v), valueFormat(v), unit, zeroBased, xDomain [min,max], snap (Index der Reihe),
 *      tipDate(date), label (fuer Screenreader), empty
 */
export function lineChart(host, cfg) {
  const o = { height: 190, yFormat: (v) => fmtNum(v, 1), valueFormat: null, unit: '', zeroBased: false, snap: 0, empty: 'Noch keine Daten', label: 'Diagramm', ...cfg };
  host.classList.add('chart', 'no-sheet-drag');
  let geo = null;

  function render() {
    const width = Math.round(host.clientWidth) || 343;
    ctl && ctl.setWidth(width);
    const series = o.series.filter((s) => s.points && s.points.length);
    if (!series.length) {
      geo = null;
      host.innerHTML = `<div class="chart-empty" style="height:${o.height}px">${esc(o.empty)}</div>`;
      return;
    }
    const xs = series.flatMap((s) => s.points.map((p) => +p.x));
    let [xmin, xmax] = o.xDomain ? o.xDomain.map(Number) : [Math.min(...xs), Math.max(...xs)];
    if (xmax - xmin < DAY) { xmin -= DAY; xmax += DAY; }
    const ys = series.flatMap((s) => s.points.map((p) => p.y));
    const vmin = Math.min(...ys), vmax = Math.max(...ys);
    let lo = o.zeroBased ? Math.min(0, vmin) : vmin, hi = vmax;
    const pad = hi - lo > 0 ? (hi - lo) * 0.15 : Math.max(1, Math.abs(hi) * 0.04);
    if (!o.zeroBased) lo -= pad;
    hi += pad;
    if (vmin >= 0) lo = Math.max(0, lo);
    const ticks = niceTicks(lo, hi, 4);
    const d0 = ticks[0], d1 = ticks[ticks.length - 1];
    const { labels, padL } = yAxis(ticks, o.yFormat);
    const H = o.height, y0 = 10, y1 = H - 24, x0 = padL, x1 = width - 10;
    const sx = (x) => x0 + ((x - xmin) / (xmax - xmin)) * (x1 - x0);
    const sy = (y) => y1 - ((y - d0) / (d1 - d0)) * (y1 - y0);

    let svg = `<svg viewBox="0 0 ${width} ${H}" width="${width}" height="${H}" role="img" aria-label="${esc(o.label)}">`;
    svg += `<g class="grid">${ticks.map((t) => `<line x1="${x0}" x2="${x1}" y1="${r1(sy(t))}" y2="${r1(sy(t))}"/>`).join('')}</g>`;
    svg += `<g class="axis">${ticks.map((t, i) => `<text x="${x0 - 8}" y="${r1(sy(t))}" dy="0.35em" text-anchor="end">${esc(labels[i])}</text>`).join('')}`;
    const tt = timeTicks(xmin, xmax, Math.max(2, Math.floor((x1 - x0) / 48)));
    svg += tt.map((t) => {
      const x = sx(t.x);
      const anchor = x - x0 < 16 ? 'start' : x1 - x < 16 ? 'end' : 'middle';
      return `<text x="${r1(x)}" y="${H - 6}" text-anchor="${anchor}">${esc(t.label)}</text>`;
    }).join('');
    svg += '</g>';

    series.forEach((s) => {
      const cls = s.cls || 'main';
      const pts = s.points.map((p) => [r1(sx(+p.x)), r1(sy(p.y))]);
      if (s.line !== false && pts.length > 1) {
        let solid = '', dashed = '';
        pts.forEach(([x, y], i) => {
          if (i === 0) { solid += `M${x},${y}`; return; }
          const [px, py] = pts[i - 1];
          if (s.points[i].gap) { dashed += `M${px},${py}L${x},${y}`; solid += `M${x},${y}`; } else solid += `L${x},${y}`;
        });
        svg += `<path class="line ${cls}" d="${solid}"/>`;
        if (dashed) svg += `<path class="line ${cls} dashed" d="${dashed}"/>`;
      }
      const dots = s.dots || (s.line === false || pts.length <= 24 ? 'all' : 'last');
      const rad = s.line === false ? 3 : 4;
      if (dots === 'all') svg += pts.map(([x, y]) => `<circle class="dot ${cls}" cx="${x}" cy="${y}" r="${rad}"/>`).join('');
      else if (dots === 'last') { const [x, y] = pts[pts.length - 1]; svg += `<circle class="dot ${cls}" cx="${x}" cy="${y}" r="${rad}"/>`; }
    });
    svg += `<line class="cross" x1="0" x2="0" y1="${y0}" y2="${y1}" visibility="hidden"/><g class="focus"></g></svg>`;
    host.innerHTML = `${svg}<div class="chart-tip" hidden></div>${legendHTML(series)}`;
    geo = { series, sx, sy, y0, width };
  }

  function pick(px) {
    if (!geo) return;
    const snapS = geo.series[Math.min(o.snap, geo.series.length - 1)];
    let best = null, bd = Infinity;
    for (const p of snapS.points) { const d = Math.abs(geo.sx(+p.x) - px); if (d < bd) { bd = d; best = p; } }
    if (best) show(+best.x);
  }
  function show(x) {
    const X = r1(geo.sx(x));
    const cross = host.querySelector('.cross'), focus = host.querySelector('.focus'), tip = host.querySelector('.chart-tip');
    cross.setAttribute('x1', X); cross.setAttribute('x2', X); cross.setAttribute('visibility', 'visible');
    const rows = geo.series.map((s) => ({ s, p: s.points.find((q) => +q.x === x) })).filter((row) => row.p);
    focus.innerHTML = rows.map(({ s, p }) => `<circle class="dot focus ${s.cls || 'main'}" cx="${X}" cy="${r1(geo.sy(p.y))}" r="5"/>`).join('');
    const fmtV = o.valueFormat || o.yFormat;
    const multi = geo.series.length > 1;
    tip.innerHTML = `<div class="tip-date">${esc((o.tipDate || defaultTipDate)(new Date(x)))}</div>${rows.map(({ s, p }) => `
      <div class="tip-row">${multi ? `<i class="key ${s.line === false ? 'dot' : 'line'} ${s.cls || 'main'}"></i><span class="tip-label">${esc(s.label || '')}</span>` : ''}
        <strong>${esc((s.format || fmtV)(p.y))}${o.unit ? ` ${esc(o.unit)}` : ''}</strong></div>${p.note ? `<div class="tip-note">${esc(p.note)}</div>` : ''}`).join('')}`;
    placeTip(tip, X, 0, geo.y0, geo.width);
  }
  function hide() {
    const tip = host.querySelector('.chart-tip');
    if (tip) tip.hidden = true;
    const cross = host.querySelector('.cross');
    if (cross) cross.setAttribute('visibility', 'hidden');
    const focus = host.querySelector('.focus');
    if (focus) focus.innerHTML = '';
  }

  let ctl = null;
  render();
  ctl = interact(host, { pick, hide, render });
  ctl.setWidth(Math.round(host.clientWidth));
  return { update(next) { Object.assign(o, next); render(); }, destroy: () => ctl.destroy() };
}

/**
 * Balkendiagramm.
 * cfg.bars: [{ label (x-Achse), tip (Tooltip-Titel), value, hl (hervorheben), note }]
 * cfg: height, yFormat, valueFormat (Tooltip), hlFormat (Wert ueber hervorgehobenen Balken), unit,
 *      band [von, bis] (dezenter Zielbereich), bandLabel, labelHl, empty, label
 */
export function barChart(host, cfg) {
  const o = { height: 170, yFormat: (v) => fmtNum(v, 0), valueFormat: null, unit: '', band: null, bandLabel: '', labelHl: true, empty: 'Noch keine Daten', label: 'Balkendiagramm', ...cfg };
  host.classList.add('chart', 'no-sheet-drag');
  let geo = null;

  function render() {
    const width = Math.round(host.clientWidth) || 343;
    ctl && ctl.setWidth(width);
    const bars = o.bars || [];
    if (!bars.length) {
      geo = null;
      host.innerHTML = `<div class="chart-empty" style="height:${o.height}px">${esc(o.empty)}</div>`;
      return;
    }
    const fmtV = o.valueFormat || o.yFormat;
    const barMax = Math.max(0, ...bars.map((b) => b.value || 0));
    const vmax = Math.max(barMax * 1.06, o.band ? o.band[1] : 0);
    const ticks = niceTicks(0, vmax > 0 ? vmax : 1, 3);
    const d1 = ticks[ticks.length - 1];
    const { labels, padL } = yAxis(ticks, o.yFormat);
    const H = o.height, y0 = o.labelHl ? 20 : 10, y1 = H - 24, x0 = padL, x1 = width - 6;
    const sy = (v) => y1 - (v / d1) * (y1 - y0);
    const n = bars.length;
    const slot = (x1 - x0) / n;
    const bw = Math.max(4, Math.min(24, slot - Math.max(2, slot * 0.34)));

    let svg = `<svg viewBox="0 0 ${width} ${H}" width="${width}" height="${H}" role="img" aria-label="${esc(o.label)}">`;
    if (o.band) {
      const ya = sy(Math.min(o.band[1], d1)), yb = sy(o.band[0]);
      svg += `<rect class="band" x="${x0}" y="${r1(ya)}" width="${r1(x1 - x0)}" height="${r1(yb - ya)}" rx="4"/>`;
    }
    svg += `<g class="grid">${ticks.map((t) => `<line x1="${x0}" x2="${x1}" y1="${r1(sy(t))}" y2="${r1(sy(t))}"/>`).join('')}</g>`;
    svg += `<g class="axis">${ticks.map((t, i) => `<text x="${x0 - 8}" y="${r1(sy(t))}" dy="0.35em" text-anchor="end">${esc(labels[i])}</text>`).join('')}`;
    const maxLabel = Math.max(...bars.map((b) => String(b.label).length)) * 6.4 + 8;
    const k = Math.max(1, Math.ceil(maxLabel / slot));
    bars.forEach((b, i) => {
      if ((n - 1 - i) % k) return;
      svg += `<text x="${r1(x0 + slot * (i + 0.5))}" y="${H - 6}" text-anchor="middle">${esc(b.label)}</text>`;
    });
    svg += '</g>';
    if (o.band && o.bandLabel) svg += `<text class="band-label" x="${x1 - 6}" y="${r1(sy(Math.min(o.band[1], d1)) + 13)}" text-anchor="end">${esc(o.bandLabel)}</text>`;
    bars.forEach((b, i) => {
      const v = b.value || 0;
      if (v <= 0) return;
      const cx = x0 + slot * (i + 0.5), x = cx - bw / 2, top = sy(v), h = y1 - top;
      const rr = Math.min(4, bw / 2, h);
      svg += `<path class="bar ${b.hl ? 'hl' : ''}" data-i="${i}" d="M${r1(x)},${y1}V${r1(top + rr)}Q${r1(x)},${r1(top)} ${r1(x + rr)},${r1(top)}H${r1(x + bw - rr)}Q${r1(x + bw)},${r1(top)} ${r1(x + bw)},${r1(top + rr)}V${y1}Z"/>`;
      if (b.hl && o.labelHl) {
        // Wert ueber dem hervorgehobenen Balken – am Rand nach innen geschoben, damit nichts abgeschnitten wird
        const txt = (o.hlFormat || fmtV)(v);
        const half = (txt.length * 6.8) / 2;
        const tx = clamp(cx, x0 + half, width - half);
        svg += `<text class="val" x="${r1(tx)}" y="${r1(top - 6)}" text-anchor="middle">${esc(txt)}</text>`;
      }
    });
    svg += '</svg>';
    host.innerHTML = `${svg}<div class="chart-tip" hidden></div>`;
    geo = { bars, x0, slot, bw, y0, width, n };
  }

  function pick(px) {
    if (!geo) return;
    const i = clamp(Math.floor((px - geo.x0) / geo.slot), 0, geo.n - 1);
    const b = geo.bars[i];
    host.querySelectorAll('.bar.sel').forEach((p) => p.classList.remove('sel'));
    const bar = host.querySelector(`.bar[data-i="${i}"]`);
    if (bar) bar.classList.add('sel');
    const tip = host.querySelector('.chart-tip');
    const fmtV = o.valueFormat || o.yFormat;
    tip.innerHTML = `<div class="tip-date">${esc(b.tip || b.label)}</div><div class="tip-row"><strong>${esc(fmtV(b.value || 0))}${o.unit ? ` ${esc(o.unit)}` : ''}</strong></div>${b.note ? `<div class="tip-note">${esc(b.note)}</div>` : ''}`;
    placeTip(tip, geo.x0 + geo.slot * (i + 0.5), geo.bw / 2, geo.y0 - 10, geo.width);
  }
  function hide() {
    const tip = host.querySelector('.chart-tip');
    if (tip) tip.hidden = true;
    host.querySelectorAll('.bar.sel').forEach((p) => p.classList.remove('sel'));
  }

  let ctl = null;
  render();
  ctl = interact(host, { pick, hide, render });
  ctl.setWidth(Math.round(host.clientWidth));
  return { update(next) { Object.assign(o, next); render(); }, destroy: () => ctl.destroy() };
}

/** Mini-Trendlinie fuer Listen (nur Verlauf, keine Achsen) */
export function sparkline(values, { w = 64, h = 26 } = {}) {
  const v = values.filter((x) => Number.isFinite(x));
  if (v.length < 2) return '';
  const min = Math.min(...v), max = Math.max(...v), p = 3;
  const sx = (i) => p + (i * (w - 2 * p)) / (v.length - 1);
  const sy = (y) => (max === min ? h / 2 : p + (1 - (y - min) / (max - min)) * (h - 2 * p));
  const d = v.map((y, i) => `${i ? 'L' : 'M'}${r1(sx(i))},${r1(sy(y))}`).join('');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${d}"/><circle cx="${r1(sx(v.length - 1))}" cy="${r1(sy(v[v.length - 1]))}" r="2.5"/></svg>`;
}
