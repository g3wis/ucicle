# Index Ucicle database

PostgreSQL schema of the Index Ucicle: every men elite road result from UCI DataRide since the 2019 season,
the identity of the riders, and the outputs of the rating engine. The collector (`functions/src/collect`)
writes the race, result and identity tables; the rating engine writes the four rating tables; the website reads.

- Migrations: plain SQL files in `functions/migrations/`, applied in order by `yarn migrate`, recorded in
  `schema_migrations (version, name, checksum, applied_at)`. Never edit an applied file: add `0002_...sql`.
- No extension is used (production runs PostgreSQL 17 in the `ucicle` stack of g3wis/infra, see deploy/README.md).
- Ids are `integer generated always as identity`. Days are `date` (no time zone); instants are `timestamptz`.
- Source-agnostic: `competition`, `race`, `classification` and `result` carry `source` (`'dataride'` today) and
  `source_id` (the id in that source, as text), unique together. A later source (amateur results) adds rows with
  its own `source`, without schema change.
- Row types for TypeScript: `functions/src/db/rows.ts`.

## Scope of the data

- Men elite, road. Seasons 2019 (warm-up) to 2027. DataRide seasons run from mid-October to mid-October
  (season 2027 started on 2026-10-18).
- UCI classes kept: `1.UWT`, `2.UWT`, `1.Pro`, `2.Pro`, `1.HC`, `2.HC` (until 2019, predecessors of 1.Pro and 2.Pro),
  `1.1`, `2.1`, `1.2`, `2.2`, `CN` (national championships), `CC` (continental), `CM` (world), `JO` (Olympic Games).
  Out of scope: U23 classes (1.2U, 2.2U), JC, JR, 1.2S, CRT, CRTP, N/A.
- Classifications stored: one-day races, every stage (road, ITT, prologue), the final general classification
  of stage races, championship and Olympic road races and ITTs. Not stored: team time trials (TTT), mixed relays
  (TTM), points, mountains, youth and team classifications, intermediate GCs, women, U23 and junior races.

## Races and results

### `competition`
One event of the calendar: a one-day race, a stage race, a championship (all its races), an Olympic event.

| column | meaning |
|---|---|
| `id` | internal id |
| `source`, `source_id` | `'dataride'`, DataRide `CompetitionId` |
| `name` | name as DataRide writes it ("Liège-Bastogne-Liège", "La Vuelta Ciclista a España") |
| `class_code` | UCI class (see scope) |
| `kind` | `one_day` (class 1.x), `stage_race` (2.x), `championship` (CN, CC, CM), `olympic` (JO) |
| `is_grand_tour` | Tour de France, Giro d'Italia, Vuelta a España |
| `country_code`, `country_iso2`, `country_name` | host country: ISO 3166 alpha-3 ("ITA"), alpha-2 ("IT"), DataRide name ("ITALY") |
| `start_date`, `end_date` | first and last day (local calendar day) |
| `season` | UCI season (year) whose dates contain `start_date` |
| `source_season_id` | DataRide season id of the listing |
| `collected_at` | last time every in-scope race of it was fetched without error; null = not (fully) collected |
| `created_at`, `updated_at` | row timestamps |

The whole calendar of the collected seasons is stored, future competitions included (no races until they start).

### `race`
A DataRide race of a competition, men elite only (stages, final classification, championship races).

| column | meaning |
|---|---|
| `source`, `source_id` | `'dataride'`, DataRide `RaceId` |
| `competition_id` | competition |
| `name` | "Stage 5", "Prologue", "Final Classification", "Men Elite - Individual Time Trial"... |
| `race_code` | DataRide `RaceCode`: `S` = stage, `F` = final classification or single race |
| `race_type_code` | `IRR` road race, `ITT` time trial, `TTT` team time trial, `TTM` mixed relay |
| `category_code` | always "Men Elite" here |
| `date` | day of the race |
| `sequence` | DataRide display order |
| `in_scope` | false for team time trials and mixed relays (kept so a stage list has no hole; no classification) |

### `classification`
The unit of the Index: one complete finish order.

