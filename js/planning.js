const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const FOCUS_MAP = { Lundi: 'Push', Mardi: 'Pull', Mercredi: 'Legs', Jeudi: 'Push', Vendredi: 'Pull', Samedi: 'Legs', Dimanche: 'Repos' };

function renderPlanning() {
  document.getElementById('days-grid').innerHTML = DAYS.map(d => {
    const exos = state.planning[d] || [];
    return `<div class="day-card">
      <div class="day-head">
        <div>
          <div class="day-name">${d}</div>
          <div class="day-focus">${FOCUS_MAP[d] || ''} • ${exos.length} exo${exos.length !== 1 ? 's' : ''}</div>
        </div>
        ${exos.length > 0 ? `<button class="btn btn-sm" onclick="launchDay('${d}')">⏱</button>` : ''}
      </div>
      <div class="exo-list">
        ${exos.length === 0
          ? '<div style="color:var(--text3);font-size:12px;text-align:center;padding:14px">Vide</div>'
          : exos.map((e, i) => `
              <div class="exo-row">
                <div style="flex:1;min-width:0">
                  <div class="name">${e[0]}</div>
                  <div class="meta">${e[1]}×${e[2]} • ${e[3]}s${e[4] ? ` • <a href="${e[4]}" target="_blank" rel="noopener" class="exo-link" onclick="event.stopPropagation()">🔗 Voir la séance</a>` : ''}</div>
                </div>
                <button class="del" onclick="delExo('${d}',${i})">×</button>
              </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function openExoModal() { document.getElementById('exo-modal').classList.add('show'); }
function closeExoModal() { document.getElementById('exo-modal').classList.remove('show'); }

function saveExo() {
  const day = document.getElementById('exo-day').value;
  const name = document.getElementById('exo-name').value.trim();
  if (!name) return alert('Nom requis');
  const sets = +document.getElementById('exo-sets').value || 4;
  const reps = +document.getElementById('exo-reps').value || 8;
  const rest = +document.getElementById('exo-rest').value || 90;
  const link = document.getElementById('exo-link').value.trim();
  state.planning[day].push([name, sets, reps, rest, link]);
  save();
  document.getElementById('exo-name').value = '';
  document.getElementById('exo-link').value = '';
  closeExoModal();
  renderPlanning();
}

function delExo(day, i) {
  state.planning[day].splice(i, 1);
  save();
  renderPlanning();
}
