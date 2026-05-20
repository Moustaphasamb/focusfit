function calc1RM(weight, reps) {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

function getBest1RM(name) {
  return state.lifts
    .filter(l => l.name.toLowerCase() === name.toLowerCase())
    .reduce((best, l) => Math.max(best, calc1RM(l.w, l.r)), 0);
}

function renderProgress() {
  populateExerciseSelect();
  render1RMTable();
  renderLiftHistory();
  renderExerciseChart();
}

function populateExerciseSelect() {
  const sel = document.getElementById('chart-exo-select');
  if (!sel) return;
  const exercises = [...new Set(state.lifts.map(l => l.name))];
  const current = sel.value;
  sel.innerHTML = '<option value="">— Choisir un exercice —</option>' +
    exercises.map(n => `<option value="${n}" ${n === current ? 'selected' : ''}>${n}</option>`).join('');
}

function render1RMTable() {
  const best1RM = {};
  state.lifts.forEach(l => {
    const orm = calc1RM(l.w, l.r);
    if (!best1RM[l.name] || orm > best1RM[l.name]) best1RM[l.name] = orm;
  });
  const entries = Object.entries(best1RM).sort((a, b) => b[1] - a[1]);
  const container = document.getElementById('orm-table');
  if (entries.length === 0) {
    container.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:18px">Loggez des charges pour voir votre 1RM estimé</div>';
    return;
  }
  container.innerHTML = `
    <table class="orm-table">
      <thead><tr><th>Exercice</th><th>1RM estimé</th><th>Formule</th></tr></thead>
      <tbody>
        ${entries.map(([name, orm]) => `
          <tr>
            <td>${name}</td>
            <td class="orm-value">${orm} kg</td>
            <td class="orm-formula">Epley w×(1+r/30)</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function renderLiftHistory() {
  document.getElementById('lift-history').innerHTML = state.lifts.length === 0
    ? '<div style="color:var(--text3);font-size:13px;text-align:center;padding:18px">Aucune charge enregistrée</div>'
    : state.lifts.slice(-15).reverse().map(l => `
        <div class="exo-row">
          <div>
            <div class="name">${l.name}${l.isPR ? ' <span class="pr-mini">PR</span>' : ''}</div>
            <div class="meta">${l.date} • 1RM estimé : ~${calc1RM(l.w, l.r)} kg</div>
          </div>
          <div style="font-family:'JetBrains Mono',monospace;color:var(--acc);font-weight:700">${l.w} kg × ${l.r}</div>
        </div>`).join('');
}

function renderExerciseChart() {
  const sel = document.getElementById('chart-exo-select');
  const wrap = document.getElementById('exo-chart-wrap');
  const empty = document.getElementById('exo-chart-empty');
  if (!sel || !wrap || !empty) return;

  const name = sel.value;
  if (!name) { wrap.style.display = 'none'; empty.style.display = 'block'; return; }

  const lifts = state.lifts.filter(l => l.name.toLowerCase() === name.toLowerCase());
  if (lifts.length < 2) {
    wrap.style.display = 'none';
    empty.style.display = 'block';
    empty.textContent = 'Pas assez de données (minimum 2 entrées)';
    return;
  }

  wrap.style.display = 'block';
  empty.style.display = 'none';

  const canvas = document.getElementById('exo-chart');
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.parentElement.clientWidth - 36;
  const h = 200;
  ctx.clearRect(0, 0, w, h);

  const data = lifts.map(l => ({ date: l.date, orm: calc1RM(l.w, l.r), w: l.w, r: l.r }));
  const orms = data.map(d => d.orm);
  const max = Math.max(...orms) * 1.1;
  const min = Math.min(...orms) * 0.9;
  const pad = { l: 50, r: 20, t: 20, b: 30 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;

  const gridColor  = cssVar('--border');
  const labelColor = cssVar('--text3');

  ctx.strokeStyle = gridColor; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ch * i / 4;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.fillStyle = labelColor; ctx.font = '10px JetBrains Mono'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(max - (max - min) * i / 4) + 'kg', pad.l - 6, y + 3);
  }

  ctx.strokeStyle = '#ffab40'; ctx.lineWidth = 2.5; ctx.beginPath();
  data.forEach((d, i) => {
    const x = pad.l + cw * i / Math.max(data.length - 1, 1);
    const y = pad.t + ch * (1 - (d.orm - min) / (max - min));
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.lineTo(pad.l + cw, pad.t + ch); ctx.lineTo(pad.l, pad.t + ch); ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
  grad.addColorStop(0, 'rgba(255,171,64,0.2)'); grad.addColorStop(1, 'rgba(255,171,64,0)');
  ctx.fillStyle = grad; ctx.fill();

  data.forEach((d, i) => {
    const x = pad.l + cw * i / Math.max(data.length - 1, 1);
    const y = pad.t + ch * (1 - (d.orm - min) / (max - min));
    ctx.fillStyle = '#ffab40'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = labelColor; ctx.font = '9px Barlow'; ctx.textAlign = 'center';
    const label = d.date.slice(0, 5);
    ctx.fillText(label, x, h - 8);
  });
}

function showPRBadge(name, orm) {
  const badge = document.getElementById('pr-badge');
  if (!badge) return;
  badge.innerHTML = `🏆 NOUVEAU RECORD — ${name} : ${orm} kg (1RM estimé)`;
  badge.classList.add('show');
  clearTimeout(badge._timeout);
  badge._timeout = setTimeout(() => badge.classList.remove('show'), 6000);
}

function logLift() {
  const name = document.getElementById('log-exo').value.trim();
  if (!name) return alert('Exercice requis');
  const w = +document.getElementById('log-w').value || 0;
  const r = +document.getElementById('log-r').value || 0;
  const newOrm = calc1RM(w, r);
  const prevBest = getBest1RM(name);
  const isPR = newOrm > prevBest;

  state.lifts.push({ name, w, r, date: new Date().toLocaleDateString('fr-FR'), isPR });
  save();
  ['log-exo', 'log-w', 'log-r'].forEach(id => { document.getElementById(id).value = ''; });

  if (isPR) showPRBadge(name, newOrm);
  renderProgress();
}
