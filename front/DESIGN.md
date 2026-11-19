# Ucicle : système de design « Le dossard » et « La liste des engagés »

Écrit à partir du code livré (pas des intentions). Chaque règle cite le fichier qui la porte. Les
contrats de direction (« Le dossard » pour le jeu, « La liste des engagés » pour l’index) et leurs
décisions successives sont dans `.bunshin/` (local, ignoré par git) ; ce fichier en est la version
tenue à jour. Les décisions citées (D1 à D9, E1 à E7) sont celles de `.bunshin/decisions/` ; le
code en garde la trace dans ses commentaires.

## L’idée

Le jeu (`/jeu/`, `/en/play/`) est un tableau de départ. Le sol est le bitume ; chaque essai est un
dossard en Tyvek épinglé, numéroté de 1 à 5 ; le coureur mystère est un dossard au numéro caché,
qui porte son meilleur résultat et, essai après essai, ce que tu as prouvé ; à la fin il se
retourne et son numéro devient ton score. Le dossard 5 est le dossard rouge du combatif : la
dernière chance.

L’index (l’accueil `/`, le classement `/classement/`, les pages coureur `/coureurs/<slug>/`, la
méthode `/classement/methode/`, la recherche `/recherche/`, et leurs jumelles sous `/en/`) est la
liste des engagés que les commissaires impriment chaque nuit : chaque coureur classé porte son rang
comme numéro de dossard. Le classement est une colonne de bandes de Tyvek ; la page coureur est
son dossard, en grand, posé sur le même bitume. Le jeu est l’étape du jour ; l’index est le
dossard de la saison.

## Couleurs (`assets/scss/_tokens.scss`)

| Token | Valeur | Rôle | Contraste (commentaire du fichier) |
|---|---|---|---|
| `--tarmac` | #2b2e33 | le sol : fond de page et des panneaux | |
| `--tarmac-raised` | #34383e | bandeau des faits, lien de navigation courant, survol d’une saison fermée | |
| `--tarmac-hover` | #3d4249 | survol sur le sol (navigation, pagination, boutons secondaires) | |
| `--tarmac-rule` | #44494f | filets décoratifs : en-tête, pied de page, saisons fermées, « Autres courses » | décoratif |
| `--tarmac-line` | #787e87 | pointillés des cases vides, filet d’en-tête des tableaux sur le sol, séparateurs du fil d’Ariane | 3,3:1 sur bitume |
| `--on-tarmac` | #f7f7f4 | texte sur le sol | 12,7:1 |
| `--on-tarmac-2` | #b9bec5 | texte secondaire sur le sol | 7,3:1 |
| `--tyvek` | #f7f7f4 | dossards, bandes, feuilles, champs, bouton principal | |
| `--tyvek-bright` | #fff | réservé au jeu (`_mystery.scss`, `_combobox.scss`) | |
| `--tyvek-shade` | #e9eae4 | ligne de résultat ouverte et son calcul, filet entre deux courses, colonne sans rang de la recherche, compte d’une saison ouverte | |
| `--ink` | #111316 | texte, bandes et colonne de rang sur Tyvek ; trait de l’historique | 17,3:1 sur Tyvek |
| `--ink-2` | #50565e | texte secondaire sur Tyvek | 6,9:1 |
| `--ink-line` | #7d838b | filets de la ligne imprimée, règles du graphique | 3,6:1 sur Tyvek |
| `--same`, `--on-same` | #1d5fd1, #fff | jeu seulement : « comme le coureur mystère » | blanc dessus 5,8:1 |
| `--red` | #c8102e | jeu seulement : dossard 5, défaite (X/5) | 5,5:1 sur Tyvek |
| `--red-on-tarmac` | #ef5d72 | jeu seulement : le 5 et le X des stats sur le sol (grands chiffres) | 4,2:1 sur bitume |
| `--pin`, `--pin-dark` | #9aa0a8, #6d737b | épingles (fils, chape) | décoratif |
| `--focus-on-tarmac`, `--focus-on-tyvek` | #f7f7f4, #1d5fd1 | anneau de focus selon la surface (`--focus`, 3 px, `_base.scss`) | |

