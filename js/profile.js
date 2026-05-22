const ACTIVITY_FACTORS = {
  sedentary:  { label: 'Sédentaire (peu ou pas de sport)',       factor: 1.2   },
  light:      { label: 'Légèrement actif (1–3 séances/sem)',     factor: 1.375 },
  moderate:   { label: 'Modérément actif (3–5 séances/sem)',     factor: 1.55  },
  active:     { label: 'Très actif (6–7 séances/sem)',           factor: 1.725 },
  veryactive: { label: 'Athlète (2× par jour)',                  factor: 1.9   }
};

const SPORT_GOALS = {
  muscle:      { label: 'Prise de masse',      icon: '💪' },
  weightloss:  { label: 'Perte de poids',      icon: '🔥' },
  endurance:   { label: 'Endurance',           icon: '🏃' },
  maintenance: { label: 'Maintien',            icon: '⚖️' }
};

const LEVELS = {
  beginner:     { label: 'Débutant',      color: 'var(--acc3)' },
  intermediate: { label: 'Intermédiaire', color: 'var(--acc4)' },
  advanced:     { label: 'Avancé',        color: 'var(--acc)'  }
};

function calcBMI(weight, height) {
  if (!weight || !height) return null;
  return weight / Math.pow(height / 100, 2);
}

function bmiCategory(bmi) {
  if (bmi < 18.5) return { label: 'Insuffisance pondérale', color: 'var(--acc5)' };
  if (bmi < 25)   return { label: 'Poids normal',           color: 'var(--acc3)' };
  if (bmi < 30)   return { label: 'Surpoids',               color: 'var(--acc4)' };
  return              { label: 'Obésité',                color: 'var(--acc2)' };
}

function calcBMR(p) {
  if (!p.weight || !p.height || !p.age) return null;
  if (p.gender === 'female') {
    return 447.593 + (9.247 * p.weight) + (3.098 * p.height) - (4.330 * p.age);
  }
  return 88.362 + (13.397 * p.weight) + (4.799 * p.height) - (5.677 * p.age);
}

function calcTDEE(bmr, activity) {
  if (!bmr) return null;
  return Math.round(bmr * (ACTIVITY_FACTORS[activity]?.factor || 1.55));
}

function idealWeight(height, gender) {
  if (!height) return null;
  // Formule de Lorentz
  const base = gender === 'female'
    ? height - 100 - (height - 150) / 2.5
    : height - 100 - (height - 150) / 4;
  return Math.round(base);
}

function getInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function renderProfile() {
  const p = state.profile;
  const bmi    = calcBMI(p.weight, p.height);
  const bmr    = calcBMR(p);
  const tdee   = calcTDEE(bmr, p.activity);
  const ideal  = idealWeight(p.height, p.gender);
  const lvl    = LEVELS[p.level] || LEVELS.intermediate;
  const goal   = SPORT_GOALS[p.sportGoal] || SPORT_GOALS.muscle;
  const bmiCat = bmi ? bmiCategory(bmi) : null;

  // Sync greeting in dashboard
  const greetEl = document.getElementById('hero-greeting');
  if (greetEl) {
    const h = new Date().getHours();
    const greet = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
    greetEl.textContent = `${greet}, ${p.name || 'Baye'} 💪`;
  }

  const container = document.getElementById('page-profile');
  if (!container) return;

  container.innerHTML = `
    <!-- Avatar card -->
    <div class="profile-hero">
      <div class="profile-avatar">${getInitials(p.name)}</div>
      <div class="profile-hero-info">
        <div class="profile-name">${p.name || '—'}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
          <span class="profile-badge" style="color:${lvl.color};border-color:${lvl.color}20;background:${lvl.color}12">${lvl.label}</span>
          <span class="profile-badge">${goal.icon} ${goal.label}</span>
          ${p.age ? `<span class="profile-badge">${p.age} ans</span>` : ''}
        </div>
      </div>
    </div>

    <!-- Stats calculées -->
    <div class="grid grid-4" style="margin-bottom:22px">
      <div class="stat-card" style="--accent-color:var(--acc)">
        <div class="stat-label">Poids</div>
        <div class="stat-value">${p.weight || '—'}<span style="font-size:18px;color:var(--text3)">${p.weight ? ' kg' : ''}</span></div>
        <div class="stat-sub">${ideal && p.weight ? (p.weight > ideal ? `+${p.weight - ideal} kg vs idéal` : p.weight < ideal ? `-${ideal - p.weight} kg vs idéal` : 'Poids idéal atteint') : 'Non renseigné'}</div>
      </div>
      <div class="stat-card" style="--accent-color:var(--acc5)">
        <div class="stat-label">Taille</div>
        <div class="stat-value">${p.height || '—'}<span style="font-size:18px;color:var(--text3)">${p.height ? ' cm' : ''}</span></div>
        <div class="stat-sub">${ideal ? `Poids idéal : ${ideal} kg` : 'Non renseigné'}</div>
      </div>
      <div class="stat-card" style="--accent-color:${bmiCat ? bmiCat.color : 'var(--text3)'}">
        <div class="stat-label">IMC</div>
        <div class="stat-value">${bmi ? bmi.toFixed(1) : '—'}</div>
        <div class="stat-sub" style="color:${bmiCat ? bmiCat.color : 'var(--text3)'}">${bmiCat ? bmiCat.label : 'Renseignez poids & taille'}</div>
      </div>
      <div class="stat-card" style="--accent-color:var(--acc4)">
        <div class="stat-label">Calories / jour</div>
        <div class="stat-value">${tdee || '—'}<span style="font-size:18px;color:var(--text3)">${tdee ? ' kcal' : ''}</span></div>
        <div class="stat-sub">TDEE estimé (${ACTIVITY_FACTORS[p.activity]?.label.split(' ')[0] || '—'})</div>
      </div>
    </div>

    <!-- Formulaire -->
    <div class="card">
      <div class="card-head"><div class="card-title">Mes informations</div></div>
      <div class="profile-form">

        <div class="profile-form-row">
          <div class="profile-form-section">Identité</div>
        </div>

        <div class="grid grid-3" style="gap:14px;margin-bottom:14px">
          <div>
            <label>Prénom</label>
            <input id="pf-name" value="${p.name || ''}" placeholder="ex : Baye">
          </div>
          <div>
            <label>Âge</label>
            <input type="number" id="pf-age" value="${p.age || ''}" placeholder="ex : 25" min="10" max="100">
          </div>
          <div>
            <label>Sexe</label>
            <select id="pf-gender">
              <option value="male"   ${p.gender === 'male'   ? 'selected' : ''}>Homme</option>
              <option value="female" ${p.gender === 'female' ? 'selected' : ''}>Femme</option>
            </select>
          </div>
        </div>

        <div class="profile-form-row">
          <div class="profile-form-section">Morphologie</div>
        </div>

        <div class="grid grid-2" style="gap:14px;margin-bottom:14px">
          <div>
            <label>Poids (kg)</label>
            <input type="number" id="pf-weight" value="${p.weight || ''}" placeholder="ex : 80" min="30" max="300" step="0.5">
          </div>
          <div>
            <label>Taille (cm)</label>
            <input type="number" id="pf-height" value="${p.height || ''}" placeholder="ex : 180" min="100" max="250">
          </div>
        </div>

        <div class="profile-form-row">
          <div class="profile-form-section">Sport</div>
        </div>

        <div class="grid grid-3" style="gap:14px;margin-bottom:20px">
          <div>
            <label>Niveau</label>
            <select id="pf-level">
              ${Object.entries(LEVELS).map(([k, v]) =>
                `<option value="${k}" ${p.level === k ? 'selected' : ''}>${v.label}</option>`
              ).join('')}
            </select>
          </div>
          <div>
            <label>Objectif sportif</label>
            <select id="pf-goal">
              ${Object.entries(SPORT_GOALS).map(([k, v]) =>
                `<option value="${k}" ${p.sportGoal === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`
              ).join('')}
            </select>
          </div>
          <div>
            <label>Activité quotidienne</label>
            <select id="pf-activity">
              ${Object.entries(ACTIVITY_FACTORS).map(([k, v]) =>
                `<option value="${k}" ${p.activity === k ? 'selected' : ''}>${v.label}</option>`
              ).join('')}
            </select>
          </div>
        </div>

        <button class="btn" onclick="saveProfile()">Enregistrer le profil</button>
      </div>
    </div>

    <!-- Suivi du poids -->
    ${renderWeightSection()}`;

  drawWeightChart();
}

function renderWeightSection() {
  const log = state.weightLog;
  const last = log.length ? log[log.length - 1] : null;
  const first = log.length ? log[0] : null;

  // Variation totale
  const totalDiff = (last && first && last !== first)
    ? (last.weight - first.weight).toFixed(1)
    : null;

  // Variation sur 30 jours
  const ago30 = new Date(); ago30.setDate(ago30.getDate() - 30);
  const old30 = [...log].reverse().find(e => {
    const parts = e.date.split('/');
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`) <= ago30;
  });
  const diff30 = (last && old30) ? (last.weight - old30.weight).toFixed(1) : null;

  function diffBadge(val) {
    if (val === null) return '<span style="color:var(--text3)">—</span>';
    const n = parseFloat(val);
    const color = n < 0 ? 'var(--acc3)' : n > 0 ? 'var(--acc2)' : 'var(--text3)';
    const sign = n > 0 ? '+' : '';
    return `<span style="color:${color};font-weight:700">${sign}${val} kg</span>`;
  }

  const today = new Date().toLocaleDateString('fr-FR');
  const currentW = last ? last.weight : (state.profile.weight || '');

  return `
    <div class="card" style="margin-top:22px">
      <div class="card-head">
        <div class="card-title">Suivi du poids</div>
        ${log.length > 1 ? `<button class="btn btn-sm btn-secondary" onclick="clearWeightLog()">Vider</button>` : ''}
      </div>

      <!-- Logger une entrée -->
      <div class="wlog-input-row">
        <div style="flex:1;min-width:100px">
          <label>Poids (kg)</label>
          <input type="number" id="wlog-weight" value="${currentW}" placeholder="ex : 82" min="30" max="300" step="0.1">
        </div>
        <div style="flex:1;min-width:120px">
          <label>Date</label>
          <input type="date" id="wlog-date" value="${new Date().toISOString().slice(0,10)}">
        </div>
        <div style="display:flex;align-items:flex-end">
          <button class="btn" onclick="logWeight()">+ Enregistrer</button>
        </div>
      </div>

      <!-- Stats strip -->
      <div class="wlog-stats">
        <div class="wlog-stat">
          <div class="wlog-stat-val" style="color:var(--acc)">${last ? last.weight + ' kg' : '—'}</div>
          <div class="wlog-stat-lbl">Poids actuel</div>
        </div>
        <div class="wlog-stat">
          <div class="wlog-stat-val">${diffBadge(totalDiff)}</div>
          <div class="wlog-stat-lbl">Variation totale</div>
        </div>
        <div class="wlog-stat">
          <div class="wlog-stat-val">${diffBadge(diff30)}</div>
          <div class="wlog-stat-lbl">Sur 30 jours</div>
        </div>
        <div class="wlog-stat">
          <div class="wlog-stat-val" style="color:var(--text3)">${log.length}</div>
          <div class="wlog-stat-lbl">Mesure${log.length > 1 ? 's' : ''}</div>
        </div>
      </div>

      <!-- Graphique -->
      ${log.length >= 2 ? `
        <div class="chart-wrap" style="margin-bottom:18px">
          <canvas id="weight-chart" height="200"></canvas>
        </div>
      ` : log.length === 1 ? `
        <div style="color:var(--text3);font-size:13px;text-align:center;padding:14px 0">
          Ajoutez une 2ᵉ mesure pour voir l'évolution
        </div>
      ` : `
        <div style="color:var(--text3);font-size:13px;text-align:center;padding:20px 0">
          📊 Enregistrez votre premier poids pour démarrer le suivi
        </div>
      `}

      <!-- Historique -->
      ${log.length > 0 ? `
        <div class="card-head" style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border)">
          <div class="card-title" style="font-size:12px">Historique</div>
        </div>
        <div class="wlog-history">
          ${[...log].reverse().slice(0, 20).map((e, i) => {
            const realIdx = log.length - 1 - i;
            const prev = realIdx > 0 ? log[realIdx - 1] : null;
            const diff = prev ? (e.weight - prev.weight).toFixed(1) : null;
            const color = diff !== null ? (parseFloat(diff) < 0 ? 'var(--acc3)' : parseFloat(diff) > 0 ? 'var(--acc2)' : 'var(--text3)') : 'var(--text3)';
            return `
              <div class="exo-row">
                <div>
                  <div class="name">${e.weight} kg</div>
                  <div class="meta">${e.date}${diff !== null ? ` • <span style="color:${color}">${parseFloat(diff) > 0 ? '+' : ''}${diff} kg</span>` : ''}</div>
                </div>
                <button class="del" onclick="deleteWeightEntry(${realIdx})">×</button>
              </div>`;
          }).join('')}
        </div>
      ` : ''}
    </div>`;
}

function logWeight() {
  const w = +document.getElementById('wlog-weight').value;
  if (!w || w < 20 || w > 400) return;
  const dateInput = document.getElementById('wlog-date').value;
  const date = dateInput
    ? new Date(dateInput).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');

  // Évite les doublons sur la même date
  const existing = state.weightLog.findIndex(e => e.date === date);
  if (existing >= 0) {
    state.weightLog[existing].weight = w;
  } else {
    state.weightLog.push({ date, weight: w, ts: new Date(dateInput || Date.now()).getTime() });
    state.weightLog.sort((a, b) => a.ts - b.ts);
  }

  state.profile.weight = w;
  save();
  renderProfile();
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

function deleteWeightEntry(i) {
  state.weightLog.splice(i, 1);
  if (state.weightLog.length > 0) {
    state.profile.weight = state.weightLog[state.weightLog.length - 1].weight;
  }
  save();
  renderProfile();
}

function clearWeightLog() {
  if (!confirm('Vider tout l\'historique de poids ?')) return;
  state.weightLog = [];
  save();
  renderProfile();
}

function drawWeightChart() {
  const canvas = document.getElementById('weight-chart');
  if (!canvas) return;
  const log = state.weightLog;
  if (log.length < 2) return;

  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.parentElement.clientWidth - 36;
  const h = 200;
  ctx.clearRect(0, 0, w, h);

  const weights = log.map(e => e.weight);
  const maxW = Math.max(...weights) + 1;
  const minW = Math.min(...weights) - 1;
  const pad = { l: 48, r: 16, t: 16, b: 32 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;

  const gridColor  = cssVar('--border');
  const labelColor = cssVar('--text3');
  const accentCol  = '#00e5ff';

  // Grille horizontale
  ctx.strokeStyle = gridColor; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ch * i / 4;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.fillStyle = labelColor; ctx.font = '10px JetBrains Mono'; ctx.textAlign = 'right';
    ctx.fillText((maxW - (maxW - minW) * i / 4).toFixed(1) + 'kg', pad.l - 6, y + 3);
  }

  // Ligne de courbe
  ctx.strokeStyle = accentCol; ctx.lineWidth = 2.5; ctx.beginPath();
  log.forEach((e, i) => {
    const x = pad.l + cw * i / Math.max(log.length - 1, 1);
    const y = pad.t + ch * (1 - (e.weight - minW) / (maxW - minW));
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Gradient fill
  const lastX = pad.l + cw;
  const lastY = pad.t + ch * (1 - (log[log.length - 1].weight - minW) / (maxW - minW));
  ctx.lineTo(lastX, pad.t + ch); ctx.lineTo(pad.l, pad.t + ch); ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
  grad.addColorStop(0, 'rgba(0,229,255,0.18)'); grad.addColorStop(1, 'rgba(0,229,255,0)');
  ctx.fillStyle = grad; ctx.fill();

  // Points + labels dates
  log.forEach((e, i) => {
    const x = pad.l + cw * i / Math.max(log.length - 1, 1);
    const y = pad.t + ch * (1 - (e.weight - minW) / (maxW - minW));
    ctx.fillStyle = accentCol; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    // Label valeur au survol — on affiche juste les dates en bas
    if (log.length <= 12) {
      ctx.fillStyle = labelColor; ctx.font = '9px Barlow'; ctx.textAlign = 'center';
      ctx.fillText(e.date.slice(0, 5), x, h - 8);
    }
  });
}

function saveProfile() {
  const p = state.profile;
  p.name     = document.getElementById('pf-name').value.trim() || p.name;
  p.age      = +document.getElementById('pf-age').value || 0;
  p.gender   = document.getElementById('pf-gender').value;
  p.weight   = +document.getElementById('pf-weight').value || 0;
  p.height   = +document.getElementById('pf-height').value || 0;
  p.level    = document.getElementById('pf-level').value;
  p.sportGoal = document.getElementById('pf-goal').value;
  p.activity = document.getElementById('pf-activity').value;
  save();
  renderProfile();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showSavedToast();
}

function showSavedToast() {
  let toast = document.getElementById('profile-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'profile-toast';
    toast.className = 'profile-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = '✓ Profil enregistré';
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 2500);
}
