const PAGE_TITLES = {
  dashboard: 'Tableau de bord',
  planning: 'Planning',
  programs: 'Programmes',
  nutrition: 'Nutrition',
  progress: 'Progression',
  goals: 'Objectifs',
  history: 'Historique'
};

const PAGE_RENDERERS = {
  dashboard: () => renderDashboard(),
  planning: () => renderPlanning(),
  programs: () => renderPrograms(),
  nutrition: () => renderNutrition(),
  progress: () => renderProgress(),
  goals: () => renderGoals(),
  history: () => renderHistory()
};

function showPage(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('pageTitle').textContent = PAGE_TITLES[id] || id;
  if (window.innerWidth <= 768) toggleSidebar(true);
  PAGE_RENDERERS[id]?.();
}

function toggleSidebar(force) {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  if (force === true) {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    return;
  }
  sidebar.classList.toggle('open');
  overlay.classList.toggle('show');
}
