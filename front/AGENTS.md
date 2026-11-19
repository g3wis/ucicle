# Ucicle front : guide pour l’IA qui maintient le site

Ce fichier dit où se fait chaque type de changement, quelles règles de design et d’écriture
tenir, quelles commandes lancer et quoi vérifier avant de pousser. Il vaut pour tout le dossier
`front/`.

Lire aussi : `PRODUCT.md` (le produit, les faits, ce qui ne s’invente pas) et `DESIGN.md` (le
système de design tel qu’il est codé, jeu et index).

## Le site en bref

Astro 7 en mode serveur (`astro.config.mjs` : `output: 'server'`, adaptateur `@astrojs/node`
autonome, `trailingSlash: 'always'`). Les pages de l’index (accueil, classement, pages coureur,
méthode, recherche) sont rendues à la demande depuis PostgreSQL ; le jeu et À propos sont
prérendus (`export const prerender = true`). Le jeu est une île React (`src/app/GameIsland.tsx`).
Les chemins sont écrits à la main par langue (`src/app/nav.ts`) : pas de routage i18n d’Astro, pas
de redirection automatique.

| Page | FR | EN | Rendu |
|---|---|---|---|
| Accueil | `/` | `/en/` | à la demande, cache court (l’étape du jour change à 05:00 UTC) |
| Jeu | `/jeu/` | `/en/play/` | prérendu |
| À propos | `/a-propos/` | `/en/about/` | prérendu |
| Classement | `/classement/`, `/classement/<p>/` | `/en/ranking/`, `/en/ranking/<p>/` | à la demande ; `/classement/1/` répond 301 |
| Méthode | `/classement/methode/` | `/en/ranking/method/` | à la demande |
| Coureur | `/coureurs/<slug>/` | `/en/riders/<slug>/` | à la demande ; ancien slug : 301 ; `/coureurs/` : 301 vers le classement |
| Recherche | `/recherche/?q=` | `/en/search/?q=` | à la demande, `no-store`, hors index |
| 404, 500 | `src/pages/404.astro`, `500.astro` | langue tirée du chemin | |
| API | `/api/riders.json`, `/api/secret_rider.json` (fichiers du jeu), `/api/recherche` (liste de la recherche), `/api/fiche/` (302 de la fin du jeu vers la page du coureur) | | |
| Sitemaps | `/sitemap-index.xml`, `/sitemaps/<nom>.xml` | | écrits à la main (`src/server/sitemaps.ts`) |

## Où se fait quoi

