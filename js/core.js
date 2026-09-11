/* ─────────────────────────────────────────────────────────────────────────────
   FocusFIT — noyau métier et utilitaires partagés : fonctions pures, sans état
   global ni localStorage. Seules `setupCanvas()` et `showHint()` touchent au DOM
   qu'on leur passe.

   Ce fichier est chargé tel quel par le navigateur (les fonctions deviennent
   globales, comme le reste de l'application) ET importable par les tests Node
   (`require('./js/core.js')`). Aucune dépendance, aucun build.
   ───────────────────────────────────────────────────────────────────────────── */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ── Schéma et vocabulaire ───────────────────────────────────────────────── */

  const SCHEMA_VERSION = 5;
  const DAY_KEYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  const ACTIVITY_FACTORS = {
    sedentary:  { label: 'Sédentaire (peu ou pas de sport)',   factor: 1.2   },
    light:      { label: 'Légèrement actif (1–3 séances/sem)', factor: 1.375 },
    moderate:   { label: 'Modérément actif (3–5 séances/sem)', factor: 1.55  },
    active:     { label: 'Très actif (6–7 séances/sem)',       factor: 1.725 },
    veryactive: { label: 'Athlète (2× par jour)',              factor: 1.9   }
  };

  const SPORT_GOALS = {
    muscle:      { label: 'Prise de masse',  icon: '💪' },
    weightloss:  { label: 'Perte de poids',  icon: '🔥' },
    endurance:   { label: 'Endurance',       icon: '🏃' },
    maintenance: { label: 'Maintien',        icon: '⚖️' }
  };

  const LEVELS = {
    beginner:     { label: 'Débutant',      color: 'var(--acc3)' },
    intermediate: { label: 'Intermédiaire', color: 'var(--acc4)' },
    advanced:     { label: 'Avancé',        color: 'var(--acc)'  }
  };

  /* ── Dates ───────────────────────────────────────────────────────────────── */

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

  /** Lundi de la semaine contenant `d` (à midi, pour ignorer les changements d'heure). */
  function startOfWeek(d = new Date()) {
    const day = new Date(d.getTime());
    day.setHours(12, 0, 0, 0);
    day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
    return day;
  }

  /** Semaine en cours : { start, end, today } au format ISO. */
  function currentWeek(d = new Date()) {
    const start = startOfWeek(d);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const ref = new Date(d.getTime());
    ref.setHours(12, 0, 0, 0);
    return { start: localISO(start), end: localISO(end), today: localISO(ref) };
  }

  /** Décale une date d'un nombre de jours (renvoie une nouvelle Date). */
  function addDays(d, days) {
    const out = new Date(d.getTime());
    out.setDate(out.getDate() + days);
    return out;
  }

  /** Jours restants avant une échéance, avec sa qualification. */
  function deadlineInfo(deadline, today = new Date()) {
    const iso = toISO(deadline);
    if (!iso) return null;
    const target = parseISO(iso);          // toujours à midi, heure locale
    const ref = new Date(today.getTime());
    ref.setHours(12, 0, 0, 0);             // midi aussi : évite les bascules d'heure
    // « + 0 » transforme un éventuel -0 en 0 : sinon une échéance de la veille
    // était classée « aujourd'hui » (-0 n'est pas < 0).
    const diff = Math.round((target - ref) / (1000 * 60 * 60 * 24)) + 0;
    const kind = diff < 0 ? 'past' : diff === 0 ? 'today' : diff <= 7 ? 'soon' : 'later';
    return { days: diff, kind };
  }

  /* ── Formats d'affichage ─────────────────────────────────────────────────── */

  function formatTime(seconds) {
    const total = Math.max(0, Math.round(seconds || 0));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /** Durée en minutes → « 1 h 30 » ou « 45 min ». */
  function formatDuration(minutes) {
    const total = Math.round(minutes || 0);
    if (total < 60) return `${total} min`;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  }

  /** Volume soulevé → « 850 kg » ou « 1,6 t ». */
  function formatVolume(kg) {
    const value = kg >= 1000 ? kg / 1000 : Math.round(kg || 0);
    const unit = kg >= 1000 ? 't' : 'kg';
    return `${value.toLocaleString('fr-FR', { maximumFractionDigits: kg >= 1000 ? 1 : 0 })} ${unit}`;
  }

  /* ── Calculs sportifs ────────────────────────────────────────────────────── */

  /** 1RM estimé — formule d'Epley : poids × (1 + reps / 30). */
  function calc1RM(weight, reps) {
    if (reps === 1) return weight;
    return Math.round(weight * (1 + reps / 30));
  }

  /** Meilleur 1RM estimé pour un exercice donné. */
  function best1RM(lifts, name) {
    const target = String(name || '').toLowerCase();
    if (!target) return 0;
    return (lifts || [])
      .filter(l => String(l.name || '').toLowerCase() === target)
      .reduce((best, l) => Math.max(best, calc1RM(l.w, l.r)), 0);
  }

  /**
   * Estimation des calories brûlées par une séance de musculation :
   * kcal = MET × 3,5 × poids(kg) / 200 × minutes, avec MET ≈ 6 (effort intense
   * entrecoupé de repos). C'est une estimation, pas une mesure.
   */
  function estimateKcal(minutes, weightKg) {
    return Math.round(6 * 3.5 * (weightKg || 75) / 200 * Math.max(0, minutes || 0));
  }

  /**
   * Volume d'entraînement (kg soulevés = poids × répétitions) par semaine,
   * calculé à partir des charges réellement enregistrées.
   */
  function weeklyVolume(lifts, refDate = new Date(), weeks = 8) {
    const ref = startOfWeek(refDate);
    const buckets = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const start = addDays(ref, -i * 7);
      const end = addDays(start, 6);
      buckets.push({ start: localISO(start), end: localISO(end), value: 0, count: 0 });
    }
    (lifts || []).forEach(l => {
      const iso = toISO(l.date);
      if (!iso) return;
      const bucket = buckets.find(b => iso >= b.start && iso <= b.end);
      if (!bucket) return;
      bucket.value += (l.w || 0) * (l.r || 0);
      bucket.count++;
    });
    return buckets;
  }

  /* ── Séances ─────────────────────────────────────────────────────────────── */

  function sessionsInRange(sessionHistory, startISO, endISO) {
    return (sessionHistory || [])
      .filter(h => (!startISO || String(h.date) >= startISO) && (!endISO || String(h.date) <= endISO));
  }

  function sessionsSince(sessionHistory, isoDate) {
    return sessionsInRange(sessionHistory, toISO(isoDate), null);
  }

  function totalSeconds(sessions) {
    return (sessions || []).reduce((sum, h) => sum + (h.duration || 0), 0);
  }

  function minutesSince(sessionHistory, isoDate) {
    return Math.round(totalSeconds(sessionsSince(sessionHistory, isoDate)) / 60);
  }

  /* ── Objectifs ───────────────────────────────────────────────────────────── */

  /**
   * Progression d'un objectif, toujours calculée depuis les données réelles :
   * charges pour la force, séances terminées pour le nombre de séances et la
   * durée. Seul le type « Personnalisé » utilise la valeur saisie à la main.
   */
  function goalCurrent(goal, data = {}) {
    if (!goal) return 0;
    if (goal.type === 'weight' && goal.exercise) {
      return best1RM(data.lifts, goal.exercise);
    }
    if (goal.type === 'sessions') {
      return sessionsSince(data.sessionHistory, goal.createdAt).length;
    }
    if (goal.type === 'duration') {
      return minutesSince(data.sessionHistory, goal.createdAt);
    }
    return goal.current || 0;
  }

  /** Indique si la progression de l'objectif est alimentée automatiquement. */
  function isAutoTracked(goal) {
    if (!goal) return false;
    return (goal.type === 'weight' && !!goal.exercise) || goal.type === 'sessions' || goal.type === 'duration';
  }

  function goalProgress(current, target) {
    if (!target || target === 0) return 0;
    return Math.min(100, Math.round((current / target) * 100));
  }

  /* ── Profil ──────────────────────────────────────────────────────────────── */

  function calcBMI(weight, height) {
    if (!weight || !height) return null;
    return weight / Math.pow(height / 100, 2);
  }

  function bmiCategory(bmi) {
    if (bmi < 18.5) return { label: 'Insuffisance pondérale', color: 'var(--acc5)' };
    if (bmi < 25)   return { label: 'Poids normal',           color: 'var(--acc3)' };
    if (bmi < 30)   return { label: 'Surpoids',               color: 'var(--acc4)' };
    return              { label: 'Obésité',                   color: 'var(--acc2)' };
  }

  /** Métabolisme de base (Mifflin/St-Jeor, formule historique de l'app). */
  function calcBMR(p) {
    if (!p || !p.weight || !p.height || !p.age) return null;
    if (p.gender === 'female') {
      return 447.593 + (9.247 * p.weight) + (3.098 * p.height) - (4.330 * p.age);
    }
    return 88.362 + (13.397 * p.weight) + (4.799 * p.height) - (5.677 * p.age);
  }

  function calcTDEE(bmr, activity) {
    if (!bmr) return null;
    return Math.round(bmr * (ACTIVITY_FACTORS[activity]?.factor || 1.55));
  }

  /** Poids idéal — formule de Lorentz. */
  function idealWeight(height, gender) {
    if (!height) return null;
    const base = gender === 'female'
      ? height - 100 - (height - 150) / 2.5
      : height - 100 - (height - 150) / 4;
    return Math.round(base);
  }

  /** Objectifs macro déduits du TDEE et du poids de corps. */
  function macroTargets(tdee, weightKg) {
    if (!tdee) return null;
    return {
      cal: tdee,
      prot: Math.round((weightKg || 0) * 1.8),
      carb: Math.round(tdee * 0.45 / 4),
      fat: Math.round(tdee * 0.28 / 9)
    };
  }

  /* ── Textes et liens sûrs ────────────────────────────────────────────────── */

  /** Échappe une valeur avant insertion dans du HTML (texte ou attribut entre guillemets). */
  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** N'autorise que les liens http(s) absolus : bloque javascript:, data:, vbscript:… */
  function safeUrl(url) {
    const raw = String(url || '').trim();
    return /^https?:\/\//i.test(raw) ? raw : '';
  }

  /** Limite la fréquence d'appel d'une fonction (redimensionnement, saisie…). */
  function debounce(fn, ms) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  /* ── Canvas ── */

  /**
   * Prépare un canvas pour les écrans HiDPI (« Retina ») : le tampon de dessin
   * est mis à l'échelle du rapport de pixels, mais tout le code de dessin
   * continue de raisonner en pixels CSS.
   * Renvoie { ctx, width, height, ratio }.
   */
  function setupCanvas(canvas, cssWidth, cssHeight, dpr) {
    const ratio = Math.min(3, Math.max(1, dpr || 1));   // 3× suffit, au-delà c'est de la mémoire perdue
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    const ctx = canvas.getContext('2d');
    if (ctx && typeof ctx.setTransform === 'function') ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx, width: cssWidth, height: cssHeight, ratio };
  }

  /**
   * Affiche un message sous un champ (validation, confirmation).
   * `kind` vaut 'success' ou 'error' et ne sert qu'à la couleur.
   */
  function showHint(elementId, message, kind) {
    const el = typeof document !== 'undefined' && document.getElementById(elementId);
    if (!el) return false;
    el.textContent = message || '';
    el.className = 'form-hint ' + (kind || '');
    return true;
  }

  /* ── État : valeurs par défaut et migration ──────────────────────────────── */

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
      macroTargetsCustom: false, // true dès que l'utilisateur fixe ses objectifs à la main
      profile: {
        name: 'Baye', age: 0, gender: 'male', weight: 0, height: 0,
        activity: 'moderate', sportGoal: 'muscle', level: 'intermediate'
      },
      weightLog: []
    };
  }

  /**
   * Complète un état ancien ou partiel avec les valeurs par défaut, convertit les
   * dates françaises en ISO et écarte les entrées irrécupérables.
   * Ne lève jamais d'exception, quel que soit le contenu stocké.
   * `today` est injectable pour rendre la migration déterministe dans les tests.
   */
  function migrateState(raw, today = todayISO()) {
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
      if (g.createdAt === undefined) { g.createdAt = today; changed = true; }
      if (g.achieved === undefined) { g.achieved = false; changed = true; }
    });

    if (s.schemaVersion !== SCHEMA_VERSION) { s.schemaVersion = SCHEMA_VERSION; changed = true; }
    return { state: s, changed };
  }

  /** Vérifie qu'un contenu importé ressemble à une sauvegarde FocusFIT. */
  function looksLikeBackup(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    return ['planning', 'lifts', 'meals', 'sessionHistory', 'weightLog', 'profile', 'goals']
      .some(key => data[key] !== undefined);
  }

  /** Les compteurs journaliers doivent-ils être remis à zéro ? */
  function rolloverNeeded(waterDate, today = todayISO()) {
    return toISO(waterDate) !== today;
  }

  return {
    // vocabulaire
    SCHEMA_VERSION, DAY_KEYS, ACTIVITY_FACTORS, SPORT_GOALS, LEVELS,
    // dates
    localISO, todayISO, yesterdayISO, parseISO, displayDate, shortDate, toISO,
    startOfWeek, currentWeek, addDays, deadlineInfo,
    // formats
    formatTime, formatDuration, formatVolume,
    // calculs
    calc1RM, best1RM, estimateKcal, weeklyVolume,
    // séances
    sessionsInRange, sessionsSince, totalSeconds, minutesSince,
    // objectifs
    goalCurrent, isAutoTracked, goalProgress,
    // profil
    calcBMI, bmiCategory, calcBMR, calcTDEE, idealWeight, macroTargets,
    // sûreté et utilitaires
    esc, safeUrl, debounce, setupCanvas, showHint,
    // état
    defaultState, migrateState, looksLikeBackup, rolloverNeeded
  };
});
