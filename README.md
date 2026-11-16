# Ucicle

Daily guessing game: find the mystery pro cyclist of the day in 5 tries.
Inspired by [Wordle](https://www.nytimes.com/games/wordle/index.html) and [Poeltl](https://poeltl.dunk.town/).

## Rules

- **One mystery rider per day**, drawn from the **UCI top 100**. A new one is published every day at 05:00 (cron `0 5 * * *`).
- You can guess any rider from the **UCI top 1000**.
- **5 tries** maximum.
- **Starting hint**: the mystery rider's best result, e.g. *"2 times 1st of the mountains classification of Tour de France in 2022 and 2023"*.
- **After each guess**, every attribute is compared to the mystery rider:

  | Attribute            | Feedback                                                       |
  |----------------------|----------------------------------------------------------------|
  | Age, height, weight  | `=` same · ↑ mystery rider's value is higher · ↓ it is lower   |
  | Country, team        | 🟩 same · 🟥 different                                          |

- **End of game**: right name → win. 5th wrong guess → lose. The answer is revealed and a *Share* button copies the result (`🎉 (3/5) 🟥🟥🟩`) to the clipboard.
- **No account**: today's game and the stats (games played, wins, win rate, history) live in the browser's `localStorage`.

## Architecture

```mermaid
flowchart LR
  PCS[procyclingstats.com] -- scraping --> FN[functions/<br>Scaleway Serverless Function]
  FN -- writes api/riders.json<br>and api/secret_rider.json --> BK[(Scaleway Object Storage<br>bucket = static website)]
  BK -- index.html, JS, api/*.json --> FR[front/<br>React app in the browser]
  FR <--> LS[(localStorage<br>game history)]
```

**No backend at runtime.** The bucket serves the static site *and* the two JSON files. All game logic (comparisons, win/lose, stats) runs in the browser.

| Folder       | Stack                                        | Role                                                      |
|--------------|----------------------------------------------|-----------------------------------------------------------|
| `front/`     | React 18, TypeScript, Vite, MUI, SCSS        | Game UI, FR/EN. Reads `/api/*.json`, stores history locally. |
| `functions/` | Node.js, TypeScript, jsdom, AWS S3 SDK       | Scrapes rider data and publishes the game files to the bucket. |

### Data jobs (`functions/`)

A single entry point, `handler` in [functions/src/index.ts](functions/src/index.ts), routes on `body.action`:

| Action                  | Cron                  | What it does                                                                                       | Output                 |
|-------------------------|-----------------------|----------------------------------------------------------------------------------------------------|------------------------|
| `LOAD_RIDERS`           | `0 0 1 * *` (monthly) | Scrapes the UCI top 1000 from procyclingstats (10 pages of 100, 5 riders at a time). Drops riders with incomplete data. | `api/riders.json`      |
| `GENERATE_SECRET_RIDER` | `0 5 * * *` (daily)   | Picks a random rider with UCI rank ≤ 100 from `riders.json`.                                       | `api/secret_rider.json`|

### Data contract

```ts
Rider       = { rank, name, country, age, weight, height, team, bestResult }
BestResult  = { race, rank, raceType: 'GC' | 'Point GC' | 'KOM' | 'stage' | 'race', recurrence, years[] }
GameSession = { date: 'YYYYMMDD', rider }   // content of secret_rider.json
```

⚠️ These types are **duplicated** in `front/src/types/` and `functions/src/types/`. Change both together.

### Repository layout

```
.github/workflows/  ci.yml: lint + build on every push/PR · cd.yml: deploy on master
front/src/
  App.tsx           game flow (fetch data, handle guesses, win/lose)
  components/       hint card, rider select, guess table, result card, modals
  services/         gameService: localStorage history + share
  i18n/             fr.ts / en.ts
  types/            Rider, GameSession…
functions/src/
  index.ts          serverless handler (action router)
  main.ts           local run: LOAD_RIDERS then GENERATE_SECRET_RIDER
  handlers/         one file per action
  scrappers/        procyclingstats HTML parsing
  s3/               upload to the bucket
```

## Getting started

Node 26 (LTS) and Yarn. Each part pins its version in its own `.nvmrc` ([front/.nvmrc](front/.nvmrc), [functions/.nvmrc](functions/.nvmrc)).

```bash
# Front: http://localhost:5173, /api is proxied to the production bucket
cd front && yarn && yarn start
```

```bash
# Functions: runs both jobs locally. Needs a .env (see below) and WRITES to the bucket.
cd functions && yarn && yarn build && node build/main.js
```

## Deployment

Automatic on push to `master` ([cd.yml](.github/workflows/cd.yml)), each part runs `yarn cd`:

- **front**: `vite build`, then uploads `build/` to the bucket (public-read).
- **functions**: sets the Scaleway Function runtime from `.nvmrc` (`node26`), zips `build/` + `node_modules`, uploads it to the Scaleway Function `FUNCTION_ID` and deploys it.

| Variable       | Used by          | Description                               |
|----------------|------------------|-------------------------------------------|
| `ACCESS_KEY`   | front, functions | Scaleway access key (secret)              |
| `SECRET_KEY`   | front, functions | Scaleway secret key (secret)              |
| `DOMAIN`       | front, functions | Object Storage endpoint domain            |
| `REGION`       | functions        | Scaleway region (e.g. `fr-par`)           |
| `BUCKET_NAME`  | front, functions | Bucket hosting the site and the JSON files |
| `FUNCTION_ID`  | functions (CD)   | Scaleway Function to deploy               |

The function's crons and memory (4 GB min) are configured in Scaleway, not in this repo.

### Hosting (Scaleway project `ucicle`)

| Piece                          | Configuration                                                                                                                                                        |
|--------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `https://www.ucicle.fr`        | Edge Services pipeline `ucicle-fr` (Starter plan): managed Let's Encrypt certificate → bucket `ucicle.com` in website mode, no cache stage. Its `www` CNAME is managed by Edge Services, don't edit it. |
| `https://ucicle.fr`            | `ALIAS` → function `ucicle-apex-redirect` (custom domain `ucicle.fr`, managed certificate), which answers `301` to `https://www.ucicle.fr` + path. Source: [apex-redirect/handler.js](apex-redirect/handler.js), deployed by hand. The Edge Services Starter plan allows a single domain (head stage), hence this function for the apex. |
| Bucket `ucicle.com`            | Site + `api/*.json`, public read.                                                                                                                                     |
| Function `ucicle-load-riders`  | Namespace `functions-ucicle`. Crons (UTC): `load-riders` `0 0 1 * *`, `secret-rider` `0 5 * * *`. Secrets `ACCESS_KEY`/`SECRET_KEY` = IAM application `ucicle-function` (Object Storage on the project). |
| GitHub `ACCESS_KEY`/`SECRET_KEY` | IAM application `ucicle-ci` (Object Storage + Functions on the project).                                                                                            |

## Conventions

- CI (`yarn ci`: ESLint + build) must pass for both `front/` and `functions/`.
- Every UI string goes in **both** `front/src/i18n/fr.ts` and `en.ts`.
- Keep the `Rider` types in sync between `front/` and `functions/`.
- SCSS structure: see [front/assets/scss/README.md](front/assets/scss/README.md).

More details: [front/README.md](front/README.md) · [functions/README.md](functions/README.md)

## License

[MIT](LICENSE)