| Je veux changer… | Fichier |
|---|---|
| Une route, son statut HTTP, son cache | `src/pages/` (un fichier par route et par langue ; la route appelle le chargeur, pose le cache avec `cachePage` ou `noStore` de `src/server/http.ts`, puis rend la vue) |
| Ce qu’une page de l’index affiche | `src/views/<page>/` : la vue `*View.astro` et son chargeur `load.ts` (requêtes SQL de cette page). Pages avec chargeur : `home`, `ranking`, `rider`, `method`, `search` ; `notFound`, `about` et `game` n’en ont pas |
| Une lecture partagée par plusieurs pages (version de l’index, coureur classé) | `src/server/index-data.ts` |
| La connexion à la base | `src/server/db.ts` (lecture seule, `DATABASE_URL` lu à l’exécution, `DATABASE_POOL` optionnel, abandon de connexion après 5 s) |
| Les fichiers du jeu servis sur `/api/*.json` | `src/server/gameData.ts` (`GAME_DATA_DIR` sur le serveur, sinon relais du bucket `GAME_DATA_ORIGIN`, HTTPS par défaut) |
| Les sitemaps | `src/server/sitemaps.ts` (coureurs provisoires exclus, `lastmod` = dernier changement d’index) |
| Un texte visible (FR et EN) | `src/content/` : `common.ts` (coquille, jeu), `help.ts`, `stats.ts`, `about.ts`, `meta.ts` (balises de tête du jeu et d’À propos, images d’aperçu), `index-common.ts` (vocabulaire partagé de l’index : statuts, recherche, erreur serveur), `home.ts`, `ranking.ts`, `rider.ts`, `method.ts`, `search.ts`. Les types sont dans chaque fichier, ou dans `types.ts` pour `common` |
| Le titre, la description, l’aperçu de lien d’une page | les props `title`, `description`, `ogTitle`, `ogImage`, `jsonLd` passées à `src/layouts/Base.astro` par la vue ; les textes viennent de `src/content/` |
| Un format (date, index, ordinal, évolution, nation, unité) | `src/i18n/format.ts` |
| Le nom d’un championnat ou d’une course | `src/i18n/races.ts` (`championshipName`, `competitionName` : championnats nommés dans la langue du lecteur, décision D1) |
| Les chemins, sections et pages | `src/app/nav.ts` (`PAGES`, `SECTIONS`, `riderPath`, `rankingPagePath`, `rankAnchor`, 50 rangs par page) |
| Une couleur, une taille, un espacement, un rayon, une durée | `assets/scss/_tokens.scss` (et `src/motion/tokens.ts` pour les durées et courbes utilisées en JS) |
| Le style d’un composant ou d’une page | `assets/scss/components/` (dont `_strip.scss`, `_page.scss` pour l’index) et `assets/scss/pages/` (`_home`, `_ranking`, `_rider`, `_method`, `_search`, `_game`, `_about`) ; ordre d’import dans `app.scss` |
| L’en-tête, le pied de page | `src/components/shell/Header.astro`, `Footer.astro`, `assets/scss/components/_header.scss`, `_footer.scss` |
| La liste des engagés, l’évolution ▲ ▼ | `src/components/index/StartList.astro`, `Delta.astro`, `assets/scss/components/_strip.scss` |
| La recherche de coureur, « Aller au rang » | `src/components/search/RiderSearch.astro`, `rider-search.ts`, `RankJump.astro`, `src/pages/api/recherche.ts`, `assets/scss/pages/_search.scss` |
| Le dossard coureur, l’historique, les résultats | `src/views/rider/RiderView.astro`, `HistoryChart.astro`, `ResultRace.astro`, `ResultItem.astro`, `rows.ts`, `assets/scss/pages/_rider.scss` |
| Le dossard du jeu (bandes, épingles, cases, bande d’équipe) | `src/components/GuessBib.tsx`, `Cell.tsx`, `Pin.tsx`, `assets/scss/components/_bib.scss`, `_cells.scss` |
| Le dossard mystère (indice, faits prouvés, retournement, score) | `src/components/MysteryBib.tsx`, `KnownStrip.tsx`, `assets/scss/components/_mystery.scss`, `_known.scss` |
| La saisie du coureur du jeu | `src/components/RiderCombobox.tsx`, `assets/scss/components/_combobox.scss` |
| La page de jeu (ordre, fin d’étape, défilements) | `src/app/GamePage.tsx`, `src/app/GameIsland.tsx`, `src/views/game/GameView.astro`, `assets/scss/pages/_game.scss` |
| La logique du jeu (comparaison, sauvegarde, stats, partage, compte à rebours) | `src/game/*.ts` |
| Un code pays ou un nom de pays du jeu | `src/data/countries.ts` |
| Une section de navigation (Équipes, Courses) | `src/app/nav.ts`, `SECTIONS` : passer `visible: true` une fois la section livrée (Jeu et Classement sont visibles) |
| La date de l’« Étape 1 » | `src/game/stage.ts`, `STAGE_ORIGIN` (ne plus jamais la changer une fois publiée : les résultats partagés citent le numéro) |
| Les images d’aperçu, favicons, icône tactile | `public/` (rendus à partir du design, sans image tierce ; voir `DESIGN.md`) |
| `robots.txt` | `public/robots.txt` (bloque la recherche et les API de recherche) |

## Règles de design

Le détail est dans `DESIGN.md`. L’essentiel :

- Fond bitume ; dossards, bandes et feuilles en Tyvek imprimés à l’encre.
- Jeu : le bleu (`--same`) veut dire « comme le coureur mystère », et rien d’autre ; le rouge
  (`--red`, `--red-on-tarmac`) est réservé au cinquième dossard et à la défaite (X/5).
- Index : ni bleu, ni rouge, ni vert. Une évolution se dit par son signe, une flèche et une phrase
  pour les lecteurs d’écran (`Delta.astro`).
- Un état est toujours dit trois fois : remplissage, icône, texte. Jamais la couleur seule.
- Typographie : Archivo pour les numéros (62 %, 900), les bandes et titres (75 %, 800, capitales
  espacées) et tous les chiffres de l’index (75 %, 800, chiffres tabulaires) ; Atkinson
  Hyperlegible Next pour le reste.
