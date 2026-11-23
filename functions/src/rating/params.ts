/**
 * Parameters of the Index Ucicle (section 9 of the research synthesis): the fixed values, the weight tables,
 * and the calibrated values frozen under "Index v1 (<date>)". Changing any value here changes the published
 * index: run `yarn rate` (full recompute) and date the change.
 */
import type { ClassificationKind } from '../db/rows.js';

/** Weight of a classification type (w_type) by classification kind; `gc_final_grand_tour` is the final GC of the Tour, Giro or Vuelta */
export type TypeWeights = Record<ClassificationKind | 'gc_final_grand_tour', number>;

export type RatingParameters = {
    /** Name of the rating version written to `rating_version.name` */
    version: string,
    /** Index of a rider before his first counted classification, when it is above the lower levels */
    initialIndex: number,
    /** Classes of the lower levels (CN, .2), where a rider may enter at `lowerEntryIndex` */
    lowerEntryClasses: readonly string[],
    /** Index of a rider whose first counted classification is of a lower level (calibrated; = initialIndex for none) */
    lowerEntryIndex: number,
    /** Classes where K_c is multiplied by `lowerK` (.2) */
    lowerKClasses: readonly string[],
    /** Multiplier of K_c in the classifications of `lowerKClasses` (calibrated; 1 for none) */
    lowerK: number,
    /** Logistic scale: E = 1 / (1 + 10^((R_j - R_i) / scale)) */
    scale: number,
    /** K_base: K_c = K_base x w_class x w_type */
    kBase: number,
    /** N, size of the counted top T for one-day races, championships, Olympic races and final GCs */
    topOneDay: number,
    /** N, size of the counted top T for stages (road and ITT) and prologues */
    topStage: number,
    /** A classification with fewer finishers than this does not count (2 at least, a duel needs two riders) */
    minFieldSize: number,
    /** w_type of a stage, an ITT stage and a prologue (calibrated) */
    stageWeight: number,
    /** Experience X under which a rider is provisional; the provisional multiplier is 1 + max(0, 1 - X / threshold) */
    experienceThreshold: number,
    /** A rider back after more than this many days without a counted result gets the return multiplier */
    returnGapDays: number,
    /** ... during this many units of experience */
    returnExperience: number,
    /** ... at least this multiplier */
    returnMultiplier: number,
    /** A rider is classified when his last counted result is at most this many days old (inactive otherwise) */
    activeDays: number,
    /** First published day: earlier classifications are the warm-up (computed, shown, not ranked) */
    publishedFrom: string,
    /** w_class by UCI class code; a class missing here does not count */
    classWeights: Record<string, number>,
    /** w_type by kind; the stage and prologue values are replaced by `stageWeight` (see `typeWeights`) */
    baseTypeWeights: TypeWeights,
};

/** w_class: importance of the race by UCI class (1.HC and 2.HC are the 2019 names of 1.Pro and 2.Pro) */
export const CLASS_WEIGHTS: Readonly<Record<string, number>> = {
    '1.UWT': 1.0, '2.UWT': 1.0, 'CM': 1.0, 'JO': 1.0,
    '1.Pro': 0.8, '2.Pro': 0.8, '1.HC': 0.8, '2.HC': 0.8,
    '1.1': 0.6, '2.1': 0.6, 'CC': 0.6,
    'CN': 0.5,
    '1.2': 0.4, '2.2': 0.4,
};

/**
 * Level of a class, 1 (WorldTour, world championships, Olympics) to 5 (.2), for the scale measures of the
 * calibration (the level of a rider is the highest he raced, the lowest number)
 */
export const CLASS_LEVELS: Readonly<Record<string, number>> = {
    '1.UWT': 1, '2.UWT': 1, 'CM': 1, 'JO': 1,
    '1.Pro': 2, '2.Pro': 2, '1.HC': 2, '2.HC': 2,
    '1.1': 3, '2.1': 3, 'CC': 3,
    'CN': 4,
    '1.2': 5, '2.2': 5,
};

/**
 * The lower levels: national championships and .2 races. A rider who only races there meets the riders of the
 * upper levels rarely, so his index drifts on a scale of its own (122 points too high at equal index on the test
 * duels of 2024-2025 without correction): he enters lower (lowerEntryIndex) and .2 races move indexes faster
 * (lowerK). National championships keep their K: the riders of the upper levels race them too.
 */
