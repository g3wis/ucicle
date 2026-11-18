/**
 * Index Ucicle v1: multi-competitor Elo by duels, truncated to the top of the finish order (synthesis, section 9).
 *
 *   F = riders with status FIN, n = |F|, T = the riders ranked at or above the N-th finisher, B = the others
 *   a pair (i, j) counts when i or j is in T (pairs inside B are ignored)
 *   E_ij = 1 / (1 + 10^((R_j - R_i) / 400)), S_ij = 1 ahead, 0.5 same rank, 0 behind
 *   K_c = K_base x w_class x w_type, times lowerK in the .2 classes (lowerKClasses)
 *   dR_i = K_c x m_i x sum over counted j of (S_ij - E_ij) / (n - 1)
 *   a rider enters at lowerEntryIndex when his first counted classification is CN or .2 (lowerEntryClasses), initialIndex otherwise
 *
 * Every E uses the indexes before the classification; every delta applies together after it. The whole history
 * is recomputed from zero on each run, in a fixed order, so the output depends only on the data and the parameters.
 */
import type { RatingData } from './data.js';
import { toDay, weekDay } from './days.js';
import { CLASS_LEVELS, isStageKind, KIND_ORDER, type RatingParameters, typeWeight, typeWeights } from './params.js';

/** Marker of "no day" in day arrays */
export const NO_DAY = -2_147_483_648;

/** Experience is counted in hundredths (every w_type is a multiple of 0.05), so thresholds compare exactly */
const EXPERIENCE_UNIT = 100;

/**
 * @param ranks Ranks of a finish order, ascending
 * @param offset First entry of the classification in `ranks`
 * @param n Number of finishers
 * @param top N
 * @return |T|: the riders ranked at or above the N-th finisher (riders tied with the N-th are in T)
 */
export function topSize(ranks: Int32Array, offset: number, n: number, top: number): number {
    if (n <= top) return n;
    const boundary: number = ranks[offset + top - 1];
    let size: number = top;
    while (size < n && ranks[offset + size] === boundary) size++;
    return size;
}

/**
 * Scores the duels of one classification.
 * @param ranks Ranks of the finish order, ascending
 * @param offset First entry of the classification in `ranks`
 * @param n Number of finishers
 * @param t |T| (see topSize)
 * @param q q[a] = 10^(R_a / scale) for the finisher at place a (E_ab = q[a] / (q[a] + q[b]))
 * @param won Out: sum of S over the counted duels of each finisher
 * @param expected Out: sum of E over the counted duels of each finisher
 */
export function scoreField(
    ranks: Int32Array, offset: number, n: number, t: number,
    q: Float64Array, won: Float64Array, expected: Float64Array,
): void {
    // S: a rider of T beats everyone ranked below him and draws with the riders of his rank;
    // T holds whole groups of equal rank, so a rider of B never beats nor draws with a rider of T.
    let first = 0;
    while (first < n) {
        let last: number = first;
        while (last + 1 < n && ranks[offset + last + 1] === ranks[offset + first]) last++;
        for (let place = first; place <= last; place++) won[place] = place < t ? (n - 1 - last) + 0.5 * (last - first) : 0;
        first = last + 1;
    }
    // E: every counted pair once (i in T, j after i)
    expected.fill(0, 0, n);
    for (let i = 0; i < t; i++) {
        const qi: number = q[i];
        let sum = 0;
        for (let j = i + 1; j < n; j++) {
            const e: number = qi / (qi + q[j]);
            sum += e;
            expected[j] += 1 - e;
        }
        expected[i] += sum;
    }
}

/** Prediction quality of the pre-race indexes over a set of duels */
export type Metrics = {
    classifications: number,
    /** Duels evaluated */
    pairs: number,
    /** Sum of the log loss of E over the duels (ties: S = 0.5) */
    logLossSum: number,
    /** Duels with a winner (not tied in rank) */
    decided: number,
    /** Duels with a winner whose winner had E > 0.5 */
    hits: number,
    /** Duels with a winner where E = 0.5 exactly (no prediction, counted as missed) */
    coinFlips: number,
};

export function emptyMetrics(): Metrics {
    return { classifications: 0, pairs: 0, logLossSum: 0, decided: 0, hits: 0, coinFlips: 0 };
}