Règles :
- Un état n’est jamais dit par la couleur seule (remplissage, icône, texte).
- L’index n’a pas de couleur sémantique : une évolution se dit par son signe, une flèche et une
  phrase pour les lecteurs d’écran (`Delta.astro`, ▲ ▼ =, « +5,9 », « −3,2 » avec le signe moins
  U+2212 de `formatDelta`, `src/i18n/format.ts`), à l’encre ou dans la couleur de texte de la
  surface (`_strip.scss`, `.delta`).
- Deux exceptions visibles dans les pages de l’index, toutes deux venues du jeu : l’anneau de
  focus sur Tyvek est `--focus-on-tyvek` (bleu) ; le bloc du jeu de l’accueil, à partir de
  1024 px, réutilise les cases du jeu, dont la cinquième et sa colonne rouge (`HomeView.astro`,
  `.bib-red`).
- `@media (forced-colors: active)` rend des contours réels : dossards (`_base.scss`), lignes de
  résultat de l’accueil (`_home.scss`), champs de recherche et option active (`_search.scss`), page
  courante de la pagination (`_ranking.scss`).

## Typographie

- **Archivo Variable** (`@fontsource-variable/archivo/wdth.css`, axe de largeur) : `--font-bib`.
  - Largeur `--stretch-numeral` (62 %) et graisse 900 : les numéros de dossard (`.bib-number`,
    `_bib.scss`), la marque (`.wordmark`, `_header.scss`), le score, le rang d’une bande
    (`.strip-rank`, `_strip.scss`) et d’une option de recherche (`.search-option-rank`,
    `_search.scss`), le rang du dossard coureur (`.rider-numeral.bib-number`, `RiderView.astro`).
  - Largeur `--stretch-band` (75 %) et graisse 800 : les bandes (`.bib-band`, `.bib-foot`,
    `.method-sheet-band`), les titres de page et de section (`.page-title`, `.section-title`,
    `_page.scss`), la navigation, les équipes sous les noms (`.strip-team`), les codes de nation et
    de classe, le compte à rebours. Bandes, titres et équipes sont en capitales espacées
    (`letter-spacing` de 0,03 à 0,06 em).
  - **Les chiffres sont en Archivo bande 800, chiffres tabulaires** (décision D7) : l’index d’une
    bande (`.strip-index`), les valeurs de la ligne imprimée du dossard (`.rider-line-cell dd`,
    `_rider.scss`), les colonnes chiffrées du tableau des saisons (`.season-table tbody .num`), la
    place et l’évolution d’une ligne de résultat (`.result-place`, `.result-delta`), les étiquettes
    du graphique, les cellules chiffrées de la méthode (mixin `method-figure`, `_method.scss`),
    `.delta`. Le zéro barré d’Atkinson n’apparaît donc jamais dans une colonne de chiffres.
- **Atkinson Hyperlegible Next Variable** : `--font-text`, tout le reste (phrases, libellés, noms,
  valeurs des cases du jeu). Son zéro barré est gardé (pas de variante simple dans la police).
- Échelle : `--fs-2xs` 12 px à `--fs-xl` (fluide), plus `--fs-bib-number`, `--fs-mystery`,
  `--fs-mystery-hero`, `--fs-score` pour le jeu. L’index ajoute ses tailles en `clamp()` dans ses
  feuilles : le rang du dossard coureur `clamp(5rem, 3.5rem + 7vw, 8rem)` (`.rider-numeral`), le
  nom `clamp(1.5rem, 1.2rem + 1.5vw, 2rem)`, le rang d’une bande 1,75rem (1,25rem à 4 ou 5
  chiffres, `[data-digits]`).
- Chiffres tabulaires (`font-variant-numeric: tabular-nums`) partout où des valeurs s’alignent.
- Espaces : une unité garde une espace insécable U+00A0 (« 1,76 m », « 66 kg » : `&#160;` dans
  `RiderView.astro`, décision E7), parce qu’Archivo dessine U+202F avec une largeur nulle. Le
  séparateur de milliers français d’`Intl` (`formatIndex`, `src/i18n/format.ts`) est U+202F : dans
  Archivo un index de quatre chiffres s’imprime donc sans espace visible (« 2250 » sur la capture
  `.bunshin/captures/round-4/home-fr-390x664.png`), alors que le même nombre en Atkinson garde
  son espace fine (« 4 020 coureurs »).

## Surfaces

- **Le bitume** (`--tarmac`) : le sol de toutes les pages. Le texte courant, les tableaux (saisons
  du coureur, tableaux de la méthode) et les lignes « Autres courses » de l’accueil s’y impriment
  directement.
