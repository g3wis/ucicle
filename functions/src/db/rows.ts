/**
 * Row types of the Index Ucicle tables (see functions/SCHEMA.md and migrations/).
 * Dates (`date` columns) are 'YYYY-MM-DD' strings, timestamps are `Date`s, ids are numbers.
 */

/** Source of the races and results collected so far */
export const DATARIDE_SOURCE = 'dataride';

/** Sources of `rider_external_id` */
export const EXTERNAL_ID_SOURCES = {
    /** DataRide ObjectId of the rider in the UCI ranking (ObjectRankings) */
    datarideObjectId: 'dataride_object_id',
    /** 11-digit UCI ID */
    uciId: 'uci_id',
    /** Wikidata P11020 ("UCI rider ID"), derived as floor(UciId / 100) - 100000000 */
    uciRiderPageId: 'uci_rider_page_id',
    /** Wikidata item (filled by the Wikidata job) */
    wikidataQid: 'wikidata_qid',
} as const;

export type CompetitionKind = 'one_day' | 'stage_race' | 'championship' | 'olympic';

export type ClassificationKind =
    | 'one_day' | 'one_day_itt' | 'stage' | 'prologue' | 'gc_final'
    | 'championship_road_race' | 'championship_itt' | 'olympic_road_race' | 'olympic_itt';

/** FIN = classified with a rank; NR = no rank and no IRM code; otherwise the UCI IRM code (DNF, DNS, OTL, DSQ...) */
export type ResultStatus = 'FIN' | 'NR' | 'DNF' | 'DNS' | 'OTL' | 'DSQ' | string;

/** How a result row (or a registry entry) was tied to a rider */
export type MatchMethod = 'registry' | 'exact' | 'loose' | 'created' | 'manual';

export type RiderRow = {
    id: number,
    slug: string,
    display_name: string,
    display_name_source: 'rules' | 'wikidata' | 'manual',
    given_name: string | null,
    family_name: string,
    name_raw: string,
    search_name: string,
    birth_date: string | null,
    nation_code: string | null,
    nation_iso2: string | null,
    nation_name: string | null,
    created_from: 'dataride_registry' | 'dataride_result' | 'manual',
    created_at: Date,
    updated_at: Date,
};

export type CompetitionRow = {
    id: number,
    source: string,
    source_id: string,
    name: string,
    class_code: string,
    kind: CompetitionKind,
    is_grand_tour: boolean,
    country_code: string | null,
    country_iso2: string | null,
    country_name: string | null,
    start_date: string,
    end_date: string,
    season: number,
    source_season_id: number | null,
    collected_at: Date | null,
};

export type ClassificationRow = {
    id: number,
    source: string,
    source_id: string,
    race_id: number,
    competition_id: number,
    date: string,
    season: number,
    kind: ClassificationKind,
    race_type: 'IRR' | 'ITT',
    stage_number: number | null,
    stage_label: string | null,
    class_code: string,
    is_grand_tour: boolean,
    competition_name: string,
    race_name: string,
    event_name: string,
    cancelled: boolean,
    row_count: number,
    starters_count: number | null,
    finishers_count: number | null,
    winner_rider_id: number | null,
    winner_name: string | null,
    results_fetched_at: Date | null,
    results_changed_at: Date | null,
};

export type ResultRow = {
    id: number,
    source: string,
    source_id: string,
    classification_id: number,
    rider_id: number,
    status: ResultStatus,
    rank: number | null,
    rank_raw: string | null,
    position: number | null,
    bib: string | null,
    team_name: string | null,
    rider_name_raw: string,
    rider_birth_date: string | null,
    rider_nation_code: string | null,
    result_value_raw: string | null,
    time_seconds: number | null,
    gap_seconds: number | null,
    uci_points: number | null,
    match_method: MatchMethod,
};

export type RatingChangeRow = {
    rating_version_id: number,
    classification_id: number,
    rider_id: number,
    date: string,
    index_before: number,
    delta: number,
    k: number,
    multiplier: number,
    field_size: number,
    rank: number,
    in_top: boolean,
    duels_counted: number,
    duels_won: number,
    duels_expected: number,
    index_after: number,
    experience_after: number | null,
};

export type RiderRatingRow = {
    rating_version_id: number,
    rider_id: number,
    current_index: number,
    experience: number,
    counted_classifications: number,
    last_counted_date: string | null,
    status: 'classified' | 'provisional' | 'inactive',
    best_index: number | null,
    best_index_date: string | null,
};

export type RankingSnapshotRow = {
    rating_version_id: number,
    date: string,
    rider_id: number,
    rank: number,
    index_value: number,
};
