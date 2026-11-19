/**
 * Calibrates the Index: runs every setting of the grid (K_base, w_stage, N one-day, N stage, minimum field)
 * from zero over 2019-2025, measures on 2024-2025 the log loss of the pre-race E over the counted duels and the
 * share of duels whose winner was predicted, compares with the UCI World Ranking, prints the table and stores
 * the chosen setting and its metrics in rating_version.parameters.calibration.
 *
 *   yarn calibrate [--no-write] [--quick] [--levels] [--freeze] [--train 2020-2023] [--test 2024-2025]
 *
 * --quick runs a pruned grid (K_base x w_stage at the default N and minimum field, then every N and minimum field
 * at the best of them). --levels runs the grid of the lower levels instead (entry index of the CN and .2 classes,
 * K multiplier of the .2 classes, LEVEL_GRID) at the frozen values of the five others, and prints the scale gap and the test
 * duels by level. The lower-level values stay at their frozen values in the main grid.
 * --freeze writes the chosen values and metrics into src/rating/params.ts (FROZEN_ON, FROZEN_VALUES,
 * FROZEN_CALIBRATION or FROZEN_LEVEL_CALIBRATION); then `yarn build && yarn rate` publishes them.
 */
import { parseArgs } from 'node:util';

import type { Sql } from 'postgres';

import { connect } from '../db/connection.js';
import {
    baselineAccuracy, type BaselineResult, chooseSetting, evaluateSetting, EVALUATION, gridSettings, type SettingResult,
} from '../rating/calibration.js';
import type { EvaluationOptions } from '../rating/engine.js';
import { freezeParameters, PARAMS_SOURCE } from '../rating/freeze.js';
import { loadRatingData } from '../rating/load.js';
import {
    type CalibratedValues, CALIBRATION_GRID, type CalibrationGrid, type CalibrationRecord, DEFAULT_PARAMETERS, FROZEN_CALIBRATION,
    FROZEN_LEVEL_CALIBRATION, FROZEN_ON, FROZEN_VALUES, LEVEL_GRID, type LevelCalibrationRecord,
} from '../rating/params.js';

function seasonRange(value: string | undefined, fallback: [number, number]): [number, number] {
    if (value === undefined) return fallback;
    const match: RegExpMatchArray | null = value.match(/^(\d{4})(?:-(\d{4}))?$/);
    if (!match) throw new Error(`Expected seasons as 2020-2023 or 2024, got '${value}'`);
    return [Number(match[1]), Number(match[2] ?? match[1])];
}

function describe(values: CalibratedValues): string {
    return `K ${String(values.kBase).padStart(2)}  w_stage ${values.stageWeight.toFixed(2)}  N1 ${String(values.topOneDay).padStart(2)}  `
        + `Ns ${String(values.topStage).padStart(2)}  min ${String(values.minFieldSize).padStart(2)}  `
        + `lower ${values.lowerEntryIndex} x${values.lowerK.toFixed(2)}`;
}

function percent(value: number): string {
    return `${(100 * value).toFixed(2)} %`;
}

function levelLine(result: SettingResult, mark = ''): string {
    const level = (key: string): string => `${percent(result.testByLevel[key].accuracy)} ${result.testByLevel[key].log_loss.toFixed(4)}`;
    return `entry ${result.values.lowerEntryIndex}  K x${result.values.lowerK.toFixed(2)} | test ${result.testLogLoss.toFixed(5)} `
        + `${percent(result.testAccuracy)} | gap ${result.testScaleGap.toFixed(1).padStart(6)} | WT ${level('1')} | Pro ${level('2')} `
        + `| .1 ${level('3')} | CN ${level('4')} | .2 ${level('5')} ${mark}`;
}

function line(result: SettingResult, mark = ''): string {
    return `${describe(result.values)} | train ${result.trainLogLoss.toFixed(5)} ${(100 * result.trainAccuracy).toFixed(2)} % `
        + `| test ${result.testLogLoss.toFixed(5)} ${(100 * result.testAccuracy).toFixed(2)} % ${mark}`;
}

/** Whether the values of the grid are the synthesis defaults (for the level grid: no correction) */
function isDefault(values: CalibratedValues, grid: CalibrationGrid = CALIBRATION_GRID): boolean {
    return (Object.keys(grid) as (keyof CalibratedValues)[]).every(key => values[key] === DEFAULT_PARAMETERS[key]);
}

