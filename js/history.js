function renderHistory() {
  const list = document.getElementById('history-list');
  if (state.sessionHistory.length === 0) {
    list.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:28px">Aucune séance enregistrée.<br>Terminez une séance via le timer pour la voir ici.</div>';
    return;
  }
  list.innerHTML = [...state.sessionHistory].reverse().map(s => `
    <div class="history-entry">
      <div class="history-head">
        <div>
          <div class="history-date">${displayDate(s.date)} à ${esc(s.time)}</div>
          <div class="history-day-label">${esc(s.day)}</div>
        </div>
        <div class="history-stats">
          <div class="history-stat">
            <div class="history-stat-val">${formatTime(s.duration)}</div>
            <div class="history-stat-lbl">Durée</div>
          </div>
          <div class="history-stat">
            <div class="history-stat-val">${s.totalExos}</div>
            <div class="history-stat-lbl">Exercices</div>
          </div>
        </div>
      </div>
      <div class="history-exos">
        ${s.exercises.map(e => `<span class="history-exo-tag">${esc(e)}</span>`).join('')}
      </div>
      ${s.volume > 0 ? `
        <div class="history-volume">
          Volume soulevé : <strong>${formatVolume(s.volume)}</strong>${s.logged && s.logged.length ? ` • ${s.logged.length} série${s.logged.length > 1 ? 's' : ''} détaillée${s.logged.length > 1 ? 's' : ''}` : ''}
        </div>` : ''}
      ${s.logged && s.logged.length ? `
        <div class="history-sets">
          ${s.logged.map(l => `<span class="history-set-tag">${esc(l.name)} · ${l.w} kg × ${l.r}</span>`).join('')}
        </div>` : ''}
    </div>`).join('');
}

function clearHistory() {
  if (!confirm("Vider tout l'historique des séances ?")) return;
  state.sessionHistory = [];
  save();
  renderHistory();
}
