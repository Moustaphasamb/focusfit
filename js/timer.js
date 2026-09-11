const timer = {
  running: false,
  paused: true,
  phase: 'idle',
  phaseTime: 0,
  phaseTotal: 0,
  phaseEndsAt: null,   // horodatage de fin de phase (source de vérité du décompte)
  pausedAt: null,
  totalTime: 0,
  queue: [],
  curExo: 0,
  curSet: 0,
  defaultRest: 90,
  interval: null,
  sessionStart: null,
  dayName: '',
  lastBeepSecond: null,
  loggedSets: [],        // séries validées pendant la séance
  setPending: false,     // série validée, en attente du passage au repos
  loggedVolume: 0,       // kg soulevés depuis le début de la séance
  setPanelOpen: false
};

const PHASE_LABELS = { prep: 'PRÉPARATION', work: 'EXÉCUTION', rest: 'REPOS' };
const PHASE_BG = { prep: 'tbg-prep', work: 'tbg-work', rest: 'tbg-rest' };

const timerVals = { prep: 10, rest: 90 };

function adjustTimerVal(field, delta) {
  timerVals[field] = Math.max(0, timerVals[field] + delta);
  const el = document.getElementById(field === 'prep' ? 'prep-display' : 'rest-display');
  const inp = document.getElementById(field === 'prep' ? 'prep-sec' : 'default-rest');
  if (el) el.textContent = formatTime(timerVals[field]);
  if (inp) inp.value = timerVals[field];
}
const RING_CIRC = 2 * Math.PI * 110; // 691.2

async function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

function sendNotif(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: 'assets/icon-192.png', silent: true });
  }
}

function updateRing(pct) {
  const fill = document.getElementById('ring-fill');
  if (fill) fill.style.strokeDashoffset = RING_CIRC * (1 - pct / 100);
}

function openTimer() {
  const sel = document.getElementById('timer-day-select');
  sel.innerHTML = '<option value="">— Démarrer libre —</option>' +
    Object.entries(state.planning)
      .filter(([, exos]) => exos.length > 0)
      .map(([d, exos]) => `<option value="${d}">${d} (${exos.length} exos)</option>`)
      .join('');
  document.getElementById('timer-modal').classList.add('show');
  document.getElementById('timer-setup').style.display = 'block';
  document.getElementById('timer-active').style.display = 'none';
  requestNotifPermission();
}

function closeTimer() {
  if (timer.running && !confirm('Quitter la séance en cours ?')) return;
  stopTimer();
  document.getElementById('timer-modal').classList.remove('show');
}

function launchDay(day) {
  openTimer();
  document.getElementById('timer-day-select').value = day;
}

function startTimer() {
  const day = document.getElementById('timer-day-select').value;
  const prep = timerVals.prep || 10;
  timer.defaultRest = timerVals.rest || 90;
  timer.dayName = day || 'Libre';
  timer.sessionStart = Date.now();

  if (day && state.planning[day]) {
    timer.queue = state.planning[day].map(e => ({
      name: e[0], sets: e[1], reps: e[2], rest: e[3] || timer.defaultRest
    }));
  } else {
    timer.queue = [{ name: 'Séance libre', sets: 99, reps: 0, rest: timer.defaultRest }];
  }

  timer.curExo = 0;
  timer.curSet = 0;
  timer.totalTime = 0;
  timer.loggedSets = [];
  timer.loggedVolume = 0;
  timer.setPending = false;
  closeSetPanel();
  document.getElementById('timer-setup').style.display = 'none';
  document.getElementById('timer-active').style.display = 'block';
  setPhase('prep', prep);
  timer.running = true;
  timer.paused = false;
  timer.pausedAt = null;
  startTicking();
  document.getElementById('ctrl-action').textContent = '⏸ Pause';
}

/* Le minuteur ne sert qu'à rafraîchir l'affichage : le temps restant est toujours
   recalculé depuis phaseEndsAt, ce qui évite toute dérive quand le navigateur
   ralentit les minuteries (onglet en arrière-plan, écran verrouillé, mobile). */
function startTicking() {
  stopTicking();
  timer.interval = setInterval(tick, 250);
}

function stopTicking() {
  clearInterval(timer.interval);
  timer.interval = null;
}

function setPhase(phase, time) {
  timer.phase = phase;
  timer.phaseTime = time;
  timer.phaseTotal = time;
  timer.phaseEndsAt = time > 0 ? Date.now() + time * 1000 : null;
  timer.lastBeepSecond = null;

  const fill = document.getElementById('ring-fill');
  if (fill) fill.classList.toggle('ring-pulse', phase === 'work');

  const bg = document.getElementById('timer-bg');
  if (bg) {
    bg.className = 'tactive-wrap ' + (PHASE_BG[phase] || '');
  }

  document.getElementById('phase-label').textContent = PHASE_LABELS[phase];

  const exo = timer.queue[timer.curExo];
  if (phase === 'work') {
    const lastW = exo ? lastWeightFor(exo.name) : '';
    document.getElementById('phase-info').textContent =
      `${exo.name} — Série ${timer.curSet + 1}/${exo.sets}${exo.reps ? ' • ' + exo.reps + ' reps' : ''}${lastW !== '' ? ' • dernière : ' + lastW + ' kg' : ''}`;
  } else if (phase === 'rest') {
    document.getElementById('phase-info').textContent = `Repos — Prochain : ${exo.name}`;
  } else {
    document.getElementById('phase-info').textContent = `Prêt pour : ${exo ? exo.name : '—'}`;
  }
  document.getElementById('rest-presets').style.display = phase === 'rest' ? 'flex' : 'none';
  updateDisplay();
}