/** Pruned grid: K_base x w_stage at the default N and minimum field, then each other value alone at the best K and w_stage */
function quickSettings(run: (values: CalibratedValues) => SettingResult): SettingResult[] {
    const base: CalibratedValues = {
        ...FROZEN_VALUES, kBase: DEFAULT_PARAMETERS.kBase, stageWeight: DEFAULT_PARAMETERS.stageWeight, topOneDay: DEFAULT_PARAMETERS.topOneDay,
        topStage: DEFAULT_PARAMETERS.topStage, minFieldSize: DEFAULT_PARAMETERS.minFieldSize,
    };
    const results: SettingResult[] = [];
    for (const kBase of CALIBRATION_GRID.kBase ?? []) {
        for (const stageWeight of CALIBRATION_GRID.stageWeight ?? []) results.push(run({ ...base, kBase, stageWeight }));
    }
    const best: SettingResult = results.reduce((a, b) => (b.testLogLoss < a.testLogLoss ? b : a));
    for (const topOneDay of CALIBRATION_GRID.topOneDay ?? []) for (const topStage of CALIBRATION_GRID.topStage ?? []) {
        for (const minFieldSize of CALIBRATION_GRID.minFieldSize ?? []) {
            const values: CalibratedValues = { ...best.values, topOneDay, topStage, minFieldSize };
            if (!results.some(result => JSON.stringify(result.values) === JSON.stringify(values))) results.push(run(values));
        }
    }
    return results;
}

