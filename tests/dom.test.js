// tests/dom.test.js — tests d'intégration : l'application réelle exécutée dans un DOM jsdom.
// Nécessite la dépendance de développement `jsdom` (npm install). Sinon, les tests sont ignorés.
let JSDOM, VirtualConsole;
try {
  ({ JSDOM, VirtualConsole } = require('jsdom'));
} catch (e) {
  JSDOM = null;
}

const { test, describe, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sources = [...html.matchAll(/<script src="js\/([^"]+)"><\/script>/g)]
  .map(m => m[1])
  .map(f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'));

const iso = d => {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const TODAY = iso(new Date());
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const DAY_NAME = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][new Date().getDay()];

/* Les fenêtres jsdom gardent des minuteurs vivants : sans fermeture, le
   processus de test ne rend jamais la main. On n'en garde qu'une à la fois. */
const OPEN_DOMS = [];
beforeEach(() => {
  while (OPEN_DOMS.length) OPEN_DOMS.pop().window.close();
});
after(() => {
  while (OPEN_DOMS.length) OPEN_DOMS.pop().window.close();
});

function boot({ preloadState, dpr } = {}) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(String(e.message).split('\n')[0]));
  const dom = new JSDOM(html, {
    url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) { if (dpr) w.devicePixelRatio = dpr; }
  });
  const { window } = dom;

  window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
    get: (t, k) => (k === 'createLinearGradient' ? () => ({ addColorStop: () => { } }) : () => { }),
    set: () => true
  });
  window.confirm = () => true;
  window.alert = m => errors.push('ALERT: ' + m);
  window.Notification = function () { };
  window.Notification.permission = 'default';
  window.Notification.requestPermission = () => Promise.resolve('denied');
  window.AudioContext = function () {
    return {
      currentTime: 0, destination: {},
      createOscillator: () => ({ connect() { }, start() { }, stop() { }, frequency: {}, type: '' }),
      createGain: () => ({ connect() { }, gain: { setValueAtTime() { }, exponentialRampToValueAtTime() { } } })
    };
  };
  window.scrollTo = () => { };
  if (preloadState !== undefined) window.localStorage.setItem('focusFit_v3', preloadState);
  window.eval(sources.join('\n;\n') + '\n;window.__timer = timer; window.__state = state;');
  OPEN_DOMS.push(dom);
  return { window, errors };
}

const suite = JSDOM ? describe : describe.skip;

suite('Application complète (jsdom)', () => {
  test('démarre sans erreur et affiche le tableau de bord', () => {
    const { window, errors } = boot();
    assert.deepStrictEqual(errors, []);
    assert.match(window.document.getElementById('hero-greeting').textContent, /Bonjour|Bon après-midi|Bonsoir/);
    assert.strictEqual(window.document.querySelectorAll('#activity-cal .cal-cell').length, 35);
    assert.strictEqual(window.document.querySelectorAll('#water-grid .water-cup').length, 8);
  });

  test('un état corrompu ne bloque pas le démarrage et la sauvegarde est mise de côté', () => {
    const { window, errors } = boot({ preloadState: '{oops' });
    assert.deepStrictEqual(errors, []);
    assert.strictEqual(window.localStorage.getItem('focusFit_v3_corrupted'), '{oops');
    assert.strictEqual(JSON.parse(window.localStorage.getItem('focusFit_v3')).schemaVersion, 5);
  });

  test('la migration d\'une sauvegarde v3 préserve les données', () => {
    const legacy = JSON.stringify({
      planning: { Lundi: [['Squat', 4, 8, 120, '']] },
      lifts: [{ name: 'Squat', w: 100, r: 5, date: '12/05/2026', isPR: true }],
      sessionHistory: [{ date: '12/05/2026', time: '18:30', duration: 2400, day: 'Lundi', exercises: ['Squat'], totalExos: 1 }],
      weightLog: [{ date: '01/05/2026', weight: 82 }],
      profile: { name: 'Baye', weight: 81 }
    });
    const { window, errors } = boot({ preloadState: legacy });
    assert.deepStrictEqual(errors, []);
    const st = JSON.parse(window.localStorage.getItem('focusFit_v3'));
    assert.strictEqual(st.lifts[0].date, '2026-05-12');
    assert.strictEqual(st.sessionHistory[0].date, '2026-05-12');
    assert.strictEqual(st.weightLog[0].date, '2026-05-01');
    assert.strictEqual(st.waterDate, TODAY);
    assert.strictEqual(st.profile.sportGoal, 'muscle');
    assert.ok(Array.isArray(st.goals));
  });

  test('les 8 pages se rendent sans exception', () => {
    const { window, errors } = boot();
    ['profile', 'dashboard', 'planning', 'programs', 'nutrition', 'progress', 'goals', 'history']
      .forEach(p => window.showPage(p, window.document.querySelector(`.nav-item[data-page="${p}"]`)));
    assert.deepStrictEqual(errors, []);
  });
});

