import type { Sql } from 'postgres';

import { type CompetitionKind, DATARIDE_SOURCE, type MatchMethod } from '../db/rows.js';
import { mapWithConcurrency } from '../utils/httpUtils.js';

import type { DataRideClient, DrCompetition, DrEvent, DrRace, DrResult, DrSeason } from './dataride.js';
import type { Identity, Match, RiderDirectory } from './identity.js';
import { recordChangedDate, recordError, type RunCounters } from './jobRun.js';
import { cleanRawName } from './names.js';
import {
    type ClassificationShape, classificationShape, competitionKind, dataRideIsoDate, isGrandTour, MEN_ELITE_CATEGORY,
    parseResultValues, pickEvent, resultStatus,
} from './parse.js';
import { refreshRegistry } from './registry.js';
import { newTally, type Tally, tally } from './tally.js';

/** First season of the Index (2019 is the warm-up season) */
export const FIRST_SEASON = 2019;
const DAY_MS = 24 * 3600 * 1000;
/** A competition fetched this many days after its end is complete: later runs skip it (unless refresh) */
const SETTLED_AFTER_DAYS = 2;
const COMPETITION_WORKERS = 4;

/** Priority of the classes when a sample of competitions is asked for (`--limit-competitions`) */
const CLASS_PRIORITY: string[] = ['1.UWT', '2.UWT', 'JO', 'CM', '1.Pro', '2.Pro', '1.HC', '2.HC', 'CC', '1.1', '2.1', 'CN', '1.2', '2.2'];

export type CollectOptions = {
    /** Full mode: DataRide season years to collect */
    seasons?: number[],
    /** Nightly mode: competitions whose dates touch the last `recentDays` days */
    recentDays?: number,
    /** Only these DataRide competition ids */
    competitionIds?: number[],
    /** At most this many competitions, chosen to mix stage races, one-day races and championships */
    limitCompetitions?: number,
    /** Fetch again classifications already stored */
    refresh: boolean,
    /** 'auto': registry seasons not loaded yet or older than a week; 'force': all; 'skip': none */
    registry: 'auto' | 'force' | 'skip',
    /** Reference day 'YYYY-MM-DD' (today) */
    today: string,
};

type CompetitionTarget = {
    id: number,
    sourceId: number,
    name: string,
    classCode: string,
    kind: CompetitionKind,
    isGrandTour: boolean,
    startDate: string,
    endDate: string,
    season: number,
    collectedAt: Date | null,
};

type StoredRace = { date: string, results_fetched_at: Date | null, row_count: number | null, cancelled: boolean };

type ClassificationCounts = { inserted: number, updated: number, deleted: number, rows: number, changed: boolean };

