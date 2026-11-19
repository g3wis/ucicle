/**
 * Writes one rating version: the version row, then every rating_change, rider_rating and ranking_snapshot row
 * of it, replacing the previous rows of the same version inside one transaction (the website keeps reading the
 * previous complete version until the commit).
 */
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import type { Sql, TransactionSql } from 'postgres';

import { fromDay } from './days.js';
import type { ChangeColumns, SnapshotColumns } from './engine.js';

/** One rider_rating row */
export type RiderRatingRecord = {
    riderId: number,
    currentIndex: number,
    experience: number,
    countedClassifications: number,
    lastCountedDay: number,
    status: 'classified' | 'provisional' | 'inactive',
    bestIndex: number | null,
    bestDay: number | null,
};

export type VersionRecord = {
    name: string,
    label: string,
    parameters: Record<string, unknown>,
    note: string,
    frozenAt: string,
    asOfDay: number,
    summary: Record<string, unknown>,
};

const ROWS_PER_CHUNK = 5000;

const dayText = new Map<number, string>();
function date(day: number): string {
    let text: string | undefined = dayText.get(day);
    if (text === undefined) {
        text = fromDay(day);
        dayText.set(day, text);
    }
    return text;
}

function float(value: number): string {
    if (!Number.isFinite(value)) throw new Error(`Not a finite number: ${value}`);
    return String(value);
}

/**
 * Streams rows into a table with COPY (text format).
 * @param tx Transaction
 * @param table Table name
 * @param columns Column names, in the order of `line`
 * @param count Number of rows
 * @param line Row i as tab-separated text
 */
async function copyRows(tx: TransactionSql, table: string, columns: string[], count: number, line: (row: number) => string): Promise<void> {
    if (count === 0) return;
    function* chunks(): Generator<string> {
        for (let first = 0; first < count; first += ROWS_PER_CHUNK) {
            const lines: string[] = [];
            for (let row = first; row < Math.min(count, first + ROWS_PER_CHUNK); row++) lines.push(line(row));
            yield lines.join('\n') + '\n';
        }
    }
    const writable = await tx.unsafe(`copy ${table} (${columns.join(', ')}) from stdin`).writable();
    await pipeline(Readable.from(chunks()), writable);
}

/**
 * Replaces the rows of one rating version and makes it the current one.
 * @param sql Database client
 * @param version Version row
 * @param changes rating_change rows
 * @param riders rider_rating rows
 * @param snapshots ranking_snapshot rows
 * @return Id of the version
 */
export async function writeRatingVersion(
    sql: Sql, version: VersionRecord, changes: ChangeColumns, riders: RiderRatingRecord[], snapshots: SnapshotColumns,
): Promise<number> {
    return sql.begin(async tx => {
        await tx`update rating_version set is_current = false where is_current and name <> ${version.name}`;
        const [row] = await tx<{ id: number }[]>`
            insert into rating_version (name, label, parameters, note, is_current, frozen_at, computed_at, as_of_date, summary)
            values (${version.name}, ${version.label}, ${tx.json(version.parameters as never)}, ${version.note}, true,
                    ${version.frozenAt}, now(), ${date(version.asOfDay)}, ${tx.json(version.summary as never)})
            on conflict (name) do update set
                label = excluded.label, parameters = excluded.parameters, note = excluded.note, is_current = true,
                frozen_at = excluded.frozen_at, computed_at = excluded.computed_at, as_of_date = excluded.as_of_date,
                summary = excluded.summary
            returning id
        `;
        const id: number = row.id;
        await tx`delete from ranking_snapshot where rating_version_id = ${id}`;
        await tx`delete from rating_change where rating_version_id = ${id}`;
        await tx`delete from rider_rating where rating_version_id = ${id}`;

        const versionId = String(id);
        await copyRows(tx, 'rating_change', [
            'rating_version_id', 'classification_id', 'rider_id', 'date', 'index_before', 'delta', 'k', 'multiplier', 'field_size',
            'rank', 'in_top', 'duels_counted', 'duels_won', 'duels_expected', 'index_after', 'experience_after', 'w_class', 'w_type',
        ], changes.classification.length, i => [
            versionId, changes.classification[i], changes.rider[i], date(changes.day[i]), float(changes.indexBefore[i]),
            float(changes.delta[i]), float(changes.k[i]), float(changes.multiplier[i]), changes.fieldSize[i], changes.rank[i],
            changes.inTop[i] ? 't' : 'f', changes.duelsCounted[i], float(changes.duelsWon[i]), float(changes.duelsExpected[i]),
            float(changes.indexAfter[i]), float(changes.experienceAfter[i]), float(changes.wClass[i]), float(changes.wType[i]),
        ].join('\t'));

        await copyRows(tx, 'rider_rating', [
            'rating_version_id', 'rider_id', 'current_index', 'experience', 'counted_classifications', 'last_counted_date',
            'status', 'best_index', 'best_index_date',
        ], riders.length, i => {
            const rider: RiderRatingRecord = riders[i];
            return [
                versionId, rider.riderId, float(rider.currentIndex), float(rider.experience), rider.countedClassifications,
                date(rider.lastCountedDay), rider.status, rider.bestIndex === null ? '\\N' : float(rider.bestIndex),
                rider.bestDay === null ? '\\N' : date(rider.bestDay),
            ].join('\t');
        });

        await copyRows(tx, 'ranking_snapshot', ['rating_version_id', 'date', 'rider_id', 'rank', 'index_value'], snapshots.day.length,
            i => [versionId, date(snapshots.day[i]), snapshots.rider[i], snapshots.rank[i], float(snapshots.index[i])].join('\t'));
        return id;
    });
}