/** Highest level of the riders counted in the upper group of the scale gap (WorldTour and ProSeries) */
const UPPER_LEVEL = 2;
/** Lowest level of the riders counted in the lower group (CN and .2 only) */
const LOWER_LEVEL = 4;

/**
 * Test duels between an experienced rider of the upper levels (he raced WorldTour or ProSeries) and an
 * experienced rider who only raced the lower levels (CN, .2), both with X >= the provisional threshold:
 * the index gap of each duel (upper minus lower) and the duels the upper rider won (ties count 0.5).
 */
export type ScaleGapSample = { gaps: number[], upperScore: number };

/**
 * @param sample Duels between the two groups
 * @param scale Logistic scale
 * @return The points to add to every upper index so that the mean E of the upper riders equals their mean score
 *         (0 when the two groups share one scale; positive when the lower riders are rated too high); NaN without duels
 */
export function scaleGap(sample: ScaleGapSample, scale: number): number {
    const n: number = sample.gaps.length;
    if (n === 0) return Number.NaN;
    const target: number = sample.upperScore / n;
    let gap = 0;
    for (let iteration = 0; iteration < 100; iteration++) {
        let mean = 0;
        let slope = 0;
        for (const difference of sample.gaps) {
            const e: number = 1 / (1 + Math.pow(10, -(difference + gap) / scale));
            mean += e;
            slope += e * (1 - e) * Math.LN10 / scale;
        }
        const step: number = (target - mean / n) / (slope / n);
        gap += step;
        if (Math.abs(step) < 1e-4) break;
    }
    return gap;
}

/**
 * Fixed set of duels on which every setting is evaluated, whatever its own N and minimum field: the duels
 * counted under the synthesis defaults (top 30 for one-day races, championships and GCs, top 15 for stages,
 * at least 10 finishers), in the classifications of the train and test seasons.
 */
export type EvaluationOptions = {
    trainSeasons: [number, number],
    testSeasons: [number, number],
    topOneDay: number,
    topStage: number,
    minFieldSize: number,
};

export type EngineOptions = {
    parameters: RatingParameters,
    /** Classifications of later seasons are ignored */
    untilSeason?: number,
    /** Keep one row per rider and counted classification (rating_change) */
    record?: boolean,
    /** Days (ascending) on which to record the published ranking */
    snapshotDays?: number[],
    evaluation?: EvaluationOptions,
};

/** Levels 1 to 5 of CLASS_LEVELS: test metrics of each in `testByLevel` */
export const LEVELS: readonly number[] = [1, 2, 3, 4, 5];

/** rating_change rows, by column (index = row) */
export type ChangeColumns = {
    classification: number[], rider: number[], day: number[], indexBefore: number[], delta: number[], k: number[],
    multiplier: number[], fieldSize: number[], rank: number[], inTop: boolean[], duelsCounted: number[], duelsWon: number[],
    duelsExpected: number[], indexAfter: number[], experienceAfter: number[], wClass: number[], wType: number[],
};

/** Mean index of the population on a snapshot day (provisional bonuses break the zero sum: watch the drift) */
export type PopulationStats = { day: number, rated: number, meanRated: number, classified: number, meanClassified: number };

/** ranking_snapshot rows, by column, and the population on each snapshot day */
export type SnapshotColumns = { day: number[], rider: number[], rank: number[], index: number[], stats: PopulationStats[] };

export type SkipCounts = { cancelled: number, empty: number, fieldTooSmall: number, classOutOfScope: number, laterSeason: number };

export type EngineResult = {
    /** By dense rider index */
    rating: Float64Array,
    experience: Float64Array,
    lastDay: Int32Array,
    counted: Int32Array,
    /** Best index on a day >= publishedFrom while classified (NaN when never), and its day */
    bestIndex: Float64Array,
    bestDay: Int32Array,
    classificationsCounted: number,
    countedSeasons: Map<number, number>,
    skipped: SkipCounts,
    changes: ChangeColumns | null,
    snapshots: SnapshotColumns | null,
    train: Metrics,
    test: Metrics,
    /** Test metrics in the classifications of each level (index = level, see CLASS_LEVELS) */
    testByLevel: Metrics[],
    /** Test duels between the upper and the lower levels (see ScaleGapSample) */
    testScaleGap: ScaleGapSample,
};

