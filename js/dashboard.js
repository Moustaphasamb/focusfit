function renderDashboard() {
  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const todayName = dayNames[new Date().getDay()];
  const today = todayISO();

  // Les compteurs journaliers (eau) sont remis à zéro si le jour a changé.
  rolloverDailyState();

  const h = new Date().getHours();
  const greet = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  const greetEl = document.getElementById('hero-greeting');
  if (greetEl) greetEl.textContent = `${greet}, ${state.profile?.name || 'Baye'} 💪`;
  document.getElementById('today-name').textContent = todayName;

  renderTodayList(todayName, today);

  // ── Indicateurs calculés à partir des séances réellement terminées ──
  const week = getCurrentWeek();                     // lundi → aujourd'hui
  const weekSessions = state.sessionHistory.filter(s => s.date >= week.start && s.date <= week.end);
  const weekMinutes = weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60;
  const weight = state.profile?.weight || 75;

  document.getElementById('s-sessions').textContent = weekSessions.length;
  const sessionSub = document.getElementById('s-sessions-sub');
  if (sessionSub) {
    const objectif = weekSessions.length >= 4 ? 'objectif hebdo atteint' : 'objectif : 4/sem';
    sessionSub.textContent = weekMinutes > 0 ? `${objectif} • ${formatDuration(weekMinutes)}` : objectif;
  }

  const kcal = estimateKcal(weekMinutes, weight);
  document.getElementById('s-cal').textContent = kcal.toLocaleString('fr-FR');
  const calSub = document.getElementById('s-cal-sub');
  if (calSub) calSub.textContent = `cette semaine • ${weekSessions.length} séance${weekSessions.length > 1 ? 's' : ''} (estimé)`;

  document.getElementById('s-water').innerHTML = state.water + '<span style="font-size:18px;color:var(--text3)">/8</span>';
  document.getElementById('s-goals').textContent = state.goals.filter(g => !g.achieved).length;
  document.getElementById('s-streak').textContent = state.streak || 0;

  renderWater();
  drawChart();
  renderCalendar();
  drawWeightDashChart();
}

/* ── Séance du jour ─────────────────────────────────────────────────────────── */

/** Liste des exercices du jour, avec cases cochées persistées par date. */
function renderTodayList(dayName, date) {
  const exos = state.planning[dayName] || [];
  const list = document.getElementById('today-list');
  const done = state.doneExos[date] || [];

  if (exos.length === 0) {
    list.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px">Aucun exercice planifié</div>';
  } else {
    list.innerHTML = exos.map((e, i) => {
      const checked = done.includes(e[0]);
      return `
      <div class="check-row ${checked ? 'done' : ''}" onclick="toggleExoDone('${esc(date)}', ${i})">
        <div class="checkbox"></div>
        <div style="flex:1">
          <div style="font-weight:500">${esc(e[0])}</div>
          <div style="font-size:11px;color:var(--text3);font-family:'JetBrains Mono',monospace">${e[1]}×${e[2]} • ${e[3]}s repos</div>
        </div>
      </div>`;
    }).join('');
  }

  const counter = document.getElementById('today-count');
  if (counter) {
    counter.textContent = exos.length
      ? `${exos.filter(e => done.includes(e[0])).length}/${exos.length} fait${exos.length > 1 ? 's' : ''}`
      : '';
  }
}

/** Coche / décoche un exercice de la séance du jour (conservé d'une visite à l'autre). */
function toggleExoDone(date, index) {
  const dayName = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][new Date().getDay()];
  const exo = (state.planning[dayName] || [])[index];
  if (!exo) return;

  const done = state.doneExos[date] || (state.doneExos[date] = []);
  const pos = done.indexOf(exo[0]);
  if (pos >= 0) done.splice(pos, 1);
  else done.push(exo[0]);

  save();
  renderTodayList(dayName, date);
}

/* ── Calculs partagés ───────────────────────────────────────────────────────── */

