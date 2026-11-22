// Pausen-Stoppuhr (kein Countdown): zaehlt hoch, alle N Sekunden ein kurzer Ton,
// ein Rahmen baut sich jede Minute einmal um den Knopf auf, volle Minute = kurzes Pulsieren.
// Startzeit liegt in der Session.

import * as db from '../db.js';
import { fmtStopwatch } from '../lib/format.js';
import { flash } from '../lib/dom.js';
import { icon } from '../lib/icons.js';

let ctx = null;

/** Muss durch einen Tipp ausgeloest werden (iOS). */
export function unlockAudio() {
  try {
    // Ziel: Musik laeuft weiter und wird nur kurz leiser
    if (navigator.audioSession && navigator.audioSession.type !== 'transient') navigator.audioSession.type = 'transient';
  } catch (e) { /* nicht unterstuetzt */ }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch (e) { /* ohne Ton weiter */ }
  return ctx;
}

/** Zwei kurze, dezente Sinustoene (880 Hz, je 80 ms) */
export function beep() {
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime + 0.02;
    [0, 0.16].forEach((off) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.setValueAtTime(0, t0 + off);
      g.gain.linearRampToValueAtTime(0.22, t0 + off + 0.01);
      g.gain.setValueAtTime(0.22, t0 + off + 0.07);
      g.gain.linearRampToValueAtTime(0, t0 + off + 0.08);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t0 + off);
      o.stop(t0 + off + 0.1);
    });
  } catch (e) { /* egal */ }
}

/**
 * Schwebende Leiste unten. host: Element, session: laufende Session, save(): speichern.
 * -> { restart(), running(), destroy() }
 */
export function stopwatchBar(host, { session, save }) {
  let timer = null, lastN = 0, lastMin = 0;
  let per = 0, lastFrac = -1; // Umfang des Minutenrahmens, zuletzt gezeigter Anteil
  const interval = () => Number(db.state.settings.stopwatchIntervalSec) || 0;
  const elapsed = () => (session.stopwatch && session.stopwatch.startedAt ? Math.max(0, Date.now() - new Date(session.stopwatch.startedAt)) : null);

  function render() {
    const e = elapsed();
    host.innerHTML = e == null
      ? `<button class="sw-bar" type="button" data-sw>${icon('timer')}<span class="sw-title grow">Pause starten</span><span class="sw-hint">${interval() ? `Ton alle ${interval()} s` : 'ohne Ton'}</span></button>`
      : `<button class="sw-bar on" type="button" data-sw aria-label="Pausen-Stoppuhr stoppen">
          <svg class="sw-frame" aria-hidden="true"><path class="sw-track"/><path class="sw-prog"/></svg>
          ${icon('timer')}<span class="sw-label">Pause</span><span class="sw-time">${fmtStopwatch(e)}</span><span class="sw-stop">Stopp</span></button>`;
    per = 0;
    if (e != null) layoutFrame();
  }

  // Rahmen, der sich jede Minute einmal um den Knopf aufbaut (Start oben in der Mitte, im Uhrzeigersinn)
  function layoutFrame() {
    const b = host.querySelector('.sw-bar.on');
    const svg = b && b.querySelector('.sw-frame');
    if (!svg) return;
    const w = b.offsetWidth, h = b.offsetHeight;
    if (!w || !h) return;
    const i = 1.5; // halbe Strichstaerke: Rahmen liegt genau auf der Kante
    const R = parseFloat(getComputedStyle(b).borderTopLeftRadius) || 18;
    const r = Math.max(0, Math.min(R - i, (h - 2 * i) / 2));
    const x0 = i, y0 = i, x1 = w - i, y1 = h - i;
    const d = `M${w / 2} ${y0}H${x1 - r}A${r} ${r} 0 0 1 ${x1} ${y0 + r}V${y1 - r}A${r} ${r} 0 0 1 ${x1 - r} ${y1}`
      + `H${x0 + r}A${r} ${r} 0 0 1 ${x0} ${y1 - r}V${y0 + r}A${r} ${r} 0 0 1 ${x0 + r} ${y0}Z`;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.querySelectorAll('path').forEach((p) => p.setAttribute('d', d));
    per = 2 * (w - 2 * i - 2 * r) + 2 * (h - 2 * i - 2 * r) + 2 * Math.PI * r;
    svg.querySelector('.sw-prog').style.strokeDasharray = `${per} ${per}`;
    lastFrac = -1;
    progress();
  }
  function progress() {
    const e = elapsed();
    const p = host.querySelector('.sw-prog');
    if (e == null || !p || !per) return;
    const frac = (e % 60000) / 60000;
    if (frac < lastFrac || lastFrac < 0) {
      // Neue Minute (oder erstes Zeichnen): ohne Uebergang zuruecksetzen
      p.style.transition = 'none';
      p.style.strokeDashoffset = String(per * (1 - frac));
      p.getBoundingClientRect();
      p.style.transition = '';
    } else {
      p.style.strokeDashoffset = String(per * (1 - frac));
    }
    lastFrac = frac;
  }
  const onResize = () => { if (elapsed() != null) layoutFrame(); };
  window.addEventListener('resize', onResize);

  function tick() {
    const e = elapsed();
    if (e == null) return;
    const t = host.querySelector('.sw-time');
    if (t) t.textContent = fmtStopwatch(e);
    progress();
    const iv = interval();
    if (iv > 0) {
      const n = Math.floor(e / 1000 / iv);
      if (n > lastN) { lastN = n; beep(); }
    }
    const m = Math.floor(e / 60000);
    if (m > lastMin) { lastMin = m; flash(host.querySelector('.sw-bar'), 'pulse', 1200); }
  }
  function run() { clearInterval(timer); timer = setInterval(tick, 250); }
  function start() {
    session.stopwatch = { startedAt: new Date().toISOString() };
    lastN = 0; lastMin = 0;
    save();
    render();
    run();
  }
  function stop() {
    session.stopwatch = { startedAt: null };
    clearInterval(timer); timer = null;
    save();
    render();
  }

  const e0 = elapsed();
  if (e0 != null) {
    const iv = interval();
    lastN = iv > 0 ? Math.floor(e0 / 1000 / iv) : 0;
    lastMin = Math.floor(e0 / 60000);
    run();
  }
  render();
  const onClick = (ev) => {
    if (!ev.target.closest('[data-sw]')) return;
    if (elapsed() != null) stop();
    else { unlockAudio(); start(); }
  };
  host.addEventListener('click', onClick);
  return {
    restart() { unlockAudio(); start(); },
    running: () => elapsed() != null,
    destroy() { clearInterval(timer); host.removeEventListener('click', onClick); window.removeEventListener('resize', onResize); },
  };
}