export const LOWER_ENTRY_CLASSES: readonly string[] = ['CN', '1.2', '2.2'];

/** Classes of the lower-level K multiplier: the .2 races, not the national championships */
export const LOWER_K_CLASSES: readonly string[] = ['1.2', '2.2'];

/** w_type before calibration (stage and prologue at the synthesis default 0.35) */
export const BASE_TYPE_WEIGHTS: Readonly<TypeWeights> = {
    one_day: 1.0,
    championship_road_race: 1.0,
    olympic_road_race: 1.0,
    one_day_itt: 0.7,
    championship_itt: 0.7,
    olympic_itt: 0.7,
    stage: 0.35,
    prologue: 0.35,
    gc_final: 1.0,
    gc_final_grand_tour: 1.5,
};

/** Starting values of section 9 of the synthesis (before calibration) */
export const DEFAULT_PARAMETERS: Readonly<RatingParameters> = {
    version: 'v1',
    initialIndex: 1500,
    lowerEntryClasses: LOWER_ENTRY_CLASSES,
    lowerEntryIndex: 1500,
    lowerKClasses: LOWER_K_CLASSES,
    lowerK: 1,
    scale: 400,
    kBase: 40,
    topOneDay: 30,
    topStage: 15,
    minFieldSize: 10,
    stageWeight: 0.35,
    experienceThreshold: 10,
    returnGapDays: 180,
    returnExperience: 5,
    returnMultiplier: 1.5,
    activeDays: 365,
    publishedFrom: '2020-01-01',
    classWeights: { ...CLASS_WEIGHTS },
    baseTypeWeights: { ...BASE_TYPE_WEIGHTS },
};

/** The parameters the calibration may change, with the grid of section 9 */
// The synthesis grid. On the complete data (2026-11-17) its best sat on the upper edge of K, the
// stage weight and N stage; two extensions (K to 400, stage weight to 1.2) predicted better but
// made a form index, and the owner kept K 80 (FROZEN_VALUES). Extend here to explore again.
// The lower-level values stay at their frozen values in this grid (`yarn calibrate`).
export const CALIBRATION_GRID: CalibrationGrid = {
    kBase: [20, 30, 40, 60, 80],
    stageWeight: [0.2, 0.35, 0.5],
    topOneDay: [20, 30, 60],
    topStage: [10, 15, 25],
    minFieldSize: [0, 10, 20],
};

/**
 * The grid of the lower levels (`yarn calibrate --levels`), the five values above at their frozen values.
 * Entry index 1500 with K x 1 is the index without correction. K x 2.5 is the bound the owner set on 2026-11-18:
 * a .2 race (w_class 0.4) then moves indexes as much as a WorldTour race, never more. Without the bound the
 * prediction kept improving up to K x 6 (test log loss 0.489), with .2 races weighing far more than the
 * WorldTour; the same multiplier on national championships made the top riders lose up to 48 points there.
 */
export const LEVEL_GRID: CalibrationGrid = {
    lowerEntryIndex: [1500, 1450, 1400, 1350, 1300, 1250, 1200, 1150, 1100],
    lowerK: [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5],
};

export type CalibratedValues = Pick<RatingParameters,
    'kBase' | 'stageWeight' | 'topOneDay' | 'topStage' | 'minFieldSize' | 'lowerEntryIndex' | 'lowerK'>;

/** Values tried for some calibrated values; the others keep their frozen value */
export type CalibrationGrid = { readonly [K in keyof CalibratedValues]?: readonly number[] };

/**
 * Metrics measured by `yarn calibrate` for the frozen values (written to rating_version.parameters.calibration).
 * Null until a calibration on the complete 2019-2025 data was run and its result frozen here.
 */
export type CalibrationRecord = {
    ran_at: string,
    data: string,
    train_seasons: [number, number],
    test_seasons: [number, number],
    evaluation_pairs: string,
    grid: Record<string, readonly number[]>,
    grid_pruned: boolean,
    settings_evaluated: number,
    selection: string,
    chosen: CalibratedValues,
    test_log_loss: number,
    test_accuracy: number,
    train_log_loss: number,
    train_accuracy: number,
    test_duels: number,
    test_decided_duels: number,
    baseline_uci_rank_accuracy: number,
    baseline_uci_rank_undecided_share: number,
    defaults_test_log_loss: number,
    defaults_test_accuracy: number,
};

