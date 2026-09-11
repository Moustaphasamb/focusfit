# FocusFIT — Analyse complète du projet

> Audit réalisé le 11/09/2026 sur le commit `536897c` (« feat: bouton réinitialiser la journée »),
> branche `arena/01a09113-focusfit`.
> Méthode : lecture intégrale du code + **exécution réelle de l'application dans un DOM instrumenté**
> (harnais jsdom, voir §15). Toutes les anomalies listées ci-dessous ont été
> **reproduites**, pas seulement déduites de la lecture.

---

## 1. Verdict en une page

**Ce que c'est :** une application web de coaching sportif (PWA) en **HTML/CSS/JavaScript vanilla**,
100 % côté navigateur, sans build, sans dépendance npm, sans backend. 8 écrans, un timer de séance,
un suivi de charges/1RM, un planning hebdomadaire, 6 programmes prêts à l'emploi, un suivi nutrition
et un suivi de poids.

**Ce qui est solide :**

- Stack minimale maîtrisée : aucun risque de dépendance, déploiement = copie de fichiers.
- Découpage par domaine clair (`state / nav / dashboard / planning / progress / goals / timer / …`).
- Design system cohérent (variables CSS centralisées, thème clair/sombre, responsive 3 paliers).
- Périmètre fonctionnel réellement large pour ~1 800 lignes de JS, code lisible, français soigné.

**Ce qui pose problème :** l'app *affiche* beaucoup d'indicateurs, mais **une partie ne mesure rien**
(graphique d'évolution figé, calories estimées au doigt mouillé, compteur « séances » qui compte des
jours planifiés), et **plusieurs chemins de données sont fragiles** : date de pesée décalable d'un
jour, repas/eau non rattachés au jour, état localStorage cassé = app morte, objectifs « Durée »
impossibles à faire progresser, service worker qui gèle les mises à jour.

**Priorité n°1 :** fiabiliser la donnée (dates, persistance, migration, service worker), car c'est
ce qui distingue un carnet d'entraînement d'un prototype. Tout le reste (fonctionnalités, UI) est
déjà là ou presque.

> **État au 11/09/2026 après les Sprints 1, 2 et 3 :** les 17 anomalies de l'audit sont traitées
> (16 corrigées, 1 partielle : il reste les repas non modifiables pour un jour passé). Le tableau de
> bord, la nutrition, les objectifs et l'historique ne s'appuient plus que sur des données réelles,
> et les charges se saisissent désormais pendant la séance. Le projet dispose à présent d'un noyau
> métier testable, d'une suite de **65 tests** exécutable par `npm test`, d'un lint, d'un export/import
> JSON des données et d'une documentation de déploiement. Détail : §11, §12 et §13.

| Indicateur | Valeur |
|---|---|
| Fichiers suivis | 21 (+ `ANALYSE.md` ajouté par cet audit) — 27 après les trois sprints |
| Lignes totales | **3 126** — dont `js/` 1 773 · `index.html` 592 · `css/` 694 (+ manifest/sw) |
| Fonctions JS globales | 83 · 0 module ES · 31 usages de `innerHTML` |
| Dépendances runtime | 1 externe (Google Fonts) · 0 npm — toujours 0 en production (2 dépendances de développement : jsdom, ESLint) |
| Tests / CI / lint | **aucun** → **65 tests** (`npm test`) + ESLint (`npm run lint`) |
| Historique git | 1 seul commit sur `main` — 4 commits sur la branche de travail |
| Anomalies confirmées | **17** — dont **16 corrigées** et 1 partiellement traitée (voir §11, §12 et §13) |

---

## 2. Cartographie

```
focusfit/
├── index.html         592 l.  SPA : 8 pages, 3 modales (objectif, exercice, timer) + chargement des scripts
├── manifest.json       14 l.  PWA (icônes 192/512 → manquantes)
├── sw.js               43 l.  Service worker : précache + cache-first
├── css/
│   ├── variables.css   31 l.  Tokens (couleurs, rayons) + thème clair
│   ├── base.css        26 l.  Reset, typo, scrollbars
│   ├── layout.css      71 l.  App/sidebar/topbar/grilles + media queries
│   ├── components.css 368 l.  Boutons, cartes, modales, timer, calendrier…
│   └── pages.css      194 l.  Écrans profil / objectifs / poids…
└── js/
    ├── state.js        43 l.  État global + persistance localStorage (clé `focusFit_v3`)
    ├── nav.js          43 l.  Routeur d'onglets + sidebar
    ├── dashboard.js   258 l.  Stats, eau, calendrier d'activité, 2 graphiques canvas
    ├── planning.js     54 l.  Planning hebdo (CRUD exercices)
    ├── programs.js    108 l.  6 programmes prédéfinis + chargement
    ├── nutrition.js    75 l.  Repas + macros
    ├── progress.js    159 l.  1RM (Epley), PR, graphique par exercice
    ├── goals.js       261 l.  4 types d'objectifs, progression, échéances
    ├── timer.js       261 l.  Timer de séance (préparation / exécution / repos, beeps, notifications)
    ├── profile.js     441 l.  Profil, IMC/BMR/TDEE/Lorentz, journal de poids
    ├── history.js      36 l.  Historique des séances
    └── app.js          34 l.  Thème, init, enregistrement du service worker
```

**Absent du dépôt :** `README.md`, `LICENSE`, `package.json`, tests, CI, `assets/` (icônes).

**Déploiement :** statique pur (`.gitignore` mentionne `.vercel` → hébergement Vercel prévu).
`sw.js` est enregistré avec un chemin relatif (`'sw.js'`) donc compatible sous-dossier, mais
`manifest.json` utilise `"start_url": "/"` → cassé si l'app n'est pas servie à la racine du domaine.

---

## 3. Architecture et fonctionnement

### 3.1 Chaîne d'exécution

