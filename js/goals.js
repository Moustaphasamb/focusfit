// Migration: convert old string goals to structured objects
(function migrateGoals() {
  let changed = false;
  state.goals = state.goals.map(g => {
    if (typeof g === 'string') {
      changed = true;
      return {
        id: Date.now() + Math.floor(Math.random() * 9999),
        title: g,
        type: 'custom',
        exercise: '',
        current: 0,
        target: 100,
        unit: '',
        deadline: '',
        achieved: false,
        createdAt: new Date().toLocaleDateString('fr-FR')
      };
    }
    return g;
  });
  if (changed) save();
})();

function getGoalCurrent(goal) {
  if (goal.type === 'weight' && goal.exercise) {
    return getBest1RM(goal.exercise) || 0;
  }
  if (goal.type === 'sessions') {
    return state.sessions || 0;
  }
  return goal.current || 0;
}

function getGoalProgress(goal) {
  const curr = getGoalCurrent(goal);
  if (!goal.target || goal.target === 0) return 0;
  return Math.min(100, Math.round((curr / goal.target) * 100));
}

function getGoalDeadlineStr(goal) {
  if (!goal.deadline) return '';
  const d = new Date(goal.deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
  if (diff < 0) return '<span style="color:var(--acc2);font-weight:600">Délai dépassé</span>';
  if (diff === 0) return '<span style="color:var(--acc4);font-weight:600">Aujourd\'hui !</span>';
  if (diff <= 7) return `<span style="color:var(--acc4);font-weight:600">${diff}j restants</span>`;
  return `<span style="color:var(--text3)">${diff} jours restants</span>`;
}

function getTypeLabel(type) {
  const labels = { weight: '🏋️ Force', sessions: '📅 Séances', duration: '⏱ Durée', custom: '✏️ Perso' };
  return labels[type] || '✏️ Perso';
}

function getTypeAccent(type) {
  const accents = { weight: 'var(--acc)', sessions: 'var(--acc3)', duration: 'var(--acc5)', custom: 'var(--acc2)' };
  return accents[type] || 'var(--acc)';
}

function renderGoals() {
  const container = document.getElementById('goals-list');
  const activeCount = state.goals.filter(g => !g.achieved).length;
  const el = document.getElementById('s-goals');
  if (el) el.textContent = activeCount;

  if (state.goals.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:36px 20px;color:var(--text3)">
        <div style="font-size:40px;margin-bottom:12px">🎯</div>
        <div style="font-size:14px;font-weight:600;color:var(--text2);margin-bottom:6px">Aucun objectif défini</div>
        <div style="font-size:13px">Créez votre premier objectif sportif !</div>
      </div>`;
    return;
  }

  const sorted = [...state.goals].sort((a, b) => (a.achieved ? 1 : 0) - (b.achieved ? 1 : 0));

  container.innerHTML = sorted.map(g => {
    const progress = g.achieved ? 100 : getGoalProgress(g);
    const current = getGoalCurrent(g);
    const accent = getTypeAccent(g.type);
    const dlStr = getGoalDeadlineStr(g);
    const unit = g.unit || '';
    const targetStr = g.target ? `${g.target}${unit ? ' ' + unit : ''}` : '—';

    let currentBlock = '';
    if (g.type === 'weight') {
      currentBlock = `
        <div class="goal-kpi">
          <span class="goal-kpi-val" style="color:${accent}">${current}</span>
          <span class="goal-kpi-unit">kg actuellement</span>
          <span class="goal-kpi-sep">→</span>
          <span class="goal-kpi-unit">Objectif : <strong style="color:var(--text)">${targetStr}</strong></span>
        </div>`;
    } else if (g.type === 'sessions') {
      currentBlock = `
        <div class="goal-kpi">
          <span class="goal-kpi-val" style="color:${accent}">${current}</span>
          <span class="goal-kpi-unit">séances</span>
          <span class="goal-kpi-sep">→</span>
          <span class="goal-kpi-unit">Objectif : <strong style="color:var(--text)">${targetStr}</strong></span>
        </div>`;
    } else if (g.type === 'duration') {
      currentBlock = `
        <div class="goal-kpi">
          <span class="goal-kpi-val" style="color:${accent}">${current}</span>
          <span class="goal-kpi-unit">${unit || 'min'}</span>
          <span class="goal-kpi-sep">→</span>
          <span class="goal-kpi-unit">Objectif : <strong style="color:var(--text)">${targetStr}</strong></span>
        </div>`;
    } else {
      currentBlock = `
        <div class="goal-kpi" style="align-items:center">
          <input type="number" value="${current}" min="0"
            style="width:76px;padding:5px 9px;font-size:13px;font-weight:700;text-align:center"
            onchange="updateGoalCurrent('${g.id}', this.value)"
            title="Entrez votre valeur actuelle">
          <span class="goal-kpi-unit">${unit}</span>
          <span class="goal-kpi-sep">→</span>
          <span class="goal-kpi-unit">Objectif : <strong style="color:var(--text)">${targetStr}</strong></span>
        </div>`;
    }

    return `
      <div class="goal-card ${g.achieved ? 'goal-achieved' : ''}">
        <div class="goal-card-top">
          <div class="goal-info">
            <div class="goal-type-badge" style="color:${accent}">${getTypeLabel(g.type)}</div>
            <div class="goal-title">${g.title}${g.achieved ? ' <span class="pr-mini" style="background:var(--acc3);color:#000">ATTEINT</span>' : ''}</div>
            ${dlStr ? `<div class="goal-deadline">${dlStr}</div>` : ''}
          </div>
          <div class="goal-actions">
            ${!g.achieved ? `<button class="btn btn-sm btn-secondary" onclick="openGoalModal('${g.id}')" title="Modifier">✏️</button>` : ''}
            <button class="btn btn-sm ${g.achieved ? 'btn-secondary' : 'btn-success'}" onclick="toggleGoalAchieved('${g.id}')" title="${g.achieved ? 'Rouvrir' : 'Marquer atteint'}">${g.achieved ? '↩' : '✓'}</button>
            <button class="btn btn-sm btn-danger" onclick="delGoal('${g.id}')" title="Supprimer">×</button>
          </div>
        </div>

        <div class="goal-progress-wrap">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
            ${currentBlock}
            <div class="goal-pct" style="color:${g.achieved ? 'var(--acc3)' : accent}">${progress}%</div>
          </div>
          <div class="goal-progress-bar">
            <div class="goal-progress-fill" style="width:${progress}%;background:${g.achieved ? 'var(--acc3)' : accent}"></div>
          </div>
        </div>

        ${g.exercise && g.type === 'weight' ? `
          <div class="goal-hint">Exercice suivi : <strong>${g.exercise}</strong> • Sync automatique avec vos charges</div>
        ` : ''}
      </div>`;
  }).join('');
}

let _editGoalId = null;

function openGoalModal(id) {
  _editGoalId = id || null;
  const modal = document.getElementById('goal-modal');

  if (id) {
    const g = state.goals.find(g => String(g.id) === String(id));
    if (!g) return;
    document.getElementById('gm-title').textContent = 'Modifier l\'objectif';
    document.getElementById('gm-name').value = g.title;
    document.getElementById('gm-type').value = g.type;
    document.getElementById('gm-exercise').value = g.exercise || '';
    document.getElementById('gm-target').value = g.target || '';
    document.getElementById('gm-unit').value = g.unit || '';
    document.getElementById('gm-deadline').value = g.deadline || '';
    document.getElementById('gm-current').value = g.current || '';
  } else {
    document.getElementById('gm-title').textContent = 'Nouvel objectif';
    document.getElementById('gm-name').value = '';
    document.getElementById('gm-type').value = 'weight';
    document.getElementById('gm-exercise').value = '';
    document.getElementById('gm-target').value = '';
    document.getElementById('gm-unit').value = 'kg';
    document.getElementById('gm-deadline').value = '';
    document.getElementById('gm-current').value = '';
  }

  updateGoalModalFields();
  modal.classList.add('show');
  setTimeout(() => document.getElementById('gm-name').focus(), 80);
}

function closeGoalModal() {
  document.getElementById('goal-modal').classList.remove('show');
  _editGoalId = null;
}

function updateGoalModalFields() {
  const type = document.getElementById('gm-type').value;
  document.getElementById('gm-exercise-row').style.display = type === 'weight' ? '' : 'none';
  document.getElementById('gm-unit-row').style.display = (type === 'custom' || type === 'duration') ? '' : 'none';
  document.getElementById('gm-current-row').style.display = type === 'custom' ? '' : 'none';
  if (type === 'sessions') document.getElementById('gm-unit').value = 'séances';
  if (type === 'weight') document.getElementById('gm-unit').value = 'kg';
}

function saveGoal() {
  const name = document.getElementById('gm-name').value.trim();
  if (!name) { document.getElementById('gm-name').focus(); return; }
  const type = document.getElementById('gm-type').value;
  const exercise = document.getElementById('gm-exercise').value.trim();
  const target = +document.getElementById('gm-target').value || 0;
  const unit = document.getElementById('gm-unit').value.trim();
  const deadline = document.getElementById('gm-deadline').value;
  const current = +document.getElementById('gm-current').value || 0;

  if (_editGoalId) {
    const idx = state.goals.findIndex(g => String(g.id) === String(_editGoalId));
    if (idx >= 0) {
      state.goals[idx] = { ...state.goals[idx], title: name, type, exercise, target, unit, deadline, current };
    }
  } else {
    state.goals.push({
      id: Date.now(),
      title: name,
      type,
      exercise,
      current,
      target,
      unit,
      deadline,
      achieved: false,
      createdAt: new Date().toLocaleDateString('fr-FR')
    });
  }

  save();
  closeGoalModal();
  renderGoals();
}

function delGoal(id) {
  state.goals = state.goals.filter(g => String(g.id) !== String(id));
  save();
  renderGoals();
}

function toggleGoalAchieved(id) {
  const g = state.goals.find(g => String(g.id) === String(id));
  if (!g) return;
  g.achieved = !g.achieved;
  save();
  renderGoals();
}

function updateGoalCurrent(id, val) {
  const g = state.goals.find(g => String(g.id) === String(id));
  if (!g) return;
  g.current = +val || 0;
  save();
  renderGoals();
}