suite('Fonctionnalités (jsdom)', () => {
  test('les indicateurs du tableau de bord viennent des séances réelles', () => {
    const { window } = boot();
    window.__state.sessionHistory = [
      { date: TODAY, duration: 5400, day: DAY_NAME, exercises: ['Squat'], totalExos: 1 },
      { date: daysAgo(30), duration: 3600, day: 'Lundi', exercises: ['Dips'], totalExos: 1 }
    ];
    window.__state.profile.weight = 80;
    window.renderDashboard();
    assert.strictEqual(window.document.getElementById('s-sessions').textContent, '1');
    assert.match(window.document.getElementById('s-sessions-sub').textContent, /1 h 30/);
    const kcal = Number(window.document.getElementById('s-cal').textContent.replace(/[\s\u202f]/g, ''));
    assert.strictEqual(kcal, window.estimateKcal(90, 80));
  });

  test('le volume hebdomadaire reflète les charges enregistrées', () => {
    const { window } = boot();
    window.__state.lifts = [
      { name: 'Squat', w: 100, r: 5, date: TODAY, isPR: true },
      { name: 'Squat', w: 100, r: 5, date: TODAY, isPR: false },
      { name: 'Bench', w: 60, r: 10, date: daysAgo(9), isPR: false }
    ];
    const buckets = window.computeWeeklyVolume(8);
    assert.strictEqual(buckets[buckets.length - 1].value, 1000);
    assert.strictEqual(buckets[buckets.length - 2].value, 600);
    window.drawChart();
    assert.match(window.document.getElementById('volume-badge').textContent, /1,6 t/);
  });

  test('sans charge, le graphique de volume affiche un état vide', () => {
    const { window } = boot();
    window.drawChart();
    assert.strictEqual(window.document.getElementById('volume-empty').style.display, 'block');
    assert.strictEqual(window.document.getElementById('volume-badge').textContent, '');
  });

  test('les cases cochées de la séance du jour sont persistées', () => {
    const { window } = boot();
    window.__state.planning[DAY_NAME] = [['Squat', 4, 8, 120, ''], ['Dips', 3, 10, 90, '']];
    window.renderDashboard();
    window.toggleExoDone(TODAY, 0);
    assert.strictEqual(window.document.querySelectorAll('#today-list .check-row.done').length, 1);
    window.renderDashboard();
    assert.strictEqual(window.document.querySelectorAll('#today-list .check-row.done').length, 1);
    assert.deepStrictEqual(JSON.parse(window.localStorage.getItem('focusFit_v3')).doneExos[TODAY], ['Squat']);
    assert.match(window.document.getElementById('today-count').textContent, /1\/2/);
  });

  test('seuls les repas du jour comptent dans les totaux', () => {
    const { window } = boot();
    window.__state.meals = [
      { date: daysAgo(1), name: 'Hier', cal: 900, prot: 50, carbs: 90, fat: 30 },
      { date: TODAY, name: 'Riz / poulet', cal: 650, prot: 45, carbs: 80, fat: 15 }
    ];
    window.showPage('nutrition');
    assert.strictEqual(Number(window.document.getElementById('n-cal').textContent), 650);
    assert.strictEqual(Number(window.document.getElementById('n-meals').textContent), 1);
    assert.match(window.document.getElementById('meals-history-note').textContent, /1 repas enregistré/);
  });

  test('l\'eau repart de zéro au changement de jour', () => {
    const { window } = boot({ preloadState: JSON.stringify({ water: 6, waterDate: daysAgo(1) }) });
    const st = JSON.parse(window.localStorage.getItem('focusFit_v3'));
    assert.strictEqual(st.water, 0);
    assert.strictEqual(st.waterDate, TODAY);
  });

  test('cocher/décocher et Reset remettent la journée à zéro', () => {
    const { window } = boot();
    window.__state.planning[DAY_NAME] = [['Squat', 4, 8, 120, '']];
    window.renderDashboard();
    window.toggleExoDone(TODAY, 0);
    window.setWater(3);
    window.resetDay();
    const st = JSON.parse(window.localStorage.getItem('focusFit_v3'));
    assert.deepStrictEqual(st.doneExos[TODAY] || [], []);
    assert.strictEqual(st.water, 0);
  });
});