```
index.html
  └─ 12 <script> classiques, dans l'ordre : state → profile → nav → dashboard → planning
     → programs → nutrition → progress → goals → timer → history → app
       • aucun module ES, aucun bundler : 83 fonctions globales + 14 constantes (dont `state`)
         + 3 `let`/`var` (`timer`, `timerVals`, `_editGoalId`), tous partagés via la portée globale
       • app.js démarre réellement l'app en appelant renderDashboard() (ligne 25)
```

Conséquences : l'ordre de chargement est un contrat implicite (une fonction appelée trop tôt
casse silencieusement), il n'y a **aucune isolation** (toute variable globale peut être écrasée),
et `history.js` dépend d'une fonction définie dans `timer.js`. C'est acceptable à cette taille,
mais c'est le premier plafond de maintenabilité.

### 3.2 État et persistance

- Un unique objet `state` sérialisé en **localStorage** sous la clé `focusFit_v3`, réécrit en
  entier à chaque modification (`save()`), sans aucune gestion d'erreur.
- Pas de date de dernière écriture, pas d'export/import, pas de synchronisation, pas de quota géré.
  Un nettoyage du navigateur = **perte définitive de tout l'historique d'entraînement**.
- Les migrations sont ad hoc : deux `if (!state.x)` dans `state.js` (profil, journal de poids)
  et une IIFE dans `goals.js` (objectifs chaîne → objet). Les autres champs ne sont pas rattrapés
  → voir anomalie **A3**.

### 3.3 Rendu

Tout le rendu se fait par **`innerHTML` (31 occurrences)** à partir de chaînes de templates.
Rapide à écrire, mais : (1) aucune échappement des données utilisateur (§7), (2) les états purement
visuels sont perdus à chaque re-rendu (voir A9), (3) impossible de mettre à jour finement une liste
(on redessine tout l'écran).

### 3.4 PWA

`sw.js` précache 18 ressources et sert `caches.match(request) || fetch(request)`. Pas de
stratégie par type de ressource, pas de revalidation, pas de `navigation preload`. Le cache n'est
invalidé que si **le contenu de `sw.js` change** → voir anomalie **A6**. Les polices Google Fonts,
elles, ne sont pas mises en cache : hors-ligne, l'app s'affiche avec les polices système.

---

## 4. Modèle de données

```js
state = {
  schemaVersion: 5,
  planning: { Lundi: [ [nom, séries, reps, repos, lien], … ], … 7 jours },  // tableaux positionnels
  meals:    [ { date: 'AAAA-MM-JJ', name, cal, prot, carbs, fat } ],   // datés : totaux du jour
  lifts:    [ { name, w, r, date: 'AAAA-MM-JJ', isPR } ],
  goals:    [ { id, title, type, exercise, current, target, unit, deadline, achieved, createdAt } ],
  water:    0, waterDate: 'AAAA-MM-JJ',                 // remise à zéro quotidienne
  doneExos: { 'AAAA-MM-JJ': [noms cochés] },            // séance du jour, persistée
  sessions: 0, streak: 0, lastSessionDate: 'AAAA-MM-JJ',
  sessionHistory: [ { date, time, duration, day, exercises[], totalExos, logged[], volume } ],
  calGoal: 2400, protGoal: 150, carbGoal: 300, fatGoal: 80, macroTargetsCustom: false,
  profile: { name, age, gender, weight, height, activity, sportGoal, level },
  weightLog: [ { date: 'AAAA-MM-JJ', weight, ts } ]
}
```

État **schéma v5** (après les Sprints 1 et 2) — les remarques ⚠ de l'audit initial sont toutes
traitées, et `weeklyVolume` (8 valeurs inventées) comme les dates `jj/mm/aaaa` ont été **supprimés
par la migration** : les anciennes sauvegardes sont converties au chargement, sans perte de données.

Points faibles structurels :

1. ~~**Dates stockées en chaîne localisée** `jj/mm/aaaa`~~ — **corrigé** : tout est en ISO
   `AAAA-MM-JJ`, avec `localISO()/parseISO()/displayDate()` comme seuls points de conversion (§11).
2. **Tableaux positionnels** pour les exercices (`e[0]`, `e[3]`) : illisible ; c'est le dernier point
   de modèle de données à moderniser (objet `{name, sets, reps, rest, link}`), à faire avec une
   migration dédiée.
3. ~~**Champs sans référence temporelle** (`meals`, `water`)~~ — **corrigé** : repas datés, eau
   rattachée à `waterDate` et remise à zéro chaque jour (§12).
4. **Deux référentiels de séances** : `state.sessions` (compteur global) et `state.sessionHistory`
   (journal) — les indicateurs s'appuient désormais sur le journal, filtré par semaine ou depuis la
   création de l'objectif (§12).

---

## 5. Fonctionnalités, écran par écran

| Écran | Ce qui fonctionne | Ce qui manque / ne mesure rien |
|---|---|---|
| **Tableau de bord** | Salutation contextuelle, eau (8 verres), séance du jour, historique 5 sem., poids | Graphique 8 semaines **fictif** (A5), « calories brûlées » = nb d'exercices × 45, « séances semaine » = jours planifiés, calendrier désaligné (A8), cases cochées non persistées (A9) |
| **Planning** | Ajout/suppression d'exercices par jour, séries/reps/repos, lien vidéo, lancement du timer | Planning figé sur la semaine-type (pas de dates réelles, pas de duplication d'une semaine, pas d'édition d'un exercice existant) |
| **Programmes** | 6 programmes (PPL, 5×5, HIIT, Upper/Lower, Full Body, Arnold), chargement avec confirmation | Mauvais menu mis en surbrillance après chargement (A10) ; écrase le planning sans possibilité d'annuler ni de fusionner |
| **Nutrition** | Saisie libre d'un repas (kcal/P/G/L), barres de progression macro | Repas **non datés** (A7), objectifs macro non modifiables dans l'UI et **non reliés au TDEE calculé dans le profil** (A7) |
| **Progression** | Journal des charges, 1RM Epley, badge PR, graphique par exercice, top 1RM | Validation trop permissive (A11) ; les séries/reps réelles ne remontent pas du timer, tout est saisi à la main |
| **Objectifs** | 4 types (Force / Séances / Durée / Personnalisé), échéances, progression, tri, édition | Type **Durée inopérant** (A4) ; objectifs sans lien avec les séances réellement terminées |
| **Historique** | Liste des séances terminées (durée, exercices) | Pas de détail par exercice (séries/reps/charges), pas d'agrégation par semaine |
| **Profil** | IMC, BMR (Mifflin/St-Jeor), TDEE, poids idéal (Lorentz), journal de poids + graphique, thème | Décalage de date (A2) ; pas d'objectif calorique piloté par le TDEE ; impossible d'exporter/importer ses données |
| **Timer de séance** | 3 phases (préparation 10 s, exécution libre, repos paramétrable), presets de repos, bip, notification, bilan | Repos sur `setInterval` → dérive si l'onglet est en arrière-plan (A1) ; pas de séries/reps/charges saisies à la fin d'une série ; pas de réveil d'écran (Wake Lock) |

