// Vorgespeicherte Workouts aus dem Trainingsplan (trainingsplan/Trainingsplan.pdf).
// Abgestimmt mit dem Nutzer: „3?“ -> 3 Saetze, Explosiv-Uebungen ohne Angabe -> 3 x 5,
// Upper B bekommt dieselben Explosiv-Uebungen wie Upper A, Aufwaermen als Hinweis (note).
// startKg: Gewicht aus dem Plan, wird nur als Platzhalter genutzt, solange es fuer die Uebung
// noch kein „letztes Mal“ gibt.

const WARMUP_LOWER = 'Aufwärmen: 3–5 min Crosstrainer (bis leichtes Schwitzen eintritt), danach 3–5 min Mobility.';
const WARMUP_UPPER = 'Aufwärmen: 3–5 min Crosstrainer (bis leichtes Schwitzen eintritt), danach 3–5 min Mobility mit Band.';
const PLYO_70 = '1. Satz ca. 70 % Gewicht, danach voll';
const NO_WARMUP = 'Evtl. ohne Aufwärmsatz – testen';

function item(exerciseId, sets, repsMin, repsMax, extra = {}) {
  return {
    exerciseId, sets, repsMin, repsMax,
    supersetGroup: extra.ss ?? null,
    note: extra.note ?? '',
    startKg: extra.kg ?? null,
  };
}

export const TEMPLATES = [
  {
    id: 'lower-a', name: 'Lower A', builtIn: true, order: 0,
    note: WARMUP_LOWER + ' Explosiv-Block ca. 10 min.',
    items: [
      item('hexbar-jumps', 3, 5, 5, { note: PLYO_70 }),
      item('bss-jumps', 3, 5, 5, { note: PLYO_70 }),
      item('beinpresse', 3, 6, 8, { kg: 300 }),
      item('rdl', 3, 6, 8, { kg: 80 }),
      item('hip-abduction', 2, 12, 15, { ss: 'A', kg: 80 }),
      item('hip-adduction', 2, 12, 15, { ss: 'A', kg: 60 }),
      item('leg-extension', 2, 6, 8, { kg: 75 }),
      item('leg-curl', 2, 6, 8, { kg: 70 }),
      item('calf-raise', 3, 10, 12, { kg: 42 }),
      item('abdominal', 3, 10, 12, { kg: 40, note: NO_WARMUP }),
    ],
  },
  {
    id: 'lower-b', name: 'Lower B', builtIn: true, order: 1,
    note: WARMUP_LOWER,
    items: [
      item('drop-jumps', 3, 5, 5),
      item('pogo-jumps', 3, 5, 5),
      item('weitsprung', 3, 5, 5),
      item('hack-squat', 3, 6, 8, { kg: 30 }),
      item('rdl', 3, 6, 8, { kg: 80 }),
      item('hip-abduction', 2, 12, 15, { ss: 'A', kg: 80 }),
      item('hip-adduction', 2, 12, 15, { ss: 'A', kg: 60 }),
      item('leg-extension', 2, 6, 8, { kg: 75 }),
      item('leg-curl', 2, 6, 8, { kg: 70 }),
      item('calf-raise', 3, 10, 12, { kg: 42 }),
      item('abdominal', 3, 10, 12, { kg: 40, note: 'Evtl. zu Leg Raise wechseln' }),
    ],
  },
  {
    id: 'upper-a', name: 'Upper A', builtIn: true, order: 2,
    note: WARMUP_UPPER,
    items: [
      item('push-press-kh', 3, 5, 5),
      item('explosive-liegestuetze', 3, 5, 5),
      item('schraegbank-lh', 3, 6, 8),
      item('klimmzuege', 3, 6, 8),
      item('dips', 2, 6, 8, { note: NO_WARMUP }),
      item('butterfly', 2, 6, 8),
      item('rudern-eng', 2, 6, 8),
      item('seitheben', 2, 6, 8, { note: 'Am Kabel ausprobieren' }),
      item('bizepscurls', 2, 6, 8),
    ],
  },
  {
    id: 'upper-b', name: 'Upper B', builtIn: true, order: 3,
    note: WARMUP_UPPER,
    items: [
      item('push-press-kh', 3, 5, 5),
      item('explosive-liegestuetze', 3, 5, 5),
      item('bankdruecken-lh', 3, 6, 8),
      item('rudern-breit', 2, 6, 8),
      item('butterfly', 2, 6, 8),
      item('latzug', 2, 6, 8),
      item('trizeps-pressdown', 2, 6, 8),
      item('hammercurls', 2, 6, 8),
      item('overhead-trizeps', 2, 6, 8, { note: NO_WARMUP }),
    ],
  },
];
