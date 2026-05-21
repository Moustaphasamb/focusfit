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
    </div>`;
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