/** Prediction of the test duels in the classifications of one level (see CLASS_LEVELS) */
export type LevelMetrics = { duels: number, accuracy: number, log_loss: number };

/**
 * Calibration of the lower levels (`yarn calibrate --levels`): the entry index and the K multiplier of the
 * CN and .2 classes, the other values at their frozen values. The scale gap is the number of points to add to
 * the index of the riders of the upper levels so that their duels against the riders of the lower levels are
 * predicted right on average (0 when both levels share one scale).
 */
export type LevelCalibrationRecord = {
    ran_at: string,
    data: string,
    train_seasons: [number, number],
    test_seasons: [number, number],
    grid: Record<string, readonly number[]>,
    fixed: Partial<CalibratedValues>,
    settings_evaluated: number,
    selection: string,
    scale_gap: string,
    chosen: Pick<CalibratedValues, 'lowerEntryIndex' | 'lowerK'>,
    test_log_loss: number,
    test_accuracy: number,
    train_log_loss: number,
    train_accuracy: number,
    test_by_level: Record<string, LevelMetrics>,
    test_scale_gap: number,
    test_scale_gap_duels: number,
    uncorrected_test_log_loss: number,
    uncorrected_test_accuracy: number,
    uncorrected_test_by_level: Record<string, LevelMetrics>,
    uncorrected_test_scale_gap: number,
};

// BEGIN FROZEN: values of the published Index v1, rewritten by `yarn calibrate --freeze` (or by hand), then `yarn build && yarn rate`
/** Day the v1 parameters were frozen (label "Index v1 (<day>)") */
export const FROZEN_ON = '2026-11-18';

/**
 * Values frozen for Index v1 (train 2020-2023, test 2024-2025). The five main values are the owner's choice of
 * 2026-11-17, "K 80, équilibré": the best setting of the synthesis grid on the complete data. Higher K values
 * predict slightly better (77.3 % of duels at K 320) but turn the index into a form index (João Almeida 300th,
 * Mathieu van der Poel 32nd as of 2026-11-08); K 80 keeps a ranking fans recognise. The lower-level values
 * (entry 1250 at CN and .2, K x 2.5 in .2 races) are the owner's choice of 2026-11-18: the best of the level grid
 * with a .2 race weighing at most as much as a WorldTour race (`yarn calibrate --levels`).
 */
export const FROZEN_VALUES: Readonly<CalibratedValues> = {
    kBase: 80,
    stageWeight: 0.5,
    topOneDay: 30,
    topStage: 25,
    minFieldSize: 10,
    lowerEntryIndex: 1250,
    lowerK: 2.5,
};

/** Calibration of the frozen values (see CalibrationRecord) */
export const FROZEN_CALIBRATION: CalibrationRecord | null = {
    ran_at: '2026-11-17T14:15:00.000Z',
    data: 'classifications with finishers by season: 2019 1415, 2020 660, 2021 966, 2022 1121, 2023 1282, 2024 1248, 2025 1261, 2026 1305, 2027 29; latest collector run 4 partial (3 minor errors)',
    train_seasons: [2020, 2023],
    test_seasons: [2024, 2025],
    evaluation_pairs: 'Duels counted under the synthesis defaults (top 30 of one-day races, championships and final GCs, top 15 of stages, at least 10 finishers), the same for every setting; E from the indexes before the race; ties in rank count S = 0.5 in the log loss and are left out of the accuracy; E = 0.5 exactly counts as a missed prediction',
    grid: {
        kBase: [20, 30, 40, 60, 80],
        stageWeight: [0.2, 0.35, 0.5],
        topOneDay: [20, 30, 60],
        topStage: [10, 15, 25],
        minFieldSize: [0, 10, 20],
    },
    grid_pruned: false,
    settings_evaluated: 405,
    selection: 'Lowest test log loss on the synthesis grid (405 settings). Two extensions of the grid (K up to 400, stage weight up to 1.2) predicted better, up to a test log loss of 0.4716 and 77.4 % of duels at K 320, but made the ranking follow recent form only; the owner chose the grid best, K 80, for a ranking fans recognise.',
    chosen: {
        kBase: 80,
        stageWeight: 0.5,
        topOneDay: 30,
        topStage: 25,
        minFieldSize: 10,
        lowerEntryIndex: 1500,
        lowerK: 1,
    },
    test_log_loss: 0.5235676243556082,
    test_accuracy: 0.7460657378356874,
    train_log_loss: 0.5437858602591146,
    train_accuracy: 0.7306773439114296,
    test_duels: 3938875,
    test_decided_duels: 3938858,
    baseline_uci_rank_accuracy: 0.6414349032130633,
    baseline_uci_rank_undecided_share: 0.09902667219788071,
    defaults_test_log_loss: 0.5703714301090819,
    defaults_test_accuracy: 0.7179773934475424,
};

