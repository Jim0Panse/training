// Eigene, schlichte Linien-Icons (24 x 24, Strich in currentColor).

function gearPath() {
  // Zahnrad als Umriss: 8 Zaehne, aussen 9,6 / innen 7,2
  const n = 8, R = 9.6, r = 7.2, cx = 12, cy = 12;
  const pt = (rad, deg) => {
    const a = (deg - 90) * Math.PI / 180;
    return `${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`;
  };
  let d = '';
  for (let i = 0; i < n; i++) {
    const c = i * 360 / n;
    d += (i === 0 ? `M${pt(r, c - 15)}` : '') +
      ` L${pt(R, c - 10)} L${pt(R, c + 10)} L${pt(r, c + 15)}` +
      ` A${r} ${r} 0 0 1 ${pt(r, c + 360 / n - 15)}`;
  }
  return d + ' Z';
}

const P = {
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2.2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/>',
  chart: '<path d="M6 19.5v-6M12 19.5v-15M18 19.5v-9.5"/>',
  dumbbell: '<path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11"/>',
  gear: `<path d="${gearPath()}"/><circle cx="12" cy="12" r="2.8"/>`,
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  chevronLeft: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  chevronRight: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
  chevronDown: '<path d="M5.5 9.5L12 16l6.5-6.5"/>',
  chevronUp: '<path d="M5.5 14.5L12 8l6.5 6.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  more: '<circle cx="5.5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5"/>',
  pencil: '<path d="M4.5 19.5h4l10-10-4-4-10 10z M12.5 7.5l4 4"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="M15.5 15.5l4.5 4.5"/>',
  sliders: '<path d="M4 8h8.5M16.5 8H20M4 16h3.5M11.5 16H20"/><circle cx="14.5" cy="8" r="2"/><circle cx="9.5" cy="16" r="2"/>',
  trophy: '<path d="M8 4h8v5.5a4 4 0 0 1-8 0z"/><path d="M8 6.2H5.2v1.3A3.2 3.2 0 0 0 8 10.7M16 6.2h2.8v1.3a3.2 3.2 0 0 1-2.8 3.2M12 13.5v3.5M8.5 20h7M10 17h4v3h-4z"/>',
  info: '<circle cx="12" cy="12" r="8.8"/><path d="M12 11v5.5M12 7.7v.1"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  timer: '<circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V10M9.8 3h4.4M12 3v3.5M18 7l1.3-1.3"/>',
  scale: '<rect x="3.8" y="3.8" width="16.4" height="16.4" rx="4.5"/><path d="M8.3 10a5 5 0 0 1 7.4 0M12 10.2l1.4-1.9"/>',
  kettlebell: '<path d="M9.3 9.5V8.2a2.7 2.7 0 0 1 5.4 0v1.3"/><path d="M7.2 9.5h9.6a1.8 1.8 0 0 1 1.8 1.6l.9 7.1a1.6 1.6 0 0 1-1.6 1.8H6.1a1.6 1.6 0 0 1-1.6-1.8l.9-7.1a1.8 1.8 0 0 1 1.8-1.6z"/>',
  layers: '<path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5L12 17l8.5-4.5M3.5 16.2L12 20.7l8.5-4.5"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1" fill="currentColor"/><circle cx="4.8" cy="12" r="1" fill="currentColor"/><circle cx="4.8" cy="17.5" r="1" fill="currentColor"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/>',
  arrowUp: '<path d="M12 19V5.5M6.5 11L12 5.5 17.5 11"/>',
  arrowDown: '<path d="M12 5v13.5M6.5 13l5.5 5.5 5.5-5.5"/>',
  trendUp: '<path d="M4 16.5l5.5-5.5 3.5 3.5L20 7.5M14.5 7.5H20V13"/>',
  grip: '<path d="M8 8h8M8 12h8M8 16h8"/>',
  link: '<path d="M10.5 13.5a3.6 3.6 0 0 0 5 0l3-3a3.6 3.6 0 0 0-5-5l-1 1M13.5 10.5a3.6 3.6 0 0 0-5 0l-3 3a3.6 3.6 0 0 0 5 5l1-1"/>',
  unlink: '<path d="M10.5 13.5a3.6 3.6 0 0 0 5 0l3-3a3.6 3.6 0 0 0-5-5l-1 1M13.5 10.5a3.6 3.6 0 0 0-5 0l-3 3a3.6 3.6 0 0 0 5 5l1-1M4 4l16 16"/>',
  swap: '<path d="M7.5 4L4 7.5 7.5 11M4 7.5h13.5M16.5 13l3.5 3.5-3.5 3.5M20 16.5H6.5"/>',
  share: '<path d="M12 14.5V3.8M7.8 7.8L12 3.6l4.2 4.2M5 12.5v6A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-6"/>',
  download: '<path d="M12 3.8v10.7M7.8 10.3l4.2 4.2 4.2-4.2M5 12.5v6A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4"/>',
  moon: '<path d="M19.5 14.6A7.8 7.8 0 1 1 9.4 4.5a6.3 6.3 0 0 0 10.1 10.1z"/>',
  phone: '<rect x="6.5" y="3" width="11" height="18" rx="2.8"/><path d="M10.5 18h3"/>',
  note: '<path d="M5.5 4.5h13v9.5l-5.5 5.5H5.5z"/><path d="M13 19.5v-5.5h5.5"/>',
  body: '<circle cx="12" cy="4.8" r="2.1"/><path d="M5.5 9h13M12 9v6M8.8 20.5L12 15l3.2 5.5"/>',
  warn: '<path d="M12 4.5l8.5 15h-17z"/><path d="M12 10.5v4M12 17.3v.1"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  bolt: '<path d="M13 3L5.5 13.5H12L11 21l7.5-10.5H12z"/>',
  repeat: '<path d="M4.5 12V10a4 4 0 0 1 4-4h11M16.5 3l3 3-3 3M19.5 12v2a4 4 0 0 1-4 4h-11M7.5 21l-3-3 3-3"/>',
  volume: '<path d="M4.5 9.5h3.5L12.5 5.5v13L8 14.5H4.5z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  shortcut: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><path d="M9 9l6 6M15 9v6H9"/>',
  expand: '<path d="M4.5 9.5v-5h5M19.5 9.5v-5h-5M4.5 14.5v5h5M19.5 14.5v5h-5"/>',
};

/** Liefert ein Inline-SVG-Icon als HTML-String. */
export function icon(name, cls = '') {
  const body = P[name] || P.info;
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
