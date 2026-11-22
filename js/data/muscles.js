// Muskelgruppen (Konstanten, werden nicht in der Datenbank gespeichert).
// views: auf welcher Ansicht der Koerperfigur der Muskel zu sehen ist.
// recoveryH: Basis-Erholungszeit in Stunden.

export const MUSCLES = [
  { id: 'brust',           name: 'Brust',                   views: ['front'],         recoveryH: 72 },
  { id: 'schulter_vorne',  name: 'Vordere Schulter',        views: ['front'],         recoveryH: 48 },
  { id: 'schulter_seite',  name: 'Seitliche Schulter',      views: ['front', 'back'], recoveryH: 48 },
  { id: 'schulter_hinten', name: 'Hintere Schulter',        views: ['back'],          recoveryH: 48 },
  { id: 'bizeps',          name: 'Bizeps',                  views: ['front'],         recoveryH: 48 },
  { id: 'trizeps',         name: 'Trizeps',                 views: ['back'],          recoveryH: 48 },
  { id: 'unterarme',       name: 'Unterarme',               views: ['front', 'back'], recoveryH: 36 },
  { id: 'bauch_oben',      name: 'Obere Bauchmuskeln',      views: ['front'],         recoveryH: 36 },
  { id: 'bauch_unten',     name: 'Untere Bauchmuskeln',     views: ['front'],         recoveryH: 36 },
  { id: 'seitl_bauch',     name: 'Seitliche Bauchmuskeln',  views: ['front'],         recoveryH: 36 },
  { id: 'trapez',          name: 'Trapez / oberer Rücken',  views: ['back'],          recoveryH: 48 },
  { id: 'latissimus',      name: 'Latissimus',              views: ['back'],          recoveryH: 72 },
  { id: 'unterer_ruecken', name: 'Unterer Rücken',          views: ['back'],          recoveryH: 72 },
  { id: 'gesaess',         name: 'Gesäß',                   views: ['back'],          recoveryH: 72 },
  { id: 'quadrizeps',      name: 'Quadrizeps',              views: ['front'],         recoveryH: 72 },
  { id: 'beinbeuger',      name: 'Beinbeuger',              views: ['back'],          recoveryH: 72 },
  { id: 'adduktoren',      name: 'Adduktoren',              views: ['front'],         recoveryH: 48 },
  { id: 'waden',           name: 'Waden',                   views: ['front', 'back'], recoveryH: 36 },
];

export const MUSCLE = Object.fromEntries(MUSCLES.map((m) => [m.id, m]));
export const muscleName = (id) => MUSCLE[id]?.name ?? id;

// Gruppen fuer Filter-Chips
export const MUSCLE_GROUPS = [
  { id: 'brust',    name: 'Brust',     muscles: ['brust'] },
  { id: 'schulter', name: 'Schultern', muscles: ['schulter_vorne', 'schulter_seite', 'schulter_hinten'] },
  { id: 'ruecken',  name: 'Rücken',    muscles: ['trapez', 'latissimus', 'unterer_ruecken'] },
  { id: 'arme',     name: 'Arme',      muscles: ['bizeps', 'trizeps', 'unterarme'] },
  { id: 'bauch',    name: 'Bauch',     muscles: ['bauch_oben', 'bauch_unten', 'seitl_bauch'] },
  { id: 'beine',    name: 'Beine',     muscles: ['quadrizeps', 'beinbeuger', 'adduktoren', 'waden'] },
  { id: 'gesaess',  name: 'Gesäß',     muscles: ['gesaess'] },
];

// Kurznamen fuer kleine Chips
export const MUSCLE_SHORT = {
  brust: 'Brust', schulter_vorne: 'Schulter', schulter_seite: 'Schulter', schulter_hinten: 'Hint. Schulter',
  bizeps: 'Bizeps', trizeps: 'Trizeps', unterarme: 'Unterarme', bauch_oben: 'Ob. Bauch', bauch_unten: 'Unt. Bauch', seitl_bauch: 'Seitl. Bauch',
  trapez: 'Trapez', latissimus: 'Latissimus', unterer_ruecken: 'Unt. Rücken', gesaess: 'Gesäß',
  quadrizeps: 'Quadrizeps', beinbeuger: 'Beinbeuger', adduktoren: 'Adduktoren', waden: 'Waden',
};

// ---------- Umstellung aelterer Daten ----------
// Bis Version 1.1 gab es nur „Bauch“, seit 1.2 obere und untere Bauchmuskeln getrennt.
const ABS = ['bauch_oben', 'bauch_unten'];
// Vorgespeicherte Uebungen mit klarem Schwerpunkt: [Hauptmuskel, dazu als Nebenmuskel]
const ABS_SPLIT = {
  abdominal: ['bauch_oben', 'bauch_unten'],
  crunches: ['bauch_oben', 'bauch_unten'],
  'beinheben-haengend': ['bauch_unten', 'bauch_oben'],
};

/** Ersetzt veraltete Muskel-Ids einer Uebung -> neue Uebung, oder null wenn nichts zu tun ist. */
export function upgradeExerciseMuscles(ex) {
  const old = (a) => Array.isArray(a) && a.includes('bauch');
  if (!ex || (!old(ex.primary) && !old(ex.secondary))) return null;
  const split = ex.builtIn ? ABS_SPLIT[ex.id] : null;
  const uniq = (a) => [...new Set(a)];
  const primary = uniq((ex.primary || []).flatMap((m) => (m === 'bauch' ? (split ? [split[0]] : ABS) : [m])));
  const secondary = (ex.secondary || []).flatMap((m) => (m === 'bauch' ? ABS : [m]));
  if (split && (ex.primary || []).includes('bauch')) secondary.push(split[1]);
  return { ...ex, primary, secondary: uniq(secondary).filter((m) => !primary.includes(m)) };
}
