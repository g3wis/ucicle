# Ucicle : système de design « Le dossard »

Écrit à partir du code livré (pas des intentions). Chaque règle cite le fichier qui la porte. Le
contrat de direction d’origine et ses décisions successives sont dans `.bunshin/` (local, ignoré
par git) ; ce fichier en est la version tenue à jour.

## L’idée

Le jeu est un tableau de départ. Le sol est le bitume ; chaque essai est un dossard en Tyvek
épinglé, numéroté de 1 à 5 ; le coureur mystère est un dossard au numéro caché, qui porte son
meilleur résultat et, essai après essai, ce que tu as prouvé ; à la fin il se retourne et son
numéro devient ton score. Le dossard 5 est le dossard rouge du combatif : la dernière chance.

## Couleurs (`assets/scss/_tokens.scss`)

| Token | Valeur | Rôle | Contraste mesuré |
|---|---|---|---|
| `--tarmac` | #2b2e33 | le sol, le fond de page et des panneaux | |
| `--tarmac-raised` | #34383e | bandeau des faits, éléments actifs sur le sol | |
| `--tarmac-hover` | #3d4249 | survol sur le sol | |
| `--tarmac-rule` | #44494f | filets décoratifs (en-tête, pied de page) | |
| `--tarmac-line` | #787e87 | contours en pointillé des cases vides, bouton désactivé | 3,3:1 sur bitume |
| `--on-tarmac` | #f7f7f4 | texte sur le sol | 12,7:1 |
| `--on-tarmac-2` | #b9bec5 | texte secondaire sur le sol | 7,3:1 |
| `--tyvek` | #f7f7f4 | les dossards, le bouton principal, le champ | |
| `--ink` | #111316 | texte et bandes sur Tyvek | 17,3:1 sur Tyvek |
| `--ink-2` | #50565e | texte secondaire sur Tyvek (autre pays) | 6,9:1 |
| `--ink-line` | #7d838b | filets de la ligne imprimée | 3,6:1 sur Tyvek |
| `--same` | #1d5fd1 | « comme le coureur mystère », et rien d’autre | blanc dessus 5,8:1 |
| `--red` | #c8102e | dossard 5 (colonne du numéro, dès la case vide), défaite (X/5) | 5,5:1 sur Tyvek |
| `--red-on-tarmac` | #ef5d72 | le 5 et le X des stats sur le sol (grands chiffres) | 4,2:1 sur bitume |
| `--pin`, `--pin-dark` | #9aa0a8, #6d737b | épingles (fils, chape) | décoratif |
| `--focus-on-tarmac`, `--focus-on-tyvek` | #f7f7f4, #1d5fd1 | anneau de focus selon la surface | |

Règle : un état n’est jamais dit par la couleur seule (remplissage, icône, texte).
`@media (forced-colors: active)` rend les contours réels (`_base.scss`).

## Typographie

- **Archivo Variable** (`@fontsource-variable/archivo`, axe de largeur) : `--font-bib`.
  Chiffres de dossard, marque et score en largeur `--stretch-numeral` (62 %) et graisse 900 ;
  bandes, titres de section, années, compte à rebours en `--stretch-band` (75 %) et 800, en
  capitales espacées. Ses zéros sont simples : il porte tous les chiffres d’affichage.
- **Atkinson Hyperlegible Next Variable** : `--font-text`, tout le reste (phrases, libellés,
  valeurs des cases). Dessinée pour les lecteurs malvoyants ; son zéro barré est gardé (pas de
  variante simple dans la police, vérifié).
- Échelle : `--fs-2xs` 12 px à `--fs-xl` (fluide), plus `--fs-bib-number`, `--fs-mystery`
  (clamp(7,5rem, 5rem + 12vw, 10rem) : le « ? » à l’échelle d’un numéro de dossard),
  `--fs-mystery-hero` (clamp(14rem, 10rem + 6vw, 17rem) sur laptop), `--fs-score`. Chiffres tabulaires
  (`font-variant-numeric: tabular-nums`) partout où des valeurs s’alignent.

## Espacement, rayons, mise en page

- Pas de 4 px : `--sp-1` 4 à `--sp-7` 48.
- Rayons : `--r-cell` 2 px (un bloc de correspondance, jamais une pastille), `--r-bib` 6 px,
  `--r-control` 8 px, `--r-sheet` 16 px.
- Gouttières `max(16px, env(safe-area-inset-*))`. Contenu max 1040 px. Sous 1024 px : une
  colonne. À partir de 1024 px : le dossard mystère collant à gauche (400 px, portrait), le
  tableau à droite (560 px), un peu d’air au-dessus (`--game-air`).

## Composants (`src/components/`, styles dans `assets/scss/components/`)

