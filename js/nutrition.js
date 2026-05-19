function renderNutrition() {
  const cal   = state.meals.reduce((a, m) => a + (m.cal   || 0), 0);
  const prot  = state.meals.reduce((a, m) => a + (m.prot  || 0), 0);
  const carbs = state.meals.reduce((a, m) => a + (m.carbs || 0), 0);
  const fat   = state.meals.reduce((a, m) => a + (m.fat   || 0), 0);

  document.getElementById('n-cal').textContent   = cal;
  document.getElementById('n-prot').innerHTML    = prot  + '<span style="font-size:18px;color:var(--text3)">g</span>';
  document.getElementById('n-carbs').innerHTML   = carbs + '<span style="font-size:18px;color:var(--text3)">g</span>';
  document.getElementById('n-fat').innerHTML     = fat   + '<span style="font-size:18px;color:var(--text3)">g</span>';
  document.getElementById('n-meals').textContent = state.meals.length;

  renderMacroBars(cal, prot, carbs, fat);

  document.getElementById('meals-list').innerHTML = state.meals.length === 0
    ? '<div style="color:var(--text3);font-size:13px;text-align:center;padding:18px">Aucun repas enregistré</div>'
    : state.meals.map((m, i) => `
        <div class="exo-row">
          <div>
            <div class="name">${m.name}</div>
            <div class="meta">${m.cal} kcal • ${m.prot}g prot • ${m.carbs || 0}g gluc • ${m.fat || 0}g lip</div>
          </div>
          <button class="del" onclick="delMeal(${i})">×</button>
        </div>`).join('');
}

function renderMacroBars(cal, prot, carbs, fat) {
  const goals = [
    { id: 'bar-cal',   val: cal,   goal: state.calGoal  || 2400, label: 'Calories', unit: 'kcal', color: 'var(--acc)'  },
    { id: 'bar-prot',  val: prot,  goal: state.protGoal || 150,  label: 'Protéines', unit: 'g',   color: 'var(--acc4)' },
    { id: 'bar-carbs', val: carbs, goal: state.carbGoal || 300,  label: 'Glucides',  unit: 'g',   color: 'var(--acc5)' },
    { id: 'bar-fat',   val: fat,   goal: state.fatGoal  || 80,   label: 'Lipides',   unit: 'g',   color: 'var(--acc2)' },
  ];
  goals.forEach(({ id, val, goal, label, unit, color }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const pct = Math.min(100, Math.round(val / goal * 100));
    el.innerHTML = `
      <div class="macro-label">
        <span>${label}</span>
        <span style="color:var(--text2);font-weight:600">${val}<span style="color:var(--text3);font-size:11px"> / ${goal} ${unit}</span></span>
      </div>
      <div class="macro-bar"><div class="macro-fill" style="width:${pct}%;background:${color}"></div></div>`;
  });
}

function addMeal() {
  const name = document.getElementById('meal-name').value.trim();
  if (!name) return alert('Nom requis');
  state.meals.push({
    name,
    cal:   +document.getElementById('meal-cal').value   || 0,
    prot:  +document.getElementById('meal-prot').value  || 0,
    carbs: +document.getElementById('meal-carbs').value || 0,
    fat:   +document.getElementById('meal-fat').value   || 0,
  });
  save();
  ['meal-name', 'meal-cal', 'meal-prot', 'meal-carbs', 'meal-fat'].forEach(id => {
    document.getElementById(id).value = '';
  });
  renderNutrition();
}

function delMeal(i) {
  state.meals.splice(i, 1);
  save();
  renderNutrition();
}

function clearMeals() {
  if (!confirm('Vider tous les repas ?')) return;
  state.meals = [];
  save();
  renderNutrition();
}