function addDays(isoDate: string, days: number): string {
    return new Date(Date.parse(isoDate) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * @param row A result row
 * @return The identity it gives
 */
export function resultIdentity(row: DrResult): Identity {
    return {
        name: cleanRawName(row.DisplayName || row.IndividualDisplayName || row.UnknownIndividualDisplayName || ''),
        birthDate: dataRideIsoDate(row.BirthDate),
        nationCode: (row.NationName || row.IndividualCountryName || row.UnknownIndividualCountryName || '').trim() || null,
        nationIso2: row.IsoCode2?.trim() || null,
        nationName: (row.IndividualCountryNameText || row.UnknownIndividualCountryNameText || '').trim() || null,
    };
}

/**
 * @param row A result row
 * @return Whether it is a marker rather than a rider ("Race Cancelled", an unknown individual without birth date)
 */
export function isPlaceholderRow(row: DrResult): boolean {
    const name: string = row.DisplayName || row.UnknownIndividualDisplayName || '';
    return !row.IndividualDisplayName && dataRideIsoDate(row.BirthDate) === null
        && /(cancel|annul|neutrali[sz]|no result|not held|void)/i.test(name);
}

/**
 * Picks a mix of finished competitions: stage races, one-day races, national championships and
 * other championships in turn, each group by class priority then most recent first.
 */
export function sampleCompetitions<T extends { kind: CompetitionKind, classCode: string, endDate: string }>(competitions: T[], limit: number, today: string): T[] {
    const priority = (code: string): number => {
        const index: number = CLASS_PRIORITY.indexOf(code);
        return index < 0 ? CLASS_PRIORITY.length : index;
    };
    const sorted: T[] = competitions
        .filter(competition => competition.endDate < today)
        .sort((a, b) => priority(a.classCode) - priority(b.classCode) || b.endDate.localeCompare(a.endDate));
    const groups: T[][] = [
        sorted.filter(competition => competition.kind === 'stage_race'),
        sorted.filter(competition => competition.kind === 'one_day'),
        sorted.filter(competition => competition.classCode === 'CN'),
        sorted.filter(competition => competition.kind === 'olympic' || (competition.kind === 'championship' && competition.classCode !== 'CN')),
    ];
    const picked: T[] = [];
    for (let round = 0; picked.length < limit && groups.some(group => group.length > round); round++) {
        for (const group of groups) {
            if (picked.length < limit && group[round]) picked.push(group[round]);
        }
    }
    return picked;
}

/**
 * Collects men elite road results from DataRide into the database: registry, calendar, then for each
 * competition its races, classifications and results. Idempotent and resumable.
 */
export class Collector {
    constructor(
        private readonly sql: Sql,
        private readonly client: DataRideClient,
        private readonly directory: RiderDirectory,
        private readonly counters: RunCounters,
    ) {
    }

    /**
     * @param options What to collect
     */
    async run(options: CollectOptions): Promise<void> {
        const seasons: DrSeason[] = (await this.client.getSeasons()).filter(season => season.Year >= FIRST_SEASON);
        const targets: DrSeason[] = this.targetSeasons(seasons, options);
        console.info(`Seasons: ${targets.map(season => season.Year).join(', ')}`);

        if (options.registry !== 'skip') {
            const registrySeasons: DrSeason[] = options.recentDays !== undefined ? targets : seasons;
            const registry = await refreshRegistry(this.sql, this.client, this.directory, registrySeasons, options.registry === 'force');
            this.counters.registryRefreshed = registry.seasonsFetched.length > 0;
            console.info(registry.seasonsFetched.length > 0
                ? `Registry: ${registry.entries} entries from seasons ${registry.seasonsFetched.join(', ')}`
                : 'Registry: up to date');
        }

        const calendar: CompetitionTarget[] = await this.loadCalendar(targets, seasons);
        const selected: CompetitionTarget[] = this.select(calendar, options);
        console.info(`Competitions: ${selected.length} to process (${calendar.length} in scope in the calendar)`);

        await mapWithConcurrency(selected, COMPETITION_WORKERS, async competition => {
            try {
                await tally.run(newTally(), () => this.collectCompetition(competition, options));
            } catch (error: unknown) {
                recordError(this.counters, `Competition ${competition.sourceId} ${competition.name}: ${(error as Error).message}`);
            }
        });
    }

    private targetSeasons(seasons: DrSeason[], options: CollectOptions): DrSeason[] {
        if (options.recentDays !== undefined) {
            const from: string = addDays(options.today, -options.recentDays);
            return seasons.filter(season => {
                const start: string | null = dataRideIsoDate(season.StartDate);
                const end: string | null = dataRideIsoDate(season.EndDate);
                return start !== null && end !== null && start <= options.today && end >= from;
            });
        }
        return (options.seasons ?? []).map(year => {
            const season: DrSeason | undefined = seasons.find(candidate => candidate.Year === year);
            if (!season) throw new Error(`Season ${year} is not listed by DataRide (from ${FIRST_SEASON})`);
            return season;
        });
    }

    /** Season (year) whose dates contain `date`, else `fallback` */
    private seasonOf(date: string, seasons: DrSeason[], fallback: number): number {
        const season: DrSeason | undefined = seasons.find(candidate => {
            const start: string | null = dataRideIsoDate(candidate.StartDate);
            const end: string | null = dataRideIsoDate(candidate.EndDate);
            return start !== null && end !== null && start <= date && date <= end;
        });
        return season?.Year ?? fallback;
    }

    /**
     * Loads the calendar of the target seasons and upserts every in-scope competition, deduplicated by CompetitionId.
     */
    private async loadCalendar(targets: DrSeason[], seasons: DrSeason[]): Promise<CompetitionTarget[]> {
        const listed: Map<number, { competition: DrCompetition, season: DrSeason }> = new Map();
        for (const season of targets) {
            for (const competition of await this.client.getCompetitions(season)) {
                if (!listed.has(competition.CompetitionId)) listed.set(competition.CompetitionId, { competition, season });
            }
        }

        const calendar: CompetitionTarget[] = [];
        for (const { competition, season } of listed.values()) {
            const classCode: string = competition.ClassCode?.trim() ?? '';
            const kind: CompetitionKind | null = competitionKind(classCode);
            const startDate: string | null = dataRideIsoDate(competition.StartDate);
            const endDate: string | null = dataRideIsoDate(competition.EndDate) ?? startDate;
            if (!kind || !startDate || !endDate) continue;

            const name: string = competition.CompetitionName?.trim().replace(/\s+/g, ' ') ?? '';
            const grandTour: boolean = isGrandTour(name, classCode);
            const seasonYear: number = this.seasonOf(startDate, seasons, season.Year);
            const [row] = await this.sql<{ id: number, collected_at: Date | null }[]>`
                insert into competition (source, source_id, name, class_code, kind, is_grand_tour, country_code, country_iso2, country_name,
                                         start_date, end_date, season, source_season_id)
                values (${DATARIDE_SOURCE}, ${String(competition.CompetitionId)}, ${name}, ${classCode}, ${kind}, ${grandTour},
                        ${competition.CountryIsoCode3?.trim() || null}, ${competition.CountryIsoCode2?.trim() || null},
                        ${competition.CountryName?.trim() || null}, ${startDate}, ${endDate}, ${seasonYear}, ${season.Id})
                on conflict (source, source_id) do update set
                    name = excluded.name, class_code = excluded.class_code, kind = excluded.kind, is_grand_tour = excluded.is_grand_tour,
                    country_code = excluded.country_code, country_iso2 = excluded.country_iso2, country_name = excluded.country_name,
                    start_date = excluded.start_date, end_date = excluded.end_date, season = excluded.season,
                    source_season_id = excluded.source_season_id,
                    updated_at = case when (competition.name, competition.class_code, competition.start_date, competition.end_date)
                        is distinct from (excluded.name, excluded.class_code, excluded.start_date, excluded.end_date)
                        then now() else competition.updated_at end
                returning id, collected_at
            `;
            calendar.push({
                id: row.id, sourceId: competition.CompetitionId, name, classCode, kind, isGrandTour: grandTour,
                startDate, endDate, season: seasonYear, collectedAt: row.collected_at,
            });
        }
        return calendar.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.sourceId - b.sourceId);
    }

    private select(calendar: CompetitionTarget[], options: CollectOptions): CompetitionTarget[] {
        let selected: CompetitionTarget[] = calendar.filter(competition => competition.startDate <= options.today);
        if (options.recentDays !== undefined) {
            const from: string = addDays(options.today, -options.recentDays);
            selected = selected.filter(competition => competition.endDate >= from);
        }
        if (options.competitionIds?.length) {
            const wanted: Set<number> = new Set(options.competitionIds);
            selected = selected.filter(competition => wanted.has(competition.sourceId));
            const missing: number[] = options.competitionIds.filter(id => !selected.some(competition => competition.sourceId === id));
            if (missing.length > 0) console.warn(`Competitions not found in scope for these seasons: ${missing.join(', ')}`);
        }
        if (options.limitCompetitions !== undefined) selected = sampleCompetitions(selected, options.limitCompetitions, options.today);
        return selected;
    }

    private async collectCompetition(competition: CompetitionTarget, options: CollectOptions): Promise<void> {
        const started: number = Date.now();
        const refresh: boolean = options.refresh || options.recentDays !== undefined;
        const label = `${competition.season} | ${competition.sourceId} | ${competition.classCode} | ${competition.name}`;

        const settled: boolean = competition.collectedAt !== null
            && competition.collectedAt.toISOString().slice(0, 10) >= addDays(competition.endDate, SETTLED_AFTER_DAYS);
        if (settled && !refresh) {
            console.info(`${label} | already collected, skipped`);
            return;
        }

        const races: DrRace[] = await this.client.getRaces(competition.sourceId);
        const stored: Map<string, StoredRace> = new Map((await this.sql<(StoredRace & { source_id: string })[]>`
            select r.source_id, c.date, c.results_fetched_at, c.row_count, c.cancelled
            from race r join classification c on c.race_id = r.id
            where r.competition_id = ${competition.id}
        `).map(row => [row.source_id, row]));

        let fetched = 0;
        let skipped = 0;
        let errors = 0;
        const total: ClassificationCounts = { inserted: 0, updated: 0, deleted: 0, rows: 0, changed: false };
        for (const race of races) {
            if (race.CategoryCode?.trim() !== MEN_ELITE_CATEGORY) continue;
            const date: string | null = dataRideIsoDate(race.StartDate);
            if (!date) continue;
            const raceName: string = race.RaceName?.trim() ?? '';
            const shape: ClassificationShape | null = classificationShape(competition.kind,
                { code: race.RaceCode, name: raceName, type: race.RaceTypeCode, category: race.CategoryCode });
            const raceId: number = await this.upsertRace(competition, race, raceName, date, shape !== null);
            if (!shape || date > options.today) continue;

            const previous: StoredRace | undefined = stored.get(String(race.Id));
            const complete: boolean = previous !== undefined && previous.results_fetched_at !== null && ((previous.row_count ?? 0) > 0 || previous.cancelled)
                && previous.results_fetched_at.toISOString().slice(0, 10) > previous.date;
            if (complete && !refresh) {
                skipped++;
                continue;
            }

            try {
                const events: DrEvent[] = await this.client.getEvents(competition.sourceId, race.Id);
                const event: DrEvent | null = pickEvent(shape, events);
                if (!event) {
                    if (events.length > 0) {
                        recordError(this.counters, `${label} | ${raceName}: no classification among ${events.map(e => e.EventName).join(', ')}`);
                        errors++;
                    }
                    continue;
                }
                const rows: DrResult[] = await this.client.getResults(competition.sourceId, event.EventId);
                const counts: ClassificationCounts = await this.storeClassification(competition, raceId, raceName, date, shape, event, rows, previous);
                fetched++;
                total.inserted += counts.inserted;
                total.updated += counts.updated;
                total.deleted += counts.deleted;
                total.rows += counts.rows;
            } catch (error: unknown) {
                errors++;
                recordError(this.counters, `${label} | ${raceName}: ${(error as Error).message}`);
            }
        }

        await this.sql`
            update classification gc set starters_count = first_stage.starters_count, updated_at = now()
            from (
                select starters_count from classification
                where competition_id = ${competition.id} and kind in ('stage', 'prologue') and starters_count is not null
                order by date, stage_number nulls last, id limit 1
            ) first_stage
            where gc.competition_id = ${competition.id} and gc.kind = 'gc_final'
              and gc.starters_count is distinct from first_stage.starters_count
        `;
        if (errors === 0) await this.sql`update competition set collected_at = now() where id = ${competition.id}`;

        this.counters.competitions++;
        const seconds: string = ((Date.now() - started) / 1000).toFixed(1);
        const counts: Tally = tally.getStore() ?? newTally();
        console.info(`${label} | ${fetched} classifications fetched, ${skipped} skipped | ${total.rows} rows (+${total.inserted} ~${total.updated} -${total.deleted})`
            + ` | ${counts.ridersCreated} riders created | ${counts.requests} requests | ${errors} errors | ${seconds} s`);
    }

    private async upsertRace(competition: CompetitionTarget, race: DrRace, name: string, date: string, inScope: boolean): Promise<number> {
        const [row] = await this.sql<{ id: number }[]>`
            insert into race (source, source_id, competition_id, name, race_code, race_type_code, category_code, date, sequence, in_scope)
            values (${DATARIDE_SOURCE}, ${String(race.Id)}, ${competition.id}, ${name}, ${race.RaceCode?.trim() || null},
                    ${race.RaceTypeCode?.trim() || null}, ${race.CategoryCode?.trim() ?? ''}, ${date}, ${race.Index ?? null}, ${inScope})
            on conflict (source, source_id) do update set
                competition_id = excluded.competition_id, name = excluded.name, race_code = excluded.race_code,
                race_type_code = excluded.race_type_code, category_code = excluded.category_code, date = excluded.date,
                sequence = excluded.sequence, in_scope = excluded.in_scope, updated_at = now()
            where (race.name, race.race_code, race.race_type_code, race.date, race.sequence, race.in_scope)
                is distinct from (excluded.name, excluded.race_code, excluded.race_type_code, excluded.date, excluded.sequence, excluded.in_scope)
            returning id
        `;
        if (row) return row.id;
        const [existing] = await this.sql<{ id: number }[]>`select id from race where source = ${DATARIDE_SOURCE} and source_id = ${String(race.Id)}`;
        return existing.id;
    }

    private async storeClassification(competition: CompetitionTarget, raceId: number, raceName: string, date: string,
        shape: ClassificationShape, event: DrEvent, rows: DrResult[], previous: StoredRace | undefined): Promise<ClassificationCounts> {
        const [classification] = await this.sql<{ id: number, inserted: boolean }[]>`
            insert into classification (source, source_id, race_id, competition_id, date, season, kind, race_type, stage_number, stage_label,
                                        class_code, is_grand_tour, competition_name, race_name, event_name, winner_name)
            values (${DATARIDE_SOURCE}, ${String(event.EventId)}, ${raceId}, ${competition.id}, ${date}, ${competition.season}, ${shape.kind},
                    ${shape.raceType}, ${shape.stageNumber}, ${shape.stageLabel}, ${competition.classCode}, ${competition.isGrandTour},
                    ${competition.name}, ${raceName}, ${event.EventName?.trim() ?? ''}, ${event.WinnerName?.trim() || null})
            on conflict (source, source_id) do update set
                race_id = excluded.race_id, competition_id = excluded.competition_id, date = excluded.date, season = excluded.season,
                kind = excluded.kind, race_type = excluded.race_type, stage_number = excluded.stage_number, stage_label = excluded.stage_label,
                class_code = excluded.class_code, is_grand_tour = excluded.is_grand_tour, competition_name = excluded.competition_name,
                race_name = excluded.race_name, event_name = excluded.event_name, winner_name = excluded.winner_name, updated_at = now()
            returning id, (xmax = 0) as inserted
        `;

        // Finish order: DataRide's SortOrder, then rank
        const ordered: DrResult[] = [...rows].sort((a, b) => (a.SortOrder ?? Number.MAX_SAFE_INTEGER) - (b.SortOrder ?? Number.MAX_SAFE_INTEGER)
            || (a.RankNumber ?? Number.MAX_SAFE_INTEGER) - (b.RankNumber ?? Number.MAX_SAFE_INTEGER));
        const riderRows: DrResult[] = ordered.filter(row => !isPlaceholderRow(row));
        const named: DrResult[] = riderRows.filter(row => resultIdentity(row).name.length > 0);
        if (named.length < riderRows.length) {
            recordError(this.counters, `Classification ${event.EventId}: ${riderRows.length - named.length} rows without a rider name left out`);
        }
        // A cancelled race comes as a single "Race Cancelled" row instead of riders
        const cancelled: boolean = riderRows.length === 0 && ordered.length > 0;
        const statuses: string[] = named.map(row => resultStatus(row.Irm, row.RankNumber));
        const classifiedValues = parseResultValues(named.filter((_, index) => statuses[index] === 'FIN').map(row => row.ResultValue));
        let classifiedIndex = 0;

        const matches: Match[] = await this.directory.exclusive(async () => {
            const found: Match[] = [];
            for (const row of named) found.push(await this.directory.resolveResult(resultIdentity(row), classification.id));
            return found;
        });
        await this.directory.flush();

        const resultRows = named.map((row, index) => {
            const identity: Identity = resultIdentity(row);
            const status: string = statuses[index];
            const value = status === 'FIN' ? classifiedValues[classifiedIndex++] : { time: null, gap: null };
            return {
                source: DATARIDE_SOURCE,
                source_id: String(row.ResultId),
                classification_id: classification.id,
                rider_id: matches[index].riderId,
                status,
                rank: status === 'FIN' ? row.RankNumber : null,
                rank_raw: row.Rank?.trim() || null,
                position: row.SortOrder ?? null,
                bib: row.Bib?.trim() || null,
                team_name: row.TeamName?.trim().replace(/\s+/g, ' ') || null,
                rider_name_raw: identity.name,
                rider_birth_date: identity.birthDate,
                rider_nation_code: identity.nationCode,
                result_value_raw: row.ResultValue?.trim() || null,
                time_seconds: value.time,
                gap_seconds: value.gap,
                uci_points: row.PointPcR ?? null,
                match_method: matches[index].method as MatchMethod,
            };
        });
        const uniqueRows = [...new Map(resultRows.map(row => [row.source_id, row])).values()];

        const counts: ClassificationCounts = await this.sql.begin(async tx => {
            let inserted = 0;
            let updated = 0;
            for (let start = 0; start < uniqueRows.length; start += 500) {
                const written = await tx<{ inserted: boolean }[]>`
                    insert into result ${tx(uniqueRows.slice(start, start + 500), 'source', 'source_id', 'classification_id', 'rider_id', 'status',
        'rank', 'rank_raw', 'position', 'bib', 'team_name', 'rider_name_raw', 'rider_birth_date', 'rider_nation_code', 'result_value_raw',
        'time_seconds', 'gap_seconds', 'uci_points', 'match_method')}
                    on conflict (source, source_id) do update set
                        classification_id = excluded.classification_id, rider_id = excluded.rider_id, status = excluded.status,
                        rank = excluded.rank, rank_raw = excluded.rank_raw, position = excluded.position, bib = excluded.bib,
                        team_name = excluded.team_name, rider_name_raw = excluded.rider_name_raw, rider_birth_date = excluded.rider_birth_date,
                        rider_nation_code = excluded.rider_nation_code, result_value_raw = excluded.result_value_raw,
                        time_seconds = excluded.time_seconds, gap_seconds = excluded.gap_seconds, uci_points = excluded.uci_points,
                        match_method = excluded.match_method, updated_at = now()
                    where (result.classification_id, result.rider_id, result.status, result.rank, result.rank_raw, result.position, result.bib,
                           result.team_name, result.rider_name_raw, result.rider_birth_date, result.rider_nation_code, result.result_value_raw,
                           result.time_seconds, result.gap_seconds, result.uci_points)
                        is distinct from
                          (excluded.classification_id, excluded.rider_id, excluded.status, excluded.rank, excluded.rank_raw, excluded.position,
                           excluded.bib, excluded.team_name, excluded.rider_name_raw, excluded.rider_birth_date, excluded.rider_nation_code,
                           excluded.result_value_raw, excluded.time_seconds, excluded.gap_seconds, excluded.uci_points)
                    returning (xmax = 0) as inserted
                `;
                for (const row of written) {
                    if (row.inserted) inserted++;
                    else updated++;
                }
            }

            // Rows DataRide no longer returns (corrections, disqualifications) are removed, unless the answer is empty
            let deleted = 0;
            if (uniqueRows.length > 0) {
                const removed = await tx`
                    delete from result
                    where classification_id = ${classification.id} and not (source_id = any(${uniqueRows.map(row => row.source_id)}::text[]))
                `;
                deleted = removed.count;
            } else if ((previous?.row_count ?? 0) > 0) {
                recordError(this.counters, `Classification ${event.EventId}: DataRide returned no rows, ${previous?.row_count} stored rows kept`);
            }

            const changed: boolean = classification.inserted || inserted + updated + deleted > 0;
            const winner = resultRows.find(row => row.status === 'FIN' && row.rank === 1);
            await tx`
                update classification set
                    row_count = (select count(*) from result where classification_id = ${classification.id}),
                    starters_count = (select count(*) from result where classification_id = ${classification.id} and status <> 'DNS'),
                    finishers_count = (select count(*) from result where classification_id = ${classification.id} and status = 'FIN'),
                    winner_rider_id = ${winner?.rider_id ?? null},
                    cancelled = ${cancelled},
                    results_fetched_at = now(),
                    results_changed_at = ${changed ? tx`now()` : tx`results_changed_at`},
                    updated_at = now()
                where id = ${classification.id}
            `;
            return { inserted, updated, deleted, rows: uniqueRows.length, changed };
        });

        this.counters.classifications++;
        this.counters.rowsInserted += counts.inserted;
        this.counters.rowsUpdated += counts.updated;
        this.counters.rowsDeleted += counts.deleted;
        if (counts.changed) recordChangedDate(this.counters, date);
        return counts;
    }
}
