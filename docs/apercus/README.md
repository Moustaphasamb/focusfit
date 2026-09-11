# Aperçus de l'interface

Ces images montrent **FocusFIT v6.0** tel qu'il est défini dans le dépôt : mêmes polices
(Barlow, Barlow Condensed, JetBrains Mono), mêmes couleurs (lues dans `css/variables.css`) et
**mêmes valeurs que celles calculées par l'application** — les libellés et les chiffres sont
extraits de `index.html` + `js/*.js` exécutés dans jsdom (`tools/apercu/data.js`).

| Fichier | Écran |
|---|---|
| `planche.png` | Planche récapitulative (4 vues) |
| `apercu-tableau-de-bord.png` | Tableau de bord, thème sombre |
| `apercu-tableau-de-bord-clair.png` | Tableau de bord, thème clair (contraste AA) |
| `apercu-mobile.png` | Version mobile avec le menu ouvert |
| `apercu-fin-de-seance.png` | Récapitulatif de fin de séance |
| `apercu-sauvegarde.png` | Bloc export / import des données (écran Profil) |

## Comment elles ont été produites

Aucun navigateur graphique n'est disponible dans l'environnement de développement (les dépôts de
binaires sont inaccessibles). Ces vues sont donc **reconstruites** : la mise en page est décrite en
flexbox et rendue par [Satori](https://github.com/vercel/satori) puis
[resvg](https://github.com/thx/resvg-js), à partir du contenu réel de l'application.

```bash
# Dépendances de rendu, non installées par défaut (facultatives)
npm i --no-save satori @resvg/resvg-js \
  @fontsource/barlow @fontsource/barlow-condensed @fontsource/jetbrains-mono

node tools/apercu/data.js     # extrait les données affichées → tools/apercu/data.json
node tools/apercu/render.js   # écrit les images dans docs/apercus/
```

Les données affichées sont un **jeu de démonstration** (`tools/apercu/data.js`), pas des données
réelles : il sert à montrer les écrans remplis (séances, charges, pesées, repas).

## Ce que ces images ne prouvent pas

Ce sont des reconstitutions fidèles, mais **pas des captures d'écran** : elles ne remplacent pas un
contrôle visuel dans un vrai navigateur (alignements, débordements, netteté réelle des graphiques
sur écran HiDPI, comportement tactile, installation en PWA). Un passage sur Chrome ou Safari, sur
ordinateur et sur téléphone, reste nécessaire avant une mise en production.