suite('Objectifs (jsdom)', () => {
  test('un objectif « durée » progresse avec les séances terminées', () => {
    const { window } = boot({
      preloadState: JSON.stringify({
        goals: [{ id: 1, title: '600 min', type: 'duration', exercise: '', current: 0, target: 600, unit: 'min', deadline: '', achieved: false, createdAt: daysAgo(10) }],
        sessionHistory: [
          { date: TODAY, duration: 2700, day: DAY_NAME, exercises: ['Squat'], totalExos: 1 },
          { date: daysAgo(2), duration: 1800, day: 'Lundi', exercises: ['Dips'], totalExos: 1 }
        ]
      })
    });
    const goal = window.__state.goals[0];
    assert.strictEqual(window.getGoalCurrent(goal), 75);
    window.showPage('goals');
    assert.strictEqual(window.document.querySelector('.goal-pct').textContent, '13%');
  });

  test('un objectif « séances » ignore les séances antérieures à sa création', () => {
    const { window } = boot();
    window.__state.sessionHistory = [{ date: daysAgo(40), duration: 3600, day: 'Lundi', exercises: ['Squat'], totalExos: 1 }];
    window.openGoalModal();
    window.document.getElementById('gm-name').value = '20 séances';
    window.document.getElementById('gm-type').value = 'sessions';
    window.updateGoalModalFields();
    window.document.getElementById('gm-target').value = '20';
    window.saveGoal();
    const goal = window.__state.goals[0];
    assert.strictEqual(window.getGoalCurrent(goal), 0);
    window.__state.sessionHistory.push({ date: TODAY, duration: 3000, day: DAY_NAME, exercises: ['Squat'], totalExos: 1 });
    assert.strictEqual(window.getGoalCurrent(goal), 1);
  });

  test('un objectif personnalisé reste manuel', () => {
    const { window } = boot();
    window.openGoalModal();
    window.document.getElementById('gm-type').value = 'custom';
    window.updateGoalModalFields();
    assert.notStrictEqual(window.document.getElementById('gm-current-row').style.display, 'none');
    window.document.getElementById('gm-name').value = 'Gainage 100 séances';
    window.document.getElementById('gm-target').value = '100';
    window.saveGoal();
    const goal = window.__state.goals[0];
    window.updateGoalCurrent(goal.id, 30);
    assert.strictEqual(window.getGoalCurrent(goal), 30);
  });
});