---

## 6. Anomalies confirmées (17), classées par impact

### Bloquantes / majeures sur la donnée

**A1 — Le timer cumule le temps en comptant des ticks (dérive en arrière-plan)** — `js/timer.js:126-146`, `209`
`tick()` incrémente un compteur ; la durée finale est calculée avec `Date.now()`. Les deux sources
divergent dès que le navigateur ralentit les minuteries (onglet inactif, mobile, écran verrouillé),
c'est-à-dire **exactement pendant une séance de sport**. Reproduit : compteur affiché `02:10`,
durée enregistrée `0 s` sur la même séance simulée.
→ *Correctif :* calculer chaque phase sur `Date.now()` (deadline), ne se servir du `setInterval`
que pour redessiner (250 ms), et persister `sessionStart` pour survivre à un rechargement.

**A2 — La date de pesée peut être enregistrée avec un jour d'écart** — `js/profile.js:317-318`, `326`
`new Date("2026-09-11")` est interprété en **UTC**, puis relu en heure locale. Test avec
`TZ=America/New_York` : saisie `2026-09-11` → enregistré `"10/09/2026"`.
→ *Correctif :* construire la date en local (`new Date(y, m-1, d)`) et stocker de l'ISO.

**A3 — Un état localStorage ancien ou corrompu casse l'application** — `js/state.js:3`, `js/dashboard.js:88`, `js/goals.js:4`
- JSON invalide → `JSON.parse` lève et **tous les scripts suivants échouent** (écran vide).
- État d'une version antérieure sans `sessionHistory`/`goals` → `TypeError: Cannot read properties
  of undefined (reading 'map')`. Reproduit dans les deux cas.
→ *Correctif :* `try/catch` autour du parse + fonction `migrate(state)` qui complète **tous** les
champs manquants avec les valeurs par défaut (testé par une suite de migrations).

**A4 — Les objectifs « Durée d'entraînement » ne peuvent jamais progresser** — `js/goals.js:32`, `197-204`
`getGoalCurrent()` lit `goal.current` pour ce type, mais le champ « Valeur actuelle » n'est affiché
que pour le type *Personnalisé*. Reproduit : objectif 600 min créé avec `current: 0` → bloqué à 0 %,
sans aucun moyen de saisie.
→ *Correctif :* afficher le champ pour `custom` **et** `duration`, ou mieux, alimenter ce type
depuis la somme des durées de `sessionHistory`.

**A5 — Plusieurs indicateurs du tableau de bord sont décoratifs** — `js/state.js:13`, `js/dashboard.js:26-29`, `207`
- `state.weeklyVolume` est un tableau **codé en dur** ; aucun PR enregistré ne le modifie (vérifié :
  ajouter un PR de 250 kg ne change pas le graphique « Évolution des charges »).
- « Calories brûlées » = `nombre d'exercices planifiés × 45` — pas une mesure.
- « Séances semaine » = nombre de jours du planning contenant au moins un exercice, pas des séances
  réalisées (alors que `state.sessions` et `sessionHistory` existent).
→ *Correctif :* dériver ces trois KPI des données réelles (`lifts` par semaine pour le volume,
`sessionHistory` filtré sur 7 jours pour les séances), ou les renommer explicitement (« prévu »).

**A6 — Le service worker en cache-first pur gèle les mises à jour** — `sw.js:36-40`
Le `fetch` sert le cache sans jamais revalider. Toute modification de `index.html`, du CSS ou du JS
reste invisible pour un utilisateur déjà installé **tant que l'on ne pense pas à incrémenter
`CACHE_NAME` à la main** (déjà incohérent : `focusfit-v5` pour une app « v3 »).
→ *Correctif :* précache versionné par hash/nom + stratégie *stale-while-revalidate* pour les
assets et *network-first* pour le HTML.

