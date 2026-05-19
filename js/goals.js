function renderGoals() {
  document.getElementById('goals-list').innerHTML = state.goals.length === 0
    ? '<div style="color:var(--text3);font-size:13px;text-align:center;padding:18px">Aucun objectif défini</div>'
    : state.goals.map((g, i) => `
        <div class="exo-row">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:8px;height:8px;border-radius:50%;background:var(--acc3);flex-shrink:0"></div>
            <span>${g}</span>
          </div>
          <button class="del" onclick="delGoal(${i})">×</button>
        </div>`).join('');
}

function addGoal() {
  const value = document.getElementById('goal-input').value.trim();
  if (!value) return;
  state.goals.push(value);
  save();
  document.getElementById('goal-input').value = '';
  renderGoals();
  document.getElementById('s-goals').textContent = state.goals.length;
}

function delGoal(i) {
  state.goals.splice(i, 1);
  save();
  renderGoals();
  document.getElementById('s-goals').textContent = state.goals.length;
}