async function main(): Promise<void> {
    const { values: options } = parseArgs({
        args: process.argv.slice(2).filter(arg => arg !== '--'),
        options: {
            'no-write': { type: 'boolean', default: false },
            'quick': { type: 'boolean', default: false },
            'levels': { type: 'boolean', default: false },
            'freeze': { type: 'boolean', default: false },
            'train': { type: 'string' },
            'test': { type: 'string' },
        },
    });
    const evaluation: EvaluationOptions = {
        ...EVALUATION,
        trainSeasons: seasonRange(options.train, EVALUATION.trainSeasons),
        testSeasons: seasonRange(options.test, EVALUATION.testSeasons),
    };
    const sql: Sql = connect(2);
    try {
        const started: number = Date.now();
        const { data, uciRankings } = await loadRatingData(sql, true);
        const seasons = new Map<number, number>();
        for (let c = 0; c < data.size; c++) if (data.count[c] > 0) seasons.set(data.seasons[c], (seasons.get(data.seasons[c]) ?? 0) + 1);
        const [run] = await sql<{ id: number, status: string }[]>`select id, status from job_run order by id desc limit 1`;
        const dataNote: string = `classifications with finishers by season: ${[...seasons.entries()].sort((a, b) => a[0] - b[0])
            .map(([season, count]) => `${season} ${count}`).join(', ')}; latest collector run ${run ? `${run.id} ${run.status}` : 'none'}`;
        console.info(`Read ${data.size} classifications, ${data.riders.length} finishes in ${((Date.now() - started) / 1000).toFixed(1)} s (${dataNote})`);
        for (let season = evaluation.trainSeasons[0] - 1; season <= evaluation.testSeasons[1]; season++) {
            if (!seasons.has(season)) console.warn(`Warning: season ${season} has no classification: the calibration is not meaningful`);
        }

        const baseline: BaselineResult = baselineAccuracy(data, uciRankings, evaluation);
        const baselineShare: number = baseline.hits / baseline.decided;
        console.info(`Baseline (UCI rank at the latest computation before the race): ${(100 * baselineShare).toFixed(2)} % of `
            + `${baseline.decided} test duels, ${(100 * baseline.undecided / baseline.decided).toFixed(2)} % undecided (both unranked), `
            + `${baseline.missingRanking} classifications without an earlier ranking`);

        let done = 0;
        const runOne = (values: CalibratedValues): SettingResult => {
            const result: SettingResult = evaluateSetting(data, values, evaluation);
            done++;
            if (done % 25 === 0) console.info(`  ${done} settings, ${((Date.now() - started) / 1000).toFixed(0)} s`);
            return result;
        };
        const timing: number = Date.now();
        const results: SettingResult[] = options.levels ? gridSettings(LEVEL_GRID).map(runOne)
            : options.quick ? quickSettings(runOne) : gridSettings().map(runOne);
        console.info(`${results.length} settings in ${((Date.now() - timing) / 1000).toFixed(1)} s`);

        if (results.some(result => result.test.pairs === 0 || result.train.pairs === 0)) {
            throw new Error(`No ${results[0].test.pairs === 0 ? 'test' : 'train'} duel: collect seasons 2019 to 2025 before calibrating`);
        }
        if (options.levels) {
            await calibrateLevels(sql, results, dataNote, evaluation, options.freeze ?? false, options['no-write'] ?? false);
            return;
        }
        const chosen: SettingResult = chooseSetting(results);
        const defaults: SettingResult | undefined = results.find(result => isDefault(result.values));
        const sorted: SettingResult[] = [...results].sort((a, b) => a.testLogLoss - b.testLogLoss);
        const bestTrain: SettingResult = results.reduce((a, b) => (b.trainLogLoss < a.trainLogLoss ? b : a));
        console.info(`\nSetting                                          | train log loss, accuracy | test log loss, accuracy   (${chosen.test.pairs} test duels, ${chosen.test.decided} with a winner)`);
        sorted.slice(0, 20).forEach(result => console.info(line(result, result === chosen ? '<- chosen' : isDefault(result.values) ? '<- defaults' : '')));
        if (defaults && sorted.indexOf(defaults) >= 20) console.info(line(defaults, '<- defaults'));
        if (sorted.indexOf(chosen) >= 20) console.info(line(chosen, '<- chosen'));
        console.info(`Worst: ${line(sorted[sorted.length - 1])}`);
        console.info(`Best on train: ${line(bestTrain)}`);
        console.info(`\nChosen: ${describe(chosen.values)}: test log loss ${chosen.testLogLoss.toFixed(5)}, `
            + `winner predicted in ${(100 * chosen.testAccuracy).toFixed(2)} % of duels (UCI rank: ${(100 * baselineShare).toFixed(2)} %)`);

        const record: CalibrationRecord = {
            ran_at: new Date().toISOString(),
            data: dataNote,
            train_seasons: evaluation.trainSeasons,
            test_seasons: evaluation.testSeasons,
            evaluation_pairs: `Duels counted under the synthesis defaults (top ${evaluation.topOneDay} of one-day races, championships and final GCs, `
                + `top ${evaluation.topStage} of stages, at least ${evaluation.minFieldSize} finishers), the same for every setting; `
                + 'E from the indexes before the race; ties in rank count S = 0.5 in the log loss and are left out of the accuracy; '
                + 'E = 0.5 exactly counts as a missed prediction',
            grid: CALIBRATION_GRID as Record<string, readonly number[]>,
            grid_pruned: options.quick ?? false,
            settings_evaluated: results.length,
            selection: 'Lowest test log loss; among the settings within 0.5 % of it, the fewest and smallest changes from the synthesis defaults',
            chosen: chosen.values,
            test_log_loss: chosen.testLogLoss,
            test_accuracy: chosen.testAccuracy,
            train_log_loss: chosen.trainLogLoss,
            train_accuracy: chosen.trainAccuracy,
            test_duels: chosen.test.pairs,
            test_decided_duels: chosen.test.decided,
            baseline_uci_rank_accuracy: baselineShare,
            baseline_uci_rank_undecided_share: baseline.undecided / baseline.decided,
            defaults_test_log_loss: defaults?.testLogLoss ?? Number.NaN,
            defaults_test_accuracy: defaults?.testAccuracy ?? Number.NaN,
        };
        if (chosen.test.decided !== baseline.decided) {
            console.warn(`Warning: ${chosen.test.decided} model duels against ${baseline.decided} baseline duels`);
        }
        console.info(`\nTo freeze, in src/rating/params.ts:\nFROZEN_VALUES = ${JSON.stringify(chosen.values)}\nFROZEN_CALIBRATION = ${JSON.stringify(record, null, 4)}`);

        const today: string = new Date().toISOString().slice(0, 10);
        if (options.freeze) {
            freezeParameters({ values: chosen.values, record, levelRecord: FROZEN_LEVEL_CALIBRATION }, today);
            console.info(`Frozen in ${PARAMS_SOURCE} (FROZEN_ON ${today}): run yarn build && yarn rate to publish`);
        }
        if (options['no-write']) return;
        const version: string = DEFAULT_PARAMETERS.version;
        const label = `Index ${version} (${options.freeze ? today : FROZEN_ON})`;
        await sql`
            insert into rating_version (name, label, parameters, note)
            values (${version}, ${label}, ${sql.json({ calibration: record } as never)}, 'Calibration only, not computed yet')
            on conflict (name) do update set parameters = rating_version.parameters || excluded.parameters
        `;
        console.info(`Calibration stored in rating_version '${version}'.parameters.calibration`);
    } finally {
        await sql.end();
    }
}