/** Calibration of the lower levels (see LevelCalibrationRecord), null before the first one */
export const FROZEN_LEVEL_CALIBRATION: LevelCalibrationRecord | null = {
    ran_at: '2026-11-18T07:19:46.983Z',
    data: 'classifications with finishers by season: 2019 1415, 2020 660, 2021 966, 2022 1121, 2023 1282, 2024 1248, 2025 1261, 2026 1305, 2027 29; latest collector run 4 partial',
    train_seasons: [2020, 2023],
    test_seasons: [2024, 2025],
    grid: {
        lowerEntryIndex: [1500, 1450, 1400, 1350, 1300, 1250, 1200, 1150, 1100],
        lowerK: [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5],
    },
    fixed: {
        kBase: 80,
        stageWeight: 0.5,
        topOneDay: 30,
        topStage: 25,
        minFieldSize: 10,
    },
    settings_evaluated: 63,
    selection: 'Lowest test log loss over the duels of the main calibration (the same for every setting), K multiplier at most 2.5 (owner\'s bound of 2026-11-18: a .2 race moves indexes at most as much as a WorldTour race)',
    scale_gap: 'Test duels between a rider who raced WorldTour or ProSeries and a rider who only raced national championships and .2 races, both with X >= 10: points to add to the first one\'s index so that his mean E equals his mean score',
    chosen: {
        lowerEntryIndex: 1250,
        lowerK: 2.5,
    },
    test_log_loss: 0.4994493423453448,
    test_accuracy: 0.7569315776298613,
    train_log_loss: 0.5189733680338326,
    train_accuracy: 0.7440755309484308,
    test_by_level: {
        '1': {
            duels: 830715,
            accuracy: 0.7711315460333472,
            log_loss: 0.4779515309598015,
        },
        '2': {
            duels: 703200,
            accuracy: 0.7760349488551604,
            log_loss: 0.4723982913087252,
        },
        '3': {
            duels: 843269,
            accuracy: 0.7635938235604535,
            log_loss: 0.4917408321429503,
        },
        '4': {
            duels: 133884,
            accuracy: 0.6467824463118581,
            log_loss: 0.5893151700972662,
        },
        '5': {
            duels: 1427807,
            accuracy: 0.7456545095188268,
            log_loss: 0.5214058145302334,
        },
    },
    test_scale_gap: 49.01771013872247,
    test_scale_gap_duels: 146500,
    uncorrected_test_log_loss: 0.5235676243556082,
    uncorrected_test_accuracy: 0.7460657378356874,
    uncorrected_test_by_level: {
        '1': {
            duels: 830715,
            accuracy: 0.7720054940755712,
            log_loss: 0.4774298975689673,
        },
        '2': {
            duels: 703200,
            accuracy: 0.7760434812905024,
            log_loss: 0.48044378901399537,
        },
        '3': {
            duels: 843269,
            accuracy: 0.7637408703509794,
            log_loss: 0.5036273860467131,
        },
        '4': {
            duels: 133884,
            accuracy: 0.6185919701213819,
            log_loss: 0.6142138578570787,
        },
        '5': {
            duels: 1427807,
            accuracy: 0.7177227654814883,
            log_loss: 0.5749267276599099,
        },
    },
    uncorrected_test_scale_gap: 122.06985717605365,
};
// END FROZEN

