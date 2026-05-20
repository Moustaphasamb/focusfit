function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function toggleTheme() {
  const isLight = document.documentElement.dataset.theme === 'light';
  const next = isLight ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('focusFit_theme', next);
  updateThemeBtn();
  if (document.getElementById('page-dashboard').classList.contains('active')) drawChart();
  renderExerciseChart();
}

function updateThemeBtn() {
  const btn = document.getElementById('theme-btn');
  if (!btn) return;
  const isLight = document.documentElement.dataset.theme === 'light';
  btn.innerHTML = isLight
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  btn.title = isLight ? 'Passer en mode sombre' : 'Passer en mode clair';
}

renderDashboard();
updateThemeBtn();

window.addEventListener('resize', () => {
  if (document.getElementById('page-dashboard').classList.contains('active')) drawChart();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