- **Les bandes de Tyvek** (`.strip`, `_strip.scss`) : une par coureur dans une liste des engagés.
  Rayon `--r-strip` (4 px), ombre dure `0 1px 0 rgb(0 0 0 / 35%)`, hauteur minimale 56 px.
- **Les dossards** (`.bib`, `_bib.scss`) : rayon `--r-bib` (6 px), même ombre dure. Le jeu (essais,
  coureur mystère), le dossard coureur, le petit dossard du jeu sur l’accueil, la carte des stats.
- **Les feuilles de Tyvek** : le graphique d’historique (`.history-panel`), la saison ouverte des
  résultats (`.season-results[open]`), les feuilles de la méthode (`.method-sheet`), les lignes de
  résultat de l’accueil (`.home-result`, rayon `--r-strip`).
- **Les bandes d’encre** : `.bib-band` (haut du dossard, capitales espacées, centrée), `.bib-foot`
  (pied du dossard, l’équipe), `.method-sheet-band`, le résumé d’une saison ouverte. Le dossard
  coureur imprime en haut « Index Ucicle, {date} » (`src/content/rider.ts`, `bibBand`) ; la date est
  celle de sa dernière course quand il est absent depuis plus de `active_days` (décision E3,
  `RiderView.astro`).
- **Les filets** : seulement entre les valeurs d’une ligne imprimée (`.rider-line`,
  `.home-result-value + .home-result-value`, `.example-line`) et sous l’en-tête d’un tableau
  (`--tarmac-line`, 2 px). Jamais une boîte autour de chaque ligne.
- **Les saisons fermées sont des lignes réglées** (décision D8) : un `<details>` fermé n’a pas de
  fond, un filet de 1 px `--tarmac-rule` au-dessus, la saison en type de bande, le compte en
  `--on-tarmac-2`, un « + » à droite. Seule la saison ouverte devient la feuille avec sa bande
  d’encre et un « − » (U+2212). Pages coureur (`.season-summary`, `_rider.scss`) et méthode
  (`.method-season-summary`, `_method.scss`).

## Espacement, rayons, mise en page

- Pas de 4 px : `--sp-1` 4 à `--sp-7` 48.
- Rayons : `--r-cell` 2 px (un bloc de correspondance, jamais une pastille), `--r-strip` 4 px (une
  bande de la liste), `--r-bib` 6 px, `--r-control` 8 px, `--r-sheet` 16 px.
- Gouttières `max(16px, env(safe-area-inset-*))`. Contenu max `--content-max` 1040 px, pour le jeu
  comme pour l’index (`.index-page`, `_page.scss`). En-tête collant de `--header-h` 56 px.
- Une liste des engagés garde une mesure de 48rem (`.start-list`, `.ranking-list`,
  `.search-results`) sauf dans les deux colonnes à partir de 1024 px. Le texte courant garde 62 à
  65 caractères (`.page-lede`, `.index-lede`, `.method-text`).

### Par largeur

| Largeur | Ce qui change | Fichier |
|---|---|---|
| 390 px (référence) | une colonne ; sur l’accueil, à 390 × 664, le H1, la phrase, la ligne calculée, le bloc du jeu et le début du top 10 tiennent dans le premier écran | `_home.scss` (en-tête du fichier) |
| moins de 360 px | la nation d’une bande disparaît ; une ligne de résultat de l’accueil passe en pile | `_strip.scss`, `_home.scss` |
| moins de 380 px | la pagination n’imprime que la page courante entre la première et la dernière | `_ranking.scss`, `Pagination.astro` |
| moins de 480 px | la colonne d’évolution des bandes se resserre ; une ligne de résultat du coureur met la place sous la course ; l’en-tête se resserre | `_strip.scss`, `_rider.scss`, `_header.scss` |
| à partir de 600 px | « Jouer » à sa propre largeur ; la liste de la recherche pend du seul champ | `_home.scss`, `_search.scss` |
| à partir de 768 px | panneaux du jeu à droite ; graphique de 260 px de haut ; méthode et recherche côte à côte en fin d’accueil ; « Autres courses » sur une ligne | `_panel.scss`, `_rider.scss`, `_home.scss` |
| à partir de 1024 px | voir ci-dessous | |
| à partir de 1200 px | la table des matières de la méthode devient un rail à droite, collant si la fenêtre fait au moins 640 px de haut ; le texte garde 65ch | `_method.scss` |

