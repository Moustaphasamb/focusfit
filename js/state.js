/* ─────────────────────────────────────────────────────────────────────────────
   État global, persistance et sélecteurs dépendant de l'état.

   Toute la logique pure (dates, calculs, migration) vit dans `core.js`, chargé
   avant ce fichier. Ici : ce qui touche au stockage et à l'instance `state`.
   ───────────────────────────────────────────────────────────────────────────── */

/* Clé historique : ne jamais la renommer, sinon les données déjà enregistrées
   sur les appareils des utilisateurs deviennent invisibles. La version du schéma
   est portée séparément par SCHEMA_VERSION (core.js) et gérée par migrateState(). */
const STATE_KEY = 'focusFit_v3';

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

/* ── Persistance ───────────────────────────────────────────────────────────── */

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

/** Les compteurs liés au jour (eau bue) repartent de zéro à chaque nouvelle journée. */
function rolloverDailyState() {
  const today = todayISO();
  if (!rolloverNeeded(state.waterDate, today)) return false;
  state.waterDate = today;
  state.water = 0;
  save();
  return true;
}

/** Remplace l'état courant (import d'une sauvegarde) puis persiste. */
function replaceState(rawState) {
  const migrated = migrateState(rawState);
  Object.keys(state).forEach(key => { delete state[key]; });
  Object.assign(state, migrated.state);
  save();
  return state;
}

/* ── Sélecteurs (état → logique pure) ──────────────────────────────────────── */

function getBest1RM(name) {
  return best1RM(state.lifts, name);
}

function getSessionsSince(isoDate) {
  return sessionsSince(state.sessionHistory, isoDate).length;
}

function getMinutesSince(isoDate) {
  return minutesSince(state.sessionHistory, isoDate);
}

function getGoalCurrent(goal) {
  return goalCurrent(goal, { lifts: state.lifts, sessionHistory: state.sessionHistory });
}

function getGoalProgress(goal) {
  return goalProgress(getGoalCurrent(goal), goal.target);
}

/** Semaine en cours (lundi → dimanche) au format ISO. */
function getCurrentWeek() {
  return currentWeek();
}

/** Volume d'entraînement par semaine, à partir des charges réellement enregistrées. */
function computeWeeklyVolume(weeks = 8) {
  return weeklyVolume(state.lifts, new Date(), weeks);
}
