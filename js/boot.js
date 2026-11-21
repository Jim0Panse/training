// Setzt das Farbschema vor dem ersten Zeichnen, damit nichts aufblitzt.
(function () {
  var pref = 'system';
  try { pref = localStorage.getItem('training-theme') || 'system'; } catch (e) { /* privat-Modus */ }
  var dark = pref === 'dark' || (pref === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0B0B0C' : '#F2F2F4');
})();
