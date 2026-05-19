const DEFAULT_PROGRAMS = [
  {
    id: 'ppl', name: 'Push Pull Legs', badge: '6 jours',
    desc: 'Classique pour gain force/volume. Pousser, tirer, jambes — répété 2x.',
    meta: ['6x/sem', '60-75 min', 'Intermédiaire'],
    plan: {
      Lundi:   [['Développé couché',4,8,120],['Développé militaire',4,8,90],['Élévations latérales',3,12,60],['Dips',3,10,90],['Triceps poulie',3,12,60]],
      Mardi:   [['Tractions',4,8,120],['Rowing barre',4,8,120],['Rowing assis',3,10,90],['Curl barre',3,10,60],['Curl marteau',3,12,60]],
      Mercredi:[['Squat',4,8,180],['Soulevé roumain',4,8,120],['Presse à cuisses',3,12,90],['Leg curl',3,12,60],['Mollets debout',4,15,45]],
      Jeudi:   [['Développé incliné',4,8,120],['Développé haltères',3,10,90],['Écarté poulie',3,12,60],['Dips lestés',3,8,90],['Extensions triceps',3,12,60]],
      Vendredi:[['Tractions lestées',4,6,150],['Rowing haltère',3,10,90],['Tirage poulie',3,12,60],['Curl haltères',3,12,60],['Curl concentré',3,12,45]],
      Samedi:  [['Soulevé de terre',4,5,180],['Fentes',3,10,90],['Hip thrust',3,12,90],['Leg extension',3,15,60],['Mollets assis',4,15,45]]
    }
  },
  {
    id: 'sl5', name: 'StrongLifts 5×5', badge: '3 jours',
    desc: 'Programme force pure, full body, 5 séries de 5 reps. Idéal débutant/intermédiaire.',
    meta: ['3x/sem', '45-60 min', 'Tous niveaux'],
    plan: {
      Lundi:   [['Squat',5,5,180],['Développé couché',5,5,180],['Rowing barre',5,5,180]],
      Mercredi:[['Squat',5,5,180],['Développé militaire',5,5,180],['Soulevé de terre',1,5,300]],
      Vendredi:[['Squat',5,5,180],['Développé couché',5,5,180],['Rowing barre',5,5,180]]
    }
  },
  {
    id: 'hiit', name: 'HIIT Cardio', badge: '4 jours',
    desc: 'Cardio haute intensité par intervalles. Brûle-graisses efficace.',
    meta: ['4x/sem', '25-35 min', 'Tous niveaux'],
    plan: {
      Lundi:   [['Burpees',5,30,30],['Mountain climbers',5,30,30],['Jump squats',5,20,30],['High knees',5,40,30]],
      Mardi:   [['Sprint',8,20,40],['Box jumps',5,15,45],['Battle ropes',5,30,30]],
      Jeudi:   [['Burpees',5,30,30],['Kettlebell swings',5,20,45],['Jumping jacks',5,40,20]],
      Samedi:  [['Sprint',10,20,40],['Squat jumps',5,20,30],['Push-ups',5,15,30]]
    }
  },
  {
    id: 'ul', name: 'Upper / Lower', badge: '4 jours',
    desc: 'Split haut/bas du corps. Bon équilibre fréquence/récupération.',
    meta: ['4x/sem', '60-75 min', 'Intermédiaire'],
    plan: {
      Lundi:   [['Développé couché',4,8,120],['Rowing barre',4,8,120],['Développé militaire',3,10,90],['Tractions',3,8,120],['Curl barre',3,12,60]],
      Mardi:   [['Squat',4,8,180],['Soulevé roumain',4,8,120],['Presse',3,12,90],['Leg curl',3,12,60],['Mollets',4,15,45]],
      Jeudi:   [['Développé incliné',4,8,120],['Rowing haltère',4,10,90],['Écarté',3,12,60],['Tirage',3,12,60],['Dips',3,10,90]],
      Vendredi:[['Soulevé de terre',4,5,180],['Fentes',3,10,90],['Hip thrust',3,12,90],['Leg ext',3,15,60],['Mollets assis',4,15,45]]
    }
  },
  {
    id: 'fb', name: 'Full Body', badge: '3 jours',
    desc: 'Travail complet à chaque séance. Parfait pour planning chargé.',
    meta: ['3x/sem', '60 min', 'Tous niveaux'],
    plan: {
      Lundi:   [['Squat',4,8,120],['Développé couché',4,8,120],['Rowing',4,8,120],['Développé militaire',3,10,90],['Curl',3,12,60]],
      Mercredi:[['Soulevé de terre',4,6,180],['Tractions',4,8,120],['Développé incliné',3,10,90],['Fentes',3,10,90],['Dips',3,10,90]],
      Vendredi:[['Squat front',4,8,120],['Développé couché',4,8,120],['Rowing haltère',4,10,90],['Élévations latérales',3,12,60],['Mollets',4,15,45]]
    }
  },
  {
    id: 'arnold', name: 'Arnold Split', badge: '6 jours',
    desc: "Le split légendaire d'Arnold. Volume élevé, double pec/dos.",
    meta: ['6x/sem', '75-90 min', 'Avancé'],
    plan: {
      Lundi:   [['Développé couché',5,8,120],['Développé incliné haltères',4,10,90],['Tractions',5,10,120],['Rowing barre',4,8,120],['Pull-over',3,12,90]],
      Mardi:   [['Développé militaire',5,8,120],['Élévations latérales',4,12,60],['Curl barre',4,10,90],['Curl haltères',4,10,60],['Curl marteau',3,12,60]],
      Mercredi:[['Squat',5,8,180],['Fentes',4,10,90],['Leg curl',4,12,60],['Mollets debout',5,15,45],['Mollets assis',4,20,45]],
      Jeudi:   [['Développé incliné',5,8,120],['Écarté haltères',4,12,90],['Tractions prise large',5,10,120],['Rowing assis',4,10,90],['Tirage horizontal',3,12,60]],
      Vendredi:[['Développé Arnold',5,10,90],['Élévations frontales',4,12,60],['Dips',4,12,90],['Extensions triceps',4,12,60],['Triceps poulie',3,15,45]],
      Samedi:  [['Soulevé de terre',4,6,180],['Hack squat',4,10,90],['Soulevé roumain',4,10,90],['Leg extension',4,15,60],['Mollets',5,20,45]]
    }
  }
];

function renderPrograms() {
  document.getElementById('prog-grid').innerHTML = DEFAULT_PROGRAMS.map(p => `
    <div class="prog-card" onclick="loadProgram('${p.id}')">
      <div class="prog-badge">${p.badge}</div>
      <div class="prog-name">${p.name}</div>
      <div class="prog-desc">${p.desc}</div>
      <div class="prog-meta">${p.meta.map(m => `<span>• ${m}</span>`).join('')}</div>
    </div>`).join('');
}

function loadProgram(id) {
  const program = DEFAULT_PROGRAMS.find(p => p.id === id);
  if (!program) return;
  if (!confirm(`Charger "${program.name}" ? Cela remplacera votre planning actuel.`)) return;
  state.planning = { Lundi: [], Mardi: [], Mercredi: [], Jeudi: [], Vendredi: [], Samedi: [], Dimanche: [] };
  Object.entries(program.plan).forEach(([day, exos]) => { state.planning[day] = exos; });
  save();
  showPage('planning', document.querySelectorAll('.nav-item')[1]);
}