À partir de 1024 px (décision D5 : chaque page finit sur un seul bord droit, celui de la colonne) :
- En-tête : À propos, Aide et Stats (jeu seulement, libellés écrits) et la langue rejoignent la
  rangée (`_header.scss`).
- Jeu : le dossard mystère collant à gauche (400 px, portrait), le tableau à droite (560 px)
  (`_game.scss`).
- Accueil : le bloc du jeu (400 px) à côté du top 10 ; il montre la mécanique (décision D3) : le
  petit dossard mystère puis les cinq cases de `/jeu/`, « Jouer » dans la première ; il colle sous
  l’en-tête si la fenêtre fait au moins 640 px de haut. Chaque dernier résultat devient une ligne
  imprimée (date, course, deux valeurs séparées par un filet) (`_home.scss`).
- Classement et recherche : deux colonnes, la liste (`minmax(0, 1fr)`) et un rail de 16rem
  (recherche, « Aller au rang », ligne calculée et note). Le rail vient en premier dans le source ;
  sous 1024 px ses enveloppes sont en `display: contents`. Il colle sous l’en-tête si la fenêtre
  fait au moins 600 px de haut (`_search.scss`, « The rail »).
- Page coureur : le dossard (560 px) et son aparté côte à côte ; le graphique à côté du tableau des
  saisons (3fr / 2fr) ; « Ses voisins au classement » à côté des coéquipiers (`_rider.scss`).

## Composants

### Jeu (`src/components/`, styles dans `assets/scss/components/`)

| Composant | Ce qu’il est | Règles |
|---|---|---|
| `GuessBib` (`_bib.scss`) | un dossard d’essai | numéro 1 à 5 en colonne à gauche ; nom ; ligne imprimée de 4 valeurs ; bande de pied d’encre avec l’équipe en type de bande, précédée d’une tuile bleue cochée si même équipe ; dossard 5 : colonne rouge, « 5 » en Tyvek |
| `Cell` (`_cells.scss`) | une valeur imprimée | filets fins entre et autour des valeurs, sans boîte ; flèche vers la valeur du mystère ; une correspondance est un bloc bleu inset de 2 px, coche, texte blanc |
| `Pin` (`Pin.tsx`, export `Pins`) | les épingles de sûreté | angles et décalages fixes propres à chaque dossard (`SETS`, variables CSS) ; jamais animées au survol |
| `MysteryBib` (`_mystery.scss`) | le dossard mystère | bande « Étape N, date » ; « ? » ; indice ; faits prouvés (`KnownStrip`) ; bande d’équipe bleue une fois l’équipe prouvée ; au retournement, colonne de score (bleue « 3/5 », rouge « X/5 ») |
| `FactsBand` (`_facts-band.scss`) | bandeau des faits sous l’en-tête (téléphone) | visible seulement quand les faits du dossard mystère sont hors de vue ; opacité seule ; jamais bleu |
| `RiderCombobox` (`_combobox.scss`) | la saisie du coureur | combobox WAI-ARIA ; champ en Tyvek ; « Valider » contouré tant que rien n’est choisi |
| `ShareButton`, `Countdown` | la fin d’étape | Partager sur toute la largeur du dossard ; compte à rebours en chiffres Archivo |
| `Panel` (`_panel.scss`) | Aide et Stats | feuille du bas sur téléphone, panneau à droite dès 768 px ; focus piégé, Échap, retour arrière |

Le jeu est une île React rendue côté client (`src/app/GameIsland.tsx`, `GamePage.tsx`, montée par
`src/views/game/GameView.astro`). Les liens Aide et Stats de l’en-tête ouvrent les panneaux par le
fragment d’URL (`#help`, `#stats`).

### Coquille (`src/components/shell/`)

| Composant | Règles |
|---|---|
| `Header.astro` (`_header.scss`) | la marque mène à l’accueil ; la rangée de navigation (Jeu, Classement) à toutes les largeurs, car deux sections sont visibles (`showNavRow`, `src/app/nav.ts`) ; la page courante a le fond `--tarmac-raised` (`aria-current="page"`, ou `"true"` dans une sous-page de la section) ; Aide et Stats sur la page du jeu seulement ; dès 1024 px : À propos et la langue (« EN » / « FR », plus discrète, derrière un filet vertical) dans le même type de bande |
| `Footer.astro` (`_footer.scss`) | le crédit des données ; sous 1024 px, À propos et l’autre langue. Chaque lien une seule fois par vue |
| `src/layouts/Base.astro` | les balises de tête (titre, description, canonique, hreflang, Open Graph, JSON-LD) rendues dans le HTML ; le lien d’évitement ; l’en-tête et le pied ; l’image d’aperçu du jeu pour le jeu, l’accueil et À propos, celle de l’index ailleurs (décision D4) |

