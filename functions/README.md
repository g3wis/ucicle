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