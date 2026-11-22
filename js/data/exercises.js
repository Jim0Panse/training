// Vorgespeicherte Uebungen. Werden nur beim allerersten Start in die Datenbank geschrieben
// und danach nie wieder automatisch ueberschrieben (Nutzer-Aenderungen bleiben erhalten).

export const CATEGORIES = { kraft: 'Kraft', plyometrie: 'Plyometrie', mobilitaet: 'Mobilität', cardio: 'Cardio' };
export const EQUIPMENT = {
  langhantel: 'Langhantel', kurzhantel: 'Kurzhantel', maschine: 'Maschine',
  kabel: 'Kabel', koerpergewicht: 'Körpergewicht', sonstiges: 'Sonstiges',
};
export const TRACKING = {
  gewicht_wdh: 'Gewicht + Wdh.',
  zusatzgewicht_wdh: 'Zusatzgewicht + Wdh.',
  wdh: 'Nur Wiederholungen',
  zeit: 'Zeit',
  distanz_zeit: 'Distanz + Zeit',
};
export const DEFAULT_INCREMENT = { langhantel: 2.5, kurzhantel: 2, maschine: 2.5, kabel: 2.5, koerpergewicht: 2.5, sonstiges: 2.5 };

/** Erfassungsart-Vorschlag aus Kategorie + Equipment (im Formular aenderbar). */
export function suggestTracking(category, equipment) {
  if (category === 'cardio') return 'distanz_zeit';
  if (category === 'mobilitaet') return 'zeit';
  if (category === 'plyometrie') return 'wdh';
  if (equipment === 'koerpergewicht') return 'zusatzgewicht_wdh';
  return 'gewicht_wdh';
}

function ex(id, name, primary, secondary, equipment, tracking = 'gewicht_wdh', category = 'kraft', incrementKg) {
  return {
    id, name, builtIn: true,
    primary, secondary,
    equipment, category, tracking,
    incrementKg: incrementKg ?? DEFAULT_INCREMENT[equipment],
    note: '', archived: false,
  };
}