### Index

| Composant | Fichier | Règles |
|---|---|---|
| Liste des engagés | `src/components/index/StartList.astro`, `_strip.scss` | une bande par coureur : colonne d’encre du rang (Archivo 62/900), nom (lien, toute la bande est la cible), équipe dessous en type de bande, code de nation, index (Archivo 75/800) ; colonne d’évolution du rang en option (`moves`) ; le coureur de la page est contouré de 2 px et n’est pas un lien (`highlight`) ; ancre `rang-<n>` / `rank-<n>` sur les pages du classement. Utilisée par le top 10 de l’accueil, le classement, les voisins et les coéquipiers |
| Évolution | `src/components/index/Delta.astro`, `.delta` dans `_strip.scss` | flèche (▲ ▼, = si rien n’a bougé), chiffre signé, phrase pour les lecteurs d’écran ; `kind="rank"` en places, `kind="index"` à une décimale ; jamais rouge ni vert |
| Recherche de coureur | `src/components/search/RiderSearch.astro`, `rider-search.ts`, `_search.scss` | formulaire GET vers la page de recherche, qui marche sans JavaScript ; avec le script, combobox WAI-ARIA dès 2 lettres (`/api/recherche`, 8 coureurs au plus) ; une option est une petite bande (rang ou rien, nom, équipe, index ou statut) ; l’option active est imprimée en négatif (encre, texte Tyvek) ; aucun résultat ou pas de réponse : une phrase sous le champ, jamais dans la liste ; le bouton d’effacement du navigateur, bleu, est retiré |
| Aller au rang | `src/components/search/RankJump.astro`, `_search.scss` | un numéro dans un formulaire GET vers la recherche (302 vers la bande) ; avec le script, saut direct à la bande et focus sur son lien ; le champ affiche sa plage en indication (« 1 à 4 020 », décision E6) ; la bande atteinte est contournée (`.strip:target`, `_ranking.scss`) |
| Pagination | `src/views/ranking/Pagination.astro`, `_ranking.scss` | liens simples ; la page courante imprimée sur Tyvek ; deux séquences imprimées, une seule visible selon la largeur |
| Dossard coureur | `src/views/rider/RiderView.astro` (section `rider-hero`), `_rider.scss` (« The bib ») | quatre épingles (`<Pins set="mystery" />`) ; bande « Index Ucicle, date » ; le rang comme numéro ; sans rang, le mot de statut (« Provisoire », « Inactif ») en type de bande dans la colonne du numéro, jamais un faux rang ; nom et identité ; ligne imprimée : Index, Dernière course (évolution et date), Meilleur index (et son mois), Nation, filets entre les valeurs seulement (grille en `subgrid`) ; bande de pied d’encre avec l’équipe. À côté : le statut, la saison en cours (décision E2), le rang UCI, les liens vers son rang et la méthode |
| Historique | `src/views/rider/HistoryChart.astro`, `_rider.scss` (« History ») | un trait d’encre sur une feuille de Tyvek ; ligne en escalier (l’index ne bouge qu’un jour de course, décision D2) ; une ligne de base et deux règles pointillées sur des valeurs rondes (multiples de 50) ; années sur l’axe, ou trimestres sous 18 mois ; un point par jour de course sous 20 jours ; le rodage 2019 en trait plus fin `--ink-2`, nommé ; le meilleur index marqué avec sa valeur et sa date ; SVG étiré, étiquettes en HTML placées en pourcentage. Le tableau des saisons (`.season-table`) le suit comme alternative accessible |
| Résultats | `src/views/rider/ResultRace.astro`, `ResultItem.astro`, `rows.ts`, `_rider.scss` (« Results ») | par saison (`<details>`, la plus récente ouverte) ; une course par étapes forme un groupe (décision E1) : un titre (nom, classe, dates), le classement général final d’abord, puis les étapes nommées par leur seul numéro ; une ligne comptée est un `<details>` natif (date, course et classe, place, évolution, chevron) qui ouvre la ligne de calcul (index avant, duels comptés, gagnés pour attendus, K et multiplicateur, index après) ; une ligne non comptée dit son statut. La saison ouverte montre environ 15 lignes de courses entières, le reste derrière « Voir les N autres » |
| Feuille de méthode | `src/views/method/MethodView.astro`, `_method.scss` | `.method-sheet` : une vraie course sur Tyvek, sa bande d’encre (course, jour, classe), ses trois premiers avec leur ligne imprimée et le calcul refait sous les yeux ; `.formula-sheet` : la formule composée en texte (une fraction est deux lignes et un trait) ; les courses comptées saison par saison en `<details>` (décision D8) ; règles et sources : un terme en type de bande, puis sa phrase |
| Titres, fil d’Ariane | `_page.scss` | `.page-title` et `.section-title` en Archivo 75/800 capitales ; `.index-lede` (accueil et classement, décision E4) dans la police de texte ; fil d’Ariane Accueil / Classement / page |