function tick() {
  if (!timer.running || timer.paused) return;
  const now = Date.now();
  timer.totalTime = Math.max(0, Math.round((now - timer.sessionStart) / 1000));

  if (timer.phase === 'work') {
    // Phase d'exécution : durée libre, on affiche le temps écoulé de la séance.
    timer.phaseTime = timer.totalTime;
    updateDisplay();
    return;
  }

  if (timer.phaseEndsAt !== null) {
    timer.phaseTime = Math.max(0, Math.ceil((timer.phaseEndsAt - now) / 1000));
  }

  if (timer.phaseTime <= 0) {
    playBeep(900);
    if (timer.phase === 'rest') {
      sendNotif('FocusFIT', `Repos terminé — ${timer.queue[timer.curExo]?.name || 'À toi !'}`);
    }
    nextPhase();
    return;
  }

  if (timer.phaseTime <= 3 && timer.lastBeepSecond !== timer.phaseTime) {
    timer.lastBeepSecond = timer.phaseTime;
    playBeep(600);
  }
  updateDisplay();
}

function nextPhase() {
  const exo = timer.queue[timer.curExo];
  if (timer.phase === 'prep') {
    setPhase('work', 0);
    timer.phaseTotal = 999;
  } else if (timer.phase === 'work') {
    timer.curSet++;
    if (timer.curSet >= exo.sets) {
      timer.curSet = 0;
      timer.curExo++;
      if (timer.curExo >= timer.queue.length) return finishSession();
    }
    setPhase('rest', timer.queue[timer.curExo].rest);
  } else if (timer.phase === 'rest') {
    setPhase('work', 0);
    timer.phaseTotal = 999;
  }
}

function skipPhase() { playBeep(700); nextPhase(); }

function timerAction() {
  if (timer.phase === 'work') {
    playBeep(900);
    openSetPanel();
    return;
  }
  timer.paused = !timer.paused;
  if (timer.paused) {
    timer.pausedAt = Date.now();
  } else if (timer.pausedAt) {
    // La pause ne doit pas être comptée : on décale les échéances d'autant.
    const delta = Date.now() - timer.pausedAt;
    timer.sessionStart += delta;
    if (timer.phaseEndsAt) timer.phaseEndsAt += delta;
    timer.pausedAt = null;
  }
  document.getElementById('ctrl-action').textContent = timer.paused ? '▶ Reprendre' : '⏸ Pause';
}

/* ── Saisie de la série ───────────────────────────────────────────────────────
   À la fin de chaque série, l'utilisateur enregistre le poids et les répétitions :
   la charge est ajoutée à l'historique de progression (avec détection du record)
   et comptée dans le volume de la séance. « Passer » enchaîne sans rien noter. */

/** Dernier poids connu pour un exercice (pour pré-remplir le champ). */
function lastWeightFor(name) {
  const entries = state.lifts.filter(l => l.name.toLowerCase() === String(name).toLowerCase());
  return entries.length ? entries[entries.length - 1].w : '';
}

function openSetPanel() {
  const exo = timer.queue[timer.curExo];
  // `setPending` couvre le court délai entre la validation et le passage au repos :
  // sans lui, un second appui sur « Série terminée » enregistrerait la même série.
  if (!exo || timer.setPanelOpen || timer.setPending) return;

  timer.setPanelOpen = true;
  const panel = document.getElementById('set-panel');
  const title = document.getElementById('set-panel-title');
  const sub = document.getElementById('set-panel-sub');
  const hint = document.getElementById('set-hint');

  if (title) title.textContent = `Série ${timer.curSet + 1}/${exo.sets}`;
  if (sub) sub.textContent = exo.name;
  if (hint) { hint.textContent = ''; hint.className = 'form-hint'; }

  const wInput = document.getElementById('set-weight');
  const rInput = document.getElementById('set-reps');
  const lastW = lastWeightFor(exo.name);
  if (wInput) wInput.value = lastW !== '' ? lastW : '';
  if (rInput) rInput.value = exo.reps || '';

  if (panel) panel.style.display = 'block';
  if (wInput) setTimeout(() => wInput.focus(), 50);
}

function closeSetPanel() {
  const panel = document.getElementById('set-panel');
  if (panel) panel.style.display = 'none';
  timer.setPanelOpen = false;
}