**A7 — Nutrition non rattachée au jour, coupée du profil** — `js/nutrition.js:47-62`, `js/state.js:8`
Les repas n'ont **aucun champ date** et l'eau est un entier sans référence temporelle : les
« calories du jour » cumulent en réalité tout l'historique (reproduit : 3 repas de 3 jours → 1 500 kcal
affichés), et l'eau ne se remet jamais à zéro toute seule. Par ailleurs `calcTDEE()` (profil) n'est
jamais utilisée pour définir les objectifs macro, qui sont figés et non éditables.
→ *Correctif :* `meals: [{ date, … }]` + notion de « jour courant » (et reset auto de l'eau à minuit),
bouton « recalculer mes objectifs depuis mon TDEE ».

### Modérées (UI, exactitude, robustesse)

**A8 — Le calendrier d'activité est désaligné avec son en-tête** — `js/dashboard.js:84-99`, `index.html:208`
35 cellules générées du plus ancien au plus récent : « aujourd'hui » est donc **toujours** la
7ᵉ colonne, sous l'étiquette « D » (dimanche), quel que soit le jour réel (reproduit un vendredi).
La grille ne commence pas un lundi.
→ *Correctif :* aligner le premier jour sur le lundi de la semaine -4 et calculer le décalage initial.

**A9 — Les cases cochées de la « séance du jour » ne sont pas persistées** — `js/dashboard.js:11-24`
L'état `done` vit uniquement dans le DOM : il disparaît à chaque retour sur le tableau de bord
(le rendu réécrit tout le `innerHTML`) et n'est pas sauvegardé.
→ *Correctif :* `state.planning[day][i].done` + clé de date du jour.

**A10 — `loadProgram()` navigue vers la mauvaise entrée de menu** — `js/programs.js:107`
`document.querySelectorAll('.nav-item')[1]` pointe « Tableau de bord » alors que la page affichée est
« Planning » (index 2). Reproduit : page `page-planning`, titre « Planning », item surligné
« Tableau de bord ».
→ *Correctif :* passer l'élément par `data-page` ou chercher `[onclick*="'planning'"]`.

**A11 — Validation trop permissive de la saisie de charge** — `js/progress.js:147-148`
`+value || 0` : un poids vide est accepté et crée une entrée à **0 kg** dans l'historique et le 1RM
(reproduit). Les bornes `min="0"` des `<input>` ne servent à rien sans `<form>`.
→ *Correctif :* rejeter `w <= 0` et `r <= 0`, borner à des plages plausibles (0-500 kg / 1-100 reps).

**A12 — Injection HTML via toutes les données utilisateur** — `js/planning.js:22`, `js/nutrition.js:20`, `js/goals.js:132`, `js/progress.js:60`, `js/profile.js:96`
Noms d'exercices, de repas, titres d'objectifs et nom de profil sont insérés en HTML brut.
Reproduit : `<img src=x onerror=…>` saisi comme nom d'exercice est **effectivement rendu**, et un
« lien » `javascript:…` est copié tel quel dans un `href` cliquable.
Risque réel : *self-XSS* aujourd'hui (les données viennent de l'utilisateur lui-même), mais devient
exploitable dès qu'on ajoute un partage/import de programme ou une synchronisation.
→ *Correctif :* fonction `esc()` + `rel="noopener"` (déjà présent) + liste blanche de protocoles
(`https:` uniquement) pour les liens.

**A13 — Icônes PWA absentes** — `manifest.json:11-12`, `index.html:10`, `js/timer.js:39`
`assets/icon-192.png` et `assets/icon-512.png` sont référencés (manifest, apple-touch-icon,
notifications) mais le dossier `assets/` n'existe pas : vérifié en production locale → **HTTP 404**.
L'installation PWA se fait donc sans icône, et les notifications non plus.
→ *Correctif :* ajouter les deux PNG (ou un SVG maskable) et les déclarer dans le précache du SW.

### Mineures (qualité, finition, accessibilité)

**A14 — Contrastes insuffisants sur le texte tertiaire (WCAG AA)** — `css/variables.css:13`
Mesures : `--text3` sur `--bg` = **3,73:1**, sur `--s1` = **3,54:1**, sur `--s2` = **3,26:1**, alors
que ce token est utilisé pour des libellés courants et des unités (12-13 px). Le seuil AA est 4,5:1.
Les autres tokens sont bons (`--text` 16,7:1, `--text2` 8,8:1, `--acc` 12,8:1).
→ *Correctif :* éclaircir `--text3` vers `#8298ab` (5,7:1 à 6,6:1 sur les trois fonds sombres,
5,4:1 en thème clair) — `#7b8fa3` suffirait tout juste.

**A15 — Navigation et formulaires non accessibles au clavier** — `index.html:32-64`, labels
Les 8 entrées de menu sont des `<div onclick>` (non focalisables, pas de `role`), il n'y a **qu'un
seul attribut ARIA** dans tout le document (`aria-hidden` sur le décor du bandeau, donc rien de
sémantique), et **aucun des 21 `<label>` n'est relié à son champ** (`for=`) : les lecteurs d'écran
n'annoncent pas les champs. Les modales n'ont ni piège de focus ni
fermeture par `Échap`.
→ *Correctif :* `<button>`/`<nav>` + `aria-current`, `for`/`id` sur les labels, `role="dialog"`
`aria-modal`, gestion d'`Escape`.

**A16 — Graphiques flous sur écrans HiDPI** — `js/dashboard.js:148`, `203`, `js/profile.js:359`, `js/progress.js:89`
`canvas.width = clientWidth - 36` sans mise à l'échelle `devicePixelRatio` → rendu interpolé sur
mobile/Retina. Trois implémentations quasi identiques (~200 lignes cumulées) qui gagneraient à
partager un helper unique `drawLineChart(canvas, data, opts)`.

**A17 — Divers finition / dette**
- `alert()` bloquant en fin de séance (`js/timer.js:224`), `confirm()` pour les suppressions : à
  remplacer par les toasts déjà présents pour le profil (`showSavedToast`).
- `.profile-form` utilisée (`js/profile.js:122`) mais **aucune règle CSS** ne la définit.
- Trois numérotations de version concurrentes : `focusFit_v3` / `focusfit-v5` / pied de page « v3.0 ».
- Duplication : le rendu de la séance du jour est copié à l'identique dans `renderDashboard()`
  (`js/dashboard.js:11-24`) et `resetDay()` (`js/dashboard.js:54-75`).
- Objectifs nutrition stockés dans `state` mais cibles **recopiées en dur** dans `index.html:250`
  → risque de divergence silencieuse.
- Aucun test, aucun lint : 1 773 lignes de JS sans filet de sécurité.
- Pas d'`README` (installation, choix produit) ni de licence.

