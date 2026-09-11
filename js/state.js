/* ─────────────────────────────────────────────────────────────────────────────
   État global, schéma de données et helpers de dates.

   Convention : toutes les dates stockées sont en ISO « AAAA-MM-JJ »
   (triables, comparables, indépendantes de la locale et du fuseau).
   L'affichage passe par displayDate() / shortDate().
   ───────────────────────────────────────────────────────────────────────────── */

/* Clé historique : ne jamais la renommer, sinon les données déjà enregistrées
   sur les appareils des utilisateurs deviennent invisibles. La version du schéma
   est portée séparément par SCHEMA_VERSION et gérée par migrateState(). */
const STATE_KEY = 'focusFit_v3';
const SCHEMA_VERSION = 5;
const DAY_KEYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    planning: { Lundi: [], Mardi: [], Mercredi: [], Jeudi: [], Vendredi: [], Samedi: [], Dimanche: [] },
    meals: [],                 // { date: 'AAAA-MM-JJ', name, cal, prot, carbs, fat }
    lifts: [],                 // { name, w, r, date: 'AAAA-MM-JJ', isPR }
    goals: [],
    water: 0,                  // verres bus aujourd'hui
    waterDate: null,           // jour auquel se rapporte `water` (remise à zéro quotidienne)
    doneExos: {},              // { 'AAAA-MM-JJ': [noms d'exercices cochés] }
    sessions: 0,
    streak: 0,
    lastSessionDate: null,
    sessionHistory: [],        // { date, time, duration, day, exercises[], totalExos, logged[], volume }
    calGoal: 2400,
    protGoal: 150,
    carbGoal: 300,
    fatGoal: 80,
    macroTargetsCustom: false,   // true dès que l'utilisateur fixe ses objectifs à la main
    profile: {
      name: 'Baye', age: 0, gender: 'male', weight: 0, height: 0,
      activity: 'moderate', sportGoal: 'muscle', level: 'intermediate'
    },
    weightLog: []
  };
}

/* ── Dates ─────────────────────────────────────────────────────────────────── */

const FR_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** Date locale → « AAAA-MM-JJ » (jamais en UTC : évite les décalages de fuseau). */
function localISO(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function todayISO() { return localISO(new Date()); }

function yesterdayISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localISO(d);
}

/** « AAAA-MM-JJ » → objet Date local (midi, pour éviter tout effet de bord DST). */
function parseISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0);
}

/** « AAAA-MM-JJ » → « JJ/MM/AAAA » (tolère les anciennes valeurs JJ/MM/AAAA). */
function displayDate(value) {
  if (!value) return '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return String(value);
}

/** « AAAA-MM-JJ » → « JJ/MM » pour les axes de graphiques. */
function shortDate(value) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  return iso ? `${iso[3]}/${iso[2]}` : String(value || '');
}