function showSetHint(message, kind) {
  const hint = document.getElementById('set-hint');
  if (!hint) return;
  hint.textContent = message;
  hint.className = 'form-hint ' + (kind || '');
}

function confirmSet() {
  if (!timer.setPanelOpen) return;            // évite un double enregistrement (double clic)
  const exo = timer.queue[timer.curExo];
  if (!exo) return closeSetPanel();

  const w = parseFloat(document.getElementById('set-weight').value);
  const r = parseInt(document.getElementById('set-reps').value, 10);

  if (!Number.isFinite(w) || w < 1 || w > 500) return showSetHint('Poids invalide : entre 1 et 500 kg.', 'error');
  if (!Number.isFinite(r) || r < 1 || r > 100) return showSetHint('Répétitions invalides : entre 1 et 100.', 'error');

  const prevBest = getBest1RM(exo.name);
  const orm = calc1RM(w, r);
  const isPR = orm > prevBest;

  state.lifts.push({ name: exo.name, w, r, date: todayISO(), isPR });
  timer.loggedSets.push({ name: exo.name, w, r, set: timer.curSet + 1 });
  timer.loggedVolume += w * r;
  timer.setPanelOpen = false;                 // la série est traitée : on verrouille les boutons
  timer.setPending = true;
  save();

  if (isPR) {
    showSetHint(`🏆 Record : 1RM estimé ${orm} kg — enregistré dans Progression.`, 'success');
    playBeep(1200);
    sendNotif('FocusFIT — Nouveau record !', `${exo.name} : ${w} kg × ${r} (1RM estimé ${orm} kg)`);
    setTimeout(advanceAfterSet, 900);
    return;
  }
  showSetHint(`✓ ${w} kg × ${r} enregistré.`, 'success');
  setTimeout(advanceAfterSet, 450);
}

function skipSet() {
  closeSetPanel();
  playBeep(700);
  nextPhase();
}

/** Poursuit la séance une fois la série traitée (sans effet si la séance a été arrêtée). */
function advanceAfterSet() {
  closeSetPanel();
  timer.setPending = false;
  if (!timer.running) return;
  nextPhase();
}

function setRest(seconds) {
  if (timer.phase === 'rest') {
    timer.phaseTime = seconds;
    timer.phaseTotal = seconds;
    timer.phaseEndsAt = Date.now() + seconds * 1000;
    updateDisplay();
  }
}

function stopTimer() {
  stopTicking();
  closeSetPanel();
  timer.running = false;
  timer.paused = true;
  timer.pausedAt = null;
  timer.phaseEndsAt = null;
  document.getElementById('timer-setup').style.display = 'block';
  document.getElementById('timer-active').style.display = 'none';
}

function updateStreak() {
  const today = todayISO();
  const yesterdayDate = yesterdayISO();
  if (state.lastSessionDate === today) return;
  state.streak = state.lastSessionDate === yesterdayDate ? (state.streak || 0) + 1 : 1;
  state.lastSessionDate = today;
}

function finishSession() {
  stopTicking();
  timer.running = false;

  const duration = Math.max(0, Math.round((Date.now() - timer.sessionStart) / 1000));
  state.sessions++;
  updateStreak();
  state.sessionHistory.push({
    date: todayISO(),
    time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    duration,
    day: timer.dayName,
    exercises: timer.queue.map(e => e.name),
    totalExos: timer.queue.length,
    logged: timer.loggedSets.slice(),
    volume: timer.loggedVolume
  });
  save();

  playBeep(1200);
  const volumeTxt = timer.loggedVolume > 0 ? ` • Volume : ${formatVolume(timer.loggedVolume)}` : '';
  sendNotif('FocusFIT — Séance terminée !', `Durée : ${formatTime(duration)} • ${timer.queue.length} exercices${volumeTxt}`);
  alert(`Séance terminée !\nDurée : ${formatTime(duration)}\nExercices : ${timer.queue.length}${volumeTxt}`);
  closeTimer();
  renderDashboard();
}

function updateDisplay() {
  document.getElementById('time-big').textContent = formatTime(timer.phaseTime);
  const pct = timer.phase === 'work' ? 100 : Math.max(0, timer.phaseTime / timer.phaseTotal * 100);
  updateRing(pct);
  const exo = timer.queue[timer.curExo];
  document.getElementById('ts-set').textContent = exo ? `${timer.curSet + 1}/${exo.sets}` : '0/0';
  document.getElementById('ts-exo').textContent = `${timer.curExo + 1}/${timer.queue.length}`;
  document.getElementById('ts-time').textContent = formatTime(timer.totalTime);
  document.getElementById('ctrl-action').textContent =
    timer.phase === 'work' ? '✓ Série terminée' : (timer.paused ? '▶ Reprendre' : '⏸ Pause');
}

function playBeep(freq) {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.frequency.value = freq || 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.15);
    osc.start();
    osc.stop(ac.currentTime + 0.15);
  } catch (e) {}
}
