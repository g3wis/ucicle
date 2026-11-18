# Ucicle: product

Facts only. Every statement here comes from the repository, the live data, or the owner's
answers of 2026-11-16. What is not known is listed under "Never invented".

## Platform

Web, mobile first, `https://www.ucicle.fr` (apex `ucicle.fr` redirects). Since the Index
(2026-11-17, owner's answers): an Astro server (Node) reading PostgreSQL, hosted on a Linux server
the owner provides (no serverless limits: the data jobs run there on a schedule, without time
limit). The game and About are prerendered; the home, the ranking, the rider pages and the method
are rendered on request with HTTP caching. The game's two JSON files are served on
`/api/riders.json` and `/api/secret_rider.json`: read from `GAME_DATA_DIR` on the server when set,
otherwise relayed from the Object Storage bucket the game jobs write today.

## Stack

Astro 7.4 (`@astrojs/node`, `@astrojs/react`), React 18 for the game island, TypeScript 5.9, SCSS
(Sass 1.107). `motion` 14.9 for the game's animation. postgres.js for the database. Fonts
self-hosted through @fontsource (Archivo Variable, Atkinson Hyperlegible Next Variable). No UI kit.
Data jobs in `functions/` (Node 26): the DataRide collector and the rating engine write PostgreSQL
(`functions/SCHEMA.md`).

## Users

Cycling fans who know the peloton and read a data table fast (owner's answer). French first,
English second. They arrive on a phone, most often from a result a friend shared in a group chat
(WhatsApp, X, Bluesky, Strava club).

## Product purpose

A free daily guessing game: find the mystery pro cyclist of the day in five tries. Since
2026-11-17, a second section: the Index, an Elo-type rating of every men elite road rider
computed from every UCI result since the 2019 season (2019 is a warm-up: computed, not ranked; the
ranking is published from 2020), with a page per rider (his info, his index, his
results, his history), a paginated ranking with search, and an SEO-oriented home at `/` (today's
game stage first, then the top 10 and the latest results; the game moved to `/jeu/`). The site
will later grow into a general database of amateur and pro riders, teams and races: the rating
must not depend on one data source.

Owner's words (2026-11-17): "On va ajouter un nouveau pan au site : l'index. L'objectif est de
calculer pour chaque coureur un index / ELO qui détermine un classement. [...] Il faut pour chaque
coureur une page coureur avec ses info, son index, ses résultats, son historique. Il faudra
également une page classement paginée avec recherche. Côté accueil => orienté référencement avec
également le top 10 et les derniers résultats".

## Positioning

The cycling daily game whose shared result reads without opening the game, and whose board reads
on a phone without relying on colour. Closest live competitors (Guess The Rider, PROCYCLE,
Cyclerly) lack one or the other (research synthesis, `.bunshin/research/synthesis.md`).

## Operating context

- One mystery rider per day, drawn from the current UCI top 100 (with known height, weight and best
  result), published at 05:00 UTC.
- Any rider of the published list can be guessed (685 riders, 57 countries, 116 teams on
  2026-11-16).
- Five tries. Starting hint: the mystery rider's best result.
- After each guess: age, height, weight compared (equal, mystery higher, mystery lower); country
  and team compared (same, different).
- The shared result (`src/game/share.ts`): the stage number and the score, then one row per try
  (age, height, weight, country, team): 🔺 the mystery value is higher, 🔻 lower, 🟦 equal or
  same, ⬛ different, ⬜ unknown (no height or weight for the guessed rider); then the URL. 🟦 is the only blue tile, so a found row is the only all-blue
  row.
- No account. Game state and stats live in the browser's localStorage, on the `www.ucicle.fr`
  origin.

## Capabilities and constraints

- Data contract: `Rider = { rank, name, country, age, weight, height, team, bestResult }`,
  `BestResult = { race, rank, raceType, recurrence, years[] }`, `secret_rider.json =
  { date: 'YYYYMMDD', rider }`. `rank` is null for a former rider out of the ranking; `height`
  and `weight` are null when unknown (the bib prints "?"); `team` is null for a rider of no UCI team
  ("Sans équipe UCI"); `bestResult` is null except for the
  secret rider candidates. The secret rider is always complete (`SecretRider`). Countries are lowercase slugs ("united-states"); heights in metres
  (1.8); raceType in the live data: GC, Points GC, KOM, stage, race.
- The answer is readable client side (static JSON). It never goes into a URL, a share text or a
  preview image.
- The game key is `secret_rider.date`, not the device's local date (the mystery changes at 05:00
  UTC, not at local midnight).
- Head tags (title, description, canonical, hreflang, Open Graph) must be in the static HTML:
  link previews do not run JavaScript.
- The site is an Astro server (`dist/server/entry.mjs`) deployed with Docker Compose (deploy/README.md); `/api/*.json` are its own routes.

## Brand commitments

- Name: Ucicle. Domain: www.ucicle.fr; it must not change (local stats are bound to the origin).
- Owner's charter: no superfluous information (no obvious legend, no filler); dynamic interfaces
  (dynamic calls to action, animated transitions and actions); an accessible art direction;
  standard but slightly dynamic navigation.
- Direction: "Le dossard" (`.bunshin/direction.md`).

## Evidence on hand

- The live data (`.bunshin/harvest/data/`), the current site captured (`.bunshin/harvest/`), the
  research synthesis (40 sites and documents read).
- Data source: UCI DataRide and Wikidata / English Wikipedia (commit 5cd4cbd).

## Product principles

1. Playable on arrival: no modal, no consent wall, no rules screen before the board.
2. Every state is told three ways: fill, icon, text. Never colour alone.
3. One try is precious: select, then validate. A slip of the finger never costs a try.
4. Nothing the player cannot verify: no community figures, no invented ratings, no dates the data
   does not hold.
5. The board stays strictly functional; the cycling world lives in the bib, its markers, the
   words and the motion.

## Accessibility and inclusion

WCAG 2.2 AA: text contrast >= 4.5:1, UI boundaries >= 3:1; the rider input follows the WAI-ARIA
APG combobox pattern with a visible label; one live-region sentence per guess; keyboard play end
to end; visible focus; reduced motion honoured (fades only); 44 px touch targets; no horizontal
scroll at 320 px; forced-colors keeps real borders.

## The Index (facts)

- Scope: men elite, road, UCI classes 1.UWT, 2.UWT, 1.Pro, 2.Pro (1.HC, 2.HC), 1.1, 2.1, 1.2, 2.2,
  national, continental and world championships, Olympic road race and ITT; seasons 2019
  (warm-up, not published) to today. Source: UCI DataRide (every starter of every
  classification, with DNF/DNS/OTL/DSQ). Height, weight and wiki links from Wikidata.
- Model: "Index Ucicle v1", a multi-competitor Elo by duels on the top of each finish order,
  weighted by UCI class and classification type, recomputed from zero every night. K 80, the
  owner's choice ("équilibré", 2026-11-17). Riders start at 1500, or 1250 when their first counted
  race is a national championship or a .2 race, and K is multiplied by 2.5 in .2 races (owner's
  choice of 2026-11-18, bounded so a .2 race never weighs more than a WorldTour race): without it,
  riders who only race there drifted 122 points too high (49 left with it). Test 2024-2025: winner
  picked in 75.7 % of duels, UCI World Ranking 64.1 %. Every change
  is printed with its calculation on the rider page; every parameter on the method page
  (`.bunshin/research/synthesis.md`, section 9; `functions/SCHEMA.md`).
- Statuses: provisional below 10 experience units (not in the ranking, page not indexed), inactive
  after 365 days without a counted result (index frozen, out of the ranking).
- The index is never called "classement UCI", results since 2020 are never called "palmarès".
- Pending for launch: the UCI's written answer on reusing DataRide data (no licence found).

## Never invented

- Player counts, success rates across players, ratings or reviews.
- A logo beyond the wordmark; rider photographs (none owned); team short codes (not in the data:
  team names are shown in full, truncated with the full name available).
- Legal mentions, contact address, author name (the owner must supply them; the About page marks
  their place).
- The stage number origin date: the owner chooses it. Until then `STAGE_ORIGIN` in
  `src/game/stage.ts` is an assumption, listed in the report.
- A "last updated" date that is not the end of the latest successful collection (`job_run`).
- Rider biographies, rider photographs, team or race logos; any rating not explained on the
  method page; ± intervals (v1 computes none).
