let timer = {
  running: false,
  paused: true,
  phase: 'idle',
  phaseTime: 0,
  phaseTotal: 0,
  totalTime: 0,
  queue: [],
  curExo: 0,
  curSet: 0,
  defaultRest: 90,
  interval: null,
  sessionStart: null,
  dayName: ''
};

const PHASE_COLORS = { prep: '#ffab40', work: '#69ff47', rest: '#00e5ff' };
const PHASE_LABELS = { prep: 'PRÉPARATION', work: 'EXÉCUTION', rest: 'REPOS' };

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
  const prep = +document.getElementById('prep-sec').value || 10;
  timer.defaultRest = +document.getElementById('default-rest').value || 90;
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
  document.getElementById('timer-setup').style.display = 'none';
  document.getElementById('timer-active').style.display = 'block';
  setPhase('prep', prep);
  timer.running = true;
  timer.paused = false;
  if (!timer.interval) timer.interval = setInterval(tick, 1000);
  document.getElementById('ctrl-action').innerHTML = '⏸ Pause';
}

function setPhase(phase, time) {
  timer.phase = phase;
  timer.phaseTime = time;
  timer.phaseTotal = time;
  const color = PHASE_COLORS[phase];
  const display = document.querySelector('.timer-display');
  display.style.setProperty('--phase-color', color);
  document.getElementById('progress-fill').style.background = color;
  document.getElementById('phase-label').textContent = PHASE_LABELS[phase];
  document.getElementById('phase-label').style.color = color;
  const exo = timer.queue[timer.curExo];
  if (phase === 'work') {
    document.getElementById('phase-info').textContent = `${exo.name} — Série ${timer.curSet + 1}/${exo.sets}${exo.reps ? ' • ' + exo.reps + ' reps' : ''}`;
  } else if (phase === 'rest') {
    document.getElementById('phase-info').textContent = `Repos — Prochain : ${exo.name}`;
  } else {
    document.getElementById('phase-info').textContent = `Prêt pour : ${exo ? exo.name : '—'}`;
  }
  document.getElementById('rest-presets').style.display = phase === 'rest' ? 'flex' : 'none';
  updateDisplay();
}

function tick() {
  if (timer.paused || !timer.running) return;
  if (timer.phase === 'work') {
    timer.phaseTime++;
    timer.totalTime++;
    updateDisplay();
    return;
  }
  if (timer.phaseTime > 0) {
    timer.phaseTime--;
    timer.totalTime++;
    updateDisplay();
    if (timer.phaseTime <= 3 && timer.phaseTime > 0) playBeep(600);
  } else {
    playBeep(900);
    if (timer.phase === 'rest') {
      sendNotif('FocusFIT', `Repos terminé — ${timer.queue[timer.curExo]?.name || 'À toi !'}`);
    }
    nextPhase();
  }
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
    nextPhase();
  } else {
    timer.paused = !timer.paused;
    document.getElementById('ctrl-action').innerHTML = timer.paused ? '▶ Reprendre' : '⏸ Pause';
  }
}

function setRest(seconds) {
  if (timer.phase === 'rest') {
    timer.phaseTime = seconds;
    timer.phaseTotal = seconds;
    updateDisplay();
  }
}

function stopTimer() {
  clearInterval(timer.interval);
  timer.interval = null;
  timer.running = false;
  timer.paused = true;
  document.getElementById('timer-setup').style.display = 'block';
  document.getElementById('timer-active').style.display = 'none';
}

function updateStreak() {
  const today = new Date().toLocaleDateString('fr-FR');
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('fr-FR');
  if (state.lastSessionDate === today) return;
  state.streak = state.lastSessionDate === yesterday ? (state.streak || 0) + 1 : 1;
  state.lastSessionDate = today;
}

function finishSession() {
  clearInterval(timer.interval);
  timer.interval = null;
  timer.running = false;

  const duration = Math.round((Date.now() - timer.sessionStart) / 1000);
  state.sessions++;
  updateStreak();
  state.sessionHistory.push({
    date: new Date().toLocaleDateString('fr-FR'),
    time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    duration,
    day: timer.dayName,
    exercises: timer.queue.map(e => e.name),
    totalExos: timer.queue.length
  });
  save();

  playBeep(1200);
  sendNotif('FocusFIT — Séance terminée !', `Durée : ${formatTime(duration)} • ${timer.queue.length} exercices`);
  alert(`Séance terminée !\nDurée : ${formatTime(duration)}\nExercices : ${timer.queue.length}`);
  closeTimer();
  renderDashboard();
}

function updateDisplay() {
  document.getElementById('time-big').textContent = formatTime(timer.phaseTime);
  const pct = timer.phase === 'work' ? 100 : Math.max(0, 100 - (timer.phaseTime / timer.phaseTotal * 100));
  document.getElementById('progress-fill').style.width = pct + '%';
  const exo = timer.queue[timer.curExo];
  document.getElementById('ts-set').textContent = exo ? `${timer.curSet + 1}/${exo.sets}` : '0/0';
  document.getElementById('ts-exo').textContent = `${timer.curExo + 1}/${timer.queue.length}`;
  document.getElementById('ts-time').textContent = formatTime(timer.totalTime);
  document.getElementById('ctrl-action').innerHTML =
    timer.phase === 'work' ? '✓ Série terminée' : (timer.paused ? '▶ Reprendre' : '⏸ Pause');
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