/** Semaine en cours (lundi → dimanche), au format ISO. */
function getCurrentWeek() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const dow = (today.getDay() + 6) % 7;             // 0 = lundi
  const start = new Date(today);
  start.setDate(today.getDate() - dow);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: localISO(start), end: localISO(end), today: localISO(today) };
}

/**
 * Estimation des calories brûlées par une séance de musculation :
 * formule standard kcal = MET × 3,5 × poids(kg) / 200 × minutes, avec MET ≈ 6
 * (effort intense avec pauses). C'est une estimation, pas une mesure.
 */
function estimateKcal(minutes, weightKg) {
  return Math.round(6 * 3.5 * (weightKg || 75) / 200 * Math.max(0, minutes));
}

/**
 * Volume d'entraînement (kg soulevés = poids × répétitions) par semaine,
 * calculé à partir des charges réellement enregistrées.
 */
function computeWeeklyVolume(weeks = 8) {
  const buckets = [];
  const ref = new Date();
  ref.setHours(12, 0, 0, 0);
  ref.setDate(ref.getDate() - ((ref.getDay() + 6) % 7));   // lundi de la semaine en cours

  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(ref);
    start.setDate(ref.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    buckets.push({ start: localISO(start), end: localISO(end), value: 0, count: 0 });
  }

  state.lifts.forEach(l => {
    const iso = toISO(l.date);
    if (!iso) return;
    const bucket = buckets.find(b => iso >= b.start && iso <= b.end);
    if (!bucket) return;
    bucket.value += (l.w || 0) * (l.r || 0);
    bucket.count++;
  });

  return buckets;
}