suite('Timer et saisie des séries (jsdom)', () => {
  function startSession(window) {
    window.__state.planning[DAY_NAME] = [['Squat', 2, 8, 20, '']];
    window.openTimer();
    window.document.getElementById('timer-day-select').value = DAY_NAME;
    window.startTimer();
  }

  test('le repos suit l\'horloge et non le nombre de ticks', () => {
    const { window } = boot();
    const realNow = window.Date.now.bind(window.Date);
    let fake = realNow();
    window.Date.now = () => fake;

    startSession(window);
    window.tick();
    fake += 10000;
    window.tick();
    assert.strictEqual(window.__timer.phase, 'work');
    window.timerAction();
    window.skipSet();
    assert.strictEqual(window.__timer.phaseTime, 20);
    fake += 12000;                                   // un seul tick en 12 s
    window.tick();
    assert.strictEqual(window.__timer.phaseTime, 8);
    window.Date.now = realNow;
  });

  test('une pause n\'est pas comptée dans le temps de séance', () => {
    const { window } = boot();
    const realNow = window.Date.now.bind(window.Date);
    let fake = realNow();
    window.Date.now = () => fake;

    window.openTimer();
    window.document.getElementById('timer-day-select').value = '';
    window.startTimer();
    window.tick();
    fake += 5000; window.tick();
    assert.strictEqual(window.__timer.totalTime, 5);
    window.timerAction();                            // pause
    fake += 60000; window.tick();
    assert.strictEqual(window.__timer.totalTime, 5);
    window.timerAction();                            // reprise
    fake += 5000; window.tick();
    assert.strictEqual(window.__timer.totalTime, 10);
    window.Date.now = realNow;
  });

  test('valider une série enregistre la charge avec détection de record', () => {
    const { window } = boot();
    startSession(window);
    window.setPhase('work', 0);
    window.timerAction();
    assert.strictEqual(window.document.getElementById('set-panel').style.display, 'block');
    assert.strictEqual(window.document.getElementById('set-reps').value, '8');
    window.document.getElementById('set-weight').value = '110';
    window.confirmSet();
    const lift = JSON.parse(window.localStorage.getItem('focusFit_v3')).lifts[0];
    assert.deepStrictEqual({ name: lift.name, w: lift.w, r: lift.r, date: lift.date, isPR: lift.isPR },
      { name: 'Squat', w: 110, r: 8, date: TODAY, isPR: true });
  });

  test('une saisie invalide est refusée sans interrompre la séance', () => {
    const { window } = boot();
    startSession(window);
    window.setPhase('work', 0);
    window.timerAction();
    window.document.getElementById('set-weight').value = '';
    window.confirmSet();
    assert.match(window.document.getElementById('set-hint').textContent, /invalide/i);
    assert.strictEqual(JSON.parse(window.localStorage.getItem('focusFit_v3')).lifts.length, 0);
    assert.strictEqual(window.document.getElementById('set-panel').style.display, 'block');
  });

  test('un double clic sur Valider n\'enregistre qu\'une série', () => {
    const { window } = boot();
    startSession(window);
    window.setPhase('work', 0);
    window.timerAction();
    window.document.getElementById('set-weight').value = '100';
    window.document.getElementById('set-reps').value = '5';
    window.confirmSet();
    window.confirmSet();
    assert.strictEqual(JSON.parse(window.localStorage.getItem('focusFit_v3')).lifts.length, 1);
    assert.strictEqual(window.__timer.loggedSets.length, 1);
  });

  test('la dernière charge connue pré-remplit le champ', () => {
    const { window } = boot();
    window.__state.lifts = [{ name: 'Squat', w: 120, r: 5, date: daysAgo(3), isPR: true }];
    startSession(window);
    window.setPhase('work', 0);
    window.timerAction();
    assert.strictEqual(window.document.getElementById('set-weight').value, '120');
    assert.match(window.document.getElementById('phase-info').textContent, /dernière : 120 kg/);
  });

  test('la séance terminée consigne volume et séries détaillées', async () => {
    const { window } = boot();
    const realNow = window.Date.now.bind(window.Date);
    let fake = realNow();
    window.Date.now = () => fake;
    startSession(window);

    let poids = 100;
    for (let i = 0; i < 60 && !JSON.parse(window.localStorage.getItem('focusFit_v3')).sessionHistory.length; i++) {
      fake += 2000;
      window.tick();
      if (window.__timer.phase === 'work') {
        window.timerAction();
        window.document.getElementById('set-weight').value = String(poids);
        window.document.getElementById('set-reps').value = '8';
        const before = window.__timer.loggedSets.length;
        window.confirmSet();
        if (window.__timer.loggedSets.length > before) poids += 10;
        await new Promise(r => setTimeout(r, 500));    // la confirmation s'enchaîne après un court délai
      }
    }
    const entry = JSON.parse(window.localStorage.getItem('focusFit_v3')).sessionHistory[0];
    window.Date.now = realNow;
    assert.ok(entry, 'séance enregistrée');
    assert.strictEqual(entry.logged.length, 2);
    assert.strictEqual(entry.volume, 100 * 8 + 110 * 8);
    window.showPage('history');
    assert.match(window.document.getElementById('history-list').innerHTML, /Volume soulevé/);
  });
});

