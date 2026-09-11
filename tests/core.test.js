// tests/core.test.js — tests du noyau métier (js/core.js).
// Aucune dépendance : `npm test` fonctionne avec Node seul.
const test = require('node:test');
const assert = require('node:assert');

const core = require('../js/core.js');

const {
  localISO, todayISO, yesterdayISO, parseISO, displayDate, shortDate, toISO,
  startOfWeek, currentWeek, addDays, deadlineInfo,
  formatTime, formatDuration, formatVolume,
  calc1RM, best1RM, estimateKcal, weeklyVolume,
  sessionsInRange, sessionsSince, totalSeconds, minutesSince,
  goalCurrent, isAutoTracked, goalProgress,
  calcBMI, bmiCategory, calcBMR, calcTDEE, idealWeight, macroTargets,
  esc, safeUrl, debounce, setupCanvas, showHint,
  defaultState, migrateState, looksLikeBackup, rolloverNeeded,
  SCHEMA_VERSION, DAY_KEYS
} = core;

/* ── Dates ────────────────────────────────────────────────────────────────── */

test('les dates sont produites en ISO local, jamais en UTC', () => {
  const d = new Date(2026, 8, 11, 23, 30);            // 11 septembre 2026, 23 h 30 locales
  assert.strictEqual(localISO(d), '2026-09-11');
  assert.strictEqual(localISO(new Date(2026, 0, 1, 0, 5)), '2026-01-01');
});

test('la date d\'aujourd\'hui correspond au calendrier local', () => {
  const now = new Date();
  const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  assert.strictEqual(todayISO(), expected);
});

test('parseISO renvoie une date locale à midi (aucun effet de bord)', () => {
  const d = parseISO('2026-09-11');
  assert.strictEqual(d.getFullYear(), 2026);
  assert.strictEqual(d.getMonth(), 8);
  assert.strictEqual(d.getDate(), 11);
  assert.strictEqual(d.getHours(), 12);
  assert.strictEqual(parseISO('11/09/2026'), null);
  assert.strictEqual(parseISO(''), null);
  assert.strictEqual(parseISO(null), null);
});

test('toISO convertit les anciennes dates françaises et rejette le reste', () => {
  assert.strictEqual(toISO('11/09/2026'), '2026-09-11');
  assert.strictEqual(toISO('2026-09-11'), '2026-09-11');
  assert.strictEqual(toISO('11-09-2026'), null);
  assert.strictEqual(toISO(42), null);
  assert.strictEqual(toISO(undefined), null);
});

test('displayDate et shortDate restent tolérantes aux anciens formats', () => {
  assert.strictEqual(displayDate('2026-09-11'), '11/09/2026');
  assert.strictEqual(displayDate('11/09/2026'), '11/09/2026');   // valeur héritée
  assert.strictEqual(displayDate(''), '');
  assert.strictEqual(shortDate('2026-09-11'), '11/09');
  assert.strictEqual(shortDate('inconnu'), 'inconnu');
});

test('la semaine commence le lundi et couvre sept jours', () => {
  const mercredi = new Date(2026, 8, 9);              // mercredi 9 septembre 2026
  const start = startOfWeek(mercredi);
  assert.strictEqual(localISO(start), '2026-09-07');  // lundi
  assert.strictEqual(start.getDay(), 1);

  const dimanche = new Date(2026, 8, 13);             // dimanche → lundi précédent
  assert.strictEqual(localISO(startOfWeek(dimanche)), '2026-09-07');

  const lundi = new Date(2026, 8, 7);
  assert.strictEqual(localISO(startOfWeek(lundi)), '2026-09-07');   // un lundi reste sur place
});

test('currentWeek renvoie lundi, dimanche et le jour courant', () => {
  const week = currentWeek(new Date(2026, 8, 9));
  assert.deepStrictEqual(
    { start: week.start, end: week.end, today: week.today },
    { start: '2026-09-07', end: '2026-09-13', today: '2026-09-09' }
  );
});

test('addDays traverse les fins de mois et les années', () => {
  assert.strictEqual(localISO(addDays(new Date(2026, 8, 30), 3)), '2026-10-03');
  assert.strictEqual(localISO(addDays(new Date(2026, 11, 31), 1)), '2027-01-01');
  assert.strictEqual(localISO(addDays(new Date(2026, 0, 1), -1)), '2025-12-31');
});

