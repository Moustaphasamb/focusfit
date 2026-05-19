const STATE_KEY = 'focusFit_v3';

const state = JSON.parse(localStorage.getItem(STATE_KEY)) || {
  planning: { Lundi: [], Mardi: [], Mercredi: [], Jeudi: [], Vendredi: [], Samedi: [], Dimanche: [] },
  meals: [],
  lifts: [],
  goals: [],
  water: 0,
  sessions: 0,
  streak: 0,
  lastSessionDate: null,
  sessionHistory: [],
  weeklyVolume: [3200, 3450, 3380, 3600, 3750, 3820, 4100, 4250],
  calGoal: 2400,
  protGoal: 150,
  carbGoal: 300,
  fatGoal: 80
};

function save() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}
