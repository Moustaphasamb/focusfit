# FocusFIT

Carnet d'entraînement **hors-ligne**, en HTML/CSS/JavaScript vanilla — aucun framework, aucune étape de build, aucune donnée envoyée sur un serveur. Tout est stocké dans le `localStorage` du navigateur.

Application installable (PWA) : elle fonctionne sans réseau après la première visite.

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Démarrage rapide](#démarrage-rapide)
- [Tests et qualité](#tests-et-qualité)
- [Organisation du code](#organisation-du-code)
- [Données : où elles vivent, comment les sauvegarder](#données--où-elles-vivent-comment-les-sauvegarder)
- [Déploiement](#déploiement)
- [Accessibilité](#accessibilité)
- [Conventions du projet](#conventions-du-projet)
- [Licence](#licence)

## Fonctionnalités

| Écran | Contenu |
|---|---|
| **Tableau de bord** | Salutation, anneau de progression du jour, résumé hebdomadaire réel (séances, minutes, volume), séries du jour à cocher, hydratation, calendrier d'activité sur 5 semaines, courbe de poids. |
| **Planning** | Programme semaine par semaine : exercices, séries, répétitions, temps de repos et lien de démonstration. |
| **Programmes** | Programmes prêts à charger (débutant, prise de masse, force, maison) et modèles personnalisés. |
| **Nutrition** | Journal des repas du jour, totaux et objectifs de macros, aliments fréquents. Les repas sont rattachés à une date : l'historique n'est plus écrasé chaque jour. |
| **Progression** | Records par exercice (1RM estimé, formule d'Epley), historique des charges, courbe de progression par exercice. |
| **Objectifs** | Objectifs de séances, de durée, de force (suivi automatique du 1RM) ou personnalisés, avec échéance. |
| **Séance (timer)** | Minuteur de séance phase par phase (préparation / travail / repos), prefill du dernier poids, saisie de chaque série validée (poids × répétitions), détection automatique des records et calcul du volume. |
| **Historique** | Séances passées : date, durée, exercices, séries détaillées et volume soulevé. |

Autres fonctions : thème clair/sombre, export/import JSON des données, service worker (mode avion), notifications et signal sonore de fin de repos, raccourci clavier `Échap` pour fermer les fenêtres.

## Démarrage rapide

Aucune installation n'est nécessaire pour utiliser l'application :

```bash
git clone https://github.com/Moustaphasamb/focusfit.git
cd focusfit
python3 -m http.server 8080      # ou : npm run serve
# puis http://localhost:8080
```

> Un simple double-clic sur `index.html` ne suffit pas : le service worker exige `http://` ou `https://`.

**Installation comme application :** ouvrir l'adresse dans Chrome, Edge ou Safari, puis « Installer l'application » / « Ajouter à l'écran d'accueil ».

## Tests et qualité

```bash
npm install        # jsdom + ESLint (dépendances de développement uniquement)
npm test           # 65 tests : noyau métier + application réelle dans un DOM jsdom
npm run test:core  # noyau métier seul (aucune dépendance : fonctionne avec Node seul)
npm run lint       # ESLint
```

- `tests/core.test.js` — logique pure : dates locales, calculs (1RM, calories, volume), objectifs, profil, échappement HTML, migration et validation de l'état.
- `tests/dom.test.js` — l'application réelle (`index.html` + tous les scripts) exécutée dans jsdom : démarrage, rendu des 8 écrans, séances, objectifs, timer et saisie des séries, accessibilité, canvas HiDPI, export/import.

Les tests du DOM ont besoin de `jsdom` ; sans lui, ils sont ignorés et `npm run test:core` continue de fonctionner.

## Organisation du code

```
index.html          structure des 8 écrans + fenêtres modales
manifest.json       métadonnées PWA (start_url relative : fonctionne en sous-dossier)
sw.js               service worker : cache hors-ligne (CACHE_NAME à changer à chaque version)
css/
  variables.css     thèmes clair/sombre (couleurs, espacements)
  base.css          remise à zéro, typographie, accessibilité
  components.css    cartes, boutons, formulaires, modalités
  app.css           mise en page (barre latérale, tableaux de bord, graphiques)
js/
  core.js           noyau métier pur (aucun DOM, aucun localStorage) — testable sous Node
  state.js          lecture/écriture du localStorage, migration, sélecteurs, sauvegarde
  data.js           export, import et effacement des données
  nav.js            navigation entre écrans, thème, barre latérale
  dashboard.js  planning.js  programs.js  nutrition.js  progress.js  goals.js  timer.js  history.js  profile.js
  app.js            démarrage, recherche, redimensionnement, modales
tests/              tests automatisés (node:test)
```

`js/core.js` est écrit en UMD : chargé comme script classique dans le navigateur, importable via `require()` sous Node. C'est ce qui permet de tester la logique sans navigateur ni outil de build.

## Données : où elles vivent, comment les sauvegarder

- Clé `localStorage` : **`focusFit_v3`**. En cas de contenu corrompu, la sauvegarde fautive est mise de côté dans `focusFit_v3_corrupted` et l'application repart d'un état propre plutôt que de refuser de démarrer.
- Version de schéma : **5**. `migrateState()` complète les états anciens (dates françaises converties en ISO, champs manquants ajoutés, entrées irrécupérables écartées) sans jamais lever d'exception.
- **Export / import** (écran *Profil* → *Sauvegarde des données*) : le fichier exporté est un JSON lisible et versionné (`app`, `schemaVersion`, `exportedAt`, `data`). Un fichier étranger est refusé sans toucher aux données existantes.
- Vider les données du navigateur **efface définitivement** l'historique : exportez régulièrement.

## Déploiement

Le projet est purement statique : tout hébergeur de fichiers convient (GitHub Pages, Netlify, Vercel, un simple serveur web…).

- `manifest.json` utilise `start_url: "./index.html"` et `scope: "./"` : l'application fonctionne aussi bien à la racine d'un domaine qu'en sous-dossier (`https://exemple.com/focusfit/`).
- Le service worker s'enregistre en chemin relatif ; servez le dossier en `https://` (ou `http://localhost`) pour qu'il soit actif.
- **À chaque publication :** incrémenter `CACHE_NAME` dans `sw.js` (actuellement `focusfit-v6`) et la version affichée dans le pied de page d'`index.html`, afin que les visiteurs reçoivent la nouvelle version.

## Accessibilité

- Tous les champs de formulaire ont une étiquette reliée (`<label for>`).
- L'écran actif est annoncé par `aria-current="page"` ; le titre du document suit la page.
- Les fenêtres modales sont des `role="dialog"` avec `aria-modal`, la tabulation reste piégée à l'intérieur et le focus revient sur le bouton déclencheur à la fermeture.
- Navigation entièrement au clavier, contour de focus visible (`:focus-visible`).
- Contraste du texte conforme AA (≥ 4,5:1) dans les deux thèmes, y compris les libellés secondaires.
- Messages d'état annoncés via `role="status"` / `aria-live`.

## Conventions du projet

- **Dates en ISO local** (`AAAA-MM-JJ`) via `localISO()` — jamais `toISOString()` qui bascule d'un jour à l'heure de Dakar.
- **Argent, poids, volumes** : stockés en nombres bruts, formatés à l'affichage (`formatVolume`, `formatTime`, `formatDuration`).
- **Échappement systématique** de toute donnée utilisateur injectée dans du HTML (`esc()`), liens filtrés (`safeUrl()` : `http(s)` uniquement).
- **Pas de données inventées** : un écran vide affiche un état vide, jamais des chiffres fictifs.
- Commentaires et interface en français.

## Licence

[MIT](LICENSE) © 2026 Moustapha Samb