test('deadlineInfo qualifie l\'échéance d\'un objectif', () => {
  const ref = new Date(2026, 8, 11, 9, 0);
  assert.deepStrictEqual(deadlineInfo('2026-09-10', ref), { days: -1, kind: 'past' });
  assert.deepStrictEqual(deadlineInfo('2026-09-11', ref), { days: 0, kind: 'today' });
  assert.deepStrictEqual(deadlineInfo('2026-09-15', ref), { days: 4, kind: 'soon' });
  assert.deepStrictEqual(deadlineInfo('2026-10-11', ref), { days: 30, kind: 'later' });
  assert.strictEqual(deadlineInfo('', ref), null);
});

/* ── Formats ──────────────────────────────────────────────────────────────── */

test('formatTime affiche mm:ss', () => {
  assert.strictEqual(formatTime(0), '00:00');
  assert.strictEqual(formatTime(59), '00:59');
  assert.strictEqual(formatTime(90), '01:30');
  assert.strictEqual(formatTime(3661), '61:01');
  assert.strictEqual(formatTime(-5), '00:00');
});

test('formatDuration résume des minutes en heures', () => {
  assert.strictEqual(formatDuration(0), '0 min');
  assert.strictEqual(formatDuration(45), '45 min');
  assert.strictEqual(formatDuration(60), '1 h');
  assert.strictEqual(formatDuration(90), '1 h 30');
  assert.strictEqual(formatDuration(125), '2 h 05');
});

test('formatVolume bascule en tonnes au-delà de 1 000 kg', () => {
  assert.strictEqual(formatVolume(850), '850 kg');
  assert.strictEqual(formatVolume(1600), '1,6 t');
  assert.strictEqual(formatVolume(12000), '12 t');
});

/* ── Calculs sportifs ─────────────────────────────────────────────────────── */

test('le 1RM suit la formule d\'Epley', () => {
  assert.strictEqual(calc1RM(100, 1), 100);
  assert.strictEqual(calc1RM(100, 5), 117);
  assert.strictEqual(calc1RM(60, 10), 80);
  assert.strictEqual(calc1RM(0, 5), 0);
});

test('best1RM retient la meilleure estimation, sans tenir compte de la casse', () => {
  const lifts = [
    { name: 'Squat', w: 100, r: 5 },       // 117
    { name: 'squat', w: 120, r: 3 },       // 132
    { name: 'Développé couché', w: 80, r: 5 }
  ];
  assert.strictEqual(best1RM(lifts, 'SQUAT'), 132);
  assert.strictEqual(best1RM(lifts, 'Développé couché'), 93);
  assert.strictEqual(best1RM(lifts, 'Inconnu'), 0);
  assert.strictEqual(best1RM([], 'Squat'), 0);
  assert.strictEqual(best1RM(lifts, ''), 0);
});

test('l\'estimation de calories suit la formule MET documentée', () => {
  assert.strictEqual(estimateKcal(60, 80), Math.round(6 * 3.5 * 80 / 200 * 60));
  assert.strictEqual(estimateKcal(60, 80), 504);
  assert.strictEqual(estimateKcal(0, 80), 0);
  assert.strictEqual(estimateKcal(60, 0), Math.round(6 * 3.5 * 75 / 200 * 60));  // poids par défaut
});

test('le volume hebdomadaire classe les charges par semaine', () => {
  const ref = new Date(2026, 8, 9);                   // mercredi 9 septembre
  const lifts = [
    { name: 'Squat', w: 100, r: 5, date: '2026-09-07' },   // semaine en cours (lundi)
    { name: 'Squat', w: 100, r: 5, date: '2026-09-13' },   // dimanche, même semaine
    { name: 'Bench', w: 60, r: 10, date: '2026-09-06' },   // dimanche précédent
    { name: 'Bench', w: 60, r: 10, date: '2026-01-01' },   // hors fenêtre
    { name: 'Rowing', w: 50, r: 10, date: '11/09/2026' }   // ancien format, migré
  ];
  const buckets = weeklyVolume(lifts, ref, 4);
  assert.strictEqual(buckets.length, 4);
  assert.strictEqual(buckets[3].start, '2026-09-07');
  assert.strictEqual(buckets[3].end, '2026-09-13');
  assert.strictEqual(buckets[3].value, 1000 + 500);
  assert.strictEqual(buckets[3].count, 3);
  assert.strictEqual(buckets[2].value, 600);
  assert.strictEqual(buckets[0].value, 0);
});

/* ── Séances et objectifs ─────────────────────────────────────────────────── */

const HISTORY = [
  { date: '2026-09-11', duration: 2700, exercises: ['Squat'] },
  { date: '2026-09-09', duration: 1800, exercises: ['Dips'] },
  { date: '2026-08-01', duration: 3600, exercises: ['Rowing'] }
];

