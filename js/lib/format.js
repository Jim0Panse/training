// Zahlen, Datum, Kalenderwoche, Komma-Eingabe (alles de-DE).

const nfCache = new Map();
function nf(min, max) {
  const k = min + ':' + max;
  if (!nfCache.has(k)) nfCache.set(k, new Intl.NumberFormat('de-DE', { minimumFractionDigits: min, maximumFractionDigits: max }));
  return nfCache.get(k);
}

/** Zahl de-DE, max. 2 Nachkommastellen: 82,4 · 3.200 */
export function fmtNum(v, maxDec = 2, minDec = 0) {
  if (v == null || !Number.isFinite(v)) return '–';
  return nf(minDec, maxDec).format(v);
}
export const fmtKg = (v) => fmtNum(v, 2);
export const fmtInt = (v) => (v == null || !Number.isFinite(v) ? '–' : nf(0, 0).format(Math.round(v)));
export const fmtOne = (v) => fmtNum(v, 1);

/** Mit Vorzeichen: +1,5 · −0,3 · ±0 */
export function fmtSigned(v, maxDec = 1) {
  if (v == null || !Number.isFinite(v)) return '–';
  const r = Number(v.toFixed(maxDec));
  if (r === 0) return '±0';
  return (r > 0 ? '+' : '−') + nf(0, maxDec).format(Math.abs(r));
}
export function fmtPct(v) {
  if (v == null || !Number.isFinite(v)) return '–';
  return fmtSigned(v * 100, 0) + ' %';
}

/** Volumen kompakt: 12.400 kg, ab 100.000 als 124 t */
export function fmtVolume(kg) {
  if (kg == null || !Number.isFinite(kg)) return '–';
  if (kg >= 100000) return fmtNum(kg / 1000, 1) + ' t';
  return fmtInt(kg) + ' kg';
}

/** Eingabe mit Komma oder Punkt: "82,5" -> 82.5. Leer/ungueltig -> null. */
export function parseNum(input) {
  if (input == null) return null;
  let s = String(input).trim().replace(/\s+/g, '');
  if (!s) return null;
  s = s.replace(',', '.');
  if (!/^\d*\.?\d*$/.test(s) || s === '.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Fuer Eingabefelder: 82.5 -> "82,5" (ohne Tausenderpunkt) */
export function numToInput(v) {
  if (v == null || !Number.isFinite(v)) return '';
  return String(Math.round(v * 100) / 100).replace('.', ',');
}

// ---------- Datum ----------
const pad = (n) => String(n).padStart(2, '0');

/** Lokales Datum als YYYY-MM-DD (nicht toISOString -> keine Zeitzonenfehler). */
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function fromKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }

export function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function addMonths(d, n) { const x = new Date(d); x.setDate(1); x.setMonth(x.getMonth() + n); return x; }
/** Wochenbeginn Montag 00:00 (lokal) */
export function startOfWeek(d) { const x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
export function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
export function startOfYear(d) { return new Date(d.getFullYear(), 0, 1); }
/** Kalendertage von a nach b (sommerzeitfest) */
export function dayDiff(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / 864e5); }
export const sameDay = (a, b) => dateKey(a) === dateKey(b);

/** ISO-Kalenderwoche */
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { year: d.getUTCFullYear(), week: Math.ceil(((d - yearStart) / 864e5 + 1) / 7) };
}

const df = (o) => new Intl.DateTimeFormat('de-DE', o);
const DF_SHORT = df({ weekday: 'short', day: 'numeric', month: 'short' });
const DF_DAYMONTH = df({ day: 'numeric', month: 'long' });
const DF_DAYMONTH_S = df({ day: 'numeric', month: 'short' });
const DF_NUM = df({ day: '2-digit', month: '2-digit', year: 'numeric' });
const DF_MONTH_S = df({ month: 'short' });
const DF_MONTH_L = df({ month: 'long' });
const DF_MONTH_Y = df({ month: 'long', year: 'numeric' });
const DF_TIME = df({ hour: '2-digit', minute: '2-digit' });
const DF_WEEKDAY = df({ weekday: 'long' });
const DF_FULL = df({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** "Fr., 21. Nov." */
export const fmtDateShort = (d) => DF_SHORT.format(d);
/** "21. November" */
export const fmtDayMonth = (d) => DF_DAYMONTH.format(d);
/** "21. Nov." */
export const fmtDayMonthShort = (d) => DF_DAYMONTH_S.format(d);
/** "21.11.2026" */
export const fmtDateNum = (d) => DF_NUM.format(d);
/** "21.11." */
export const fmtDM = (d) => `${d.getDate()}.${d.getMonth() + 1}.`;
export const fmtMonthShort = (d) => DF_MONTH_S.format(d).replace('.', '');
export const fmtMonthLong = (d) => DF_MONTH_L.format(d);
export const fmtMonthYear = (d) => DF_MONTH_Y.format(d);
export const fmtTime = (d) => DF_TIME.format(d);
export const fmtWeekday = (d) => DF_WEEKDAY.format(d);
export const fmtDateFull = (d) => DF_FULL.format(d);

/** "heute", "gestern", "vor 5 Tagen", ... */
export function fmtRelDay(d, now = new Date()) {
  const n = dayDiff(d, now);
  if (n <= 0) return 'heute';
  if (n === 1) return 'gestern';
  if (n < 30) return `vor ${n} Tagen`;
  const m = Math.round(n / 30.4);
  if (m < 12) return m === 1 ? 'vor einem Monat' : `vor ${m} Monaten`;
  const y = Math.round(n / 365);
  return y === 1 ? 'vor einem Jahr' : `vor ${y} Jahren`;
}

/** Laufende Dauer: "23:41" bzw. "1:02:03" */
export function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
/** Stoppuhr: "1:37" */
export function fmtStopwatch(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
/** "1 h 35 min" / "45 min" */
export function fmtDuration(ms) {
  if (ms == null || !Number.isFinite(ms)) return '–';
  const min = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
/** Stunden als "ca. 18 h" bzw. "ca. 2 Tagen" */
export function fmtHours(h) {
  if (h <= 1) return 'unter 1 h';
  if (h < 48) return `${Math.round(h)} h`;
  return `${fmtNum(h / 24, 1)} Tagen`;
}

/** Plural-Helfer: plural(3, 'Satz', 'Sätze') -> "3 Sätze" */
export function plural(n, one, many, fmt = fmtNum) {
  return `${fmt(n)} ${n === 1 ? one : many}`;
}
