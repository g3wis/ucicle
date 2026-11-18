-- Rating engine (Index Ucicle v1): columns the website prints and indexes it reads by.
-- Documented in functions/SCHEMA.md, section "Rating engine".

-- K_c = K_base x w_class x w_type: the two weights of each counted classification, so the result line can print
-- "K = 40 x 1,0 x 0,35" exactly as the engine computed it.
alter table rating_change add column w_class double precision;
alter table rating_change add column w_type double precision;

-- Day the statuses and the latest snapshot are computed for, and the run summary (season ends, counts, drift).
alter table rating_version add column as_of_date date;
alter table rating_version add column summary jsonb not null default '{}';

-- Latest counted classifications and the movers of a day.
create index rating_change_date_idx on rating_change (rating_version_id, date, classification_id);
-- A rider's rank history within a version.
create index ranking_snapshot_version_rider_idx on ranking_snapshot (rating_version_id, rider_id, date);
