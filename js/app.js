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

/* Le redimensionnement redessine les graphiques, sans surcharger le navigateur.
   Chaque canvas est mis à l'échelle de l'écran (voir setupCanvas dans core.js). */
const redrawOnResize = debounce(() => {
  const active = document.querySelector('.page.active');
  if (!active) return;
  if (active.id === 'page-dashboard') { drawWeightDashChart(); drawChart(); }
  else if (active.id === 'page-progress') renderExerciseChart();
  else if (active.id === 'page-profile') drawWeightChart();
}, 150);
window.addEventListener('resize', redrawOnResize);

/* ── Fenêtres modales : clavier et lecteurs d'écran ───────────────────────────
   Échap ferme, la tabulation reste piégée dans la fenêtre ouverte, le focus est
   rendu à l'élément déclencheur à la fermeture. */
const MODAL_CLOSERS = {
  'goal-modal': () => closeGoalModal(),
  'exo-modal': () => closeExoModal(),
  'timer-modal': () => closeTimer()
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let _lastFocused = null;
let _openModalId = null;

function focusableIn(modal) {
  return [...modal.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null || el === document.activeElement);
}

function activeModal() {
  return document.querySelector('.modal.show');
}

/** Garde le focus à l'intérieur de la fenêtre modale ouverte. */
document.addEventListener('keydown', event => {
  const modal = activeModal();
  if (!modal) return;

  if (event.key === 'Escape') {
    const closer = MODAL_CLOSERS[modal.id];
    if (closer) closer();
    else modal.classList.remove('show');
    return;
  }

  if (event.key !== 'Tab') return;
  const items = focusableIn(modal);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];

  if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

/** Surveille l'ouverture/fermeture des modales pour gérer le focus. */
function watchModals() {
  const observer = new MutationObserver(mutations => {
    mutations.forEach(m => {
      const modal = m.target;
      const isOpen = modal.classList.contains('show');
      if (isOpen && _openModalId !== modal.id) {
        _openModalId = modal.id;
        _lastFocused = document.activeElement;
        const items = focusableIn(modal);
        if (items.length) setTimeout(() => items[0].focus(), 60);
      } else if (!isOpen && _openModalId === modal.id) {
        _openModalId = null;
        if (_lastFocused && typeof _lastFocused.focus === 'function') _lastFocused.focus();
        _lastFocused = null;
      }
    });
  });
  document.querySelectorAll('.modal').forEach(modal => {
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
  });
}
watchModals();

/* Sauvegarde de secours si l'onglet est fermé pendant une séance en cours. */
window.addEventListener('beforeunload', () => {
  if (typeof timer !== 'undefined' && timer.running) save();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
