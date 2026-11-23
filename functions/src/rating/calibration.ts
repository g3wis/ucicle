/**
 * Calibration of the Index (synthesis, section 9): a grid over the calibratable parameters, every setting run
 * from zero (2019 as warm-up) and evaluated on the same duels, with the UCI World Ranking as the baseline.
 */
import type { RatingData } from './data.js';
import { type EvaluationOptions, LEVELS, type Metrics, runEngine, scaleGap, topSize } from './engine.js';
import type { UciRankings } from './load.js';
import {
    type CalibratedValues, CALIBRATION_GRID, type CalibrationGrid, CLASS_WEIGHTS, DEFAULT_PARAMETERS, FROZEN_VALUES, isStageKind,
    KIND_ORDER, type LevelMetrics, withValues,
} from './params.js';

/** Train 2020-2023 (2019 is the warm-up), test 2024-2025, on the duels counted under the synthesis defaults */
export const EVALUATION: EvaluationOptions = {
    trainSeasons: [2020, 2023],
    testSeasons: [2024, 2025],
    topOneDay: DEFAULT_PARAMETERS.topOneDay,
    topStage: DEFAULT_PARAMETERS.topStage,
    minFieldSize: DEFAULT_PARAMETERS.minFieldSize,
};

export type SettingResult = {
    values: CalibratedValues,
    train: Metrics,
    test: Metrics,
    trainLogLoss: number,
    testLogLoss: number,
    trainAccuracy: number,
    testAccuracy: number,
    /** Test duels by level of the classification ('1' to '5', see CLASS_LEVELS) */
    testByLevel: Record<string, LevelMetrics>,
    /** Scale gap between the upper and the lower levels on the test duels (see LevelCalibrationRecord) */
    testScaleGap: number,
    testScaleGapDuels: number,
};

/** Baseline: the rider with the better UCI rank (latest computation before the race) wins; unranked riders lose to ranked ones */
export type BaselineResult = { decided: number, hits: number, undecided: number, classifications: number, missingRanking: number };

/**
 * @param grid Values tried for some calibrated values
 * @param base The values of the others (the frozen ones by default)
 * @return Every combination of the grid
 */
export function gridSettings(grid: CalibrationGrid = CALIBRATION_GRID, base: CalibratedValues = FROZEN_VALUES): CalibratedValues[] {
    let settings: CalibratedValues[] = [{ ...base }];
    for (const key of Object.keys(grid) as (keyof CalibratedValues)[]) {
        const values: readonly number[] = grid[key] ?? [];
        settings = settings.flatMap(setting => values.map(value => ({ ...setting, [key]: value })));
    }
    return settings;
}

/**
 * @param metrics Test metrics of one level
 * @return Its accuracy and mean log loss
 */
export function levelMetrics(metrics: Metrics): LevelMetrics {
    return { duels: metrics.pairs, accuracy: metrics.hits / metrics.decided, log_loss: metrics.logLossSum / metrics.pairs };
}

/**
 * @param data Engine input
 * @param values One setting
 * @param evaluation Seasons and duels evaluated
 * @return Its log loss and accuracy on the train and test duels
 */
export function evaluateSetting(data: RatingData, values: CalibratedValues, evaluation: EvaluationOptions = EVALUATION): SettingResult {
    const result = runEngine(data, { parameters: withValues(values), untilSeason: evaluation.testSeasons[1], evaluation });
    return {
        values,
        train: result.train,
        test: result.test,
        trainLogLoss: result.train.logLossSum / result.train.pairs,
        testLogLoss: result.test.logLossSum / result.test.pairs,
        trainAccuracy: result.train.hits / result.train.decided,
        testAccuracy: result.test.hits / result.test.decided,
        testByLevel: Object.fromEntries(LEVELS.map(level => [String(level), levelMetrics(result.testByLevel[level])])),
        testScaleGap: scaleGap(result.testScaleGap, DEFAULT_PARAMETERS.scale),
        testScaleGapDuels: result.testScaleGap.gaps.length,
    };
}

/**
 * Distance of a setting from the synthesis defaults: number of values changed, then relative size of the changes.
 * Only the values of the grid count (the others are the same in every setting).
 */
export function distanceFromDefaults(values: CalibratedValues, grid: CalibrationGrid = CALIBRATION_GRID): [number, number] {
    let changed = 0;
    let size = 0;
    for (const key of Object.keys(grid) as (keyof CalibratedValues)[]) {
        const value: number = values[key];
        const reference: number = DEFAULT_PARAMETERS[key];
        if (value === reference) continue;
        changed++;
        size += reference === 0 ? Math.abs(value) : Math.abs(Math.log((value || 1) / reference));
    }
    return [changed, size];
}

/**
 * Lowest test log loss; among the settings within `tolerance` (relative) of it, the closest to the defaults.
 */
export function chooseSetting(results: SettingResult[], tolerance = 0.005, grid: CalibrationGrid = CALIBRATION_GRID): SettingResult {
    const best: number = Math.min(...results.map(result => result.testLogLoss));
    const candidates: SettingResult[] = results.filter(result => result.testLogLoss <= best * (1 + tolerance));
    candidates.sort((a, b) => {
        const [changedA, sizeA] = distanceFromDefaults(a.values, grid);
        const [changedB, sizeB] = distanceFromDefaults(b.values, grid);
        return changedA - changedB || sizeA - sizeB || a.testLogLoss - b.testLogLoss;
    });
    return candidates[0];
}

/**
 * Accuracy of the UCI World Ranking on the test duels (the same duels as the model's).
 */
export function baselineAccuracy(data: RatingData, rankings: UciRankings, evaluation: EvaluationOptions = EVALUATION): BaselineResult {
    const result: BaselineResult = { decided: 0, hits: 0, undecided: 0, classifications: 0, missingRanking: 0 };
    const seasons: [number, number] = evaluation.testSeasons;
    const minField: number = Math.max(2, evaluation.minFieldSize);
    const uciRank = new Float64Array(data.maxField);
    for (let c = 0; c < data.size; c++) {
        const season: number = data.seasons[c];
        const n: number = data.count[c];
        if (season < seasons[0] || season > seasons[1] || data.cancelled[c] || n < minField) continue;
        if (CLASS_WEIGHTS[data.classCodes[c]] === undefined) continue;
        result.classifications++;

        const day: number = data.days[c];
        let ranking = -1;
        for (let index = 0; index < rankings.days.length && rankings.days[index] < day; index++) ranking = index;
        if (ranking < 0) result.missingRanking++;
        const ranks: Map<number, number> | undefined = ranking >= 0 ? rankings.ranks[ranking] : undefined;
        const offset: number = data.start[c];
        for (let place = 0; place < n; place++) {
            uciRank[place] = ranks?.get(data.riderIds[data.riders[offset + place]]) ?? Number.POSITIVE_INFINITY;
        }
        const top: number = isStageKind(KIND_ORDER[data.kinds[c]]) ? evaluation.topStage : evaluation.topOneDay;
        const t: number = topSize(data.ranks, offset, n, top);
        for (let i = 0; i < t; i++) {
            for (let j = i + 1; j < n; j++) {
                if (data.ranks[offset + i] === data.ranks[offset + j]) continue; // tie in the race: no winner
                result.decided++;
                if (uciRank[i] < uciRank[j]) result.hits++;
                else if (uciRank[i] === uciRank[j]) result.undecided++;
            }
        }
    }
    return result;
}