/**
 * @param values Calibrated values to apply
 * @return The full parameter set: defaults with these values
 */
export function withValues(values: CalibratedValues): RatingParameters {
    return { ...DEFAULT_PARAMETERS, classWeights: { ...CLASS_WEIGHTS }, baseTypeWeights: { ...BASE_TYPE_WEIGHTS }, ...values };
}

/** The parameters of the published version */
export function frozenParameters(): RatingParameters {
    return withValues(FROZEN_VALUES);
}

/**
 * @param parameters Parameter set
 * @return w_type by kind actually used (stage and prologue at `stageWeight`)
 */
export function typeWeights(parameters: RatingParameters): TypeWeights {
    return { ...parameters.baseTypeWeights, stage: parameters.stageWeight, prologue: parameters.stageWeight };
}

/**
 * @param parameters Parameter set
 * @return The JSON written to rating_version.parameters: every value and weight table actually used, snake_case
 */
export function parametersJson(parameters: RatingParameters): Record<string, unknown> {
    return {
        model: 'Multi-competitor Elo by duels, truncated to the top N (research synthesis, section 9)',
        initial_index: parameters.initialIndex,
        lower_levels: {
            entry_classes: parameters.lowerEntryClasses,
            entry_index: parameters.lowerEntryIndex,
            k_classes: parameters.lowerKClasses,
            k_multiplier: parameters.lowerK,
            rule: `a rider whose first counted classification is of an entry class starts at ${parameters.lowerEntryIndex}; `
                + `in the classifications of the k classes, k is multiplied by ${parameters.lowerK}`,
        },
        logistic_scale: parameters.scale,
        k_base: parameters.kBase,
        top_n: {
            one_day: parameters.topOneDay, championship: parameters.topOneDay, olympic: parameters.topOneDay,
            gc_final: parameters.topOneDay, stage: parameters.topStage, prologue: parameters.topStage,
        },
        top_n_by_kind: Object.fromEntries(KIND_ORDER.map(kind => [kind, isStageKind(kind) ? parameters.topStage : parameters.topOneDay])),
        min_field_size: Math.max(2, parameters.minFieldSize),
        stage_weight: parameters.stageWeight,
        class_weights: parameters.classWeights,
        type_weights: typeWeights(parameters),
        experience_threshold: parameters.experienceThreshold,
        provisional_multiplier: `1 + max(0, 1 - X / ${parameters.experienceThreshold})`,
        return_bonus: {
            gap_days: parameters.returnGapDays,
            experience: parameters.returnExperience,
            min_multiplier: parameters.returnMultiplier,
        },
        active_days: parameters.activeDays,
        published_from: parameters.publishedFrom,
        warm_up: `classifications dated before ${parameters.publishedFrom} are computed and stored (rating_change) but not ranked`,
        field: 'riders with status FIN; ties in rank score 0.5; T = the riders ranked at or above the N-th finisher',
        order: 'date, then stages before the final GC of the same day, then classification id',
        formula: 'delta = k x multiplier x (duels_won - duels_expected) / (field_size - 1), k = k_base x w_class x w_type (x lower_levels.k_multiplier)',
        decay: 'none (no inactivity decay, no end-of-season regression)',
    };
}

/** Every classification kind, in a fixed order (index used by the engine) */
export const KIND_ORDER: readonly ClassificationKind[] = [
    'one_day', 'one_day_itt', 'stage', 'prologue', 'gc_final',
    'championship_road_race', 'championship_itt', 'olympic_road_race', 'olympic_itt',
];

/**
 * @param kind Classification kind
 * @return Whether it is a stage or a prologue (top N = `topStage`, w_type = `stageWeight`)
 */
export function isStageKind(kind: ClassificationKind): boolean {
    return kind === 'stage' || kind === 'prologue';
}

/**
 * @param kind Classification kind
 * @param isGrandTour Whether the competition is the Tour, the Giro or the Vuelta
 * @param weights w_type table (see `typeWeights`)
 * @return w_type of the classification
 */
export function typeWeight(kind: ClassificationKind, isGrandTour: boolean, weights: TypeWeights): number {
    return kind === 'gc_final' && isGrandTour ? weights.gc_final_grand_tour : weights[kind];
}
