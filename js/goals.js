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
        createdAt: todayISO()
      };
    }
    return g;
  });
  if (changed) save();
})();

/* La progression des objectifs est calculée par core.js (goalCurrent, isAutoTracked,
   goalProgress) à partir des données réelles ; getGoalCurrent()/getGoalProgress()
   (state.js) font le lien avec l'état courant. */

function getGoalDeadlineStr(goal) {
  const info = deadlineInfo(goal.deadline);
  if (!info) return '';
  if (info.kind === 'past') return '<span style="color:var(--acc2);font-weight:600">Délai dépassé</span>';
  if (info.kind === 'today') return '<span style="color:var(--acc4);font-weight:600">Aujourd\'hui !</span>';
  if (info.kind === 'soon') return `<span style="color:var(--acc4);font-weight:600">${info.days}j restants</span>`;
  return `<span style="color:var(--text3)">${info.days} jours restants</span>`;
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
    const targetStrSafe = esc(targetStr);

    const auto = isAutoTracked(g);
    let currentBlock = '';
    if (g.type === 'weight') {
      currentBlock = `
        <div class="goal-kpi">
          <span class="goal-kpi-val" style="color:${accent}">${current}</span>
          <span class="goal-kpi-unit">kg actuellement</span>
          <span class="goal-kpi-sep">→</span>
          <span class="goal-kpi-unit">Objectif : <strong style="color:var(--text)">${targetStrSafe}</strong></span>
        </div>`;
    } else if (g.type === 'sessions') {
      currentBlock = `
        <div class="goal-kpi">
          <span class="goal-kpi-val" style="color:${accent}">${current}</span>
          <span class="goal-kpi-unit">séances</span>
          <span class="goal-kpi-sep">→</span>
          <span class="goal-kpi-unit">Objectif : <strong style="color:var(--text)">${targetStrSafe}</strong></span>
        </div>`;
    } else if (g.type === 'duration') {
      currentBlock = `
        <div class="goal-kpi">
          <span class="goal-kpi-val" style="color:${accent}">${current}</span>
          <span class="goal-kpi-unit">${esc(unit) || 'min'} cumulées</span>
          <span class="goal-kpi-sep">→</span>
          <span class="goal-kpi-unit">Objectif : <strong style="color:var(--text)">${targetStrSafe}</strong></span>
        </div>`;
    } else {
      currentBlock = `
        <div class="goal-kpi" style="align-items:center">
          <input type="number" value="${current}" min="0"
            style="width:76px;padding:5px 9px;font-size:13px;font-weight:700;text-align:center"
            onchange="updateGoalCurrent('${esc(g.id)}', this.value)"
            title="Entrez votre valeur actuelle">
          <span class="goal-kpi-unit">${esc(unit)}</span>
          <span class="goal-kpi-sep">→</span>
          <span class="goal-kpi-unit">Objectif : <strong style="color:var(--text)">${targetStrSafe}</strong></span>
        </div>`;
    }

    return `
      <div class="goal-card ${g.achieved ? 'goal-achieved' : ''}">
        <div class="goal-card-top">
          <div class="goal-info">
            <div class="goal-type-badge" style="color:${accent}">${getTypeLabel(g.type)}</div>
            <div class="goal-title">${esc(g.title)}${g.achieved ? ' <span class="pr-mini" style="background:var(--acc3);color:#000">ATTEINT</span>' : ''}</div>
            ${dlStr ? `<div class="goal-deadline">${dlStr}</div>` : ''}
          </div>
          <div class="goal-actions">
            ${!g.achieved ? `<button class="btn btn-sm btn-secondary" onclick="openGoalModal('${esc(g.id)}')" title="Modifier">✏️</button>` : ''}
            <button class="btn btn-sm ${g.achieved ? 'btn-secondary' : 'btn-success'}" onclick="toggleGoalAchieved('${esc(g.id)}')" title="${g.achieved ? 'Rouvrir' : 'Marquer atteint'}">${g.achieved ? '↩' : '✓'}</button>
            <button class="btn btn-sm btn-danger" onclick="delGoal('${esc(g.id)}')" title="Supprimer">×</button>
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
          <div class="goal-hint">Exercice suivi : <strong>${esc(g.exercise)}</strong> • Sync automatique avec vos charges</div>
        ` : auto && g.type !== 'weight' ? `
          <div class="goal-hint">Progression alimentée automatiquement par vos séances terminées</div>
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
  if (type === 'duration' && !document.getElementById('gm-unit').value) {
    document.getElementById('gm-unit').value = 'min';
  }

  // Rappel de la source de progression (les autres types se remplissent tout seuls).
  const hint = document.getElementById('gm-sync-hint');
  if (hint) {
    const messages = {
      weight: 'Progression calculée depuis vos charges enregistrées (1RM estimé).',
      sessions: 'Progression calculée depuis vos séances terminées depuis la création de l\'objectif.',
      duration: 'Progression calculée depuis les minutes d\'entraînement cumulées depuis la création de l\'objectif.',
      custom: 'Objectif manuel : vous saisissez la valeur actuelle vous-même.'
    };
    hint.textContent = messages[type] || '';
  }
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
      createdAt: todayISO()
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
