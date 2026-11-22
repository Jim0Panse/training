// Muskelgruppen (Konstanten, werden nicht in der Datenbank gespeichert).
// views: auf welcher Ansicht der Koerperfigur der Muskel zu sehen ist.
// recoveryH: Basis-Erholungszeit in Stunden.
// region: upper | core | lower – der Rumpf zaehlt weder zum Ober- noch zum Unterkoerper.
// tier: Stufe der Wochen-Richtwerte (TARGETS).

// Richtwerte in effektiven Saetzen pro Woche (Hauptmuskel 1, Nebenmuskel 0,5), Details in lib/balance.js:
// std   – unter 4 kaum Muskelaufbau (Iversen et al. 2021), 10–20 guter Bereich (Schoenfeld et al. 2017)
// small – Bereiche, die bei vielen Uebungen stark mitarbeiten oder Teil eines groesseren Muskels sind
export const TARGETS = {
  std: { min: 4, from: 10, to: 20 },
  small: { min: 2, from: 4, to: 12 },
};

export const MUSCLES = [
  { id: 'brust',           name: 'Brust',                   views: ['front'],         recoveryH: 72, region: 'upper', tier: 'std' },
  { id: 'schulter_vorne',  name: 'Vordere Schulter',        views: ['front'],         recoveryH: 48, region: 'upper', tier: 'small' },
  { id: 'schulter_seite',  name: 'Seitliche Schulter',      views: ['front', 'back'], recoveryH: 48, region: 'upper', tier: 'std' },
  { id: 'schulter_hinten', name: 'Hintere Schulter',        views: ['back'],          recoveryH: 48, region: 'upper', tier: 'std' },
  { id: 'bizeps',          name: 'Bizeps',                  views: ['front'],         recoveryH: 48, region: 'upper', tier: 'std' },
  { id: 'trizeps',         name: 'Trizeps',                 views: ['back'],          recoveryH: 48, region: 'upper', tier: 'std' },
  { id: 'unterarme',       name: 'Unterarme',               views: ['front', 'back'], recoveryH: 36, region: 'upper', tier: 'small' },
  { id: 'bauch_oben',      name: 'Obere Bauchmuskeln',      views: ['front'],         recoveryH: 36, region: 'core',  tier: 'small' },
  { id: 'bauch_unten',     name: 'Untere Bauchmuskeln',     views: ['front'],         recoveryH: 36, region: 'core',  tier: 'small' },
  { id: 'seitl_bauch',     name: 'Seitliche Bauchmuskeln',  views: ['front'],         recoveryH: 36, region: 'core',  tier: 'small' },
  { id: 'trapez',          name: 'Trapez / oberer Rücken',  views: ['back'],          recoveryH: 48, region: 'upper', tier: 'std' },
  { id: 'latissimus',      name: 'Latissimus',              views: ['back'],          recoveryH: 72, region: 'upper', tier: 'std' },
  { id: 'unterer_ruecken', name: 'Unterer Rücken',          views: ['back'],          recoveryH: 72, region: 'core',  tier: 'small' },
  { id: 'gesaess',         name: 'Gesäß',                   views: ['back'],          recoveryH: 72, region: 'lower', tier: 'std' },
  { id: 'quadrizeps',      name: 'Quadrizeps',              views: ['front'],         recoveryH: 72, region: 'lower', tier: 'std' },
  { id: 'beinbeuger',      name: 'Beinbeuger',              views: ['back'],          recoveryH: 72, region: 'lower', tier: 'std' },
  { id: 'adduktoren',      name: 'Adduktoren',              views: ['front'],         recoveryH: 48, region: 'lower', tier: 'small' },
  { id: 'waden',           name: 'Waden',                   views: ['front', 'back'], recoveryH: 36, region: 'lower', tier: 'std' },
];

export const MUSCLE = Object.fromEntries(MUSCLES.map((m) => [m.id, m]));
export const muscleName = (id) => MUSCLE[id]?.name ?? id;
/** Wochen-Richtwert eines Muskels: { min, from, to } in effektiven Saetzen */
export const muscleTarget = (id) => TARGETS[MUSCLE[id]?.tier] || TARGETS.std;

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