---

## 7. Sécurité et vie privée

| Sujet | Constat |
|---|---|
| Surface d'attaque | Très faible : aucun backend, aucun appel réseau hors Google Fonts, aucune donnée envoyée |
| Injection HTML | **Réelle** (A12) : `innerHTML` sans échappement + `href` non filtré. Impact limité aujourd'hui (données locales), à traiter avant toute fonctionnalité de partage/import |
| Stockage | Tout en clair dans `localStorage` (PII : prénom, âge, poids, taille). Pas de chiffrement, pas de durée de vie — acceptable pour un usage strictement local, à documenter |
| Dépendances | Aucune bibliothèque tierce → pas de risque de chaîne d'approvisionnement |
| CSP / en-têtes | Aucun en-tête de sécurité (normal pour du statique) ; une CSP `default-src 'self'` serait possible en supprimant les handlers `onclick` inline (40 occurrences) |
| Confidentialité | Aucun traceur, aucun analytics → bon point |

---

## 8. Performance

- Poids total ≈ **134 Ko** de sources non minifiées (244 Ko avec `.git`) : l'app est intrinsèquement
  très rapide.
- Points d'attention : la police Google Fonts est **bloquante** dans le `<head>` (et absente du
  précache SW, donc non disponible hors-ligne) ; `drawChart()` est rappelé à chaque `resize`
  **sans debounce** ; chaque interaction re-rend un écran complet via `innerHTML` (acceptable à
  cette échelle, mais c'est ce qui fait perdre l'état des cases à cocher, cf. A9).
- Les trois canvas redimensionnent leur `width` à chaque rendu, ce qui réinitialise le contexte :
  correct ici, mais à cadrer dès qu'un graphique animé sera ajouté.

---

## 9. Qualité de code et maintenabilité

**Points forts** : nommage cohérent en français, fonctions courtes et à responsabilité unique,
séparation claire des domaines, CSS organisé en couches (tokens → base → layout → composants →
pages), thème clair/sombre sans duplication.

**Plafonds identifiés** :

1. **Portée globale** : 83 fonctions + 17 déclarations de haut niveau, aucun module → toute
   collision de nom est un bug silencieux.
   Passage à des modules ES (`<script type="module">`) possible sans build, à coût faible.
2. **Rendu par chaînes** : 31 `innerHTML`, aucune fonction d'échappement, pas de composants réutilisables.
3. **Aucun test** : les fonctions pures (`calc1RM`, `calcBMR`, `calcTDEE`, `getGoalProgress`,
   `updateStreak`) sont pourtant trivialement testables — c'est là qu'un filet rapporte le plus.
4. **Migrations dispersées** dans 2 fichiers, sans version de schéma.
5. **Duplication** : séance du jour, 3 graphiques canvas, 2 blocs de rendu du poids (dashboard/profil).
6. **Fichiers trop larges** : `profile.js` (441 l.) mélange calculs physiologiques, formulaire,
   journal de poids et graphique → à découper.

---

## 10. Plan d'action recommandé

### Sprint 1 — Fiabiliser la donnée ✅ *livré (§11)*

1. A2/A3 : dates ISO partout + `migrate()` défensive et `try/catch` sur le parse (avec test de
   non-régression sur un état ancien).
2. A1 : phases du timer calculées sur l'horloge, `setInterval` uniquement pour l'affichage.
3. A6 : service worker versionné + *stale-while-revalidate* (fin des « vieilles versions » chez les utilisateurs).
4. A13 : ajouter les deux icônes et les précacher.
5. A11 (sprint 1) / A4 (sprint 2) : valider les saisies, débloquer les objectifs « Durée ».
6. A10/A8 : index de menu de `loadProgram`, alignement du calendrier.

### Sprint 2 — Rendre les indicateurs honnêtes ✅ *livré (§12)*

7. A5 : remplacer `weeklyVolume`, « calories brûlées » et « séances semaine » par des calculs
   dérivés de `lifts` et `sessionHistory` (ou renommer en « prévu » si c'est l'intention produit).
8. A7 : repas datés + jour courant ; objectifs macro dérivés du TDEE du profil ; reset auto de l'eau.
9. A9 : persister les cases cochées de la séance du jour.
10. Nouveau : saisir séries/reps/charge à la fin d'une série dans le timer pour alimenter
    automatiquement `lifts` et l'historique (c'est le chaînon manquant entre les 3 écrans). ✅ *fait*

### Sprint 3 — Industrialiser ✅ *livré (§13)*

11. ✅ Extraire la logique pure (`calc1RM`, `calcBMR`, `calcTDEE`, progression, streak) en module
    testable + tests (node:test), et un `package.json` avec `npm test` + lint. Les harnais des
    Sprints 1 et 2 sont devenus une vraie suite versionnée (65 tests). *Choix retenu : `js/core.js`
    en UMD plutôt qu'en modules ES — les modules ES auraient imposé `type="module"` et un serveur,
    donc cassé l'ouverture directe du fichier et l'installation PWA telle qu'elle fonctionne
    aujourd'hui, sans rien apporter ici.*