suite('Retours utilisateur (jsdom)', () => {
  test('la fin de séance affiche un récapitulatif intégré, sans alerte bloquante', async () => {
    const { window, errors } = boot();
    const realNow = window.Date.now.bind(window.Date);
    let fake = realNow();
    window.Date.now = () => fake;
    window.__state.planning[DAY_NAME] = [['Squat', 1, 8, 20, '']];
    window.openTimer();
    window.document.getElementById('timer-day-select').value = DAY_NAME;
    window.startTimer();

    for (let i = 0; i < 40 && !JSON.parse(window.localStorage.getItem('focusFit_v3')).sessionHistory.length; i++) {
      fake += 2000;
      window.tick();
      if (window.__timer.phase === 'work') {
        window.timerAction();
        window.document.getElementById('set-weight').value = '100';
        window.document.getElementById('set-reps').value = '8';
        window.confirmSet();
        await new Promise(r => setTimeout(r, 500));
      }
    }

    const entry = JSON.parse(window.localStorage.getItem('focusFit_v3')).sessionHistory[0];
    assert.ok(entry, 'séance enregistrée');
    assert.deepStrictEqual(errors.filter(e => e.startsWith('ALERT')), [], 'plus aucune alerte bloquante');

    const done = window.document.getElementById('timer-done');
    assert.strictEqual(done.style.display, 'flex', 'récapitulatif affiché');
    assert.strictEqual(window.document.getElementById('timer-active').style.display, 'none');
    assert.match(window.document.getElementById('tdone-duration').textContent, /^\d{2}:\d{2}$/);
    assert.strictEqual(window.document.getElementById('tdone-exos').textContent, '1');
    assert.strictEqual(window.document.getElementById('tdone-volume').textContent, '800 kg');
    assert.match(window.document.getElementById('tdone-note').textContent, /1 série enregistrée/);

    window.closeTimerDone();
    assert.strictEqual(done.style.display, 'none');
    assert.strictEqual(window.document.getElementById('timer-modal').classList.contains('show'), false);

    // Une nouvelle ouverture repart de l'écran de configuration, pas du récapitulatif.
    window.openTimer();
    assert.strictEqual(window.document.getElementById('timer-setup').style.display, 'block');
    window.closeTimer();
  });

  test('les formulaires signalent leurs erreurs en ligne au lieu d\'une alerte', () => {
    const { window, errors } = boot();

    window.openExoModal();
    window.document.getElementById('exo-name').value = '   ';
    window.saveExo();
    assert.strictEqual(window.document.getElementById('exo-hint').textContent, 'Nom de l\'exercice requis.');
    assert.ok(window.document.getElementById('exo-hint').classList.contains('error'));
    assert.ok(window.document.getElementById('exo-modal').classList.contains('show'), 'la fenêtre reste ouverte');

    window.document.getElementById('exo-name').value = 'Squat';
    window.document.getElementById('exo-link').value = 'javascript:alert(1)';
    window.saveExo();
    assert.match(window.document.getElementById('exo-hint').textContent, /^Lien invalide/);

    window.document.getElementById('exo-link').value = 'https://example.com/demo';
    window.saveExo();
    assert.strictEqual(window.document.getElementById('exo-modal').classList.contains('show'), false);
    assert.strictEqual(window.document.getElementById('exo-hint').textContent, '');

    window.addMeal();
    assert.strictEqual(window.document.getElementById('meal-hint').textContent, 'Nom du repas requis.');
    window.document.getElementById('meal-name').value = 'Riz';
    window.addMeal();
    assert.strictEqual(window.__state.meals.length, 1);

    assert.deepStrictEqual(errors.filter(e => e.startsWith('ALERT')), [], 'aucune alerte système');
  });

  test('le formulaire de profil est mis en page par la feuille de styles', () => {
    const css = fs.readdirSync(path.join(ROOT, 'css'))
      .map(f => fs.readFileSync(path.join(ROOT, 'css', f), 'utf8')).join('\n');
    for (const selector of ['.profile-form {', '.profile-form .btn', '.profile-form-section', '.tdone-stats', '.tdone-title']) {
      assert.ok(css.includes(selector), `règle manquante : ${selector}`);
    }
  });
});