function emptyChanges(): ChangeColumns {
    return {
        classification: [], rider: [], day: [], indexBefore: [], delta: [], k: [], multiplier: [], fieldSize: [], rank: [], inTop: [],
        duelsCounted: [], duelsWon: [], duelsExpected: [], indexAfter: [], experienceAfter: [], wClass: [], wType: [],
    };
}

/**
 * @param weight A w_type
 * @return It in hundredths of experience
 */
function experienceUnits(weight: number): number {
    const units: number = Math.round(weight * EXPERIENCE_UNIT);
    if (Math.abs(units - weight * EXPERIENCE_UNIT) > 1e-6) throw new Error(`w_type ${weight} is not a multiple of 0.01`);
    return units;
}

/** Adds one duel to `metrics`: its log loss, and whether its winner was predicted (E of the rider ahead) */
function count(metrics: Metrics, loss: number, tie: boolean, e: number): void {
    metrics.pairs++;
    metrics.logLossSum += loss;
    if (tie) return;
    metrics.decided++;
    if (e > 0.5) metrics.hits++;
    else if (e === 0.5) metrics.coinFlips++;
}

/**
 * Evaluates the pre-race indexes on the duels of the top `top` of one classification.
 * @param metrics Period metrics (train or test)
 * @param levelMetrics Metrics of the classification's level, or null
 * @param gap Scale gap sample, or null
 * @param group group[place]: 1 upper-level rider, 2 lower-level rider, 0 other (read when `gap` is given)
 * @param index index[place]: pre-race index (read when `gap` is given)
 */
function evaluate(
    metrics: Metrics, levelMetrics: Metrics | null, gap: ScaleGapSample | null, group: Int8Array, index: Float64Array,
    ranks: Int32Array, offset: number, n: number, top: number, q: Float64Array,
): void {
    const t: number = topSize(ranks, offset, n, top);
    metrics.classifications++;
    if (levelMetrics) levelMetrics.classifications++;
    for (let i = 0; i < t; i++) {
        const qi: number = q[i];
        const rank: number = ranks[offset + i];
        for (let j = i + 1; j < n; j++) {
            const e: number = qi / (qi + q[j]);
            const tie: boolean = ranks[offset + j] === rank;
            const loss: number = tie ? -0.5 * (Math.log(e) + Math.log(q[j] / (qi + q[j]))) : -Math.log(e);
            count(metrics, loss, tie, e);
            if (levelMetrics) count(levelMetrics, loss, tie, e);
            if (gap && group[i] !== 0 && group[j] !== 0 && group[i] !== group[j]) {
                const upperFirst: boolean = group[i] === 1;
                gap.gaps.push(upperFirst ? index[i] - index[j] : index[j] - index[i]);
                gap.upperScore += tie ? 0.5 : upperFirst ? 1 : 0;
            }
        }
    }
}

/**
 * Runs the index over the whole history.
 * @param data Classifications in processing order
 * @param options Parameters and what to record
 */