12. ✅ A12/A14/A15 : `esc()` partout, protocoles filtrés, contraste et navigation clavier.
13. ✅ Export/import JSON des données (le filet de sécurité indispensable d'un carnet de sport en local).
14. ✅ `README.md` + licence + déploiement documenté (et `start_url` relatif pour vivre sous un sous-dossier).

---

## 11. Corrections apportées — Sprint 1

> Livré sur la branche `arena/01a09113-focusfit`. Toutes les corrections sont couvertes par un
> harnais de vérification : **26/26 contrôles passent** (états dégradés, fuseaux horaires, horloge
> simulée, échappement, liens, migration, cohérence des versions).

| # | Anomalie | Statut | Ce qui a changé |
|---|---|---|---|
| A3 | État corrompu ou ancien = app morte | **Corrigé** | `migrateState()` complète tout champ manquant et ne lève jamais d'exception ; `JSON.parse` protégé ; une sauvegarde illisible est mise de côté sous `focusFit_v3_corrupted` au lieu d'être perdue ; `save()` gère le quota |
| A2 | Pesée datée de la veille | **Corrigé** | Formule unique `localISO()` (jamais UTC) ; date stockée en ISO, plus aucun `new Date('AAAA-MM-JJ')` |
| A1 | Timer qui dérive en arrière-plan | **Corrigé** | Chaque phase porte une échéance (`phaseEndsAt`) ; l'affichage se rafraîchit toutes les 250 ms mais le temps est toujours recalculé depuis l'horloge ; les pauses décalent les échéances (non comptées) ; le temps total et la durée enregistrée proviennent de la même source |
| A6 | Service worker qui gèle les mises à jour | **Corrigé** | Navigations en *network-first* (repli cache hors-ligne), ressources en *stale-while-revalidate*, `CACHE_NAME` = `focusfit-v4`, icônes précachées |
| A13 | Icônes PWA absentes (404) | **Corrigé** | `assets/icon-192.png` et `icon-512.png` générées (éclair cyan `#00e5ff` sur fond sombre), précachées et référencées comme favicon |
| A8 | Calendrier d'activité désaligné | **Corrigé** | La grille couvre 5 semaines complètes (lundi → dimanche) alignées sur l'en-tête, « aujourd'hui » tombe sur la bonne colonne, les jours à venir sont estompés et le survol indique le nombre de séances |
| A10 | Menu erroné après `loadProgram()` | **Corrigé** | Les entrées de menu portent `data-page`, la navigation cible la bonne |
| A11 | Charges à 0 kg acceptées | **Corrigé** | Bornes 1-500 kg et 1-100 reps, message d'erreur sous le formulaire, message de confirmation (et de record) en cas de succès — plus d'`alert()` |
| A12 | Injection HTML / `javascript:` | **Corrigé** | `esc()` appliqué à toutes les données utilisateur (planning, repas, objectifs, charges, profil, historique) ; `safeUrl()` n'accepte que `http(s)` |
| A7 | Nutrition déconnectée du profil | **Corrigé** (Sprint 2) | Objectifs macro éditables et recalculés depuis le TDEE du profil (`macroTargetsCustom` protège un réglage manuel) ; repas datés et totaux limités au jour courant ; eau remise à zéro au changement de jour |
| A17 | Dette / incohérences mineures | **Partiel** | Versions harmonisées (app, schéma et cache suivent le même numéro ; clé de stockage documentée comme gelée), `.cal-cell.future`/`.form-hint`/liens du planning stylés, duplication de la « séance du jour » supprimée (`renderTodayList()` unique). **Reste :** `alert()` de fin de séance, `.profile-form` sans CSS |
| — | Robustesse diverse | **Ajouté** | `js/utils.js` (`esc`, `safeUrl`, `debounce`), fermeture des modales par `Échap`, redimensionnement des graphiques *debounced*, titre et description de page explicites, un poids saisi dans le profil alimente désormais le journal de poids du jour |

**Contrôles clés du harnais** (extraits) :

```
✓ État corrompu      → l'app démarre, sauvegarde conservée, schéma v4
✓ État v3 ancien     → dates FR converties en ISO, champs manquants complétés, historique intact
✓ Pesée (TZ New_York)→ saisie 2026-09-11 → stocké 2026-09-11 (aucun décalage)
✓ Calendrier         → aujourd'hui (ven) en colonne 5 = « V » ; 2 jours à venir estompés
✓ Timer              → repos de 90 s : après un seul tick +45 s, il reste 45 s (suit l'horloge)
✓ Timer (pause)      → 60 s de pause non comptées (5 s → 5 s → 10 s)
✓ Séance complète    → durée réelle 40 s enregistrée, date ISO, streak = 1
✓ Injection HTML     → <img onerror=…> affiché comme texte, jamais exécuté
✓ Liens              → javascript: refusé, https conservé
✓ Nutrition          → TDEE 2873 kcal → objectifs recalculés ; un objectif manuel n'est plus écrasé
✓ Ressources         → 21 références dans index.html, 22 fichiers précachés : aucun 404
```

**Suite :** A4, A5, A7 et A9 ont été traités au Sprint 2 (§12), puis A14 (contraste `--text3`),
A15 (accessibilité clavier/labels), A16 (netteté des graphiques HiDPI) et les chantiers
d'industrialisation du §10 au Sprint 3 (§13).

---

## 12. Corrections apportées — Sprint 2

> Objectif : **ne plus afficher que des informations mesurées**, et relier enfin les trois écrans
> qui vivaient en silo (timer → charges → historique). 31 contrôles automatisés passent, dont
> 6 de non-régression sur le Sprint 1.

**A5 — Le tableau de bord ne raconte plus de chiffres inventés**
- `state.weeklyVolume` (8 valeurs codées en dur) est **supprimé** de l'état et purgé des sauvegardes
  existantes. Le graphique devient « **Volume soulevé (8 sem.)** », calculé en kg (poids × reps) à
  partir des charges réellement enregistrées, avec un état vide explicite au lieu de valeurs fictives.
- « **Séances terminées** » compte les séances de la semaine en cours (lundi → dimanche) d'après
  `sessionHistory`, avec le temps d'entraînement cumulé (« objectif : 4/sem • 2 h »).
- « **Calories brûlées** » applique une formule explicite et documentée :
  `MET 6 × 3,5 × poids / 200 × minutes`, sur les séances réellement terminées (au lieu de
  « nombre d'exercices planifiés × 45 »).

**A9 — Les cases cochées de la séance du jour sont conservées**
`state.doneExos['AAAA-MM-JJ']` mémorise les exercices faits ; le compteur « 1/2 faits » s'affiche
dans l'en-tête de la carte, le bouton Reset de la journée remet tout à zéro (cases + eau), et
l'état survit à un rechargement — vérifié sur un re-rendu complet.

**A7 — Nutrition rattachée au jour**
Chaque repas porte une date (ISO). Seuls les repas du jour alimentent les totaux et les barres de
macro ; les repas des jours précédents sont conservés et signalés (« 1 repas enregistré sur les
jours précédents — exclus des totaux »). « Vider le jour » ne supprime que le jour courant.
L'eau bue est rattachée à `waterDate` et **repart de zéro automatiquement** à chaque nouvelle
journée, y compris si l'application reste ouverte plusieurs jours.

**A4 — Les objectifs mesurent enfin quelque chose**
- Type **« Nombre de séances »** : compte les séances terminées **depuis la création de l'objectif**.
- Type **« Durée d'entraînement »** : cumule les minutes réellement passées à s'entraîner depuis la
  création (testé : 45 min + 30 min → 13 % sur un objectif de 600 min, au lieu d'un blocage à 0 %).
- Type **« Personnalisé »** : reste manuel, avec saisie de la valeur actuelle.
- La fenêtre de création rappelle la source de progression de chaque type.

**Nouveau — Saisie des séries pendant la séance (le chaînon manquant)**
À la fin de chaque série, le timer ouvre un panneau de saisie : **poids pré-rempli avec la dernière
charge connue** de l'exercice, répétitions pré-remplies depuis le planning. « Valider la série »
enregistre la charge dans la progression (avec détection de record, notification et son),
comptabilise le volume, puis enchaîne sur le repos ; « Passer » continue sans rien noter.
Les séances terminées conservent le détail (`logged`) et le volume, affichés dans l'historique
(« Volume soulevé : 550 kg • 1 série détaillée »). Le double clic sur « Valider » n'enregistre
qu'une fois, et arrêter la séance interrompt proprement l'enchaînement.

**Contrôles clés** (extraits) :

```
✓ Séances semaine     → 2 séances réelles (3 dans l'historique dont 1 hors semaine)
✓ Calories            → 90 min × 80 kg → 756 kcal (formule MET documentée)
✓ Volume soulevé      → semaine en cours 1 000 kg, précédente 600 kg, badge « 1,6 t »
✓ Sans données        → message d'aide affiché, aucun chiffre inventé
✓ Cases cochées       → conservées après re-rendu, compteur « 1/2 faits », Reset OK
✓ Repas datés         → 900 kcal d'avant-hier exclus, 650 kcal affichés aujourd'hui
✓ Eau                 → 6 verres hier → 0 aujourd'hui ; conservés dans la même journée
✓ Objectif durée      → 45 min + 30 min = 75/600 → 13 % (auparavant 0 % figé)
✓ Objectif séances    → séance d'il y a 40 j ignorée, séance du jour comptée
✓ Série validée       → {"name":"Squat","w":110,"r":8,"date":"…","isPR":true} + reps pré-remplies
✓ Saisie invalide     → refusée, message affiché, séance non interrompue
✓ Double clic         → une seule charge enregistrée
✓ Séance terminée     → volume 1 680 kg et 2 séries détaillées dans l'historique
✓ Migration v4 → v5   → repas datés, weeklyVolume purgé, waterDate/doneExos initialisés
```

---

## 13. Corrections apportées — Sprint 3

> Livré sur la branche `arena/01a09113-focusfit`. Toutes les corrections sont couvertes par la suite
> de tests versionnée : **65/65 passent** (`npm test`) et `npm run lint` ne signale rien.

**Noyau métier testable.** La logique pure est sortie des fichiers d'interface dans `js/core.js`
(UMD : global dans le navigateur, `require()` sous Node). Il contient les constantes, les dates ISO
locales, les formats, les calculs (1RM, calories, volume hebdomadaire), les sélecteurs de séances et
d'objectifs, le calcul du profil (IMC, BMR, TDEE, macros), `esc`/`safeUrl`/`debounce`, `setupCanvas`
et la fabrique d'état (`defaultState`, `migrateState`, `looksLikeBackup`, `rolloverNeeded`).
`js/state.js` ne garde que la persistance, la migration et les sélecteurs branchés sur l'état vivant ;
`js/utils.js` disparaît (absorbé par `core.js`).

| # | Anomalie | Statut | Ce qui a changé |
|---|---|---|---|
| A14 | Contrastes insuffisants sur le texte tertiaire | **Corrigé** | `--text3` recalibré : `#8298ab` en sombre (5,74 à 6,57:1) et `#4d6b87` en clair (5,04 à 5,57:1) sur les trois fonds de l'application — conformes AA partout, alors que l'ancien `#5d7d99` du thème clair plafonnait à 3,91:1 |
| A15 | Navigation et formulaires inaccessibles au clavier | **Corrigé** | Les 8 entrées de menu, les cases d'exercice, les verres d'eau et les boutons d'action sont de vrais `<button>` (focusables, activables au clavier) ; 25 étiquettes reliées à leur champ ; fenêtres modales en `role="dialog" aria-modal="true"` avec piège de tabulation et retour du focus sur le bouton d'origine ; `aria-current="page"` sur l'écran actif ; titre du document synchronisé ; messages d'état en `role="status" aria-live` ; contour de focus visible (`:focus-visible`) |
| A16 | Graphiques flous sur écrans HiDPI | **Corrigé** | `setupCanvas()` (core.js) dimensionne le tampon selon `devicePixelRatio` (borné à 3×) et met le contexte à l'échelle : les quatre graphiques (tableau de bord, poids ×2, progression par exercice) sont nets, et le code de dessin reste exprimé en pixels CSS ; les graphiques se redessinent au redimensionnement |
| A17 | Dette / incohérences mineures | **Partiel** | Ajout d'une suite de tests, d'un lint (`eslint.config.mjs`), de `package.json`, `README.md` et `LICENSE` (MIT). **Reste :** `alert()` de fin de séance, `.profile-form` sans CSS |
| — | Fiabilité des séries | **Ajouté** | Un garde-fou (`setPending`) empêche la double validation d'une même série pendant le court délai entre la confirmation et le passage au repos : une série ne peut plus être comptée deux fois |
| — | Calcul d'échéance | **Corrigé** | `deadlineInfo()` normalise à midi et neutralise le `-0` : une échéance de la veille n'est plus classée « aujourd'hui » |
| — | Filet de sécurité des données | **Ajouté** | Export/import JSON (`js/data.js`) depuis l'écran Profil : fichier versionné (`app`, `schemaVersion`, `exportedAt`, `data`), import validé (`looksLikeBackup`) qui refuse un fichier étranger sans toucher aux données, remise à zéro explicite après confirmation |

**Suite de tests (65).** `tests/core.test.js` (37) couvre la logique pure : dates locales et bascules
de semaine, formats, 1RM, calories, volume hebdomadaire, sélecteurs de séances et d'objectifs, profil,
échappement, `setupCanvas`, migration d'un état v3, idempotence de `migrateState`. `tests/dom.test.js`
(28) exécute l'application réelle (`index.html` + tous les scripts) dans jsdom : démarrage, huit écrans,
état corrompu, saisie des séries, double-validation, objectifs, persistance, accessibilité (étiquettes,
`aria-current`, Échap, navigation clavier), graphiques HiDPI et export/import.

**Documentation.** `README.md` (fonctionnalités, démarrage, tests, organisation du code, données et
sauvegarde, déploiement, accessibilité, conventions) et `LICENSE` (MIT). `manifest.json` passe en
`start_url`/`scope` relatifs : l'application fonctionne aussi en sous-dossier. Rappel maintenu :
incrémenter `CACHE_NAME` (aujourd'hui `focusfit-v6`) à chaque publication.

---

## 14. Limites de l'audit

- Aucun navigateur graphique n'était installé dans l'environnement (CDN de navigateurs inaccessible) :
  l'exécution a été validée dans **jsdom** (DOM réel, scripts réels, canvas et API audio simulés).
  Les anomalies listées sont des comportements de code, reproduits et non dépendants du rendu visuel ;
  en revanche, **aucun contrôle visuel pixel** (alignements, débordements) n'a été réalisé.
- Les performances sont estimées par analyse statique (taille, stratégies de rendu), sans profilage.
- Les chemins « multi-appareils/multi-navigateurs » (Safari iOS, service worker en PWA installée,
  Wake Lock, throttling réel des minuteries) sont analysés par lecture du code, pas mesurés sur device.

---

## 15. Annexe — Résultats du harnais de vérification

Exécution réelle de `index.html` + `js/*.js` dans jsdom (constats d'audit **avant corrections** —
les anomalies listées ci-dessous sont depuis traitées, voir §11 à §13) : **21 vérifications →
5 conformes et 16 anomalies reproduites**. S'y ajoutent 4 mesures complémentaires qui n'étaient pas exprimables
dans le harnais : A4 (script dédié aux objectifs « Durée »), A14 (calcul des ratios de contraste),
A15 (comptage des attributs d'accessibilité), A16 (analyse des appels canvas) — soit **17 anomalies
au total**. Les 5 points conformes : démarrage sans erreur JS, rendu du tableau de bord, ajout d'un
exercice au planning, calcul du 1RM Epley avec détection de PR, et déroulé complet d'une séance
jusqu'à l'historisation (durée, streak, entrée d'historique).

Extraits représentatifs :

```
OK        │ L'app démarre sans erreur JavaScript            → aucune erreur console
OK        │ 100 kg × 5 → 1RM 117 kg, isPR = true
ANOMALIE  │ calendrier : aujourd'hui (ven) = cellule 35/35 → colonne « D » (dimanche)
ANOMALIE  │ loadProgram('sl5') → page-planning, titre "Planning", menu actif "Tableau de bord"
ANOMALIE  │ date saisie 2026-09-11 → enregistrée "10/09/2026" (TZ America/New_York)
ANOMALIE  │ logLift() sans poids → {"name":"Bench","w":0,"r":5,"isPR":false}
ANOMALIE  │ timer : compteur affiché 02:10 vs durée enregistrée 0 s
ANOMALIE  │ localStorage "{oops"  → SyntaxError → app vide
ANOMALIE  │ état sans sessionHistory → TypeError ... reading 'map'
ANOMALIE  │ PR de 250 kg → weeklyVolume inchangé : [3200,3450,3380,3600,3750,3820,4100,4250]
ANOMALIE  │ planning 2 exercices jamais réalisés → "Séances semaine" = 2, "Calories" = 90
ANOMALIE  │ 3 repas de 3 jours → 1500 kcal affichés "aujourd'hui" ; champs : name, cal, prot, carbs, fat
ANOMALIE  │ objectif "Durée" 600 min → created current: 0 → progression bloquée à 0 %
ANOMALIE  │ <img src=x onerror=...> saisi comme exercice → rendu dans le DOM
ANOMALIE  │ href généré : javascript:window.__PWN=1
ANOMALIE  │ assets/icon-192.png → HTTP 404 (vérifié sur le serveur local)
ANOMALIE  │ sw.js : cache-first pur, sans revalidation
```

Outils utilisés pendant l'audit et **volontairement laissés hors du dépôt** (donc sans aucun impact
sur l'application) : un harnais jsdom de 21 vérifications (`node harness.js`), un script de mesure de
la dérive du timer, et un script dédié aux objectifs « Durée ». Toute cette mécanique est
reproductible : elle ne fait que charger `index.html`, exécuter les 12 scripts dans l'ordre réel et
simuler des clics/saisies utilisateur.