| column | meaning |
|---|---|
| `source`, `source_id` | `'dataride'`, DataRide `EventId` |
| `race_id`, `competition_id` | race and competition |
| `date` | day of the classification (for `gc_final`: the last day of the stage race) |
| `season` | UCI season (year) of the competition |
| `kind` | `one_day`, `one_day_itt`, `stage`, `prologue`, `gc_final`, `championship_road_race`, `championship_itt`, `olympic_road_race`, `olympic_itt` |
| `race_type` | `IRR` or `ITT` (an ITT stage is `kind = 'stage'` with `race_type = 'ITT'`) |
| `stage_number` | stage number (0 for a prologue; half stages 1a and 1b both have 1); null outside stage races |
| `stage_label` | DataRide stage name ("Stage 1b"); null outside stages |
| `class_code`, `is_grand_tour` | copied from the competition |
| `competition_name`, `race_name`, `event_name` | names as DataRide gives them ("General Classification", "Stage Classification") |
| `cancelled` | the race was cancelled (DataRide returns a single "Race Cancelled" row; no result is stored) |
| `row_count` | result rows stored (all statuses) |
| `starters_count` | riders at the start: rows minus DNS; for `gc_final`, the starters of the first stored stage (see pitfalls) |
| `finishers_count` | rows with status `FIN` |
| `winner_rider_id` | rider ranked 1 (null if cancelled) |
| `winner_name` | winner as DataRide's event list writes it ("POGAČAR Tadej") |
| `results_fetched_at` | last time its results were fetched |
| `results_changed_at` | last time a result row was inserted, changed or deleted |

### `result`
Every row DataRide returns for a stored classification, non-finishers included.

| column | meaning |
|---|---|
| `source`, `source_id` | `'dataride'`, DataRide `ResultId` |
| `classification_id`, `rider_id` | classification and rider |
| `status` | `FIN` classified; otherwise the UCI IRM code as given: `DNF`, `DNS`, `OTL` (outside time limit), `DSQ`, others possible; `NR` = no rank and no code |
| `rank` | rank, only when `status = 'FIN'` (equal ranks are possible) |
| `rank_raw` | rank text as DataRide gives it (DataRide sometimes numbers DNF rows: ignore it) |
| `position` | DataRide `SortOrder`: the full finish order, non-finishers last |
| `bib` | race number |
| `team_name` | team at the date of the race, as the UCI writes it (upper case) |
| `rider_name_raw`, `rider_birth_date`, `rider_nation_code` | the row's own identity (name "FAMILY Given", birth date, UCI nation code at that date) |
| `result_value_raw` | DataRide `ResultValue` ("5:50:28", "+45", "00:36:54.550") |
| `time_seconds` | absolute time in seconds when known |
| `gap_seconds` | gap to the winner in seconds (0 for the winner) |
| `uci_points` | UCI points of the row (null if none) |
| `match_method` | how the row was tied to the rider: `registry` (same name, birth date and nation as a UCI ranking entry), `exact` (same name and birth date), `loose` (same birth date and nation, name without accents), `created` (new rider), `manual` |

Time parsing: the first classified value is the winner's absolute time; a later value is a gap when it starts
with "+" or is smaller than the winner's time, an absolute time otherwise; "s.t." / ",," repeat the previous gap.

## Riders

### `rider`