- Sur le Tyvek, les valeurs sont imprimées sur une ligne réglée (filets entre les valeurs), jamais
  dans des boîtes.
- Les épingles n’existent que sur les dossards du jeu et sur le dossard de la page coureur. Jamais
  sur une bande, une liste, un tableau ou un graphique.
- Mouvement : 140 à 420 ms ; un seul dépassement (la pose d’un dossard) ; un seul retournement
  (le dossard mystère) ; ni confettis, ni lueur, ni parallaxe, ni boucle ; jamais d’animation de
  largeur, hauteur, top, left, marge ou padding ; rien déclenché par le défilement. Toute
  transition CSS va dans `@media (prefers-reduced-motion: no-preference)` ; tout survol dans
  `@media (hover: hover) and (pointer: fine)`.
- Pas d’information superflue ni répétée : pas de légende évidente, pas de texte de remplissage,
  chaque lien une seule fois par vue.
- Mobile d’abord : 390 px est la référence ; pas de défilement horizontal jusqu’à 320 px ; cibles
  de 44 px.

## Règles d’écriture

- Tutoiement dans le jeu, phrases courtes, vocabulaire du peloton (étape, départ, dossard,
  engagés). Même registre en anglais.
- Aucun texte dans les vues : tout passe par `src/content/`, en français et en anglais, avec les
  mêmes clés (le type de chaque fichier l’impose). Les nombres et les noms sont calculés par la
  vue ; le contenu ne fait que mettre des mots autour.
- Typographie française : espace insécable U+00A0 avant « : » et « ? » et à l’intérieur des
  guillemets « » (écrite ` ` dans les gabarits : ESLint refuse le caractère brut ; règle
  rappelée en tête de `src/content/about.ts` et `help.ts`). Apostrophes typographiques (’).
  Ordinaux « 1er », « 2e » (`formatOrdinal`).
- U+202F (espace fine insécable) seulement dans un texte composé en Atkinson (« ; » de
  `home.ts`, « ≥ » de `common.ts`). Dans un texte en Archivo, une unité suit sa valeur avec U+00A0
  (« 1,76 m ») : Archivo dessine U+202F avec une largeur nulle (décision E7).
- Jamais le caractère U+2014 (tiret cadratin), nulle part. Le signe moins d’une évolution est
  U+2212 (`formatDelta`).
- L’index ne s’appelle jamais « classement UCI » ; les résultats depuis 2020 ne s’appellent jamais
  « palmarès » (`PRODUCT.md`).
- Rien d’inventé : pas de chiffre de joueurs, pas de pourcentage global, pas d’avis, pas de date
  « mis à jour » qui ne soit pas la fin de la dernière collecte réussie (`job_run`). Un fait
  inconnu reste générique à l’écran et prend un commentaire `// OWNER:` dans le fichier de
  contenu (la garde de lancement les liste).
- Le nom du coureur du jour ne va jamais dans une URL, un texte de partage, une image d’aperçu ni
  sur l’accueil (indexé).
- Les noms de championnat passent par `competitionName()` (`src/i18n/races.ts`), jamais le nom UCI
  brut.

## Commandes

Node 26 (`.nvmrc`), Yarn.

```bash
yarn                        # installer
yarn start                  # astro dev, http://127.0.0.1:4321 (port par défaut d’Astro)
yarn build                  # astro build dans dist/, puis la garde de lancement (scripts/launch-guard.js)
yarn preview                # le serveur de production construit : node dist/server/entry.mjs (HOST, PORT)
yarn typescript             # astro check (types des .ts, .tsx et .astro)
yarn eslint                 # ESLint sur src (.ts, .tsx ; les .astro ne sont pas lintés)
yarn stylelint              # stylelint sur assets/scss (hors CI)
yarn ci                     # ce que la CI exécute : install, eslint, typescript, build
node scripts/snapshot.mjs   # build, serveur local sur un port libre, HTML des routes dans snap/
```