suite('Sûreté et accessibilité (jsdom)', () => {
  test('les données utilisateur sont échappées et les liens filtrés', () => {
    const { window } = boot();
    window.document.getElementById('exo-day').value = 'Lundi';
    window.document.getElementById('exo-name').value = '<img src=x onerror="window.__XSS=1">';
    window.document.getElementById('exo-link').value = 'javascript:window.__PWN=1';
    window.saveExo();
    window.renderPlanning();
    assert.strictEqual(window.document.querySelector('#days-grid img'), null);
    assert.strictEqual(window.document.querySelector('#days-grid a.exo-link'), null);
  });

  test('Échap ferme la fenêtre modale ouverte', () => {
    const { window } = boot();
    window.openGoalModal();
    assert.ok(window.document.querySelector('.modal.show'));
    window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.strictEqual(window.document.querySelector('.modal.show'), null);
  });

  test('les entrées de menu sont des boutons navigables au clavier', () => {
    const { window } = boot();
    window.showPage('planning', window.document.querySelector('.nav-item[data-page="planning"]'));
    const navs = [...window.document.querySelectorAll('.nav-item')];
    assert.strictEqual(navs.length, 8);
    assert.ok(navs.every(n => n.tagName === 'BUTTON'));
    assert.strictEqual(window.document.querySelector('.nav-item.active').getAttribute('aria-current'), 'page');
  });

  test('tous les champs visibles ont une étiquette reliée', () => {
    const { window } = boot();
    window.showPage('profile');
    window.showPage('nutrition');
    window.showPage('progress');
    window.openTimer();
    const orphans = [...window.document.querySelectorAll('input, select')]
      .filter(el => el.type !== 'hidden' && el.offsetParent !== null || el.id === 'gm-name')
      .filter(el => !window.document.querySelector(`label[for="${el.id}"]`))
      .map(el => el.id || el.name || el.tagName);
    assert.deepStrictEqual(orphans, []);
  });
});

suite('Graphiques HiDPI (jsdom)', () => {
  test('le tampon des canvas suit devicePixelRatio, le dessin reste en pixels CSS', () => {
    const { window } = boot({ dpr: 2 });
    window.__state.lifts = [
      { name: 'Squat', w: 100, r: 5, date: daysAgo(3) },
      { name: 'Squat', w: 105, r: 5, date: daysAgo(1) }
    ];
    window.__state.weightLog = [
      { date: daysAgo(10), weight: 82, ts: 1 },
      { date: daysAgo(2), weight: 81, ts: 2 }
    ];
    window.showPage('progress');
    window.renderProgress();                       // remplit la liste des exercices
    window.document.getElementById('chart-exo-select').value = 'Squat';
    window.renderExerciseChart();

    const canvas = window.document.getElementById('exo-chart');
    const expectedCss = Math.max(240, canvas.parentElement.clientWidth - 36);
    assert.strictEqual(canvas.style.width, expectedCss + 'px');
    assert.strictEqual(canvas.width, expectedCss * 2, 'tampon doublé sur écran 2×');
    assert.strictEqual(canvas.height, 400, 'hauteur doublée (200 px CSS)');

    window.showPage('profile');
    window.drawWeightChart();
    const wc = window.document.getElementById('weight-chart');
    assert.strictEqual(wc.width, Math.max(240, wc.parentElement.clientWidth - 36) * 2);
  });
});

suite('Export / import (jsdom)', () => {
  test('l\'export produit un JSON complet et l\'import le restaure', () => {
    const { window } = boot();
    window.document.getElementById('exo-day').value = 'Lundi';
    window.document.getElementById('exo-name').value = 'Squat';
    window.saveExo();

    const exported = window.exportStateJSON();
    const parsed = JSON.parse(exported);
    assert.strictEqual(parsed.app, 'FocusFIT');
    assert.strictEqual(parsed.schemaVersion, 5);
    assert.strictEqual(parsed.data.planning.Lundi.length, 1);

    const { window: fresh } = boot();
    const result = fresh.importStateJSON(exported);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(JSON.parse(fresh.localStorage.getItem('focusFit_v3')).planning.Lundi[0][0], 'Squat');
  });

  test('un fichier étranger est refusé sans toucher aux données', () => {
    const { window } = boot();
    const before = window.localStorage.getItem('focusFit_v3');
    assert.strictEqual(window.importStateJSON('{"foo":1}').ok, false);
    assert.strictEqual(window.importStateJSON('pas du json').ok, false);
    assert.strictEqual(window.localStorage.getItem('focusFit_v3'), before);
  });
});