| column | meaning |
|---|---|
| `id` | internal id (the only stable key; use it for joins) |
| `slug` | URL slug, ASCII lower case "given-family" (`tadej-pogacar`); a homonym gets "-<birth year>" (`matthew-walls-2007`), then "-2". Generated once, **never regenerated**; a changed slug must go to `rider_slug_history` |
| `display_name` | the name to show: "Given Family" in natural case built from the UCI name ("Mathieu van der Poel", "Arnaud De Lie"), or the Wikidata label when it qualifies ("Jonas Vingegaard", "Lyu Xianjing"; see "Display names from Wikidata") |
| `display_name_source` | `rules` (built from the UCI name), `wikidata` (label of the rider's Wikidata item), `manual` (never overwritten by a job) |
| `given_name`, `family_name` | parts of the display name |
| `name_raw` | the UCI form "FAMILY Given" the rider was created from |
| `search_name` | search key: display name folded to ASCII, lower case, apostrophes dropped, other punctuation as single spaces ("ben oconnor"). Fold the search input the same way (`foldToAscii` in `src/collect/names.ts`: ß→ss, æ→ae, ø→o, ł→l, đ→d, then Unicode decomposition without marks) and query `search_name like '%' || $1 || '%'` (or `like $1 || '%'`, indexed) |
| `birth_date` | date of birth (null when DataRide gives none) |
| `nation_code`, `nation_iso2`, `nation_name` | UCI nation code ("SLO"), ISO alpha-2 ("SI"), name ("SLOVENIA") when the rider was created (latest season of the registry). For the nation at a given race, read `result.rider_nation_code` |
| `created_from` | `dataride_registry` (from the UCI ranking), `dataride_result` (from a result row only), `manual` |

Display rules: the family name is the leading words in capitals; particles (van, der, de, den, da, di, du, le, la,
von, ter) are lower case except at the start, with a corrections table in `src/collect/names.ts` (Belgian and
Italian first particles capitalised, French Le/La, "van Aert"); words in another script are dropped when the name
also has Latin words ("黃 HUANG 文忠 Wen Chung" → "Wen Chung Huang"). `yarn enrich:wikidata` then replaces some of
these names by the Wikidata label (rules below); `slug` and `search_name` keep the rule-built form, so a search by the
full UCI name or by the label both work (`like '%' || $1 || '%'`).

#### Display names from Wikidata

Applied by `yarn enrich:wikidata` (`nameFromLabel` in `src/enrich/wikidata.ts`) only to a rider whose Wikidata
item was matched by P11020 (exactly one item for the rider, exactly one rider for the item). The rule-built name is
rebuilt from `name_raw` (`displayNameParts`); "words" are the words of `foldToAscii` (ASCII, lower case, punctuation
as spaces, so "Pierre-Luc" is two words).

1. **Common name** (tried first, French label, then English): the label is taken when its words are all words of
   the rule-built name (any order, a repeated word counts once), it has at least two words, it contains the first
   word of the family name or the first word of the given name, and it contains at least one word of the given name
   (when the UCI name has one). Examples: "Jonas Vingegaard Hansen" → "Jonas Vingegaard", "Pello Bilbao Lopez de
   Armentia" → "Pello Bilbao", "Sergio Samitier Samitier" → "Sergio Samitier", "Xianjing Lyu" → "Lyu Xianjing"
   (family name first, as Wikidata writes it). Rejected: "Fernando Arroyo Rosario" → "Rosario Arroyo" (no word of
   the given name).
2. **Spelling** (otherwise; English, then French, then the multilingual `mul` label): the label is taken when it is
   the same words in the same order, differing only by accents, case or punctuation ("Joao Almeida" → "João Almeida",
   "Pierre Luc Perichon" → "Pierre-Luc Périchon").
3. Any other label is ignored and the rule-built name stays.

The label taken sets `display_name`, `display_name_source = 'wikidata'` and, when the label splits into a given part
and a family part matching the rule-built ones, `given_name` and `family_name` (otherwise they keep the rule-built
parts, e.g. family-first labels). `manual` names are never changed. Each run re-applies the rules: a `wikidata` name
for which no label qualifies any more goes back to the rule-built name (`display_name_source = 'rules'`). Slugs and
`search_name` are never changed.

### `rider_external_id`
`(source, external_id)` → `rider_id`. Sources: `dataride_object_id` (DataRide ObjectId of the UCI ranking),
`uci_id` (11-digit UCI ID), `uci_rider_page_id` (Wikidata **P11020**, derived as floor(UciId / 100) − 100000000;
the ObjectId is NOT P11020 for most riders), `wikidata_qid` (to be filled by the Wikidata job). A rider can have
several ids of one source (the UCI has duplicate records of some people).

### `rider_alias`
Every name variant met for a rider: `name_raw`, `birth_date`, `nation_code`, `alias_key` (lower-case name | birth date | nation),
`match_method`, `source`. Used by the collector to match rows; usable by the search.

### `rider_slug_history`
`slug` (primary key) → `rider_id`, `replaced_at`: old slugs to redirect (301) to the rider's current slug. Empty until a slug changes.

### `rider_profile`
Filled by the Wikidata job (`yarn enrich:wikidata`, see "Rating engine" below), one row per rider matched by P11020:
`wikidata_qid` ("Q16205040"), `wikidata_label` (English label, else French, else the multilingual `mul` label),
`height_m` (metres, 1.40 to 2.20, rounded to the centimetre; null when Wikidata has none), `weight_kg` (kilograms,
40 to 110, one decimal; null when none), `frwiki_url`, `enwiki_url` (article URLs, null when none), `fetched_at`.
No row = no Wikidata item found. Show height and weight only when present (first run: 5 663 riders matched, 1 690 with a height, 770 with a weight).

### `uci_ranking_entry`
The UCI World Ranking (DataRide ObjectRankings, men elite road) of every season, latest computation: one row per
ranked rider, season and computation date. `rider_id`, `object_id`, `uci_id`, `season`, `source_season_id`,
`ranking_date` (computation date), `moment_id`, `rank`, `points`, `team_code`, `team_name`, `nation_code`, `name_raw`,
`fetched_at`. Only riders with UCI points appear (about 3 400 per season).

### `rider_review`
Identity cases for a human: `kind` (`ambiguous_match`: several riders fit a row; `possible_duplicate`: a new rider
close to known ones, same birth day and a common family-name word, or same name and nation with another birth date;
`missing_birth_date`: a row without birth date; `registry_duplicate`: two DataRide ObjectIds for one identity,
attached to one rider), `rider_id`, `candidate_rider_ids`, the row's `name_raw`, `birth_date`, `nation_code`,
`classification_id`, `note`, `status` (`open`, `merged`, `dismissed`), `resolved_at`.

## Rating engine outputs

Written by the rating engine (`yarn rate`, `src/rating/`), empty after collection. Section 9 of the research
synthesis; the computation is described in "Rating engine" at the end of this file. Every run recomputes the whole
history from zero and replaces all rows of its version in one transaction: read the rows of one version only
(`rating_version_id` of the row with `is_current`), and they are always complete and consistent.

### `rating_version`

| column | meaning |
|---|---|
| `name` | unique version name (`v1`) |
| `label` | "Index v1 (2026-11-18)": the day the parameters were frozen |
| `parameters` | jsonb: every parameter and weight table used (keys below), plus `calibration` and `level_calibration` (metrics of the two calibrations, null before them) |
| `note` | free text: why this version |
| `is_current` | the published version (at most one true) |
| `frozen_at` | day the parameters were frozen |
| `computed_at` | end of the last full computation |
| `as_of_date` | day of the statuses and of the latest ranking snapshot: the latest classification date with finishers |
| `summary` | jsonb written by each run (keys below) |

`parameters` keys: `initial_index` (1500), `lower_levels` (`entry_classes` CN, 1.2, 2.2 and `entry_index` 1250: the index
of a rider whose first counted classification is of one of these classes; `k_classes` 1.2, 2.2 and `k_multiplier` 2.5:
K_c is multiplied by it in these classes; `rule`), `logistic_scale` (400), `k_base`, `top_n_by_kind` (N by classification
kind), `min_field_size`, `stage_weight`, `class_weights` (w_class by UCI class code), `type_weights` (w_type by kind,
with `gc_final_grand_tour`), `experience_threshold` (10), `provisional_multiplier`, `return_bonus` (`gap_days` 180,
`experience` 5, `min_multiplier` 1.5), `active_days` (365), `published_from` ("2020-01-01"), plus text fields
(`formula`, `field`, `order`, `decay`, `warm_up`) and `calibration`: `chosen` (the calibrated values), `test_log_loss`,
`test_accuracy` (share of test duels whose winner had E > 0.5), `train_log_loss`, `train_accuracy`, `test_duels`,
`test_decided_duels`, `baseline_uci_rank_accuracy` (same duels predicted by the UCI World Ranking), `defaults_test_*`,
`train_seasons`, `test_seasons`, `grid`, `selection`, `evaluation_pairs`, `data`, `ran_at` (the main grid, run before the
lower-level values existed: its metrics are those of the index without them). `level_calibration` (`yarn calibrate
--levels`, the published setting): `chosen` (`lowerEntryIndex`, `lowerK`), `fixed` (the five other values),
`test_log_loss`, `test_accuracy`, `train_*`, `test_by_level` (by level of the classification, "1" WorldTour to "5" .2:
`duels`, `accuracy`, `log_loss`), `test_scale_gap` (points to add to the index of the riders who raced WorldTour or
ProSeries so that their test duels against riders who only raced CN and .2 are predicted right on average; both
groups with X >= 10), `test_scale_gap_duels`, `uncorrected_*` (the same without the correction), `grid`, `selection`,
`scale_gap`, `data`, `ran_at`.

`summary` keys: `as_of_date`, `published_from`, `season_ends` (season -> its last day, the snapshot of the season
table), `classifications_counted`, `classifications_counted_by_season`, `classifications_skipped` (`cancelled`,
`no_duel`, `field_too_small`, `class_out_of_scope`), `rating_change_rows`, `riders_rated`, `statuses` (counts),
`mean_index_classified`, `mean_index_rated`, `drift` (mean index of the classified and of all rated riders on the
first published day and at each season end), `snapshot_days`, `snapshot_rows`, `data` (seasons present, latest
collector run).

### `rating_change`
One row per rider with status `FIN` in each counted classification (primary key `rating_version_id, classification_id, rider_id`).
A classification without rows was not counted (cancelled, fewer than `min_field_size` finishers).

| column | meaning |
|---|---|
| `date` | day of the classification; before `published_from` (2020-01-01) the row belongs to the warm-up: show it, marked "rodage" |
| `index_before` | index before the classification (for a first classification: 1250 at CN and .2, 1500 elsewhere) |
| `delta` | variation: `k * multiplier * (duels_won - duels_expected) / (field_size - 1)`, exactly as stored |
| `k` | K_c = K_base x `w_class` x `w_type`, x 2.5 in a .2 class (`parameters.lower_levels`) |
| `w_class`, `w_type` | the two weights of K_c (print "K = 80 x 1,0 x 0,5"; for a .2 race the extra factor is `k` / (K_base x w_class x w_type): "K = 80 x 0,4 x 1,0 x 2,5") |
| `multiplier` | m_i: 1 + max(0, 1 - X / 10) while provisional (2 at the first classification), at least 1.5 during 5 units of experience after more than 180 days without a counted result, else 1 |
| `field_size` | n, the riders with status FIN |
| `rank` | rank in the classification (equal ranks possible) |
| `in_top` | the rider is in T (ranked at or above the N-th finisher): his duels are against every other finisher; otherwise only against T |
| `duels_counted` | `field_size - 1` when `in_top`, else the size of T |
| `duels_won` | sum of S over the counted duels (1 ahead, 0.5 same rank, 0 behind); 0 for a rider outside T |
| `duels_expected` | sum of E over the counted duels, E from the indexes before the classification |
| `index_after` | `index_before + delta` |
| `experience_after` | X after the classification (sum of the w_type of his counted classifications, in T or not) |

### `rider_rating`
One row per rider with at least one counted classification (primary key `rating_version_id, rider_id`).

| column | meaning |
|---|---|
| `current_index` | index after his latest counted classification (frozen while inactive: no decay) |
| `experience` | X |
| `counted_classifications` | number of counted classifications |
| `last_counted_date` | day of the latest |
| `status` | as of `rating_version.as_of_date`: `classified` (X >= 10 and a counted result within 365 days: in the ranking), `provisional` (X < 10: index shown with the label, not ranked, page not indexed), `inactive` (X >= 10, nothing counted for more than 365 days: index frozen, shown with the date of the last result) |
| `best_index`, `best_index_date` | highest index at the end of a day on or after 2020-01-01 while classified; a rider already classified on 2020-01-01 starts with his index of that day (`best_index_date` = 2020-01-01 when the warm-up value was never beaten). Null when never classified since 2020 |

### `ranking_snapshot`
The published ranking (classified riders only) on chosen days (primary key `rating_version_id, date, rider_id`):
`rank` (1, 2, 3..., no equal ranks: index desc, then experience desc, then rider id) and `index_value`. Snapshot
days: every day of the 35 days up to `as_of_date`, every Monday from 2020-01-06 before that, and each season end
(`summary.season_ends`). The snapshot of day D includes every classification dated D or earlier.
Indexes: `(rating_version_id, date, rank)`, `(rating_version_id, rider_id, date)`.

## Collector runs: `job_run`

One row per collector run: `kind` (`collect_full`, `collect_recent`), `args`, `status` (`running`, `success`,
`partial`, `failed`, `interrupted`), `started_at`, `heartbeat_at` (every 30 s while running), `finished_at`,
`requests`, `request_retries`, `median_request_ms`, `competitions`, `classifications`, `rows_inserted`,
`rows_updated`, `rows_deleted`, `riders_created`, `errors`, `error_messages`, `oldest_changed_date` (earliest
classification date whose results changed: the rating engine recomputes from there), `registry_refreshed`.
"Mis à jour le" = `max(finished_at)` of the runs with status `success` or `partial`.

## Reading the data

For the rating engine:

- Process classifications ordered by `date`, then stages before the final GC of the same day
  (`kind = 'gc_final'` last), then `race.source_id`/`classification.id`. Skip `cancelled`.
- The field F of a classification is `status = 'FIN'`; order it by `rank` (ties possible), then `position`.
  `n = finishers_count`. DNF, DNS, OTL, DSQ do not count.
- Weights: `class_code` (`1.HC`/`2.HC` = `1.Pro`/`2.Pro`; `CN`, `CC`, `CM`, `JO`) and `kind`/`race_type`/`is_grand_tour`
  give w_class and w_type. Team time trials are not stored.
- The final GC lists only the riders who finished the race: abandons are not in it. Riders of the stages missing
  from the GC abandoned (derive it from the stage rows if needed).

```sql
-- Full finish order of one classification
select r.rank, r.position, r.status, ri.display_name, ri.slug, r.team_name, r.gap_seconds
from result r join rider ri on ri.id = r.rider_id
where r.classification_id = $1
order by r.position;

-- A rider's results, latest first
select c.date, c.competition_name, c.race_name, c.kind, c.class_code, r.status, r.rank, c.finishers_count, r.team_name
from result r join classification c on c.id = r.classification_id
where r.rider_id = $1
order by c.date desc, c.id desc;
```

## Data pitfalls

- Result rows carry no rider id: riders are matched by name, birth date and nation (three steps, see `rider`
  and `match_method`). Riders absent from the UCI ranking (no points) are created from results without UCI id.
- The UCI holds duplicate records of some people (two ObjectIds); they are attached to one rider and listed in
  `rider_review`. Twins and homonyms born the same day exist (Johannessen twins): check before merging.
- The final GC omits abandons, so its `starters_count` comes from the first stored stage (first stage after a TTT
  start when the race opened with a TTT).
- A cancelled stage is a classification with `cancelled = true` and no result.
- DataRide numbers some DNF rows in `Rank`: use `status` and `rank`, not `rank_raw`.
- Seasons overlap in DataRide listings: competitions are deduplicated by `source_id`.
- Team names are the UCI's upper-case names and change between seasons; there is no team id.

## Rating engine

`src/rating/` computes the Index Ucicle (section 9 of the research synthesis); `yarn rate` writes the four tables
above, `yarn calibrate` measures the parameters, `yarn check:rating` checks the formula on hand-made fields.
Parameters live in `src/rating/params.ts` (`FROZEN_VALUES`, `FROZEN_CALIBRATION`); changing one changes the
published index and needs a full `yarn rate` and a dated note.

### Computation

- Unit: one classification (one-day race, stage, prologue, final GC, championship or Olympic road race or ITT),
  processed by `date`, then stages before the final GC of the same day, then `classification.id`. Cancelled
  classifications and classifications with fewer than `min_field_size` finishers are skipped (no row at all).
- F = results with status `FIN`, by `rank` then `position`; n = |F|. T = the riders ranked at or above the N-th
  finisher (N = 30 for one-day races, championships, Olympic races and final GCs; 25 for stages and prologues;
  riders tied with the N-th are in T). A pair counts when one of the two riders is in T.
- A rider enters at 1500, or at 1250 when his first counted classification is a national championship or a .2 race
  (`lower_levels`): riders who only race there rarely meet the others, and their index drifted 122 points too high
  without it (test duels 2024-2025; 49 with it).
- `E_ij = 1 / (1 + 10^((R_j - R_i) / 400))`, `S_ij` = 1 / 0.5 / 0, `K_c = K_base x w_class x w_type` (x 2.5 in .2 races),
  `delta_i = K_c x m_i x sum over counted j of (S_ij - E_ij) / (n - 1)`. Every E uses the indexes before the
  classification; every delta applies after it.
- Experience X = sum of w_type of the counted classifications (exact to the hundredth). Provisional multiplier
  `1 + max(0, 1 - X / 10)`; return multiplier at least 1.5 during 5 units of experience after a gap of more than
  180 days. No decay for inactivity, no end-of-season regression.
- Warm-up: season 2019 (and anything dated before 2020-01-01) is computed and stored in `rating_change`, but no
  snapshot exists before 2020-01-06 and `best_index` ignores it.
- Properties (checked by `yarn check:rating`): finishing higher never gives less; |delta| <= K_c x m_i; with
  every m_i = 1 a classification sums to zero. Provisional and return multipliers break the zero sum, so the mean
  index drifts: `rating_version.summary.drift` records it at each season end.

### Reading the index

```sql
-- The published version
select id, label, as_of_date, parameters, summary from rating_version where is_current;

-- Ranking page on a day (as_of_date for "today"), with the rank 7 days earlier (null: not ranked then)
select s.rank, s.index_value, r.display_name, r.slug, r.nation_iso2, rr.experience, prev.rank as rank_7_days_ago
from ranking_snapshot s
join rider r on r.id = s.rider_id
join rider_rating rr on rr.rating_version_id = s.rating_version_id and rr.rider_id = s.rider_id
left join ranking_snapshot prev on prev.rating_version_id = s.rating_version_id and prev.rider_id = s.rider_id
     and prev.date = s.date - 7
where s.rating_version_id = $1 and s.date = $2
order by s.rank limit 100 offset $3;

-- Season table: the snapshot of each season end (summary.season_ends) for one rider
select s.date, s.rank, s.index_value from ranking_snapshot s
where s.rating_version_id = $1 and s.rider_id = $2
  and s.date in (select value::date from rating_version v, jsonb_each_text(v.summary->'season_ends') where v.id = $1);

-- A rider's index history, one line per counted result (latest first), the duels of each
select rc.date, c.competition_name, c.race_name, c.kind, c.class_code, rc.rank, rc.field_size, rc.in_top,
       rc.duels_counted, rc.duels_won, rc.duels_expected, rc.k, rc.w_class, rc.w_type, rc.multiplier, rc.delta,
       rc.index_before, rc.index_after, rc.date < '2020-01-01' as warm_up
from rating_change rc join classification c on c.id = rc.classification_id
where rc.rating_version_id = $1 and rc.rider_id = $2
order by rc.date desc, c.kind = 'gc_final' desc, rc.classification_id desc;

-- One classification with every finisher's variation
select r.rank, ri.display_name, ri.slug, rc.index_before, rc.delta, rc.in_top, rc.duels_won, rc.duels_expected
from result r join rider ri on ri.id = r.rider_id
left join rating_change rc on rc.rating_version_id = $1 and rc.classification_id = r.classification_id and rc.rider_id = r.rider_id
where r.classification_id = $2 and r.status = 'FIN'
order by r.rank, r.position;

-- Latest counted classifications, and the biggest movers of a day
select distinct rc.classification_id, rc.date from rating_change rc where rc.rating_version_id = $1 order by rc.date desc limit 20;
select rider_id, sum(delta) from rating_change where rating_version_id = $1 and date = $2 group by rider_id order by 2 desc limit 10;
```

Printing a result line ("29 duels comptés, 24 gagnés pour 19,6 attendus, K = 80 x 1,0 x 1,0, +5,9"): every
number is stored; `delta = k * multiplier * (duels_won - duels_expected) / (field_size - 1)` recomputes it exactly
from the stored values (round only for display: index to the unit, delta to one decimal). Show the multiplier when
it is not 1 ("x 2,0 provisoire", "x 1,5 retour").

### Wikidata enrichment (`yarn enrich:wikidata`)

SPARQL on query.wikidata.org, read-only, one request at a time at least one second apart, User-Agent with
https://www.ucicle.fr, backoff on 429 and 5xx. Batches of 300 `uci_rider_page_id` values (P11020). For each rider
with exactly one item (and each item with exactly one rider) it writes `rider_profile`, a `wikidata_qid` row in
`rider_external_id`, and the display name from the label under the rules of "Display names from Wikidata" (section
Riders). `manual` names, slugs and `search_name` are never changed. Images (P18) are not fetched: no licence accepted.
Run of 2026-11-17: 5 663 riders matched, 1 690 heights, 770 weights, 1 122 display names from labels.
