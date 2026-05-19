renderDashboard();

window.addEventListener('resize', () => {
  if (document.getElementById('page-dashboard').classList.contains('active')) drawChart();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