export function runEngine(data: RatingData, options: EngineOptions): EngineResult {
    const parameters: RatingParameters = options.parameters;
    const riderCount: number = data.riderIds.length;
    const rating = new Float64Array(riderCount).fill(parameters.initialIndex);
    const experience = new Int32Array(riderCount); // hundredths
    const lastDay = new Int32Array(riderCount).fill(NO_DAY);
    const returnLeft = new Int32Array(riderCount); // hundredths of experience still under the return multiplier
    const counted = new Int32Array(riderCount);
    const bestIndex = new Float64Array(riderCount).fill(Number.NaN);
    const bestDay = new Int32Array(riderCount).fill(NO_DAY);
    const touchedDay = new Int32Array(riderCount).fill(NO_DAY);
    const touched: number[] = [];

    const q = new Float64Array(data.maxField);
    const won = new Float64Array(data.maxField);
    const expected = new Float64Array(data.maxField);
    const multiplier = new Float64Array(data.maxField);
    const delta = new Float64Array(data.maxField);
    const preRace = new Float64Array(data.maxField);
    const group = new Int8Array(data.maxField);
    // Highest level raced (lowest number), 9 before the first counted classification
    const topLevel = new Int8Array(riderCount).fill(9);
    const entryClasses = new Set<string>(parameters.lowerEntryClasses);
    const kClasses = new Set<string>(parameters.lowerKClasses);

    const weights = typeWeights(parameters);
    const thresholdUnits: number = experienceUnits(parameters.experienceThreshold);
    const returnUnits: number = experienceUnits(parameters.returnExperience);
    const minField: number = Math.max(2, parameters.minFieldSize);
    const publishedFromDay: number = toDay(parameters.publishedFrom);
    const untilSeason: number = options.untilSeason ?? Number.POSITIVE_INFINITY;
    const evaluation: EvaluationOptions | undefined = options.evaluation;
    const evaluationMinField: number = evaluation ? Math.max(2, evaluation.minFieldSize) : 0;
    const train: Metrics = emptyMetrics();
    const test: Metrics = emptyMetrics();
    const testByLevel: Metrics[] = [0, ...LEVELS].map(() => emptyMetrics());
    const testScaleGap: ScaleGapSample = { gaps: [], upperScore: 0 };

    const changes: ChangeColumns | null = options.record ? emptyChanges() : null;
    const snapshotDays: number[] = options.snapshotDays ?? [];
    const snapshots: SnapshotColumns | null = options.snapshotDays ? { day: [], rider: [], rank: [], index: [], stats: [] } : null;
    let nextSnapshot = 0;
    const skipped: SkipCounts = { cancelled: 0, empty: 0, fieldTooSmall: 0, classOutOfScope: 0, laterSeason: 0 };
    const countedSeasons = new Map<number, number>();
    let classificationsCounted = 0;

    const isClassified = (rider: number, day: number): boolean =>
        lastDay[rider] !== NO_DAY && experience[rider] >= thresholdUnits && day - lastDay[rider] <= parameters.activeDays;

    // Best index: from the first published day, while classified, read at the end of each day
    let published = false;
    const startPublication = (): void => {
        published = true;
        for (let rider = 0; rider < riderCount; rider++) {
            if (isClassified(rider, publishedFromDay)) {
                bestIndex[rider] = rating[rider];
                bestDay[rider] = publishedFromDay;
            }
        }
    };
    const closeDay = (day: number): void => {
        if (day >= publishedFromDay) {
            for (const rider of touched) {
                if (experience[rider] >= thresholdUnits && !(rating[rider] <= bestIndex[rider])) {
                    bestIndex[rider] = rating[rider];
                    bestDay[rider] = day;
                }
            }
        }
        touched.length = 0;
    };
    const snapshot = (day: number): void => {
        if (!snapshots) return;
        const ranked: number[] = [];
        let rated = 0;
        let ratedSum = 0;
        let classifiedSum = 0;
        for (let rider = 0; rider < riderCount; rider++) {
            if (lastDay[rider] === NO_DAY) continue;
            rated++;
            ratedSum += rating[rider];
            if (isClassified(rider, day)) {
                ranked.push(rider);
                classifiedSum += rating[rider];
            }
        }
        ranked.sort((a, b) => rating[b] - rating[a] || experience[b] - experience[a] || data.riderIds[a] - data.riderIds[b]);
        ranked.forEach((rider, place) => {
            snapshots.day.push(day);
            snapshots.rider.push(data.riderIds[rider]);
            snapshots.rank.push(place + 1);
            snapshots.index.push(rating[rider]);
        });
        snapshots.stats.push({
            day,
            rated,
            meanRated: rated > 0 ? ratedSum / rated : Number.NaN,
            classified: ranked.length,
            meanClassified: ranked.length > 0 ? classifiedSum / ranked.length : Number.NaN,
        });
    };

    let currentDay: number = NO_DAY;
    for (let c = 0; c < data.size; c++) {
        const day: number = data.days[c];
        if (day !== currentDay) {
            if (currentDay !== NO_DAY) closeDay(currentDay);
            while (nextSnapshot < snapshotDays.length && snapshotDays[nextSnapshot] < day) snapshot(snapshotDays[nextSnapshot++]);
            if (!published && day >= publishedFromDay) startPublication();
            currentDay = day;
        }

        const season: number = data.seasons[c];
        if (season > untilSeason) {
            skipped.laterSeason++;
            continue;
        }
        const n: number = data.count[c];
        const wClass: number | undefined = parameters.classWeights[data.classCodes[c]];
        if (data.cancelled[c]) {
            skipped.cancelled++;
            continue;
        }
        if (n < 2) {
            skipped.empty++;
            continue;
        }
        if (wClass === undefined) {
            skipped.classOutOfScope++;
            continue;
        }
        const kind = KIND_ORDER[data.kinds[c]];
        const stage: boolean = isStageKind(kind);
        const counts: boolean = n >= minField;
        const period: Metrics | null = !evaluation || n < evaluationMinField ? null
            : season >= evaluation.testSeasons[0] && season <= evaluation.testSeasons[1] ? test
                : season >= evaluation.trainSeasons[0] && season <= evaluation.trainSeasons[1] ? train : null;
        if (!counts) skipped.fieldTooSmall++;
        if (!counts && !period) continue;

        const offset: number = data.start[c];
        const level: number = CLASS_LEVELS[data.classCodes[c]] ?? 0;
        // A rider never counted before enters at the index of this classification's level
        const entry: number = entryClasses.has(data.classCodes[c]) ? parameters.lowerEntryIndex : parameters.initialIndex;
        for (let place = 0; place < n; place++) {
            const rider: number = data.riders[offset + place];
            if (lastDay[rider] === NO_DAY && counts) rating[rider] = entry;
            preRace[place] = lastDay[rider] === NO_DAY ? entry : rating[rider];
            q[place] = Math.pow(10, preRace[place] / parameters.scale);
        }
        if (period && evaluation) {
            const isTest: boolean = period === test;
            if (isTest) {
                for (let place = 0; place < n; place++) {
                    const rider: number = data.riders[offset + place];
                    group[place] = experience[rider] < thresholdUnits ? 0 : topLevel[rider] <= UPPER_LEVEL ? 1
                        : topLevel[rider] >= LOWER_LEVEL && topLevel[rider] < 9 ? 2 : 0;
                }
            }
            evaluate(
                period, isTest && level > 0 ? testByLevel[level] : null, isTest ? testScaleGap : null, group, preRace,
                data.ranks, offset, n, stage ? evaluation.topStage : evaluation.topOneDay, q,
            );
        }
        if (!counts) continue;

        const t: number = topSize(data.ranks, offset, n, stage ? parameters.topStage : parameters.topOneDay);
        scoreField(data.ranks, offset, n, t, q, won, expected);
        const wType: number = typeWeight(kind, data.grandTour[c] === 1, weights);
        const wUnits: number = experienceUnits(wType);
        const k: number = parameters.kBase * wClass * wType * (kClasses.has(data.classCodes[c]) ? parameters.lowerK : 1);

        for (let place = 0; place < n; place++) {
            const rider: number = data.riders[offset + place];
            if (lastDay[rider] !== NO_DAY && day - lastDay[rider] > parameters.returnGapDays) returnLeft[rider] = returnUnits;
            let m: number = 1 + Math.max(0, 1 - experience[rider] / thresholdUnits);
            if (returnLeft[rider] > 0 && m < parameters.returnMultiplier) m = parameters.returnMultiplier;
            multiplier[place] = m;
            delta[place] = k * m * (won[place] - expected[place]) / (n - 1);
        }
        for (let place = 0; place < n; place++) {
            const rider: number = data.riders[offset + place];
            const before: number = rating[rider];
            const after: number = before + delta[place];
            rating[rider] = after;
            experience[rider] += wUnits;
            if (level > 0 && level < topLevel[rider]) topLevel[rider] = level;
            returnLeft[rider] = Math.max(0, returnLeft[rider] - wUnits);
            lastDay[rider] = day;
            counted[rider]++;
            if (touchedDay[rider] !== day) {
                touchedDay[rider] = day;
                touched.push(rider);
            }
            if (changes) {
                changes.classification.push(data.ids[c]);
                changes.rider.push(data.riderIds[rider]);
                changes.day.push(day);
                changes.indexBefore.push(before);
                changes.delta.push(delta[place]);
                changes.k.push(k);
                changes.multiplier.push(multiplier[place]);
                changes.fieldSize.push(n);
                changes.rank.push(data.ranks[offset + place]);
                changes.inTop.push(place < t);
                changes.duelsCounted.push(place < t ? n - 1 : t);
                changes.duelsWon.push(won[place]);
                changes.duelsExpected.push(expected[place]);
                changes.indexAfter.push(after);
                changes.experienceAfter.push(experience[rider] / EXPERIENCE_UNIT);
                changes.wClass.push(wClass);
                changes.wType.push(wType);
            }
        }
        classificationsCounted++;
        countedSeasons.set(season, (countedSeasons.get(season) ?? 0) + 1);
    }
    if (currentDay !== NO_DAY) closeDay(currentDay);
    const lastSnapshotDay: number | undefined = snapshotDays[snapshotDays.length - 1];
    if (!published && lastSnapshotDay !== undefined && lastSnapshotDay >= publishedFromDay) startPublication();
    while (nextSnapshot < snapshotDays.length) snapshot(snapshotDays[nextSnapshot++]);

    return {
        rating,
        experience: Float64Array.from(experience, units => units / EXPERIENCE_UNIT),
        lastDay,
        counted,
        bestIndex,
        bestDay,
        classificationsCounted,
        countedSeasons,
        skipped,
        changes,
        snapshots,
        train,
        test,
        testByLevel,
        testScaleGap,
    };
}