## Mouvement (`src/motion/tokens.ts`, `--dur-*`, `--ease-*`)

- Durées de `tokens.ts` : rapide 140 ms, base 200 ms, panneau 240 ms (sortie 180 ms),
  retournement 420 ms, mouvement réduit 120 ms. Courbes : sortie `cubic-bezier(0.2, 0.7, 0.2, 1)`,
  entrée `cubic-bezier(0.4, 0, 1, 1)`. La CSS n’en reprend que `--dur-fast`, `--dur-base` et
  `--dur-panel` (`_tokens.scss:72-74`) ; les 420 ms et 120 ms de l’index sont écrits en dur dans
  `_rider.scss` et `_home.scss`.
- Toute transition CSS est dans `@media (prefers-reduced-motion: no-preference)` ; tout survol
  dans `@media (hover: hover) and (pointer: fine)`. Rien n’est déclenché par le défilement.

### Jeu

- Un dossard posé tombe de 12 px avec un seul dépassement (ressort 420 / 28, `SPRING`), ses cases
  se tamponnent à 80 ms d’écart, ses épingles à 40 ms, puis la case suivante s’ouvre en fondu.
- Fin d’étape : le dernier dossard se pose, la page remonte au dossard mystère sur téléphone, il se
  retourne une fois, puis Partager et le compte à rebours apparaissent.
- Survol : un dossard d’essai s’incline de 0,6 degré (`_bib.scss:223-234`) ; le bouton principal
  monte de 1 px sur une arête dure (`_buttons.scss:67-77`).
- Mouvement réduit : `<MotionConfig reducedMotion="user">` (`src/app/GameIsland.tsx:32`) et
  `useReducedMotion()` dans `GamePage.tsx`, `MysteryBib.tsx`, `KnownStrip.tsx`, `Panel.tsx` : des
  fondus, sans déplacement ; le retournement devient un fondu enchaîné.

### Index

| Ce qui bouge | Durée | Fichier:ligne | Mouvement réduit |
|---|---|---|---|
| Le dossard coureur se pose une fois au chargement : chute de 12 px, un dépassement de 2 px à 62 % | 420 ms, `--ease-out` | `_rider.scss:160-163`, images clés `183-187` | fondu de 120 ms linéaire (`_rider.scss:177-181`) |
| Le trait de l’historique se dessine une fois (`clip-path` de gauche à droite) | 420 ms après 180 ms | `_rider.scss:165-167`, `194-197` | aucune animation |
| Les points et la marque du meilleur index apparaissent quand le trait les atteint | 140 ms après 560 ms | `_rider.scss:169-174` | aucune animation |
| Une bande du classement monte de 1 px au survol (arête de 2 px et nom souligné, même sans mouvement) | 140 ms | `_strip.scss:178-197` | arête et soulignement seuls |
| Le libellé de « Jouer » sur l’accueil, remplacé une fois l’étape finie sur cet appareil | 200 ms | `_home.scss:97-101` | fondu de 120 ms (`_home.scss:103-107`) |
| Fond des liens de pagination et de navigation, boutons | 140 ms | `_ranking.scss:192-196`, `_header.scss:212-216`, `_buttons.scss:89-94` | changement immédiat |
| Sur un écran tactile, le champ de recherche remonte sous l’en-tête au focus | défilement `smooth` | `rider-search.ts:309-316` | défilement `auto` |