test('les séances se filtrent par plage de dates', () => {
  assert.strictEqual(sessionsInRange(HISTORY, '2026-09-01', '2026-09-30').length, 2);
  assert.strictEqual(sessionsInRange(HISTORY, null, '2026-09-09').length, 2);
  assert.strictEqual(sessionsInRange(HISTORY, '2026-09-10', null).length, 1);
  assert.strictEqual(sessionsSince(HISTORY, '2026-09-01').length, 2);
  assert.strictEqual(sessionsSince(HISTORY, null).length, 3);
  assert.strictEqual(totalSeconds(HISTORY), 8100);
  assert.strictEqual(minutesSince(HISTORY, '2026-09-10'), 45);
});

test('un objectif « séances » ne compte que les séances depuis sa création', () => {
  const goal = { type: 'sessions', target: 20, createdAt: '2026-09-10' };
  assert.strictEqual(goalCurrent(goal, { sessionHistory: HISTORY }), 1);
  assert.strictEqual(isAutoTracked(goal), true);
});

test('un objectif « durée » cumule les minutes depuis sa création', () => {
  const goal = { type: 'duration', target: 600, createdAt: '2026-09-01' };
  assert.strictEqual(goalCurrent(goal, { sessionHistory: HISTORY }), 75);
  assert.strictEqual(goalProgress(75, 600), 13);
});

test('un objectif de force suit le 1RM de l\'exercice suivi', () => {
  const lifts = [{ name: 'Squat', w: 120, r: 5 }];      // 140
  assert.strictEqual(goalCurrent({ type: 'weight', exercise: 'Squat' }, { lifts }), 140);
  assert.strictEqual(goalCurrent({ type: 'weight', exercise: 'Squat', target: 200 }, { lifts }), 140);
  assert.strictEqual(isAutoTracked({ type: 'weight', exercise: '' }), false);
});

test('un objectif personnalisé reste manuel', () => {
  const goal = { type: 'custom', current: 30, target: 100 };
  assert.strictEqual(goalCurrent(goal, {}), 30);
  assert.strictEqual(isAutoTracked(goal), false);
  assert.strictEqual(goalProgress(30, 100), 30);
});

test('la progression est bornée et se protège des cibles absentes', () => {
  assert.strictEqual(goalProgress(150, 100), 100);
  assert.strictEqual(goalProgress(0, 0), 0);
  assert.strictEqual(goalProgress(5, null), 0);
  assert.strictEqual(goalCurrent(null, {}), 0);
});

/* ── Profil ───────────────────────────────────────────────────────────────── */

test('IMC et catégories', () => {
  assert.strictEqual(Math.round(calcBMI(80, 180) * 10) / 10, 24.7);
  assert.strictEqual(calcBMI(0, 180), null);
  assert.strictEqual(bmiCategory(17).label, 'Insuffisance pondérale');
  assert.strictEqual(bmiCategory(22).label, 'Poids normal');
  assert.strictEqual(bmiCategory(27).label, 'Surpoids');
  assert.strictEqual(bmiCategory(32).label, 'Obésité');
});

test('métabolisme de base (Harris-Benedict révisée) et dépense journalière', () => {
  const homme = { weight: 80, height: 180, age: 30, gender: 'male' };
  const femme = { weight: 60, height: 165, age: 28, gender: 'female' };
  assert.strictEqual(Math.round(calcBMR(homme)), 1854);   // Harris-Benedict révisée
  assert.strictEqual(Math.round(calcBMR(femme)), 1392);
  assert.strictEqual(calcBMR({ weight: 80 }), null);
  assert.strictEqual(calcTDEE(1854, 'moderate'), Math.round(1854 * 1.55));
  assert.strictEqual(calcTDEE(1854, 'inconnu'), Math.round(1854 * 1.55));   // repli prudent
  assert.strictEqual(calcTDEE(null, 'moderate'), null);
});

test('poids idéal (Lorentz) et objectifs macro', () => {
  assert.strictEqual(idealWeight(180, 'male'), 73);
  assert.strictEqual(idealWeight(165, 'female'), 59);
  assert.strictEqual(idealWeight(0, 'male'), null);

  const macros = macroTargets(2500, 80);
  assert.deepStrictEqual(macros, { cal: 2500, prot: 144, carb: 281, fat: 78 });
  assert.strictEqual(macroTargets(null, 80), null);
});

/* ── Sûreté ───────────────────────────────────────────────────────────────── */