/** Durée en minutes → « 1 h 30 » ou « 45 min ». */
function formatDuration(minutes) {
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

function formatVolume(kg) {
  const value = kg >= 1000 ? kg / 1000 : Math.round(kg);
  const unit = kg >= 1000 ? 't' : 'kg';
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: kg >= 1000 ? 1 : 0 })} ${unit}`;
}

function renderWater() {
  const grid = document.getElementById('water-grid');
  grid.innerHTML = Array.from({ length: 8 }, (_, i) =>
    `<div class="water-cup ${i < state.water ? 'filled' : ''}" onclick="setWater(${i + 1})">${i < state.water ? '💧' : ''}</div>`
  ).join('');
}

function setWater(n) {
  state.water = state.water === n ? n - 1 : n;
  state.waterDate = todayISO();
  save();
  renderWater();
  document.getElementById('s-water').innerHTML = state.water + '<span style="font-size:18px;color:var(--text3)">/8</span>';
}

/** Réinitialise la journée en cours : cases cochées, puis eau. */
function resetDay() {
  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const dayName = dayNames[new Date().getDay()];
  const date = todayISO();

  delete state.doneExos[date];
  state.water = 0;
  state.waterDate = date;
  save();

  renderTodayList(dayName, date);
  renderWater();
  document.getElementById('s-water').innerHTML = '0<span style="font-size:18px;color:var(--text3)">/8</span>';
}

function resetWater() {
  state.water = 0;
  state.waterDate = todayISO();
  save();
  renderWater();
  document.getElementById('s-water').innerHTML = '0<span style="font-size:18px;color:var(--text3)">/8</span>';
}

function renderCalendar() {
  const cal = document.getElementById('activity-cal');
  if (!cal) return;

  // Nombre de séances par jour : la grille affiche 5 semaines complètes (lundi → dimanche),
  // alignées sur l'en-tête « L M M J V S D », la semaine en cours étant la dernière ligne.
  const perDay = {};
  state.sessionHistory.forEach(s => { perDay[s.date] = (perDay[s.date] || 0) + 1; });

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const todayStr = localISO(today);

  const dow = (today.getDay() + 6) % 7;                  // 0 = lundi … 6 = dimanche
  const end = new Date(today);
  end.setDate(today.getDate() + (6 - dow));              // dimanche de la semaine en cours
  const start = new Date(end);
  start.setDate(end.getDate() - 34);                     // 5 semaines = 35 jours

  const cells = [];
  for (let i = 0; i < 35; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = localISO(d);
    const count = perDay[iso] || 0;
    const classes = ['cal-cell'];
    if (count > 0) classes.push('active');
    if (iso === todayStr) classes.push('today');
    if (d > today) classes.push('future');
    const title = count > 0
      ? `${displayDate(iso)} — ${count} séance${count > 1 ? 's' : ''}`
      : displayDate(iso);
    cells.push(`<div class="${classes.join(' ')}" title="${title}"></div>`);
  }
  cal.innerHTML = cells.join('');

  const streakEl = document.getElementById('streak-label');
  if (streakEl) {
    const s = state.streak || 0;
    streakEl.textContent = s > 0 ? `${s} jour${s > 1 ? 's' : ''} de suite 🔥` : '';
  }
}

function drawWeightDashChart() {
  const wrap  = document.getElementById('dash-weight-wrap');
  const empty = document.getElementById('dash-weight-empty');
  const badge = document.getElementById('dash-weight-badge');
  if (!wrap || !empty || !badge) return;

  const log = state.weightLog || [];
  if (log.length < 2) {
    wrap.style.display  = 'none';
    empty.style.display = 'block';
    badge.innerHTML = '';
    return;
  }

  wrap.style.display  = 'block';
  empty.style.display = 'none';

  const last  = log[log.length - 1];
  const first = log[0];
  const diff  = (last.weight - first.weight).toFixed(1);
  const diffColor = parseFloat(diff) < 0 ? 'var(--acc3)' : parseFloat(diff) > 0 ? 'var(--acc2)' : 'var(--text3)';
  const sign  = parseFloat(diff) > 0 ? '+' : '';

  // Variation 30 jours
  const ago30 = new Date(); ago30.setDate(ago30.getDate() - 30);
  const ref30 = [...log].reverse().find(e => {
    const d = parseISO(e.date);
    return d && d <= ago30;
  });
  const diff30 = ref30 ? (last.weight - ref30.weight).toFixed(1) : null;
  const diff30Color = diff30 !== null ? (parseFloat(diff30) < 0 ? 'var(--acc3)' : parseFloat(diff30) > 0 ? 'var(--acc2)' : 'var(--text3)') : '';
  const sign30 = diff30 !== null && parseFloat(diff30) > 0 ? '+' : '';

  badge.innerHTML = `
    <span style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:var(--acc)">${last.weight} kg</span>
    <span style="font-size:12px;color:${diffColor};font-weight:700">${sign}${diff} kg total</span>
    ${diff30 !== null ? `<span style="font-size:12px;color:${diff30Color};font-weight:700">${sign30}${diff30} kg / 30j</span>` : ''}`;

  const canvas = document.getElementById('dash-weight-chart');
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.parentElement.clientWidth - 36;
  const h = 180;
  ctx.clearRect(0, 0, w, h);

  const weights = log.map(e => e.weight);
  const maxW = Math.max(...weights) + 0.8;
  const minW = Math.min(...weights) - 0.8;
  const pad  = { l: 48, r: 16, t: 16, b: 32 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;

  const gridColor  = cssVar('--border');
  const labelColor = cssVar('--text3');
  const lineColor  = '#b388ff';

  // Grille
  ctx.strokeStyle = gridColor; ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = pad.t + ch * i / 3;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.fillStyle = labelColor; ctx.font = '10px JetBrains Mono'; ctx.textAlign = 'right';
    ctx.fillText((maxW - (maxW - minW) * i / 3).toFixed(1) + 'kg', pad.l - 5, y + 3);
  }

  // Courbe
  ctx.strokeStyle = lineColor; ctx.lineWidth = 2.5; ctx.beginPath();
  log.forEach((e, i) => {
    const x = pad.l + cw * i / Math.max(log.length - 1, 1);
    const y = pad.t + ch * (1 - (e.weight - minW) / (maxW - minW));
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Gradient fill
  ctx.lineTo(pad.l + cw, pad.t + ch); ctx.lineTo(pad.l, pad.t + ch); ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
  grad.addColorStop(0, 'rgba(179,136,255,0.2)'); grad.addColorStop(1, 'rgba(179,136,255,0)');
  ctx.fillStyle = grad; ctx.fill();

  // Points + dates
  log.forEach((e, i) => {
    const x = pad.l + cw * i / Math.max(log.length - 1, 1);
    const y = pad.t + ch * (1 - (e.weight - minW) / (maxW - minW));
    ctx.fillStyle = lineColor; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    if (log.length <= 14) {
      ctx.fillStyle = labelColor; ctx.font = '9px Barlow'; ctx.textAlign = 'center';
      ctx.fillText(shortDate(e.date), x, h - 8);
    }
  });
}

function drawChart() {
  const canvas = document.getElementById('chart');
  if (!canvas) return;

  const buckets = computeWeeklyVolume(8);
  const values = buckets.map(b => b.value);
  const hasData = values.some(v => v > 0);

  const wrap = document.getElementById('volume-wrap');
  const empty = document.getElementById('volume-empty');
  const badge = document.getElementById('volume-badge');
  if (wrap) wrap.style.display = hasData ? 'block' : 'none';
  if (empty) empty.style.display = hasData ? 'none' : 'block';
  if (badge) {
    const total = values.reduce((a, b) => a + b, 0);
    badge.textContent = hasData ? `${formatVolume(total)} sur 8 semaines` : '';
  }
  if (!hasData) return;

  const ctx = canvas.getContext('2d');
  const cw = Math.max(240, canvas.parentElement.clientWidth - 36);
  const h = 240;
  if (canvas.width !== cw) canvas.width = cw;
  if (canvas.height !== h) canvas.height = h;
  ctx.clearRect(0, 0, cw, h);

  const max = Math.max(...values) * 1.15 || 1;
  const min = 0;
  const pad = { l: 56, r: 20, t: 20, b: 30 };
  const innerW = cw - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  const gridColor  = cssVar('--border');
  const labelColor = cssVar('--text3');
  const accColor   = cssVar('--acc') || '#00e5ff';

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + innerH * i / 4;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(cw - pad.r, y); ctx.stroke();
    ctx.fillStyle = labelColor;
    ctx.font = '10px JetBrains Mono';
    ctx.textAlign = 'right';
    ctx.fillText(formatVolume(max - (max - min) * i / 4), pad.l - 8, y + 3);
  }

  const step = values.length > 1 ? innerW / (values.length - 1) : 0;
  ctx.strokeStyle = accColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = pad.l + step * i;
    const y = pad.t + innerH * (1 - (v - min) / (max - min));
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.lineTo(pad.l + step * (values.length - 1), pad.t + innerH);
  ctx.lineTo(pad.l, pad.t + innerH);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + innerH);
  grad.addColorStop(0, 'rgba(0,229,255,0.25)');
  grad.addColorStop(1, 'rgba(0,229,255,0)');
  ctx.fillStyle = grad;
  ctx.fill();

  buckets.forEach((b, i) => {
    const x = pad.l + step * i;
    const y = pad.t + innerH * (1 - (b.value - min) / (max - min));
    ctx.fillStyle = b.value > 0 ? accColor : labelColor;
    ctx.beginPath(); ctx.arc(x, y, b.value > 0 ? 4 : 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = labelColor;
    ctx.font = '10px Barlow';
    ctx.textAlign = 'center';
    ctx.fillText('S' + (i + 1), x, h - 10);
    if (b.value > 0) {
      ctx.font = '9px JetBrains Mono';
      ctx.fillText(formatVolume(b.value), x, y - 9);
    }
  });
}