Variables d’environnement lues par le serveur (jamais figées dans le build) :

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | PostgreSQL de l’index (tables de `functions/SCHEMA.md`). Sans elle, les pages de l’index échouent ; l’accueil dit que les données ne répondent pas |
| `DATABASE_POOL` | taille du pool (5 par défaut) |
| `GAME_DATA_DIR` | dossier qui contient `riders.json` et `secret_rider.json` ; sans lui, relais de `GAME_DATA_ORIGIN` |
| `GAME_DATA_ORIGIN` | origine des fichiers du jeu (défaut : le bucket Scaleway en HTTPS) ; une origine en HTTP non locale déclenche un avertissement |
| `HOST`, `PORT` | adresse du serveur de production (`dist/server/entry.mjs`) |

`scripts/snapshot.mjs [--no-build] [--routes routes.json]` lit `DATABASE_URL` (défaut :
`postgres://ucicle@127.0.0.1:5433/ucicle`, la base locale de travail). Il construit le site, démarre
`dist/server/entry.mjs` sur un port libre, copie `dist/client` dans `snap/`, écrit le HTML de
chaque route (accueil, jeu, À propos, classement page 1 et 2, méthode, recherches, fichiers du jeu,
deux 404, et trois coureurs classés plus un provisoire lus en base, en FR et EN) dans
`snap/<chemin>/index.html`, et le rapport dans `snap/_snapshot.json`. Il sort en 0 seulement si
chaque route a répondu le statut attendu. `snap/` est une copie statique qu’un navigateur sans tête
peut capturer depuis le disque ; elle est ignorée par git.

## Données

Le front ne fait que lire. Tout ce qu’il lit est écrit par `functions/` :
- `functions/README.md` : la collecte UCI DataRide (`yarn collect`), le calcul de l’index
  (`yarn rate`), l’enrichissement Wikidata, les tâches du jeu.
- `functions/SCHEMA.md` : les tables, la section « Rating engine » (formule, statuts, paramètres
  dans `rating_version.parameters`), les requêtes de lecture.
- Après chaque `yarn collect --recent 14`, `yarn rate` recalcule tout et remplace la version en une
  transaction : le site lit toujours une version complète (`rating_version.is_current`).
- La page méthode lit chaque nombre dans la version courante : changer un paramètre de l’index se
  fait dans `functions/src/rating/params.ts`, pas dans `src/content/method.ts`.
- Le déploiement du serveur est décrit dans `deploy/README.md`.

## Avant de pousser

1. `yarn eslint`, `yarn typescript` et `yarn build` sortent en 0.
2. Les deux langues ont les mêmes clés de contenu, et le texte se lit dans les deux.
3. Aucun U+2014 dans le code ni le contenu (`grep -rn "$(printf '\342\200\224')" src assets` ne sort rien).
4. Avec une base remplie, `node scripts/snapshot.mjs` sort en 0 (toutes les routes au bon statut).
5. À 390 px : pas de défilement horizontal (ni à 320 px) ; l’accueil montre le H1, le bloc du jeu
   et le début du top 10 ; le jeu montre le dossard mystère et la saisie.
6. À 1024 px : les rails du classement et de la recherche, les deux colonnes de la page coureur ; à
   1200 px, le rail de la méthode.
7. Avec « réduire les animations » activé dans le système : plus de déplacement, des fondus
   seulement.
8. Au clavier : la recherche (flèches, Entrée ouvre le coureur, Échap ferme la liste), « Aller au
   rang », les `<details>` des saisons et des lignes de résultat, le jeu de bout en bout ; les
   panneaux gardent le focus et le rendent à la fermeture.
9. Les balises de tête (titre, description, canonique, hreflang, Open Graph) sont dans le HTML
   servi ; une page provisoire ou de recherche porte `noindex`.

## Ce que le propriétaire doit encore fournir

`scripts/launch-facts.json` liste les faits à fournir ou confirmer avant la mise en ligne (mentions
légales, date de l’étape 1, lien de signalement d’erreur, engagement « sans publicité », données
du jeu à rafraîchir, vérification gzip après le premier déploiement, conditions de réutilisation
de DataRide, serveur et DNS, doublons de coureurs, images d’aperçu par coureur, question de la
liste des engagés en feuille). `scripts/launch-guard.js`, lancé par `yarn build`, affiche ceux dont
`confirmed` est `false` et chaque marqueur `OWNER:` des fichiers de `src/content/`. Il n’échoue
jamais, sauf avec `LAUNCH_STRICT=1`. Quand le propriétaire confirme un fait, passer son
`confirmed` à `true` ; ne jamais inventer la réponse.
