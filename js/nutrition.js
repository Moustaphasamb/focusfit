/** Index des repas dans `state.meals`, pour ne supprimer que le bon. */
function todayMeals() {
  rolloverDailyState();
  const date = todayISO();
  return state.meals
    .map((meal, index) => ({ meal, index }))
    .filter(({ meal }) => meal.date === date);
}

function renderNutrition() {
  // Seuls les repas du jour comptent dans les totaux affichés.
  const meals = todayMeals().map(({ meal }) => meal);
  const cal   = meals.reduce((a, m) => a + (m.cal   || 0), 0);
  const prot  = meals.reduce((a, m) => a + (m.prot  || 0), 0);
  const carbs = meals.reduce((a, m) => a + (m.carbs || 0), 0);
  const fat   = meals.reduce((a, m) => a + (m.fat   || 0), 0);

  document.getElementById('n-cal').textContent   = cal;
  document.getElementById('n-prot').innerHTML    = prot  + '<span style="font-size:18px;color:var(--text3)">g</span>';
  document.getElementById('n-carbs').innerHTML   = carbs + '<span style="font-size:18px;color:var(--text3)">g</span>';
  document.getElementById('n-fat').innerHTML     = fat   + '<span style="font-size:18px;color:var(--text3)">g</span>';
  document.getElementById('n-meals').textContent = meals.length;

  const mealsSub = document.getElementById('n-meals-sub');
  if (mealsSub) mealsSub.textContent = displayDate(todayISO());
  const mealsTitle = document.getElementById('meals-title');
  if (mealsTitle) mealsTitle.textContent = `Repas du ${displayDate(todayISO())}`;

  renderMacroBars(cal, prot, carbs, fat);
  renderMacroGoalInputs();
  renderMacroGoals();

  document.getElementById('meals-list').innerHTML = meals.length === 0
    ? '<div style="color:var(--text3);font-size:13px;text-align:center;padding:18px">Aucun repas enregistré aujourd\'hui</div>'
    : todayMeals().map(({ meal, index }) => `
        <div class="exo-row">
          <div>
            <div class="name">${esc(meal.name)}</div>
            <div class="meta">${meal.cal} kcal • ${meal.prot || 0}g prot • ${meal.carbs || 0}g gluc • ${meal.fat || 0}g lip</div>
          </div>
          <button class="del" onclick="delMeal(${index})">×</button>
        </div>`).join('');

  const note = document.getElementById('meals-history-note');
  if (note) {
    const otherDays = state.meals.length - meals.length;
    note.textContent = otherDays > 0
      ? `${otherDays} repas enregistré${otherDays > 1 ? 's' : ''} sur les jours précédents — conservés mais exclus des totaux du jour.`
      : '';
  }
}

function renderMacroGoals() {
  const g = document.getElementById('n-goal-cal');
  if (g) g.textContent = `/ ${state.calGoal} kcal`;
  const gp = document.getElementById('n-goal-prot');
  if (gp) gp.textContent = `/ ${state.protGoal}g`;
  const gc = document.getElementById('n-goal-carbs');
  if (gc) gc.textContent = `/ ${state.carbGoal}g`;
  const gf = document.getElementById('n-goal-fat');
  if (gf) gf.textContent = `/ ${state.fatGoal}g`;
}

function renderMacroGoalInputs() {
  const set = (id, v) => { const el = document.getElementById(id); if (el && el !== document.activeElement) el.value = v; };
  set('goal-cal', state.calGoal);
  set('goal-prot', state.protGoal);
  set('goal-carbs', state.carbGoal);
  set('goal-fat', state.fatGoal);
}

/** Objectifs personnalisés : ils ne seront plus écrasés par le recalcul TDEE du profil. */
function saveMacroGoals() {
  const val = id => Math.max(0, parseInt(document.getElementById(id).value, 10) || 0);
  const cal = val('goal-cal');
  const prot = val('goal-prot');
  const carbs = val('goal-carbs');
  const fat = val('goal-fat');
  if (!cal && !prot && !carbs && !fat) {
    return showGoalHint('Renseignez au moins une valeur.', 'error');
  }
  state.calGoal = cal; state.protGoal = prot; state.carbGoal = carbs; state.fatGoal = fat;
  state.macroTargetsCustom = true;
  save();
  renderNutrition();
  renderMacroGoals();
  showGoalHint('Objectifs enregistrés — ils ne seront plus recalculés automatiquement depuis le profil.', 'success');
}

function resetMacroGoals() {
  const tdee = calcTDEE(calcBMR(state.profile), state.profile.activity);
  if (!tdee) {
    return showGoalHint('Complétez poids, taille et âge dans le profil pour utiliser le calcul TDEE.', 'error');
  }
  state.macroTargetsCustom = false;
  applyMacroTargets({
    cal: tdee,
    prot: Math.round((state.profile.weight || 0) * 1.8),
    carb: Math.round(tdee * 0.45 / 4),
    fat: Math.round(tdee * 0.28 / 9)
  });
  save();
  renderNutrition();
  renderMacroGoals();
  showGoalHint(`Objectifs recalculés depuis votre profil (${state.calGoal} kcal).`, 'success');
}

function showGoalHint(message, kind) {
  const el = document.getElementById('goal-hint');
  if (!el) return;
  el.textContent = message;
  el.className = 'form-hint ' + (kind || '');
}

/** Rafraîchit les totaux nutrition si la page est affichée (appelé après une sauvegarde du profil). */
function syncNutritionTotals() {
  const page = document.getElementById('page-nutrition');
  if (page && page.classList.contains('active')) {
    renderNutrition();
    renderMacroGoals();
  }
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
    date: todayISO(),
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
  if (!confirm('Supprimer les repas enregistrés aujourd\'hui ?')) return;
  const date = todayISO();
  state.meals = state.meals.filter(m => m.date !== date);
  save();
  renderNutrition();
}
