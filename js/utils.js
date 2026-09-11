/* ─────────────────────────────────────────────────────────────────────────────
   Utilitaires partagés par tous les modules.
   ───────────────────────────────────────────────────────────────────────────── */

/** Échappe une valeur avant insertion dans du HTML (texte ou attribut entre guillemets). */
function esc(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** N'autorise que les liens http(s) absolus : bloque javascript:, data:, vbscript:… */
function safeUrl(url) {
  const raw = String(url || '').trim();
  return /^https?:\/\//i.test(raw) ? raw : '';
}

/** Limite la fréquence d'appel d'une fonction (redimensionnement, saisie…). */
function debounce(fn, ms) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}