/**
 * Chooses the lower-level values (lowest test log loss), prints the table and stores or freezes the record.
 */
async function calibrateLevels(
    sql: Sql, results: SettingResult[], dataNote: string, evaluation: EvaluationOptions, freeze: boolean, noWrite: boolean,
): Promise<void> {
    const chosen: SettingResult = chooseSetting(results, 0, LEVEL_GRID);
    const uncorrected: SettingResult | undefined = results.find(result => isDefault(result.values, LEVEL_GRID));
    if (!uncorrected) throw new Error('The level grid must hold the setting without correction (entry 1500, K x 1)');
    const sorted: SettingResult[] = [...results].sort((a, b) => a.testLogLoss - b.testLogLoss);
    console.info('\nLower levels (CN, .2) | test log loss, accuracy | scale gap (points) | test by level: accuracy, log loss');
    sorted.forEach(result => console.info(levelLine(result, result === chosen ? '<- chosen' : result === uncorrected ? '<- no correction' : '')));
    console.info(`\nChosen: ${describe(chosen.values)}: test log loss ${chosen.testLogLoss.toFixed(5)} (no correction `
        + `${uncorrected.testLogLoss.toFixed(5)}), scale gap ${chosen.testScaleGap.toFixed(1)} (no correction ${uncorrected.testScaleGap.toFixed(1)}) `
        + `over ${chosen.testScaleGapDuels} duels`);

    const fixed: Partial<CalibratedValues> = { ...FROZEN_VALUES };
    for (const key of Object.keys(LEVEL_GRID) as (keyof CalibratedValues)[]) delete fixed[key];
    const record: LevelCalibrationRecord = {
        ran_at: new Date().toISOString(),
        data: dataNote,
        train_seasons: evaluation.trainSeasons,
        test_seasons: evaluation.testSeasons,
        grid: LEVEL_GRID as Record<string, readonly number[]>,
        fixed,
        settings_evaluated: results.length,
        selection: 'Lowest test log loss over the duels of the main calibration (the same for every setting), K multiplier at most 2.5 '
            + '(owner\'s bound of 2026-11-18: a .2 race moves indexes at most as much as a WorldTour race)',
        scale_gap: 'Test duels between a rider who raced WorldTour or ProSeries and a rider who only raced national championships '
            + 'and .2 races, both with X >= 10: points to add to the first one\'s index so that his mean E equals his mean score',
        chosen: { lowerEntryIndex: chosen.values.lowerEntryIndex, lowerK: chosen.values.lowerK },
        test_log_loss: chosen.testLogLoss,
        test_accuracy: chosen.testAccuracy,
        train_log_loss: chosen.trainLogLoss,
        train_accuracy: chosen.trainAccuracy,
        test_by_level: chosen.testByLevel,
        test_scale_gap: chosen.testScaleGap,
        test_scale_gap_duels: chosen.testScaleGapDuels,
        uncorrected_test_log_loss: uncorrected.testLogLoss,
        uncorrected_test_accuracy: uncorrected.testAccuracy,
        uncorrected_test_by_level: uncorrected.testByLevel,
        uncorrected_test_scale_gap: uncorrected.testScaleGap,
    };
    console.info(`\nFROZEN_LEVEL_CALIBRATION = ${JSON.stringify(record, null, 4)}`);
    const today: string = new Date().toISOString().slice(0, 10);
    if (freeze) {
        freezeParameters({ values: chosen.values, record: FROZEN_CALIBRATION, levelRecord: record }, today);
        console.info(`Frozen in ${PARAMS_SOURCE} (FROZEN_ON ${today}): run yarn build && yarn rate to publish`);
    }
    if (noWrite) return;
    const version: string = DEFAULT_PARAMETERS.version;
    const label = `Index ${version} (${freeze ? today : FROZEN_ON})`;
    await sql`
        insert into rating_version (name, label, parameters, note)
        values (${version}, ${label}, ${sql.json({ level_calibration: record } as never)}, 'Calibration only, not computed yet')
        on conflict (name) do update set parameters = rating_version.parameters || excluded.parameters
    `;
    console.info(`Calibration stored in rating_version '${version}'.parameters.level_calibration`);
}

main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
});
