/* Extrait de l'application réelle (jsdom) les données affichées à l'écran :
   mêmes valeurs, mêmes libellés, mêmes calculs que dans le navigateur. */
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.resolve(__dirname, '..', '..');   // racine du dépôt
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const src = [...html.matchAll(/<script src="js\/([^"]+)"><\/script>/g)].map(m => m[1])
  .map(f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'));

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const today = new Date();

const demo = {
  planning: {
    Lundi: [['Squat', 4, 8, 120, ''], ['Fentes', 3, 12, 90, ''], ['Gainage', 3, 45, 60, '']],
    Mardi: [], Mercredi: [['Développé couché', 4, 8, 120, ''], ['Dips', 3, 10, 90, '']],
    Jeudi: [], Vendredi: [['Soulevé de terre', 3, 5, 150, ''], ['Rowing barre', 4, 10, 90, '']],
    Samedi: [['Course', 1, 30, 0, '']], Dimanche: []
  },
  lifts: [], meals: [], goals: [], water: 5, waterDate: iso(today),
  sessions: 24, streak: 3, lastSessionDate: daysAgo(1),
  doneExos: { [iso(today)]: ['Soulevé de terre'] },
  sessionHistory: [], calGoal: 2600, protGoal: 160, carbGoal: 300, fatGoal: 80,
  profile: { name: 'Baye', age: 32, gender: 'male', weight: 82, height: 180, activity: 'moderate', sportGoal: 'muscle', level: 'intermediate' },
  weightLog: []
};
/* Charges plausibles et régulières, pour un graphique de volume réaliste */
const plan = [['Squat', 110, 5], ['Développé couché', 85, 6], ['Soulevé de terre', 140, 5], ['Rowing barre', 75, 8], ['Dips', 20, 10]];
for (let w = 8; w >= 1; w--) {
  const base = 8 - w;
  for (const d of [w * 7 - 1, w * 7 - 3, w * 7 - 5]) {
    for (const [name, weight, reps] of plan.slice(0, 3 + (base % 2))) {
      demo.lifts.push({ name, w: weight + base * 2, r: reps, date: daysAgo(d), isPR: false });
    }
  }
}
demo.lifts.push({ name: 'Squat', w: 132, r: 5, date: daysAgo(3), isPR: true });
for (const [i, ago] of [1, 3, 5, 8, 11, 15, 18].entries()) {
  demo.sessionHistory.push({ date: daysAgo(ago), time: '18:30', duration: 2400 + i * 200, day: DAYS[today.getDay()],
    exercises: ['Squat', 'Développé couché'], totalExos: 3, logged: [{ name: 'Squat', w: 120, r: 8, set: 1 }], volume: 4200 + i * 380 });
}
for (let i = 0; i < 13; i++) {
  const d = new Date(today); d.setDate(d.getDate() - i * 4);
  demo.weightLog.push({ date: iso(d), weight: +(84 - i * 0.28).toFixed(1), ts: Date.now() - i * 4 * 86400000 });
}
demo.meals = [
  { date: iso(today), name: "Flocons d'avoine", cal: 520, prot: 22, carbs: 78, fat: 12 },
  { date: iso(today), name: 'Poulet / Riz', cal: 780, prot: 55, carbs: 92, fat: 18 }
];

const vc = new VirtualConsole();
const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
const w = dom.window;
w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => (k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
w.confirm = () => true; w.alert = () => {};
w.localStorage.setItem('focusFit_v3', JSON.stringify(demo));
w.eval(src.join('\n;\n') + '\n;window.__state = state;');
w.renderDashboard();
w.showPage('progress'); w.renderProgress();

const T = sel => { const e = w.document.querySelector(sel); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
const cal = [...w.document.querySelectorAll('#activity-cal .cal-cell')].map((e, i) => ({
  active: e.classList.contains('active'), today: e.classList.contains('today'), future: e.classList.contains('future'),
  title: e.getAttribute('title') || '', col: i % 7
}));
const todayExos = [...w.document.querySelectorAll('#today-list .check-row')].map(e => ({
  name: e.querySelector('div > div').textContent,
  detail: e.querySelector('div > div:nth-child(2)').textContent,
  done: e.classList.contains('done')
}));
const week = w.computeWeeklyVolume(8);
const section = (id) => {
  const el = w.document.getElementById(id);
  if (!el) return null;
  const card = el.closest('.card');
  return card ? card.querySelector('.card-title').textContent.trim() : null;
};

const out = {
  greffon: T('#hero-greeting'),
  kpis: [
    { label: 'Séances terminées', value: T('#s-sessions'), sub: T('#s-sessions-sub'), accent: 'acc' },
    { label: 'Calories brûlées', value: T('#s-cal'), sub: T('#s-cal-sub'), accent: 'acc4' },
    { label: "Eau aujourd'hui", value: T('#s-water'), sub: T('#s-water-sub'), accent: 'acc' },
    { label: 'Objectifs actifs', value: T('#s-goals'), sub: 'en cours', accent: 'acc3' },
    { label: 'Streak', value: T('#s-streak'), sub: 'jours consécutifs', accent: 'acc5' }
  ],
  today: { day: T('#today-name'), count: T('#today-count'), exos: todayExos },
  water: { filled: w.__state.water, total: 8 },
  volume: { badge: T('#volume-badge'), weeks: week },
  calendar: cal,
  streakLabel: T('#streak-label'),
  titles: { nutrition: section('n-cal') }
};
fs.writeFileSync(path.join(__dirname, 'data.json'), JSON.stringify(out, null, 2));
console.log('greeting :', out.greffon);
console.log('kpis   :', out.kpis.map(k => `${k.label}=${k.value}`).join(' · '));
console.log('volume :', out.volume.badge, '| barres:', out.volume.weeks.map(x => Math.round(x.value)).join(','));
console.log('séance :', out.today.day, out.today.count, '|', out.today.exos.map(e => e.name + (e.done ? ' ✓' : '')).join(', '));
console.log('calendrier :', out.calendar.length, 'cellules · actives', out.calendar.filter(c => c.active).length, '· aujourd\'hui col', (out.calendar.findIndex(c => c.today) % 7) + 1, '· streak', out.streakLabel);
w.close();
