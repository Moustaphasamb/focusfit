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
  fatGoal: 80,
  profile: {
    name: 'Baye',
    age: 0,
    gender: 'male',
    weight: 0,
    height: 0,
    activity: 'moderate',
    sportGoal: 'muscle',
    level: 'intermediate'
  },
  weightLog: []
};

// Migration: ensure profile and weightLog exist on old saves
if (!state.profile) {
  state.profile = { name: 'Baye', age: 0, gender: 'male', weight: 0, height: 0, activity: 'moderate', sportGoal: 'muscle', level: 'intermediate' };
  save();
}
if (!state.weightLog) {
  state.weightLog = [];
  save();
}

function save() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}