/** « AAAA-MM-JJ » (ou ancien JJ/MM/AAAA) → « AAAA-MM-JJ ». */
function toISO(value) {
  if (typeof value !== 'string') return null;
  const fr = FR_DATE_RE.exec(value);
  if (fr) return `${fr[3]}-${fr[2]}-${fr[1]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/* ── Migration / validation du schéma ──────────────────────────────────────── */

/**
 * Complète un état ancien ou partiel avec les valeurs par défaut, convertit les
 * dates françaises en ISO et supprime les entrées irrécupérables.
 * Ne lève jamais d'exception, quel que soit le contenu stocké.
 */
function migrateState(raw) {
  const def = defaultState();
  let changed = false;
  const s = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : (changed = true, {});

  ['meals', 'lifts', 'goals', 'sessionHistory', 'weightLog'].forEach(key => {
    if (!Array.isArray(s[key])) { s[key] = def[key]; changed = true; }
  });

  if (!s.planning || typeof s.planning !== 'object' || Array.isArray(s.planning)) {
    s.planning = def.planning; changed = true;
  }
  DAY_KEYS.forEach(day => {
    if (!Array.isArray(s.planning[day])) { s.planning[day] = []; changed = true; }
  });

  if (!s.profile || typeof s.profile !== 'object' || Array.isArray(s.profile)) {
    s.profile = def.profile; changed = true;
  } else {
    Object.entries(def.profile).forEach(([k, v]) => {
      if (s.profile[k] === undefined) { s.profile[k] = v; changed = true; }
    });
  }

  ['water', 'sessions', 'streak', 'calGoal', 'protGoal', 'carbGoal', 'fatGoal'].forEach(key => {
    if (typeof s[key] !== 'number' || !Number.isFinite(s[key])) { s[key] = def[key]; changed = true; }
  });

  if (s.lastSessionDate === undefined) { s.lastSessionDate = null; changed = true; }
  if (typeof s.macroTargetsCustom !== 'boolean') { s.macroTargetsCustom = false; changed = true; }

  // L'ancien graphique « 8 semaines » reposait sur des valeurs inventées : on les supprime
  // et le volume est désormais calculé à partir des charges réellement enregistrées.
  if (s.weeklyVolume !== undefined) { delete s.weeklyVolume; changed = true; }

  // Repas : les anciennes entrées n'avaient pas de date, on les rattache au jour courant
  // (c'était déjà ainsi qu'ils étaient comptés) pour que les totaux restent cohérents.
  const today = todayISO();
  s.meals = s.meals.filter(m => m && typeof m === 'object');
  s.meals.forEach(m => {
    if (!toISO(m.date)) { m.date = today; changed = true; }
  });

  if (typeof s.doneExos !== 'object' || s.doneExos === null || Array.isArray(s.doneExos)) {
    s.doneExos = {}; changed = true;
  } else {
    Object.entries(s.doneExos).forEach(([date, names]) => {
      if (!Array.isArray(names)) { s.doneExos[date] = []; changed = true; }
    });
  }

  if (toISO(s.waterDate) === null) { s.waterDate = today; changed = true; }

  // Dates françaises → ISO (lifts, séances, pesées)
  s.lifts = s.lifts.filter(l => l && typeof l === 'object');
  s.lifts.forEach(l => {
    const iso = toISO(l.date);
    if (iso !== l.date) { l.date = iso; changed = true; }
  });

  s.sessionHistory = s.sessionHistory.filter(h => h && typeof h === 'object');
  s.sessionHistory.forEach(h => {
    const iso = toISO(h.date);
    if (iso !== h.date) { h.date = iso; changed = true; }
  });

  s.weightLog = s.weightLog.filter(w => w && typeof w === 'object' && Number.isFinite(w.weight));
  s.weightLog.forEach(w => {
    const iso = toISO(w.date);
    if (iso !== w.date) { w.date = iso; changed = true; }
    const ts = parseISO(w.date);
    if (ts && w.ts !== ts.getTime()) { w.ts = ts.getTime(); changed = true; }
  });
  s.weightLog.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  s.goals = s.goals.filter(g => g && typeof g === 'object');
  s.goals.forEach(g => {
    if (g.createdAt === undefined) { g.createdAt = todayISO(); changed = true; }
    if (g.achieved === undefined) { g.achieved = false; changed = true; }
  });

  if (s.schemaVersion !== SCHEMA_VERSION) { s.schemaVersion = SCHEMA_VERSION; changed = true; }
  return { state: s, changed };
}

/* ── Chargement ────────────────────────────────────────────────────────────── */

function readStoredState() {
  let raw = null;
  let corrupted = false;
  try {
    const str = localStorage.getItem(STATE_KEY);
    if (str) {
      try { raw = JSON.parse(str); }
      catch (e) {
        corrupted = true;
        // On ne détruit pas silencieusement la sauvegarde : elle est mise de côté.
        try { localStorage.setItem(STATE_KEY + '_corrupted', str); } catch (_) {}
      }
    }
  } catch (e) { /* stockage indisponible (navigation privée, quota…) */ }
  return { raw, corrupted };
}

const _loaded = readStoredState();
const _migrated = migrateState(_loaded.raw);
const state = _migrated.state;

if (_loaded.corrupted || _migrated.changed) save();

/* Remise à zéro de l'eau si la journée a changé depuis la dernière ouverture. */
rolloverDailyState();

/* ── Remise à zéro quotidienne ─────────────────────────────────────────────── */

/**
 * Les compteurs liés au jour (eau bue) repartent de zéro à chaque nouvelle journée.
 * Appelé au démarrage et à chaque rendu du tableau de bord, y compris si l'app
 * reste ouverte plusieurs jours.
 */
function rolloverDailyState() {
  const today = todayISO();
  if (state.waterDate === today) return false;
  state.waterDate = today;
  state.water = 0;
  save();
  return true;
}

/* ── Sauvegarde ────────────────────────────────────────────────────────────── */

function save() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    // Quota dépassé ou stockage refusé : on prévient une seule fois, sans casser l'app.
    if (!save._warned) {
      save._warned = true;
      console.warn('FocusFIT : sauvegarde locale impossible (' + e.message + ')');
    }
    return false;
  }
}