export const EXERCISES = [
  // ---- Aus dem Trainingsplan (Lower A/B, Upper A/B, „Allgemein“) ----
  ex('hexbar-jumps', 'Hexbar Jumps', ['quadrizeps', 'gesaess'], ['waden', 'beinbeuger'], 'langhantel', 'gewicht_wdh', 'plyometrie'),
  ex('bss-jumps', 'Bulgarian Split Squat Jumps', ['quadrizeps', 'gesaess'], ['adduktoren', 'waden'], 'kurzhantel', 'gewicht_wdh', 'plyometrie'),
  ex('beinpresse', 'Beinpresse', ['quadrizeps', 'gesaess'], ['adduktoren'], 'maschine', 'gewicht_wdh', 'kraft', 5),
  ex('rdl', 'Rumänisches Kreuzheben', ['beinbeuger', 'gesaess'], ['unterer_ruecken'], 'langhantel'),
  ex('hip-abduction', 'Hip Abduction', ['gesaess'], [], 'maschine'),
  ex('hip-adduction', 'Hip Adduction', ['adduktoren'], [], 'maschine'),
  ex('leg-extension', 'Leg Extension', ['quadrizeps'], [], 'maschine'),
  ex('leg-curl', 'Leg Curl', ['beinbeuger'], [], 'maschine'),
  ex('calf-raise', 'Calf Raise', ['waden'], [], 'maschine'),
  ex('abdominal', 'Abdominal', ['bauch_oben'], ['bauch_unten'], 'maschine'),
  ex('drop-jumps', 'Drop Jumps', ['quadrizeps', 'waden'], ['gesaess'], 'koerpergewicht', 'wdh', 'plyometrie'),
  ex('pogo-jumps', 'Pogo Jumps', ['waden'], ['quadrizeps'], 'koerpergewicht', 'wdh', 'plyometrie'),
  ex('weitsprung', 'Weitsprung', ['quadrizeps', 'gesaess'], ['waden', 'beinbeuger'], 'koerpergewicht', 'wdh', 'plyometrie'),
  ex('hack-squat', 'Hack Squat', ['quadrizeps'], ['gesaess', 'adduktoren'], 'maschine', 'gewicht_wdh', 'kraft', 5),
  ex('push-press-kh', 'Push Press (Kurzhantel)', ['schulter_vorne'], ['schulter_seite', 'trizeps', 'quadrizeps'], 'kurzhantel', 'gewicht_wdh', 'plyometrie'),
  ex('explosive-liegestuetze', 'Explosive Liegestütze', ['brust'], ['trizeps', 'schulter_vorne'], 'koerpergewicht', 'wdh', 'plyometrie'),
  ex('schraegbank-lh', 'Schrägbankdrücken', ['brust', 'schulter_vorne'], ['trizeps'], 'langhantel'),
  ex('klimmzuege', 'Klimmzüge', ['latissimus'], ['bizeps', 'trapez', 'schulter_hinten', 'unterarme'], 'koerpergewicht', 'zusatzgewicht_wdh'),
  ex('dips', 'Dips', ['brust', 'trizeps'], ['schulter_vorne'], 'koerpergewicht', 'zusatzgewicht_wdh'),
  ex('butterfly', 'Butterfly', ['brust'], ['schulter_vorne'], 'maschine'),
  ex('rudern-eng', 'Rudern (Griff innen)', ['latissimus'], ['trapez', 'schulter_hinten', 'bizeps'], 'kabel'),
  ex('seitheben', 'Seitheben', ['schulter_seite'], ['trapez'], 'kurzhantel'),
  ex('bizepscurls', 'Bizepscurls', ['bizeps'], ['unterarme'], 'kurzhantel'),
  ex('bankdruecken-lh', 'Flaches Bankdrücken', ['brust'], ['schulter_vorne', 'trizeps'], 'langhantel'),
  ex('rudern-breit', 'Rudern (Griff außen)', ['trapez', 'latissimus'], ['schulter_hinten', 'bizeps'], 'kabel'),
  ex('latzug', 'Latzug', ['latissimus'], ['bizeps', 'trapez'], 'kabel'),
  ex('trizeps-pressdown', 'Trizeps Pressdown', ['trizeps'], [], 'kabel'),
  ex('hammercurls', 'Hammercurls', ['bizeps', 'unterarme'], [], 'kurzhantel'),
  ex('overhead-trizeps', 'Overhead Trizepsstrecken', ['trizeps'], [], 'kabel'),
  ex('kabelholzhacker', 'Kabelholzhacker', ['seitl_bauch'], ['bauch_oben', 'bauch_unten'], 'kabel'),
  ex('kettlebell-swings', 'Kettlebell Swings', ['gesaess', 'beinbeuger'], ['unterer_ruecken', 'bauch_oben', 'bauch_unten'], 'sonstiges', 'gewicht_wdh', 'plyometrie', 4),

  // ---- Grundliste (ohne Doppelungen zum Plan) ----
  ex('kh-bankdruecken', 'Kurzhantel-Bankdrücken', ['brust'], ['schulter_vorne', 'trizeps'], 'kurzhantel'),
  ex('schraegbank-kh', 'Schrägbankdrücken (Kurzhantel)', ['brust', 'schulter_vorne'], ['trizeps'], 'kurzhantel'),
  ex('kabel-flys', 'Kabel-Flys', ['brust'], ['schulter_vorne'], 'kabel'),
  ex('liegestuetze', 'Liegestütze', ['brust'], ['trizeps', 'schulter_vorne', 'bauch_oben', 'bauch_unten'], 'koerpergewicht', 'wdh'),
  ex('schulterdruecken-kh', 'Schulterdrücken (Kurzhantel)', ['schulter_vorne'], ['schulter_seite', 'trizeps'], 'kurzhantel'),
  ex('reverse-butterfly', 'Reverse Butterfly', ['schulter_hinten'], ['trapez'], 'maschine'),
  ex('face-pulls', 'Face Pulls', ['schulter_hinten'], ['trapez'], 'kabel'),
  ex('sz-stirndruecken', 'SZ-Stirndrücken', ['trizeps'], [], 'langhantel'),
  ex('langhantelrudern', 'Langhantelrudern', ['latissimus', 'trapez'], ['schulter_hinten', 'bizeps', 'unterer_ruecken'], 'langhantel'),
  ex('kh-rudern-einarmig', 'Einarmiges Kurzhantelrudern', ['latissimus'], ['trapez', 'schulter_hinten', 'bizeps'], 'kurzhantel'),
  ex('kreuzheben', 'Kreuzheben', ['gesaess', 'beinbeuger', 'unterer_ruecken'], ['quadrizeps', 'trapez', 'unterarme'], 'langhantel'),
  ex('shrugs', 'Shrugs', ['trapez'], ['unterarme'], 'kurzhantel'),
  ex('hyperextensions', 'Hyperextensions', ['unterer_ruecken'], ['gesaess', 'beinbeuger'], 'koerpergewicht', 'zusatzgewicht_wdh'),
  ex('sz-curls', 'SZ-Curls', ['bizeps'], ['unterarme'], 'langhantel'),
  ex('kniebeuge', 'Kniebeuge', ['quadrizeps', 'gesaess'], ['adduktoren', 'unterer_ruecken'], 'langhantel'),
  ex('frontkniebeuge', 'Frontkniebeuge', ['quadrizeps'], ['gesaess', 'bauch_oben', 'bauch_unten'], 'langhantel'),
  ex('bulgarian-split-squats', 'Bulgarian Split Squats', ['quadrizeps', 'gesaess'], ['adduktoren', 'beinbeuger'], 'kurzhantel'),
  ex('ausfallschritte', 'Ausfallschritte', ['quadrizeps', 'gesaess'], ['adduktoren', 'beinbeuger'], 'kurzhantel'),
  ex('hip-thrust', 'Hip Thrust', ['gesaess'], ['beinbeuger'], 'langhantel'),
  ex('wadenheben-stehend', 'Wadenheben stehend', ['waden'], [], 'maschine'),
  ex('wadenheben-sitzend', 'Wadenheben sitzend', ['waden'], [], 'maschine'),
  ex('crunches', 'Crunches', ['bauch_oben'], ['bauch_unten'], 'koerpergewicht', 'wdh'),
  ex('beinheben-haengend', 'Hängendes Beinheben', ['bauch_unten'], ['seitl_bauch', 'unterarme', 'bauch_oben'], 'koerpergewicht', 'wdh'),
  ex('plank', 'Plank', ['bauch_oben', 'bauch_unten'], ['seitl_bauch'], 'koerpergewicht', 'zeit'),
  ex('russian-twists', 'Russian Twists', ['seitl_bauch'], ['bauch_oben', 'bauch_unten'], 'koerpergewicht', 'zusatzgewicht_wdh'),
  ex('box-jumps', 'Box Jumps', ['quadrizeps', 'gesaess'], ['waden'], 'koerpergewicht', 'wdh', 'plyometrie'),
];
