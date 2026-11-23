/**
 * Computes the Index Ucicle from zero with the frozen parameters (src/rating/params.ts) and writes the version
 * (rating_version, rating_change, rider_rating, ranking_snapshot) in one transaction.
 *
 *   yarn rate [--dry-run]
 *
 * --dry-run computes and prints the summary without writing.
 */
import { parseArgs } from 'node:util';

import type { Sql } from 'postgres';

import { connect } from '../db/connection.js';
import { fromDay } from '../rating/days.js';
import { type EngineResult, NO_DAY, publicationDays, riderStatus, runEngine } from '../rating/engine.js';
import { loadRatingData } from '../rating/load.js';
import {
    type CalibrationRecord, FROZEN_CALIBRATION, FROZEN_LEVEL_CALIBRATION, FROZEN_ON, FROZEN_VALUES, frozenParameters, parametersJson, type RatingParameters,
} from '../rating/params.js';
import { type RiderRatingRecord, writeRatingVersion } from '../rating/write.js';

type DataState = {
    seasons: Record<string, number>,
    first_date: string | null,
    last_date: string | null,
    latest_collector_run: { id: number, kind: string, status: string, finished_at: Date | null } | null,
};

async function dataState(sql: Sql): Promise<DataState> {
    const seasons = await sql<{ season: number, classifications: number }[]>`
        select season, count(*) as classifications from classification where not cancelled group by season order by season
    `;
    const [range] = await sql<{ first: string | null, last: string | null }[]>`select min(date) as first, max(date) as last from classification`;
    const [run] = await sql<{ id: number, kind: string, status: string, finished_at: Date | null }[]>`
        select id, kind, status, finished_at from job_run order by id desc limit 1
    `;
    return {
        seasons: Object.fromEntries(seasons.map(row => [String(row.season), row.classifications])),
        first_date: range?.first ?? null,
        last_date: range?.last ?? null,
        latest_collector_run: run ?? null,
    };
}

/**
 * @return The calibration to publish with the version: the frozen one, else the one `yarn calibrate` stored for the same values
 */
async function calibrationRecord(sql: Sql, parameters: RatingParameters): Promise<CalibrationRecord | null> {
    if (FROZEN_CALIBRATION) return FROZEN_CALIBRATION;
    const [row] = await sql<{ calibration: CalibrationRecord | null }[]>`
        select parameters->'calibration' as calibration from rating_version where name = ${parameters.version}
    `;
    const stored: CalibrationRecord | null = row?.calibration ?? null;
    if (!stored?.chosen) return null;
    const same: boolean = (Object.keys(FROZEN_VALUES) as (keyof typeof FROZEN_VALUES)[])
        .every(key => stored.chosen[key] === FROZEN_VALUES[key]);
    return same ? stored : null;
}

function mean(values: number[]): number {
    return values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : Number.NaN;
}

function round(value: number, digits = 2): number {
    const factor: number = 10 ** digits;
    return Math.round(value * factor) / factor;
}

