function renderDashboard() {
  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const today = dayNames[new Date().getDay()];

  const h = new Date().getHours();
  const greet = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  const greetEl = document.getElementById('hero-greeting');
  if (greetEl) greetEl.textContent = `${greet}, ${state.profile?.name || 'Baye'} 💪`;
  document.getElementById('today-name').textContent = today;

  const exos = state.planning[today] || [];
  const list = document.getElementById('today-list');
  if (exos.length === 0) {
    list.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px">Aucun exercice planifié</div>';
  } else {
    list.innerHTML = exos.map(e => `
      <div class="check-row" onclick="this.classList.toggle('done')">
        <div class="checkbox"></div>
        <div style="flex:1">
          <div style="font-weight:500">${e[0]}</div>
          <div style="font-size:11px;color:var(--text3);font-family:'JetBrains Mono',monospace">${e[1]}×${e[2]} • ${e[3]}s repos</div>
        </div>
      </div>`).join('');
  }

  const daysWithExos = Object.values(state.planning).filter(d => d.length > 0).length;
  const totalExos = Object.values(state.planning).reduce((a, b) => a + b.length, 0);
  document.getElementById('s-sessions').textContent = daysWithExos;
  document.getElementById('s-cal').textContent = (totalExos * 45).toLocaleString();
  document.getElementById('s-water').innerHTML = state.water + '<span style="font-size:18px;color:var(--text3)">/8</span>';
  document.getElementById('s-goals').textContent = state.goals.filter(g => !g.achieved).length;
  document.getElementById('s-streak').textContent = state.streak || 0;

  renderWater();
  drawChart();
  renderCalendar();
  drawWeightDashChart();
}

function renderWater() {
  const grid = document.getElementById('water-grid');
  grid.innerHTML = Array.from({ length: 8 }, (_, i) =>
    `<div class="water-cup ${i < state.water ? 'filled' : ''}" onclick="setWater(${i + 1})">${i < state.water ? '💧' : ''}</div>`
  ).join('');
}

function setWater(n) {
  state.water = state.water === n ? n - 1 : n;
  save();
  renderWater();
  document.getElementById('s-water').innerHTML = state.water + '<span style="font-size:18px;color:var(--text3)">/8</span>';
}

function resetDay() {
  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const today = dayNames[new Date().getDay()];
  const exos = state.planning[today] || [];
  const list = document.getElementById('today-list');
  if (exos.length === 0) {
    list.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px">Aucun exercice planifié</div>';
  } else {
    list.innerHTML = exos.map(e => `
      <div class="check-row" onclick="this.classList.toggle('done')">
        <div class="checkbox"></div>
        <div style="flex:1">
          <div style="font-weight:500">${e[0]}</div>
          <div style="font-size:11px;color:var(--text3);font-family:'JetBrains Mono',monospace">${e[1]}×${e[2]} • ${e[3]}s repos</div>
        </div>
      </div>`).join('');
  }
  state.water = 0;
  save();
  renderWater();
  document.getElementById('s-water').innerHTML = '0<span style="font-size:18px;color:var(--text3)">/8</span>';
}

function resetWater() {
  state.water = 0;
  save();
  renderWater();
  document.getElementById('s-water').innerHTML = '0<span style="font-size:18px;color:var(--text3)">/8</span>';
}

function renderCalendar() {
  const cal = document.getElementById('activity-cal');
  if (!cal) return;

  const sessionDates = new Set(state.sessionHistory.map(s => s.date));
  const cells = [];
  const totalDays = 35;

  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dateStr = d.toLocaleDateString('fr-FR');
    const isToday = i === 0;
    const active = sessionDates.has(dateStr);
    cells.push(`<div class="cal-cell ${active ? 'active' : ''} ${isToday ? 'today' : ''}" title="${dateStr}"></div>`);
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
    const p = e.date.split('/');
    return new Date(`${p[2]}-${p[1]}-${p[0]}`) <= ago30;
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
      ctx.fillText(e.date.slice(0, 5), x, h - 8);
    }
  });
}

function drawChart() {
  const canvas = document.getElementById('chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.parentElement.clientWidth - 36;
  const h = 240;
  ctx.clearRect(0, 0, w, h);

  const data = state.weeklyVolume;
  const max = Math.max(...data) * 1.1;
  const min = Math.min(...data) * 0.9;
  const pad = { l: 50, r: 20, t: 20, b: 30 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;

  const gridColor  = cssVar('--border');
  const labelColor = cssVar('--text3');
  const accColor   = cssVar('--acc') || '#00e5ff';

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ch * i / 4;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.fillStyle = labelColor;
    ctx.font = '10px JetBrains Mono';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(max - (max - min) * i / 4), pad.l - 8, y + 3);
  }

  ctx.strokeStyle = accColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = pad.l + cw * i / (data.length - 1);
    const y = pad.t + ch * (1 - (v - min) / (max - min));
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.lineTo(pad.l + cw, pad.t + ch);
  ctx.lineTo(pad.l, pad.t + ch);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
  grad.addColorStop(0, 'rgba(0,229,255,0.25)');
  grad.addColorStop(1, 'rgba(0,229,255,0)');
  ctx.fillStyle = grad;
  ctx.fill();

  data.forEach((v, i) => {
    const x = pad.l + cw * i / (data.length - 1);
    const y = pad.t + ch * (1 - (v - min) / (max - min));
    ctx.fillStyle = accColor;
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = labelColor;
    ctx.font = '10px Barlow';
    ctx.textAlign = 'center';
    ctx.fillText('S' + (i + 1), x, h - 10);
  });
}
