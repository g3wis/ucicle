-- Index Ucicle: results of men elite road racing, rider identities and the outputs of the rating engine.
-- Every table and column is documented in functions/SCHEMA.md.
-- Plain PostgreSQL, no extension (the production database is Scaleway Serverless SQL Database).

-- Riders ------------------------------------------------------------------------------------------

create table rider (
    id integer generated always as identity primary key,
    slug text not null unique,
    display_name text not null,
    display_name_source text not null default 'rules' check (display_name_source in ('rules', 'wikidata', 'manual')),
    given_name text,
    family_name text not null,
    name_raw text not null,
    search_name text not null,
    birth_date date,
    nation_code text,
    nation_iso2 text,
    nation_name text,
    created_from text not null check (created_from in ('dataride_registry', 'dataride_result', 'manual')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index rider_search_name_idx on rider (search_name text_pattern_ops);
create index rider_birth_date_idx on rider (birth_date);

create table rider_external_id (
    source text not null,
    external_id text not null,
    rider_id integer not null references rider (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (source, external_id)
);
create index rider_external_id_rider_idx on rider_external_id (rider_id);

create table rider_alias (
    id integer generated always as identity primary key,
    rider_id integer not null references rider (id) on delete cascade,
    alias_key text not null,
    name_raw text not null,
    birth_date date,
    nation_code text,
    match_method text not null check (match_method in ('registry', 'exact', 'loose', 'created', 'manual')),
    source text not null,
    created_at timestamptz not null default now(),
    unique (alias_key, rider_id)
);
create index rider_alias_rider_idx on rider_alias (rider_id);

create table rider_slug_history (
    slug text primary key,
    rider_id integer not null references rider (id) on delete cascade,
    replaced_at timestamptz not null default now()
);
create index rider_slug_history_rider_idx on rider_slug_history (rider_id);

create table rider_profile (
    rider_id integer primary key references rider (id) on delete cascade,
    wikidata_qid text,
    wikidata_label text,
    height_m double precision,
    weight_kg double precision,
    frwiki_url text,
    enwiki_url text,
    fetched_at timestamptz
);

create table uci_ranking_entry (
    id integer generated always as identity primary key,
    rider_id integer not null references rider (id) on delete cascade,
    source text not null default 'dataride',
    object_id text not null,
    uci_id text,
    season integer not null,
    source_season_id integer not null,
    ranking_date date not null,
    moment_id integer,
    rank integer not null,
    points double precision not null,
    team_code text,
    team_name text,
    nation_code text,
    name_raw text not null,
    fetched_at timestamptz not null default now(),
    unique (source, object_id, season, ranking_date)
);
create index uci_ranking_entry_rider_idx on uci_ranking_entry (rider_id, season);
create index uci_ranking_entry_season_rank_idx on uci_ranking_entry (season, ranking_date, rank);

-- Races and results -------------------------------------------------------------------------------

create table competition (
    id integer generated always as identity primary key,
    source text not null,
    source_id text not null,
    name text not null,
    class_code text not null,
    kind text not null check (kind in ('one_day', 'stage_race', 'championship', 'olympic')),
    is_grand_tour boolean not null default false,
    country_code text,
    country_iso2 text,
    country_name text,
    start_date date not null,
    end_date date not null,
    season integer not null,
    source_season_id integer,
    collected_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (source, source_id)
);
create index competition_dates_idx on competition (start_date, end_date);
create index competition_season_idx on competition (season);

create table race (
    id integer generated always as identity primary key,
    source text not null,
    source_id text not null,
    competition_id integer not null references competition (id) on delete cascade,
    name text not null,
    race_code text,
    race_type_code text,
    category_code text not null,
    date date not null,
    sequence integer,
    in_scope boolean not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (source, source_id)
);
create index race_competition_idx on race (competition_id);

create table classification (
    id integer generated always as identity primary key,
    source text not null,
    source_id text not null,
    race_id integer not null references race (id) on delete cascade,
    competition_id integer not null references competition (id) on delete cascade,
    date date not null,
    season integer not null,
    kind text not null check (kind in (
        'one_day', 'one_day_itt', 'stage', 'prologue', 'gc_final',
        'championship_road_race', 'championship_itt', 'olympic_road_race', 'olympic_itt'
    )),
    race_type text not null check (race_type in ('IRR', 'ITT')),
    stage_number integer,
    stage_label text,
    class_code text not null,
    is_grand_tour boolean not null default false,
    competition_name text not null,
    race_name text not null,
    event_name text not null,
    cancelled boolean not null default false,
    row_count integer not null default 0,
    starters_count integer,
    finishers_count integer,
    winner_rider_id integer references rider (id),
    winner_name text,
    results_fetched_at timestamptz,
    results_changed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (source, source_id)
);
create index classification_date_idx on classification (date, id);
create index classification_competition_idx on classification (competition_id);
create index classification_race_idx on classification (race_id);

create table result (
    id integer generated always as identity primary key,
    source text not null,
    source_id text not null,
    classification_id integer not null references classification (id) on delete cascade,
    rider_id integer not null references rider (id),
    status text not null,
    rank integer,
    rank_raw text,
    position integer,
    bib text,
    team_name text,
    rider_name_raw text not null,
    rider_birth_date date,
    rider_nation_code text,
    result_value_raw text,
    time_seconds double precision,
    gap_seconds double precision,
    uci_points double precision,
    match_method text not null check (match_method in ('registry', 'exact', 'loose', 'created', 'manual')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (source, source_id)
);
create index result_rider_idx on result (rider_id, classification_id);
create index result_classification_idx on result (classification_id, position);

create table rider_review (
    id integer generated always as identity primary key,
    kind text not null check (kind in ('ambiguous_match', 'possible_duplicate', 'missing_birth_date', 'registry_duplicate')),
    dedupe_key text not null unique,
    rider_id integer references rider (id) on delete cascade,
    candidate_rider_ids integer[] not null default '{}',
    name_raw text,
    birth_date date,
    nation_code text,
    classification_id integer references classification (id) on delete set null,
    note text,
    status text not null default 'open' check (status in ('open', 'merged', 'dismissed')),
    created_at timestamptz not null default now(),
    resolved_at timestamptz
);
create index rider_review_status_idx on rider_review (status, kind);

-- Rating engine outputs (written by the rating engine, not by the collector) ---------------------

create table rating_version (
    id integer generated always as identity primary key,
    name text not null unique,
    label text,
    parameters jsonb not null default '{}',
    note text,
    is_current boolean not null default false,
    frozen_at timestamptz,
    computed_at timestamptz,
    created_at timestamptz not null default now()
);
create unique index rating_version_current_idx on rating_version (is_current) where is_current;

create table rating_change (
    rating_version_id integer not null references rating_version (id) on delete cascade,
    classification_id integer not null references classification (id) on delete cascade,
    rider_id integer not null references rider (id) on delete cascade,
    date date not null,
    index_before double precision not null,
    delta double precision not null,
    k double precision not null,
    multiplier double precision not null,
    field_size integer not null,
    rank integer not null,
    in_top boolean not null,
    duels_counted integer not null,
    duels_won double precision not null,
    duels_expected double precision not null,
    index_after double precision not null,
    experience_after double precision,
    primary key (rating_version_id, classification_id, rider_id)
);
create index rating_change_rider_idx on rating_change (rating_version_id, rider_id, date);

create table rider_rating (
    rating_version_id integer not null references rating_version (id) on delete cascade,
    rider_id integer not null references rider (id) on delete cascade,
    current_index double precision not null,
    experience double precision not null,
    counted_classifications integer not null default 0,
    last_counted_date date,
    status text not null check (status in ('classified', 'provisional', 'inactive')),
    best_index double precision,
    best_index_date date,
    updated_at timestamptz not null default now(),
    primary key (rating_version_id, rider_id)
);
create index rider_rating_status_idx on rider_rating (rating_version_id, status, current_index desc);

create table ranking_snapshot (
    rating_version_id integer not null references rating_version (id) on delete cascade,
    date date not null,
    rider_id integer not null references rider (id) on delete cascade,
    rank integer not null,
    index_value double precision not null,
    primary key (rating_version_id, date, rider_id)
);
create index ranking_snapshot_date_rank_idx on ranking_snapshot (rating_version_id, date, rank);
create index ranking_snapshot_rider_idx on ranking_snapshot (rider_id, date);

-- Collector runs ----------------------------------------------------------------------------------

create table job_run (
    id integer generated always as identity primary key,
    kind text not null,
    args jsonb not null default '{}',
    status text not null default 'running' check (status in ('running', 'success', 'partial', 'failed', 'interrupted')),
    started_at timestamptz not null default now(),
    heartbeat_at timestamptz not null default now(),
    finished_at timestamptz,
    requests integer not null default 0,
    request_retries integer not null default 0,
    median_request_ms integer,
    competitions integer not null default 0,
    classifications integer not null default 0,
    rows_inserted integer not null default 0,
    rows_updated integer not null default 0,
    rows_deleted integer not null default 0,
    riders_created integer not null default 0,
    errors integer not null default 0,
    error_messages jsonb not null default '[]',
    oldest_changed_date date,
    registry_refreshed boolean not null default false
);
create index job_run_kind_idx on job_run (kind, started_at desc);
