/* ─────────────────────────────────────────────────────────────────────────────
   Sauvegarde des données : export, import et remise à zéro.

   Tout vit dans le localStorage du navigateur : vider les données du site (ou
   changer d'appareil) effacerait l'historique. L'export produit un fichier JSON
   lisible et versionné, l'import le valide puis remplace l'état courant.
   ───────────────────────────────────────────────────────────────────────────── */

const BACKUP_APP = 'FocusFIT';

/** Sérialise l'état complet avec ses métadonnées. */
function exportStateJSON() {
  return JSON.stringify({
    app: BACKUP_APP,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: state
  }, null, 2);
}

/** Déclenche le téléchargement d'une sauvegarde. */
function exportState() {
  const json = exportStateJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `focusfit-${todayISO()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showDataHint('✓ Sauvegarde téléchargée : gardez ce fichier en lieu sûr.', 'success');
}

/**
 * Importe une sauvegarde (contenu JSON). Ne touche à rien si le fichier est
 * invalide. Renvoie { ok, message }.
 */
function importStateJSON(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, message: 'Fichier illisible : ce n\'est pas du JSON valide.' };
  }

  // Accepte aussi un état brut (sans enveloppe) exporté par une ancienne version.
  const data = parsed && parsed.data ? parsed.data : parsed;
  if (!looksLikeBackup(data)) {
    return { ok: false, message: 'Ce fichier ne ressemble pas à une sauvegarde FocusFIT.' };
  }

  const previous = JSON.stringify(state);
  try {
    replaceState(data);
  } catch (e) {
    return { ok: false, message: 'Import impossible : ' + e.message };
  }

  refreshAllViews();
  const counts = `${state.sessionHistory.length} séance(s), ${state.lifts.length} charge(s), ${state.weightLog.length} pesée(s)`;
  return { ok: true, message: `✓ Sauvegarde importée : ${counts}.`, previous };
}

/** Lit le fichier choisi dans le champ d'import. */
function handleImportFile(input) {
  const file = input && input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const result = importStateJSON(String(reader.result));
    showDataHint(result.message, result.ok ? 'success' : 'error');
    input.value = '';                       // permet de réimporter le même fichier
  };
  reader.onerror = () => showDataHint('Lecture du fichier impossible.', 'error');
  reader.readAsText(file);
}

/** Efface toutes les données locales (après confirmation). */
function wipeAllData() {
  if (!confirm('Effacer toutes vos données FocusFIT (planning, séances, charges, repas, poids) ?\nCette action est définitive : pensez à exporter avant.')) return;
  replaceState(defaultState());
  refreshAllViews();
  showDataHint('Toutes les données ont été effacées.', 'success');
}

function showDataHint(message, kind) { return showHint('data-hint', message, kind); }

/** Met à jour les écrans après un import ou une remise à zéro. */
function refreshAllViews() {
  rolloverDailyState();
  renderDashboard();
  showPage('profile');
}

/* ── Bloc d'interface (ajouté à la page Profil) ─────────────────────────────── */

function renderDataSection() {
  return `
    <div class="card" style="margin-top:22px">
      <div class="card-head">
        <div class="card-title">Sauvegarde des données</div>
      </div>
      <div style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:16px">
        Vos données restent dans ce navigateur, sur cet appareil. Exportez régulièrement un fichier
        de sauvegarde : vider les données du navigateur effacerait définitivement votre historique.
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn" onclick="exportState()">⬇ Exporter (JSON)</button>
        <button class="btn btn-secondary" onclick="document.getElementById('import-file').click()">⬆ Importer</button>
        <button class="btn btn-danger" onclick="wipeAllData()">Tout effacer</button>
      </div>
      <input type="file" id="import-file" accept="application/json,.json" class="visually-hidden"
             onchange="handleImportFile(this)" aria-label="Choisir un fichier de sauvegarde à importer">
      <div id="data-hint" class="form-hint" role="status" aria-live="polite"></div>
    </div>`;
}
