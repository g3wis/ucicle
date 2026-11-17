# Ucicle functions

`functions` folder contains a serverless application. This application provides handler which redirect to functions designed to generate game datas:
* `handleLoadRiders` generates riders database
* `handleGenerateSecretRider` generates the daily secret rider

## handleLoadRiders

The aim of this function is to build, once a month, the list of riders the player can guess, and save it in an s3 service:

* the top 1000 of the current UCI (Union Cycliste Internationale) World Ranking,
* the former top riders: every rider ranked in the top 100 of a UCI World Ranking since 2016 (`FORMER_RIDERS_SINCE`, `FORMER_RIDERS_TOP`), retired ones included (Froome, Nibali, Valverde…). A rider still ranked keeps their current rank and team; a rider out of the ranking gets `rank: null` and the team of the last ranking they appear in.

Riders without country (neutral athletes) are left out. A rider without team this season takes the team of the last past ranking that has one, else `team: null` (a rider of a club or a national team: the front prints "Sans équipe UCI"). Height and weight are `null` when no source has them: the front prints "?" and does not compare. The best result is only computed for the secret rider candidates, the current top 100 with a team, a height and a weight (`isSecretRiderCandidate` in [riderUtils.ts](src/utils/riderUtils.ts)): it is the starting hint, shown for no one else. Nothing is uploaded when fewer than 300 riders, or 50 secret rider candidates, are found.

### Data sources

procyclingstats.com, the previous source, now answers every automated client with a Cloudflare challenge (HTTP 403), so the data comes from open sources:

| Field                              | Source                                                                                                                                  |
|------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| rank, name, country, age, team     | [UCI World Ranking](https://dataride.uci.ch/iframe/rankings/10) (men elite, road), served as JSON by UCI DataRide in pages of 1000: the whole current ranking, and the whole ranking of every season since 2016 (for the former riders and their last team) |
| name (display spelling)            | English label on [Wikidata](https://www.wikidata.org), matched by "UCI rider ID" (P11020), else by date of birth and name                |
| height, weight                     | Wikidata (P2048, P2067), else the infobox of the English Wikipedia article                                                               |
| bestResult                         | The rider's UCI results of the last 52 weeks (DataRide): the result worth the most UCI points, and how many times the rider got it. Secret rider candidates only |

Teams are the official UCI names (uppercase). The best result covers the ranking window (last 52 weeks), not the whole career.

DataRide answers each rider's results in 2 to 6 seconds, which is why the best result is only computed for the secret rider candidates (about 90 riders, 4 requests in flight). With the season rankings (about 45 pages of 1000 riders) and Wikidata, a run took 1.5 to 4 minutes in November 2026.

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