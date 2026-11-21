// Pausen-Stoppuhr (kein Countdown): zaehlt hoch, alle N Sekunden ein kurzer Ton,
// jede volle Minute eine kurze visuelle Hervorhebung. Startzeit liegt in der Session.

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
  const interval = () => Number(db.state.settings.stopwatchIntervalSec) || 0;
  const elapsed = () => (session.stopwatch && session.stopwatch.startedAt ? Math.max(0, Date.now() - new Date(session.stopwatch.startedAt)) : null);

  function render() {
    const e = elapsed();
    host.innerHTML = e == null
      ? `<button class="sw-bar" type="button" data-sw>${icon('timer')}<span class="grow">Pause starten</span><span class="sw-hint">${interval() ? `Ton alle ${interval()} s` : 'ohne Ton'}</span></button>`
      : `<button class="sw-bar on" type="button" data-sw aria-label="Pausen-Stoppuhr stoppen">${icon('timer')}<span class="sw-label">Pause</span><span class="sw-time">${fmtStopwatch(e)}</span><span class="sw-hint">Tippen = Stopp</span></button>`;
  }
  function tick() {
    const e = elapsed();
    if (e == null) return;
    const t = host.querySelector('.sw-time');
    if (t) t.textContent = fmtStopwatch(e);
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
    destroy() { clearInterval(timer); host.removeEventListener('click', onClick); },
  };
}