/** Days on which the ranking is published, and the last day of each season */
export type Publication = {
    /** Latest classification day with finishers: the "as of" day of statuses and of the last snapshot */
    asOfDay: number,
    /** Ascending */
    snapshotDays: number[],
    /** Season -> its last day (the day before the next season's first classification, or asOfDay), published seasons only */
    seasonEnds: Map<number, number>,
};

/**
 * @param data Engine input
 * @param parameters Parameters (publishedFrom)
 * @param dailyDays Number of days up to asOfDay with a daily snapshot
 * @return Snapshot days: every day of the last `dailyDays` days, every Monday from publishedFrom before that, every season end
 */
export function publicationDays(data: RatingData, parameters: RatingParameters, dailyDays = 35): Publication {
    const publishedFromDay: number = toDay(parameters.publishedFrom);
    const firstDayOfSeason = new Map<number, number>();
    let asOfDay: number = NO_DAY;
    for (let c = 0; c < data.size; c++) {
        if (data.cancelled[c] || data.count[c] === 0) continue;
        const day: number = data.days[c];
        asOfDay = Math.max(asOfDay, day);
        const season: number = data.seasons[c];
        firstDayOfSeason.set(season, Math.min(firstDayOfSeason.get(season) ?? day, day));
    }
    if (asOfDay === NO_DAY) return { asOfDay, snapshotDays: [], seasonEnds: new Map() };

    const seasons: number[] = [...firstDayOfSeason.keys()].sort((a, b) => a - b);
    const seasonEnds = new Map<number, number>();
    seasons.forEach((season, index) => {
        const next: number | undefined = seasons[index + 1];
        const end: number = next !== undefined ? firstDayOfSeason.get(next)! - 1 : asOfDay;
        if (end >= publishedFromDay && end <= asOfDay) seasonEnds.set(season, end);
    });

    const days = new Set<number>();
    const dailyFrom: number = Math.max(publishedFromDay, asOfDay - dailyDays + 1);
    let monday: number = publishedFromDay;
    while (weekDay(monday) !== 1) monday++;
    for (; monday < dailyFrom; monday += 7) days.add(monday);
    for (let day = dailyFrom; day <= asOfDay; day++) days.add(day);
    for (const end of seasonEnds.values()) days.add(end);
    return { asOfDay, snapshotDays: [...days].sort((a, b) => a - b), seasonEnds };
}

export type RiderStatus = 'classified' | 'provisional' | 'inactive';

/**
 * @param experience X of the rider
 * @param lastDay Day of his last counted classification
 * @param asOfDay Day of the status
 * @param parameters Thresholds
 */
export function riderStatus(experience: number, lastDay: number, asOfDay: number, parameters: RatingParameters): RiderStatus {
    if (experience * EXPERIENCE_UNIT < parameters.experienceThreshold * EXPERIENCE_UNIT - 1e-6) return 'provisional';
    return asOfDay - lastDay <= parameters.activeDays ? 'classified' : 'inactive';
}