async function main(): Promise<void> {
    const { values } = parseArgs({ args: process.argv.slice(2).filter(arg => arg !== '--'), options: { 'dry-run': { type: 'boolean', default: false } } });
    const dryRun: boolean = values['dry-run'] ?? false;
    const sql: Sql = connect(2);
    try {
        const started: number = Date.now();
        const parameters: RatingParameters = frozenParameters();
        const { data } = await loadRatingData(sql);
        const loaded: number = Date.now();
        const publication = publicationDays(data, parameters);
        if (publication.asOfDay === NO_DAY) throw new Error('No classification with finishers: nothing to rate');
        const result: EngineResult = runEngine(data, { parameters, record: true, snapshotDays: publication.snapshotDays });
        const computed: number = Date.now();

        const asOf: string = fromDay(publication.asOfDay);
        const riders: RiderRatingRecord[] = [];
        for (let rider = 0; rider < data.riderIds.length; rider++) {
            if (result.counted[rider] === 0) continue;
            const best: number = result.bestIndex[rider];
            riders.push({
                riderId: data.riderIds[rider],
                currentIndex: result.rating[rider],
                experience: result.experience[rider],
                countedClassifications: result.counted[rider],
                lastCountedDay: result.lastDay[rider],
                status: riderStatus(result.experience[rider], result.lastDay[rider], publication.asOfDay, parameters),
                bestIndex: Number.isNaN(best) ? null : best,
                bestDay: Number.isNaN(best) ? null : result.bestDay[rider],
            });
        }
        const statuses = { classified: 0, provisional: 0, inactive: 0 };
        for (const rider of riders) statuses[rider.status]++;
        const classified: RiderRatingRecord[] = riders.filter(rider => rider.status === 'classified')
            .sort((a, b) => b.currentIndex - a.currentIndex || b.experience - a.experience || a.riderId - b.riderId);
        const meanClassified: number = mean(classified.map(rider => rider.currentIndex));
        const meanRated: number = mean(riders.map(rider => rider.currentIndex));

        const stats = result.snapshots!.stats;
        const statsByDay = new Map(stats.map(stat => [stat.day, stat]));
        const drift = [...publication.seasonEnds.entries()].map(([season, day]) => {
            const stat = statsByDay.get(day)!;
            return {
                season, end_date: fromDay(day), classified: stat.classified, mean_index_classified: round(stat.meanClassified),
                rated: stat.rated, mean_index_rated: round(stat.meanRated),
            };
        });
        const firstStat = stats[0];
        const state: DataState = await dataState(sql);
        const calibration: CalibrationRecord | null = await calibrationRecord(sql, parameters);

        const summary: Record<string, unknown> = {
            as_of_date: asOf,
            published_from: parameters.publishedFrom,
            season_ends: Object.fromEntries([...publication.seasonEnds.entries()].map(([season, day]) => [String(season), fromDay(day)])),
            snapshot_days: publication.snapshotDays.length,
            snapshot_rows: result.snapshots!.day.length,
            classifications_counted: result.classificationsCounted,
            classifications_counted_by_season: Object.fromEntries(result.countedSeasons),
            classifications_skipped: {
                cancelled: result.skipped.cancelled, no_duel: result.skipped.empty,
                field_too_small: result.skipped.fieldTooSmall, class_out_of_scope: result.skipped.classOutOfScope,
            },
            rating_change_rows: result.changes!.delta.length,
            riders_rated: riders.length,
            statuses,
            mean_index_classified: round(meanClassified),
            mean_index_rated: round(meanRated),
            drift: {
                note: 'Mean index at each season end: provisional and return multipliers break the zero sum',
                first_published_day: firstStat ? {
                    date: fromDay(firstStat.day), classified: firstStat.classified, mean_index_classified: round(firstStat.meanClassified),
                    rated: firstStat.rated, mean_index_rated: round(firstStat.meanRated),
                } : null,
                season_ends: drift,
            },
            duplicate_result_rows_dropped: data.duplicateRows,
            data: state,
        };

        console.info(`Index ${parameters.version}: ${data.size} classifications read, ${result.classificationsCounted} counted `
            + `(skipped: ${result.skipped.cancelled} cancelled, ${result.skipped.empty} without duel, ${result.skipped.fieldTooSmall} `
            + `under ${parameters.minFieldSize} finishers, ${result.skipped.classOutOfScope} class out of scope), `
            + `${result.changes!.delta.length} rating rows, ${publication.snapshotDays.length} snapshot days `
            + `(${result.snapshots!.day.length} rows), as of ${asOf}`);
        console.info(`Read ${((loaded - started) / 1000).toFixed(1)} s, computed ${((computed - loaded) / 1000).toFixed(1)} s`);
        console.info(`Riders rated: ${riders.length} (classified ${statuses.classified}, provisional ${statuses.provisional}, inactive ${statuses.inactive})`);
        console.info(`Mean index: classified ${meanClassified.toFixed(1)}, all rated riders ${meanRated.toFixed(1)}`);
        const top: RiderRatingRecord[] = classified.slice(0, 10);
        const names = new Map<number, string>();
        if (top.length > 0) {
            const rows = await sql<{ id: number, display_name: string }[]>`select id, display_name from rider where id in ${sql(top.map(rider => rider.riderId))}`;
            for (const row of rows) names.set(row.id, row.display_name);
        }
        console.info('Top 10:');
        top.forEach((rider, place) => console.info(`  ${String(place + 1).padStart(2)}. ${(names.get(rider.riderId) ?? `#${rider.riderId}`).padEnd(28)} `
            + `${rider.currentIndex.toFixed(1)}  (X ${rider.experience.toFixed(2)}, ${rider.countedClassifications} classifications)`));
        console.info('Drift (season end: classified mean / all rated mean):');
        if (firstStat) console.info(`  ${fromDay(firstStat.day)} (first published day): ${firstStat.meanClassified.toFixed(1)} (${firstStat.classified}) / ${firstStat.meanRated.toFixed(1)} (${firstStat.rated})`);
        for (const row of drift) {
            console.info(`  ${row.season} ends ${row.end_date}: ${row.mean_index_classified.toFixed(1)} (${row.classified}) / ${row.mean_index_rated.toFixed(1)} (${row.rated})`);
        }

        if (dryRun) {
            console.info('Dry run: nothing written');
            return;
        }
        const parametersRecord: Record<string, unknown> = {
            ...parametersJson(parameters), calibration, level_calibration: FROZEN_LEVEL_CALIBRATION,
        };
        const id: number = await writeRatingVersion(sql, {
            name: parameters.version,
            label: `Index ${parameters.version} (${FROZEN_ON})`,
            parameters: parametersRecord,
            note: calibration ? 'Parameters frozen after calibration (train 2020-2023, test 2024-2025)'
                : 'Synthesis default parameters, not calibrated yet',
            frozenAt: FROZEN_ON,
            asOfDay: publication.asOfDay,
            summary,
        }, result.changes!, riders, result.snapshots!);
        console.info(`Written as rating_version ${id} (${parameters.version}, current) in ${((Date.now() - computed) / 1000).toFixed(1)} s`);
    } finally {
        await sql.end();
    }
}

main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
});
