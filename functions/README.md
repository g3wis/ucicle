# Ucicle functions

`functions` folder contains a serverless application. This application provides handler which redirect to functions designed to generate game datas:
* `handleLoadRiders` generates riders database
* `handleGenerateSecretRider` generates the daily secret rider

## handleLoadRiders

The aim of this function is to retrieve the list of the top 1000 UCI (Union Cycliste Internationale) riders once a month. This list will be saved in an s3 service. Only riders with complete data (team, country, height, weight, best result) are saved, and nothing is uploaded when fewer than 300 riders (or 50 of the top 100) are complete.

### Data sources

procyclingstats.com, the previous source, now answers every automated client with a Cloudflare challenge (HTTP 403), so the data comes from open sources:

| Field                              | Source                                                                                                                                  |
|------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| rank, name, country, age, team     | [UCI World Ranking](https://dataride.uci.ch/iframe/rankings/10) (men elite, road), served as JSON by UCI DataRide: one request for the top 1000 |
| name (display spelling)            | English label on [Wikidata](https://www.wikidata.org), matched by "UCI rider ID" (P11020), else by date of birth and name                |
| height, weight                     | Wikidata (P2048, P2067), else the infobox of the English Wikipedia article                                                               |
| bestResult                         | The rider's UCI results of the last 52 weeks (DataRide): the result worth the most UCI points, and how many times the rider got it      |

Teams are the official UCI names (uppercase). The best result covers the ranking window (last 52 weeks), not the whole career.

DataRide answers each rider's results in 2 to 6 seconds, so a run takes about 15 minutes (4 requests in flight): the Scaleway function timeout must allow it.

### Local run

```bash
yarn build && yarn load:local [output file]   # default: build/riders.local.json
```

Builds the riders list and writes it to a file, without touching the bucket. `HTTP_USER_AGENT` overrides the User-Agent sent to the data sources.

### Configuration

| parameter    | value     |
|--------------|-----------|
| cron trigger | 0 0 1 * * |
| endpoint     | -         |

## handleGenerateSecretRider

The purpose of this lambda is to randomly retrieve a rider from the riders list and register it in a s3 service.

| parameter    | value     |
|--------------|-----------|
| cron trigger | 0 5 * * * |
| endpoint     | -         |

## Node version

The Node major version is pinned in [`.nvmrc`](.nvmrc), the single source of truth:
* CI and CD install this version (`node-version-file` in the workflows).
* `deploy.js` sets the Scaleway Function runtime to `node<version>` before each deployment if it differs.

To upgrade Node, change `.nvmrc` (and `engines` in `package.json`), check that the runtime exists in the [Scaleway runtimes list](https://www.scaleway.com/en/docs/serverless-functions/reference-content/functions-runtimes/), then merge to `master`.

## Environment variables

| variable    | description                            |
|-------------|----------------------------------------|
| ACCESS_KEY  | access key for accessing the s3 bucket |
| SECRET_KEY  | secret key for accessing the s3 bucket |
| DOMAIN      | domain of the s3 service endpoint      |
| REGION      | s3 region                              |
| BUCKET_NAME | bucket used to store uci riders        |

## Configuration of the serverless instance

| parameter  | value     |
|------------|-----------|
| runtime    | `node26` (Node 26 LTS) |
| min memory | 4GB       |
| cron       | 0 0 1 * * |
| endpoint   | -         |

## Index data

The Index Ucicle reads every men elite road result since the 2019 season from UCI DataRide, stored in PostgreSQL.
The tables are documented in [`SCHEMA.md`](SCHEMA.md); the migrations are the numbered SQL files of
[`migrations/`](migrations/). Nothing here touches the game jobs, the bucket or `.env`.

```bash
yarn build
export DATABASE_URL=postgres://user@host:5432/ucicle   # required
export RAW_ARCHIVE_DIR=/path/to/archive                 # optional, default functions/.data/raw (git-ignored)

yarn migrate                                            # applies the pending migrations
yarn collect --seasons 2027,2026 [--limit-competitions N] [--competition ID,ID] [--refresh]
yarn collect --recent 14                                # nightly: competitions touching the last 14 days
```

- **Full mode** (`--seasons`): loads the UCI ranking of every season since 2019 (the registry of riders, at most
  once a week for open seasons), the calendar of the given seasons, then for each started competition its races,
  classifications and results. Idempotent and resumable: a competition fetched after its end, or a classification
  fetched after its day, is skipped unless `--refresh`. `--limit-competitions N` takes a mix of finished stage
  races, one-day races and championships; `--competition` restricts to DataRide competition ids.
- **Nightly mode** (`--recent N`): re-fetches and upserts the competitions of the current seasons whose dates
  touch the last N days (DataRide's `IsDone` is always false and late corrections happen); the registry is
  reloaded when older than a week. `--registry` forces the registry, `--no-registry` skips it.
- Each run writes a `job_run` row (requests, rows inserted, updated and deleted, errors, oldest changed date) and
  one log line per competition. A second run refuses to start while one is alive (`--force` overrides).
- Every raw DataRide response is archived gzipped under `RAW_ARCHIVE_DIR/dataride/`.
- Politeness: read endpoints only, at most 4 requests in flight, 500 ms pause per worker, pages of at most 1000
  rows, exponential backoff on 429, 5xx, timeouts and HTTP 200 answers that are not the expected JSON.
  `HTTP_USER_AGENT` overrides the User-Agent.

## Index rating

The Index Ucicle (an Elo-type rating of every men elite road rider, section 9 of the research synthesis) is
computed from the collected results by `src/rating/` and written to `rating_version`, `rating_change`,
`rider_rating` and `ranking_snapshot` (documented in [`SCHEMA.md`](SCHEMA.md), section "Rating engine").

```bash
yarn build
export DATABASE_URL=postgres://user@host:5432/ucicle

yarn migrate                 # 0002 adds rating_change.w_class/w_type, rating_version.as_of_date/summary and indexes
yarn check:rating            # formula checks on hand-made fields: monotonicity, |delta| <= K x m, zero sum, multipliers
yarn calibrate               # grid of 405 settings, train 2020-2023, test 2024-2025 (needs seasons 2019-2025 collected)
yarn calibrate --quick       # pruned grid (K_base x w_stage, then N and minimum field at the best of them)
yarn calibrate --levels      # grid of the lower levels: entry index at CN and .2, K multiplier in .2 races (the five others frozen)
yarn calibrate --freeze      # also writes the chosen values and metrics into src/rating/params.ts (then yarn build && yarn rate)
yarn rate                    # full recompute with the frozen parameters, replaces the rows of version v1 in one transaction
yarn rate --dry-run          # same computation and summary, nothing written
yarn enrich:wikidata         # QID, labels, height, weight, Wikipedia links by P11020; better display names
```

- **Deterministic and idempotent**: every `yarn rate` recomputes the whole history from zero (2019 is the warm-up,
  nothing before 2020-01-01 is ranked) and rewrites version `v1` inside one transaction, so the website never reads a
  half-written version. Run it after each collector run (nightly, after `yarn collect --recent 14`). It reads the
  data in one read-only snapshot, so it can run while the collector writes.
- **Parameters**: `src/rating/params.ts`. `yarn calibrate` prints the table of every setting (test log loss of the
  pre-race E over the counted duels, share of duels whose winner was predicted, the UCI World Ranking as baseline),
  stores the chosen setting and its metrics in `rating_version.parameters.calibration`, and prints the values to
  freeze in `FROZEN_VALUES` and `FROZEN_CALIBRATION` (`--freeze` rewrites that block of `params.ts` itself, with
  `FROZEN_ON` = today, the date in the label "Index v1 (<date>)"). Freezing new values is a new published index:
  date it. Every setting is evaluated on the same duels: those counted under the synthesis defaults (top 30 / top 15,
  at least 10 finishers). `--levels` prints, for each setting of `LEVEL_GRID`, the test duels by level of the race and
  the scale gap between the riders of the upper levels and those who only raced CN and .2, and stores its record in
  `rating_version.parameters.level_calibration` (`FROZEN_LEVEL_CALIBRATION` once frozen). The K multiplier stops at
  2.5 (owner's bound: a .2 race weighs at most as much as a WorldTour race).
- **Output**: `yarn rate` prints the classifications counted, the riders rated by status, the top 10, the mean
  index of the classified population and its drift at each season end (provisional bonuses break the zero sum).
  It takes about a minute for the whole history (reading, computing and writing about two million rows).
- **Wikidata**: read-only SPARQL, one request at a time at least one second apart, backoff on 429; no image is
  fetched. `HTTP_USER_AGENT` overrides the User-Agent.
