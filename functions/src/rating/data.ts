/**
 * The input of the rating engine in compact form: every classification in processing order, with its finish
 * order (riders with status FIN, by rank then DataRide position), in flat typed arrays.
 */
import type { ClassificationKind } from '../db/rows.js';

import { toDay } from './days.js';
import { KIND_ORDER } from './params.js';

/** One classification as read from the database */
export type ClassificationInput = {
    id: number,
    date: string,
    season: number,
    kind: ClassificationKind,
    classCode: string,
    isGrandTour: boolean,
    cancelled: boolean,
    /** Riders with status FIN, in finish order (rank, then position) */
    riderIds: number[],
    /** Their ranks (equal ranks possible), same order */
    ranks: number[],
};

export type RatingData = {
    /** Number of classifications */
    size: number,
    /** Classification ids, in processing order: date, stages before the final GC of the same day, id */
    ids: Int32Array,
    days: Int32Array,
    seasons: Int32Array,
    /** Index in KIND_ORDER */
    kinds: Uint8Array,
    grandTour: Uint8Array,
    cancelled: Uint8Array,
    classCodes: string[],
    /** Finishers of classification c: entries start[c] .. start[c] + count[c] - 1 of `riders` and `ranks` */
    start: Int32Array,
    count: Int32Array,
    /** Dense rider index (see riderIds) of each finisher */
    riders: Int32Array,
    ranks: Int32Array,
    /** Dense rider index -> rider id */
    riderIds: Int32Array,
    /** Largest field */
    maxField: number,
    /** Second rows of a rider already in the same classification, dropped */
    duplicateRows: number,
};

const GC_FINAL_KIND: number = KIND_ORDER.indexOf('gc_final');

/**
 * @param inputs Classifications, in any order; their finishers must be in finish order
 * @return The engine input, classifications sorted in processing order
 */
export function buildRatingData(inputs: ClassificationInput[]): RatingData {
    const keyed = inputs.map(input => ({ input, day: toDay(input.date), kind: KIND_ORDER.indexOf(input.kind) }));
    for (const { input, kind } of keyed) {
        if (kind < 0) throw new Error(`Classification ${input.id}: unknown kind '${input.kind}'`);
    }
    keyed.sort((a, b) => a.day - b.day
        || Number(a.kind === GC_FINAL_KIND) - Number(b.kind === GC_FINAL_KIND)
        || a.input.id - b.input.id);

    const size: number = keyed.length;
    const total: number = inputs.reduce((sum, input) => sum + input.riderIds.length, 0);
    const data: RatingData = {
        size,
        ids: new Int32Array(size),
        days: new Int32Array(size),
        seasons: new Int32Array(size),
        kinds: new Uint8Array(size),
        grandTour: new Uint8Array(size),
        cancelled: new Uint8Array(size),
        classCodes: new Array<string>(size),
        start: new Int32Array(size),
        count: new Int32Array(size),
        riders: new Int32Array(total),
        ranks: new Int32Array(total),
        riderIds: new Int32Array(0),
        maxField: 0,
        duplicateRows: 0,
    };

    const denseIndex = new Map<number, number>();
    const riderIds: number[] = [];
    let offset = 0;
    keyed.forEach(({ input, day, kind }, c) => {
        data.ids[c] = input.id;
        data.days[c] = day;
        data.seasons[c] = input.season;
        data.kinds[c] = kind;
        data.grandTour[c] = input.isGrandTour ? 1 : 0;
        data.cancelled[c] = input.cancelled ? 1 : 0;
        data.classCodes[c] = input.classCode;
        data.start[c] = offset;

        const seen = new Set<number>();
        let previousRank = -Infinity;
        input.riderIds.forEach((riderId, position) => {
            const rank: number = input.ranks[position];
            if (rank < previousRank) throw new Error(`Classification ${input.id}: finishers not in rank order`);
            previousRank = rank;
            if (seen.has(riderId)) {
                data.duplicateRows++;
                return;
            }
            seen.add(riderId);
            let index: number | undefined = denseIndex.get(riderId);
            if (index === undefined) {
                index = riderIds.length;
                riderIds.push(riderId);
                denseIndex.set(riderId, index);
            }
            data.riders[offset] = index;
            data.ranks[offset] = rank;
            offset++;
        });
        data.count[c] = offset - data.start[c];
        data.maxField = Math.max(data.maxField, data.count[c]);
    });
    data.riderIds = Int32Array.from(riderIds);
    return data;
}