Interdits : confettis, lueur, parallaxe, boucle, plus d’un dépassement, plus d’un retournement,
toute animation de largeur, hauteur, top, left, marge ou padding.

## Motifs permis (contrat « La liste des engagés »)

- Les épingles seulement sur le dossard de la page coureur et sur les dossards du jeu (`Pins` est
  importé par `GuessBib.tsx`, `MysteryBib.tsx` et `RiderView.astro`, nulle part ailleurs). Le petit
  dossard du jeu sur l’accueil n’en porte pas (`_home.scss`, `.home-game-bib`).
- De grands chiffres d’affichage : le rang imprimé comme un numéro de dossard.
- Une bande d’encre en capitales espacées.
- Des filets entre les valeurs d’une ligne imprimée.

## Cases vides et dossard rouge (jeu)

Les cases à venir sont des contours en pointillé (`--tarmac-line`) numérotés ; la case active a un
contour plein. La cinquième, vide ou active, montre déjà sa colonne rouge et son « 5 » en Tyvek.

## Partage (jeu)

`src/game/share.ts` : une ligne en clair (« Ucicle #N, trouvé en 3/5 🚴 »), une ligne par essai
(âge, taille, poids, pays, équipe) en 🔺 (valeur du mystère plus haute), 🔻 (plus basse),
🟦 (même), ⬛ (différent), puis le lien. 🟦 est la seule tuile bleue : une ligne gagnante est la
seule ligne toute bleue. Jamais le nom du coureur.

## À faire

- Tirer chaque valeur des tokens ; ajouter un nouveau token dans `_tokens.scss`.
- Garder le bleu pour « même » et le rouge pour le 5 et la défaite, dans le jeu.
- Écrire chaque texte dans `src/content/` en FR et EN.
- Garder les balises de tête dans le HTML rendu (`Base.astro`).
- Imprimer chaque chiffre de l’index en Archivo bande 800, chiffres tabulaires.

## Ne pas faire

- Du bleu, du rouge ou du vert dans l’index (hors les deux exceptions de « Couleurs »).
- Des épingles sur une bande, une liste, un tableau, un graphique ou une image d’aperçu (l’image
  `og/index.png` n’en a pas, décision r3-1).
- Une information répétée dans la même vue : quand un bloc doit changer de place selon la largeur,
  il est imprimé deux fois et la CSS n’en montre qu’un en `display: none` (ligne calculée et note du
  classement, `_ranking.scss:62-89` ; pagination). L’aparté du dossard dit la saison, pas la
  dernière course déjà imprimée sur le dossard (décision E2).
- Des boîtes autour des valeurs sur Tyvek ; une légende évidente ; un chiffre de joueurs ou un
  pourcentage global.
- U+202F (espace fine insécable) entre une valeur et son unité dans un texte en Archivo : Archivo
  la dessine avec une largeur nulle. Utiliser U+00A0.
- U+2014 (tiret cadratin), nulle part : ni dans le texte, ni dans le code, ni dans les documents.
- Le nom du coureur du jour dans une URL, un partage, une image d’aperçu, ou sur l’accueil (indexé :
  `HomeView.astro` ne lit que la date de l’étape).

## Images (`public/`)

- `og/ucicle.png` (FR) et `og/ucicle-en.png` (EN), 1200 × 630 : la marque, la promesse, un dossard
  mystère et un tableau en cours. Utilisées par le jeu, l’accueil et À propos.
- `og/index.png` et `og/index-en.png`, 1200 × 630 (décision D4) : sur le bitume, la marque,
  « L’index des coureurs cyclistes », une phrase sur le périmètre (« Hommes élite, courses UCI sur
  route. Recalculé chaque nuit. »), et une liste des engagés vierge sur Tyvek (bande d’encre « Liste
  des engagés / Index Ucicle », rangs 1 à 6 dans la colonne d’encre, lignes vides), sans épingles.
  Aucun nom de coureur, aucun chiffre qui date. Utilisées par le classement, les pages coureur, la
  méthode, la recherche et les pages d’erreur (`Base.astro`, `GAME_PAGES`).
- `apple-touch-icon.png` (180), `favicon-32.png`, `favicon-48.png` : un dossard au « ? » en Archivo.
- Aucune image tierce, aucune photo de coureur, aucun logo d’équipe ou de course.
