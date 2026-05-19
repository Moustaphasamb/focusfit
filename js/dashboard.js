function renderDashboard() {
  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const today = dayNames[new Date().getDay()];
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
  document.getElementById('s-goals').textContent = state.goals.length;
  document.getElementById('s-streak').textContent = state.streak || 0;

  renderWater();
  drawChart();
  renderCalendar();
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

  ctx.strokeStyle = '#1d2733';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ch * i / 4;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.fillStyle = '#5a6e82';
    ctx.font = '10px JetBrains Mono';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(max - (max - min) * i / 4), pad.l - 8, y + 3);
  }

  ctx.strokeStyle = '#00e5ff';
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
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a6e82';
    ctx.font = '10px Barlow';
    ctx.textAlign = 'center';
    ctx.fillText('S' + (i + 1), x, h - 10);
  });
}
