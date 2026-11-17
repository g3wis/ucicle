# Ucicle: product

Facts only. Every statement here comes from the repository, the live data, or the owner's
answers of 2026-11-16. What is not known is listed under "Never invented".

## Platform

Web, mobile first. Static site served from a Scaleway Object Storage bucket in website mode
behind `https://www.ucicle.fr` (apex `ucicle.fr` redirects). No backend at runtime: the bucket
serves the HTML, the bundles and two JSON files, `/api/riders.json` and `/api/secret_rider.json`.

## Stack

React 18, TypeScript 4.9 compiled by `ttsc` to `ts-built/`, then bundled by Vite 4. SCSS.
`motion` 14.9 for animation. Fonts self-hosted through @fontsource (Archivo Variable, Atkinson
Hyperlegible Next Variable). No UI kit (MUI removed in the redesign).

## Users

Cycling fans who know the peloton and read a data table fast (owner's answer). French first,
English second. They arrive on a phone, most often from a result a friend shared in a group chat
(WhatsApp, X, Bluesky, Strava club).

## Product purpose

A free daily guessing game: find the mystery pro cyclist of the day in five tries. The site will
later grow into a general database of amateur and pro riders, teams and races; the game is the
first section and must stay first.

## Positioning

The cycling daily game whose shared result reads without opening the game, and whose board reads
on a phone without relying on colour. Closest live competitors (Guess The Rider, PROCYCLE,
Cyclerly) lack one or the other (research synthesis, `.bunshin/research/synthesis.md`).

## Operating context

- One mystery rider per day, drawn from the UCI top 100, published at 05:00 UTC.
- Any rider of the published list can be guessed (685 riders, 57 countries, 116 teams on
  2026-11-16).
- Five tries. Starting hint: the mystery rider's best result.
- After each guess: age, height, weight compared (equal, mystery higher, mystery lower); country
  and team compared (same, different).
- The shared result (`src/game/share.ts`): the stage number and the score, then one row per try
  (age, height, weight, country, team): 🔺 the mystery value is higher, 🔻 lower, 🟦 equal or
  same, ⬛ different; then the URL. 🟦 is the only blue tile, so a found row is the only all-blue
  row.
- No account. Game state and stats live in the browser's localStorage, on the `www.ucicle.fr`
  origin.

## Capabilities and constraints

- Data contract: `Rider = { rank, name, country, age, weight, height, team, bestResult }`,
  `BestResult = { race, rank, raceType, recurrence, years[] }`, `secret_rider.json =
  { date: 'YYYYMMDD', rider }`. Countries are lowercase slugs ("united-states"); heights in metres
  (1.8); raceType in the live data: GC, Points GC, KOM, stage, race.
- The answer is readable client side (static JSON). It never goes into a URL, a share text or a
  preview image.
- The game key is `secret_rider.date`, not the device's local date (the mystery changes at 05:00
  UTC, not at local midnight).
- Head tags (title, description, canonical, hreflang, Open Graph) must be in the static HTML:
  link previews do not run JavaScript.
- `yarn cd` uploads `build/` to the bucket: nothing under `build/` may be named `api/`.

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

## Never invented

- Player counts, success rates across players, ratings or reviews.
- A logo beyond the wordmark; rider photographs (none owned); team short codes (not in the data:
  team names are shown in full, truncated with the full name available).
- Legal mentions, contact address, author name (the owner must supply them; the About page marks
  their place).
- The stage number origin date: the owner chooses it. Until then `STAGE_ORIGIN` in
  `src/game/stage.ts` is an assumption, listed in the report.
- A "last updated" date.