| Composant | Ce qu’il est | Règles |
|---|---|---|
| `GuessBib` (`_bib.scss`) | un dossard d’essai | numéro 1 à 5 en colonne à gauche ; nom ; ligne imprimée de 4 valeurs ; bande de pied d’encre avec l’équipe en type de bande (Archivo 75/800, capitales), précédée d’une tuile bleue cochée si même équipe ; dossard 5 : colonne rouge, « 5 » en Tyvek |
| `Cell` (`_cells.scss`) | une valeur imprimée | filets fins entre et autour des valeurs, sans boîte ; flèche vers la valeur du mystère ; une correspondance est un bloc bleu inset de 2 px, coche, texte blanc |
| `Pin` (`Pin.tsx`) | une épingle de sûreté | 30 × 11, ressort, deux tiges, chape ; angles fixes propres à chaque dossard (variables CSS) ; jamais animée au survol ; seulement sur de vrais dossards |
| `MysteryBib` (`_mystery.scss`) | le dossard mystère | bande « Étape N, date » ; « ? » ; indice (résultat, course, années) ; ligne imprimée des faits prouvés (`KnownStrip`) ; bande d’équipe bleue une fois l’équipe prouvée (la seule bande pleine bleue, avec celle de la victoire) ; au retournement, colonne de score (bleue « 3/5 » et bande bleue sur une victoire, rouge « X/5 » sur une défaite) |
| `FactsBand` (`_facts-band.scss`) | bandeau des faits sous l’en-tête (téléphone) | deux lignes (indice, faits par ordre décisif) ; visible seulement quand les faits du dossard mystère sont hors de vue ; opacité seule ; jamais bleu |
| `RiderCombobox` (`_combobox.scss`) | la saisie du coureur | combobox WAI-ARIA ; champ en Tyvek ; liste qui pend du champ ; « Valider » contouré tant que rien n’est choisi, rempli en Tyvek avec le nom court une fois un coureur choisi |
| `ShareButton`, `Countdown` | la fin d’étape | Partager sur toute la largeur du dossard ; « Prochain départ dans 05:12:33 » en chiffres Archivo |
| `Panel` (`_panel.scss`) | Aide, Stats, Menu | feuille du bas sur téléphone, panneau à droite dès 768 px ; focus piégé, Échap, retour arrière |
| `Header`, `Footer`, `MenuPanel` | navigation | la marque mène au jeu ; dès 1024 px : À propos, Aide, Stats et la langue (« EN » / « FR », plus discrète, derrière un filet vertical) dans le même type de bande ; chaque lien une fois par vue ; sections futures déclarées dans `src/app/nav.ts`, cachées |

## Cases vides et dossard rouge

Les cases à venir sont des contours en pointillé (`--tarmac-line`) numérotés ; la case active a un
contour plein. La cinquième, vide ou active, montre déjà sa colonne rouge et son « 5 » en Tyvek.

## Partage

`src/game/share.ts` : une ligne en clair (« Ucicle #N, trouvé en 3/5 🚴 »), une ligne par essai
(âge, taille, poids, pays, équipe) en 🔺 (valeur du mystère plus haute), 🔻 (plus basse),
🟦 (même), ⬛ (différent), puis le lien. 🟦 est la seule tuile bleue : une ligne gagnante est la
seule ligne toute bleue. Jamais le nom du coureur.

## Mouvement (`src/motion/tokens.ts`, `--dur-*`, `--ease-*`)

- Durées : rapide 140 ms, base 200 ms, panneau 240 ms (sortie 180 ms), retournement 420 ms, mouvement
  réduit 120 ms. Courbes : sortie `cubic-bezier(0.2, 0.7, 0.2, 1)`, entrée `cubic-bezier(0.4, 0, 1, 1)`.
- Un dossard posé tombe de 12 px avec un seul dépassement (ressort 420 / 28), ses cases se
  tamponnent à 80 ms d’écart, ses épingles se posent, puis la case suivante s’ouvre en fondu.
- Fin d’étape : le dernier dossard se pose, la page remonte au dossard mystère sur téléphone, il
  se retourne une fois, puis Partager et le compte à rebours apparaissent.
- Survol (pointeur fin) : un dossard s’incline de 0,6 degré ; le bouton principal monte de 1 px
  sur une arête dure.
- Mouvement réduit : des fondus de 120 ms, sans déplacement ; le retournement devient un fondu
  enchaîné.
- Interdits : confettis, lueur, parallaxe, boucle, plus d’un dépassement, plus d’un retournement,
  toute animation de largeur, hauteur, top, left, marge ou padding.

## À faire et à ne pas faire

- Faire : tirer chaque valeur des tokens ; garder le bleu pour « même » et le rouge pour le 5 et
  la défaite ; écrire chaque texte dans `src/content/` en FR et EN ; garder les balises de tête
  dans le HTML statique.
- Ne pas faire : des boîtes autour des valeurs sur Tyvek ; des épingles hors des dossards ; une
  information répétée dans la même vue ; une légende évidente ; un chiffre de joueurs ou un
  pourcentage global ; le nom du coureur du jour dans une URL, un partage ou une image d’aperçu.

## Images (`public/`)

`og/ucicle.png` (FR) et `og/ucicle-en.png` (EN), 1200 × 630, rendus à partir de ce système : la
marque, la promesse, un dossard mystère et un tableau en cours, avec un indice partagé par
plusieurs coureurs pour ne jamais désigner une réponse. `apple-touch-icon.png` (180),
`favicon-32.png`, `favicon-48.png` : un dossard au « ? » en Archivo. Aucune image tierce.
