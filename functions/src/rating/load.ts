/**
 * Reads the engine input from the database, in one read-only snapshot (the collector may be writing meanwhile).
 */
import type { Sql } from 'postgres';

import type { ClassificationKind } from '../db/rows.js';

import { buildRatingData, type ClassificationInput, type RatingData } from './data.js';
import { toDay } from './days.js';

type ClassificationRecord = {
    id: number,
    date: string,
    season: number,
    kind: ClassificationKind,
    class_code: string,
    is_grand_tour: boolean,
    cancelled: boolean,
};

type FinisherRecord = { classification_id: number, rider_id: number, rank: number };

/** UCI World Ranking of each computation date: rider id -> rank */
export type UciRankings = { days: number[], ranks: Map<number, number>[] };

export type LoadedData = { data: RatingData, uciRankings: UciRankings };

/**
 * @param sql Database client
 * @param withUciRankings Also read the UCI World Ranking (calibration baseline)
 * @return The classifications and their finishers (status FIN, by rank then position)
 */
export async function loadRatingData(sql: Sql, withUciRankings = false): Promise<LoadedData> {
    return sql.begin('isolation level repeatable read read only', async tx => {
        const classifications: ClassificationRecord[] = await tx<ClassificationRecord[]>`
            select id, date, season, kind, class_code, is_grand_tour, cancelled from classification
        `;
        const inputs = new Map<number, ClassificationInput>(classifications.map(row => [row.id, {
            id: row.id, date: row.date, season: row.season, kind: row.kind, classCode: row.class_code,
            isGrandTour: row.is_grand_tour, cancelled: row.cancelled, riderIds: [], ranks: [],
        }]));

        await tx<FinisherRecord[]>`
            select classification_id, rider_id, rank from result
            where status = 'FIN' and rank is not null
            order by classification_id, rank, position nulls last, id
        `.cursor(50_000, rows => {
            for (const row of rows) {
                const input: ClassificationInput | undefined = inputs.get(row.classification_id);
                if (!input) continue; // classification inserted after the snapshot's first read: not possible in one snapshot
                input.riderIds.push(row.rider_id);
                input.ranks.push(row.rank);
            }
        });

        const uciRankings: UciRankings = { days: [], ranks: [] };
        if (withUciRankings) {
            const entries = await tx<{ ranking_date: string, rider_id: number, rank: number }[]>`
                select ranking_date, rider_id, min(rank) as rank from uci_ranking_entry
                group by ranking_date, rider_id order by ranking_date
            `;
            for (const entry of entries) {
                const day: number = toDay(entry.ranking_date);
                if (uciRankings.days[uciRankings.days.length - 1] !== day) {
                    uciRankings.days.push(day);
                    uciRankings.ranks.push(new Map());
                }
                uciRankings.ranks[uciRankings.ranks.length - 1].set(entry.rider_id, entry.rank);
            }
        }
        return { data: buildRatingData([...inputs.values()]), uciRankings };
    });
}