test('esc neutralise le HTML', () => {
  assert.strictEqual(esc('<img src=x onerror="alert(1)">'),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.strictEqual(esc("O'Brien & fils"), 'O&#39;Brien &amp; fils');
  assert.strictEqual(esc(undefined), '');
  assert.strictEqual(esc(0), '0');
});

test('safeUrl n\'accepte que http(s)', () => {
  assert.strictEqual(safeUrl('https://example.com/video'), 'https://example.com/video');
  assert.strictEqual(safeUrl('http://example.com'), 'http://example.com');
  assert.strictEqual(safeUrl('javascript:alert(1)'), '');
  assert.strictEqual(safeUrl('data:text/html;base64,PHN2Zz4='), '');
  assert.strictEqual(safeUrl('   '), '');
  assert.strictEqual(safeUrl(null), '');
});

test('debounce ne déclenche l\'appel qu\'après la pause', async () => {
  let calls = 0;
  const fn = debounce(() => { calls++; }, 20);
  fn(); fn(); fn();
  assert.strictEqual(calls, 0);
  await new Promise(r => setTimeout(r, 60));
  assert.strictEqual(calls, 1);
});

test('setupCanvas adapte le tampon à la densité de l\'écran', () => {
  const transforms = [];
  const canvas = {
    style: {}, width: 0, height: 0,
    getContext: () => ({ setTransform: (...a) => transforms.push(a) })
  };

  const r = setupCanvas(canvas, 300, 200, 2);
  assert.strictEqual(canvas.width, 600, 'tampon doublé pour un écran 2×');
  assert.strictEqual(canvas.height, 400);
  assert.strictEqual(canvas.style.width, '300px', 'taille CSS inchangée');
  assert.strictEqual(canvas.style.height, '200px');
  assert.deepStrictEqual(transforms, [[2, 0, 0, 2, 0, 0]], 'mise à l\'échelle du contexte');
  assert.strictEqual(r.width, 300, 'le dessin reste en pixels CSS');
  assert.strictEqual(r.height, 200);
  assert.strictEqual(r.ratio, 2);

  setupCanvas(canvas, 300, 200, undefined);
  assert.strictEqual(canvas.width, 300, '1× par défaut');
  setupCanvas(canvas, 300, 200, 0.5);
  assert.strictEqual(canvas.width, 300, 'jamais en dessous de 1×');
  setupCanvas(canvas, 300, 200, 8);
  assert.strictEqual(canvas.width, 900, 'plafonné à 3× (mémoire)');
});

test('showHint écrit le message et la classe de style demandée', () => {
  const previousDocument = global.document;
  const el = { textContent: '', className: '' };
  global.document = { getElementById: id => (id === 'ma-zone' ? el : null) };

  assert.strictEqual(showHint('ma-zone', 'Poids invalide.', 'error'), true);
  assert.strictEqual(el.textContent, 'Poids invalide.');
  assert.strictEqual(el.className, 'form-hint error');

  assert.strictEqual(showHint('ma-zone', 'Enregistré.', 'success'), true);
  assert.strictEqual(el.className, 'form-hint success');

  showHint('ma-zone', '');
  assert.strictEqual(el.className, 'form-hint ', 'sans type, la classe reste neutre');

  assert.strictEqual(showHint('zone-absente', 'x'), false, 'zone absente : aucun plantage');
  assert.strictEqual(showHint('ma-zone', undefined), true);

  if (previousDocument === undefined) delete global.document;
  else global.document = previousDocument;
});

/* ── État et migration ────────────────────────────────────────────────────── */

test('l\'état par défaut est complet et au bon schéma', () => {
  const s = defaultState();
  assert.strictEqual(s.schemaVersion, SCHEMA_VERSION);
  assert.deepStrictEqual(Object.keys(s.planning).sort(), [...DAY_KEYS].sort());
  assert.deepStrictEqual(s.meals, []);
  assert.strictEqual(s.water, 0);
  assert.deepStrictEqual(s.doneExos, {});
  assert.strictEqual(s.profile.gender, 'male');
});

test('migrateState répare un contenu corrompu sans lever d\'exception', () => {
  for (const broken of [null, undefined, 42, 'texte', [], { planning: 'non' }]) {
    const { state: s } = migrateState(broken, '2026-09-11');
    assert.strictEqual(s.schemaVersion, SCHEMA_VERSION);
    assert.deepStrictEqual(Object.keys(s.planning).sort(), [...DAY_KEYS].sort());
    assert.ok(Array.isArray(s.meals) && Array.isArray(s.lifts));
  }
});

test('migrateState convertit les anciennes sauvegardes (v3) sans perte', () => {
  const legacy = {
    planning: { Lundi: [['Squat', 4, 8, 120, '']] },
    lifts: [{ name: 'Squat', w: 100, r: 5, date: '12/05/2026', isPR: true }],
    meals: [{ name: 'Riz', cal: 600, prot: 40, carbs: 70, fat: 12 }],
    sessionHistory: [{ date: '12/05/2026', duration: 2400, exercises: ['Squat'] }],
    weightLog: [{ date: '01/05/2026', weight: 82 }, { date: '20/05/2026', weight: 81 }],
    weeklyVolume: [3200, 3450],
    water: 5,
    profile: { name: 'Baye', weight: 81, height: 180 }
  };
  const { state: s, changed } = migrateState(legacy, '2026-09-11');
  assert.strictEqual(changed, true);
  assert.strictEqual(s.schemaVersion, SCHEMA_VERSION);
  assert.strictEqual(s.lifts[0].date, '2026-05-12');
  assert.strictEqual(s.sessionHistory[0].date, '2026-05-12');
  assert.strictEqual(s.weightLog[0].date, '2026-05-01');
  assert.ok(s.weightLog[0].ts > 0, 'horodatage reconstruit pour le tri');
  assert.strictEqual(s.meals[0].date, '2026-09-11', 'repas sans date rattachés au jour courant');
  assert.strictEqual(s.weeklyVolume, undefined, 'données fictives supprimées');
  assert.strictEqual(s.waterDate, '2026-09-11');
  assert.deepStrictEqual(s.doneExos, {});
  assert.strictEqual(s.profile.sportGoal, 'muscle', 'champs manquants du profil complétés');
  assert.strictEqual(s.profile.name, 'Baye', 'données existantes préservées');
  assert.strictEqual(s.planning.Lundi.length, 1);
  assert.strictEqual(s.water, 5, 'compteur conservé (remis à zéro par rolloverDailyState)');
});

test('migrateState écarte les entrées irrécupérables', () => {
  const dirty = {
    lifts: [null, 'x', { name: 'Squat', w: 100, r: 5 }],
    meals: [null, { name: 'Riz', cal: 600 }],
    weightLog: [{ date: '2026-01-01' }, { date: '2026-01-02', weight: 80 }],
    goals: [null, { title: 'Objectif' }],
    doneExos: { '2026-09-01': 'pas un tableau', '2026-09-02': ['Squat'] }
  };
  const { state: s } = migrateState(dirty, '2026-09-11');
  assert.strictEqual(s.lifts.length, 1);
  assert.strictEqual(s.meals.length, 1);
  assert.strictEqual(s.weightLog.length, 1);
  assert.strictEqual(s.goals.length, 1);
  assert.strictEqual(s.goals[0].achieved, false);
  assert.strictEqual(s.goals[0].createdAt, '2026-09-11');
  assert.deepStrictEqual(s.doneExos['2026-09-01'], []);
});

test('migrateState est idempotente', () => {
  const first = migrateState({ water: 3 }, '2026-09-11').state;
  const second = migrateState(JSON.parse(JSON.stringify(first)), '2026-09-11');
  assert.strictEqual(second.changed, false, 'une seconde passe ne modifie plus rien');
  assert.deepStrictEqual(second.state, first);
});

test('looksLikeBackup reconnaît une sauvegarde et rejette le reste', () => {
  assert.strictEqual(looksLikeBackup({ planning: {}, lifts: [] }), true);
  assert.strictEqual(looksLikeBackup({ profile: { name: 'Baye' } }), true);
  assert.strictEqual(looksLikeBackup({ foo: 1 }), false);
  assert.strictEqual(looksLikeBackup([]), false);
  assert.strictEqual(looksLikeBackup(null), false);
  assert.strictEqual(looksLikeBackup('texte'), false);
});

test('rolloverNeeded détecte le changement de jour', () => {
  assert.strictEqual(rolloverNeeded('2026-09-10', '2026-09-11'), true);
  assert.strictEqual(rolloverNeeded('2026-09-11', '2026-09-11'), false);
  assert.strictEqual(rolloverNeeded(null, '2026-09-11'), true);
  assert.strictEqual(rolloverNeeded(undefined, '2026-09-11'), true);
});

test('yesterdayISO renvoie bien la veille', () => {
  const now = new Date();
  const veille = new Date(now.getTime());
  veille.setDate(veille.getDate() - 1);
  assert.strictEqual(yesterdayISO(), localISO(veille));
  assert.notStrictEqual(yesterdayISO(), todayISO());
});
