# Ucicle front : guide pour l’IA qui maintient le site

Ce fichier dit où se fait chaque type de changement, quelles règles de design et d’écriture
tenir, et quoi vérifier avant de pousser. Il vaut pour tout le dossier `front/`.

Lire aussi : `PRODUCT.md` (le produit, les faits, ce qui ne s’invente pas) et `DESIGN.md` (le
système de design tel qu’il est codé).

## Où se fait quoi

| Je veux changer… | Fichier |
|---|---|
| Un texte visible (FR et EN) du jeu, de l’en-tête, du menu, du pied de page | `src/content/common.ts` (les deux langues, mêmes clés ; le type est dans `src/content/types.ts`) |
| Un texte de l’aide | `src/content/help.ts` |
| Un texte de la page À propos | `src/content/about.ts` |
| Un texte du panneau Stats | `src/content/stats.ts` |
| Le titre, la description, l’aperçu de lien d’une page | `index.html`, `en/index.html`, `a-propos/index.html`, `en/about/index.html` (les balises doivent rester dans le HTML statique : les aperçus de lien n’exécutent pas JavaScript) |
| Une couleur, une taille, un espacement, un rayon, une durée | `assets/scss/_tokens.scss` (et `src/motion/tokens.ts` pour les durées et courbes utilisées en JS) |
| Le dossard (bandes, épingles, cases, bande d’équipe) | `src/components/GuessBib.tsx`, `Cell.tsx`, `Pin.tsx`, `assets/scss/components/_bib.scss`, `_cells.scss` |
| Le dossard mystère (indice, faits prouvés, retournement, score) | `src/components/MysteryBib.tsx`, `KnownStrip.tsx`, `assets/scss/components/_mystery.scss`, `_known.scss` |
| La saisie du coureur | `src/components/RiderCombobox.tsx`, `assets/scss/components/_combobox.scss` |
| La page de jeu (ordre, fin d’étape, défilements) | `src/pages/game/GamePage.tsx`, `assets/scss/pages/_game.scss` |
| La logique du jeu (comparaison, sauvegarde, stats, partage, compte à rebours) | `src/game/*.ts` |
| Un code pays ou un nom de pays | `src/data/countries.ts` |
| Une section de navigation (Coureurs, Équipes, Courses) | `src/app/nav.ts` : passer `visible: true` ; la rangée de navigation apparaît seule dès que deux sections sont visibles |
| La date de l’« Étape 1 » | `src/game/stage.ts`, `STAGE_ORIGIN` (ne plus jamais la changer une fois publiée : les résultats partagés citent le numéro) |
| Les images d’aperçu, favicons, icône tactile | `public/` (rendus à partir du design, sans image tierce ; voir `DESIGN.md`) |

## Règles de design (le contrat « Le dossard »)

- Fond bitume, dossards en Tyvek imprimés à l’encre. Le bleu (`--same`) veut dire « comme le
  coureur mystère », et rien d’autre. Le rouge (`--red`, `--red-on-tarmac`) est réservé au
  cinquième et dernier dossard, et à la défaite (X/5).
- Sur le Tyvek, les valeurs sont imprimées sur une ligne réglée, jamais dans des boîtes. Seule une
  correspondance est un bloc rempli (bleu, coche, texte blanc).
- Un état est toujours dit trois fois : remplissage, icône, texte. Jamais la couleur seule.
- Typographie : Archivo (variable) pour les numéros de dossard, la marque, les bandes et les
  chiffres d’affichage ; Atkinson Hyperlegible Next pour tout le reste. Chiffres tabulaires
  partout où des valeurs s’alignent.
- Les épingles n’existent que sur de vrais dossards. Chaque dossard a ses angles fixes.
- Mouvement : 140 à 420 ms ; un seul dépassement de ressort (la pose d’un dossard) ; un seul
  retournement (le dossard mystère, à la fin) ; ni confettis, ni lueur, ni parallaxe, ni boucle ;
  jamais d’animation de largeur, hauteur, top, left, marge ou padding. Toute transition CSS va dans
  `@media (prefers-reduced-motion: no-preference)` ; tout survol dans
  `@media (hover: hover) and (pointer: fine)`.
- Pas d’information superflue : pas de légende évidente, pas de texte de remplissage, chaque
  lien une seule fois par vue.

## Règles d’écriture

- Tutoiement, phrases courtes, vocabulaire du peloton (étape, départ, dossard). Même registre en
  anglais.
- Aucun texte dans les vues : tout passe par les fichiers de `src/content/`, en français et en
  anglais.
- Jamais le caractère U+2014 (tiret cadratin). Apostrophes typographiques (’).
- Rien d’inventé : pas de chiffre de joueurs, pas de pourcentage global, pas d’avis. Un fait
  inconnu reste générique à l’écran et prend un commentaire `// OWNER:` dans le fichier de
  contenu.
- Le nom du coureur du jour ne va jamais dans une URL, un texte de partage ou une image d’aperçu.

## Commandes

```bash
yarn            # installer
yarn start      # développement (http://localhost:5173, /api est relayé vers le bucket de production)
yarn eslint     # lint
yarn typescript # vérification des types
yarn build      # build de production dans build/ (affiche les faits encore manquants)
yarn ci         # ce que la CI exécute : install, lint, build
```

Pour tester sans réseau, `dev-fixtures/api/` (ignoré par git) contient une copie de
`riders.json` et de `secret_rider.json` ; copier ces fichiers dans `build/api/` d’une copie du
build, jamais dans `public/` (le déploiement enverrait `api/` sur le bucket et écraserait les
vraies données).

## Avant de pousser

1. `yarn eslint` et `yarn build` sortent en 0.
2. Les deux langues ont les mêmes clés de contenu, et le texte se lit dans les deux.
3. À 390 px : pas de défilement horizontal ; le premier écran montre le dossard mystère et la
   saisie.
4. Avec « réduire les animations » activé dans le système : plus de déplacement, des fondus
   seulement.
5. Au clavier : saisir, choisir avec les flèches, Entrée pour choisir, Entrée pour valider ; Échap
   ferme la liste ; les panneaux gardent le focus et le rendent à la fermeture.
6. `build/` ne contient pas de dossier `api/`.
