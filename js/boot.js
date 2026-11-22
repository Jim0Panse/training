// Setzt das Farbschema vor dem ersten Zeichnen, damit nichts aufblitzt.
(function () {
  var pref = 'system';
  try { pref = localStorage.getItem('training-theme') || 'system'; } catch (e) { /* privat-Modus */ }
  var dark = pref === 'dark' || (pref === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#090B0E' : '#F2F4F7');
})();

// Kein versehentliches Zoomen: iOS ignoriert „user-scalable=no“, darum die Zwei-Finger-Geste
// (Pinch) abfangen. Doppeltipp-Zoom verhindert das CSS (touch-action).
(function () {
  var stop = function (e) { e.preventDefault(); };
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) {
    document.addEventListener(t, stop, { passive: false });
  });
})();
