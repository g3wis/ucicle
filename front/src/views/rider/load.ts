import type { Lang } from '../../i18n/language';
import { db } from '../../server/db';
import {
  indexVersion, rankingRows, type IndexVersion, type RankedRider, type RatingStatus,
} from '../../server/index-data';
import type { RaceKind } from '../../content/rider';

/**
 * Everything the rider page prints, read in one go. Days are ISO text. The page shows the
 * rider's counted results with their calculation (rating_change of the current version), and his
 * non-counted rows (abandons...) with their status.
 */
export type RiderResultRow = {
  classificationId: number,
  /** The competition: the lines of one stage race share it and print as one race (decision E1). */
  competitionId: number,
  /** The race's own first and last days (competition.start_date, end_date), for a stage race's heading. */
  raceStart: string | null,
  raceEnd: string | null,
  date: string,
  season: number,
  kind: RaceKind,
  stageNumber: number | null,
  stageLabel: string | null,
  classCode: string,
  isGrandTour: boolean,
  /** The UCI's competition name; print it through competitionName() (championships are renamed). */
  competition: string,
  /** Host country of the competition (ISO alpha-2): names a national championship. */
  country: string | null,
  finishers: number | null,
  status: string,
  rank: number | null,
  team: string | null,
  calc: null | {
    before: number, delta: number, k: number, wClass: number | null, wType: number | null,
    multiplier: number, fieldSize: number,
    inTop: boolean, counted: number, won: number, expected: number, after: number,
  },
};

export type HistoryPoint = { date: string, index: number };

export type SeasonRow = {
  season: number, index: number | null, rank: number | null, counted: number, wins: number,
};

export type RiderData = {
  version: IndexVersion,
  rider: {
    id: number, slug: string, name: string, birthDate: string | null,
    nationCode: string | null, nationIso2: string | null,
  },
  rating: null | {
    index: number, experience: number, status: RatingStatus, lastCounted: string | null,
    best: number | null, bestDate: string | null, counted: number,
  },
  rank: number | null,
  team: string | null,
  uci: null | { rank: number, date: string, uciId: string | null, pageId: string | null },
  profile: null | {
    qid: string | null, height: number | null, weight: number | null, frwiki: string | null, enwiki: string | null,
  },
  history: HistoryPoint[],
  seasons: SeasonRow[],
  results: RiderResultRow[],
  wins: number,
  countedSince2020: number,
  neighbours: RankedRider[],
  teammates: RankedRider[],
  /** The top N counted in a classification, by kind (parameters.top_n_by_kind). */
  topN: Record<string, number>,
  /** K before the weights (parameters.k_base). */
  kBase: number | null,
  /** Experience needed to leave the provisional status. */
  threshold: number,
};

export type RiderResult = { kind: 'found', data: RiderData } | { kind: 'moved', slug: string } | null;

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export async function loadRider(_lang: Lang, slug: string): Promise<RiderResult> {
  if (!/^[a-z0-9-]{2,120}$/.test(slug)) return null;
  const sql = db();
  const [found] = await sql<{
    id: number, slug: string, name: string, birth_date: string | null,
    nation_code: string | null, nation_iso2: string | null,
  }[]>`
    select id, slug, display_name as name, birth_date::text, nation_code, nation_iso2 from rider where slug = ${slug}`;
  if (!found) {
    const [moved] = await sql<{ slug: string }[]>`
      select ri.slug from rider_slug_history h join rider ri on ri.id = h.rider_id where h.slug = ${slug}`;
    return moved ? { kind: 'moved', slug: moved.slug } : null;
  }
  const version = await indexVersion();
  if (!version) return null;
  const v = version.id;
  const r = found.id;

  const [rating, snap, team, uci, profile, history, seasons, results, teammateIds] = await Promise.all([
    sql`select current_index, experience, status, last_counted_date::text, best_index, best_index_date::text, counted_classifications
        from rider_rating where rating_version_id = ${v} and rider_id = ${r}`,
    sql`select rank from ranking_snapshot where rating_version_id = ${v} and date = ${version.asOf} and rider_id = ${r}`,
    sql`select res.team_name from result res join classification c on c.id = res.classification_id
        where res.rider_id = ${r} and res.team_name is not null
          and c.kind not like 'championship%' and c.kind not like 'olympic%'
        order by c.date desc, c.id desc limit 1`,
    sql`select u.rank, u.ranking_date::text as date,
          (select external_id from rider_external_id where rider_id = ${r} and source = 'uci_id' limit 1) as uci_id,
          (select external_id from rider_external_id where rider_id = ${r} and source = 'uci_rider_page_id' limit 1) as page_id
        from uci_ranking_entry u where u.rider_id = ${r} order by u.ranking_date desc limit 1`,
    sql`select wikidata_qid, height_m, weight_kg, frwiki_url, enwiki_url from rider_profile where rider_id = ${r}`,
    // A day's value and a season's end value follow the engine's processing order
    // (functions/src/rating/data.ts): by day, a final GC after the other classifications of the
    // same day, then by id. The last one processed is the first of this order.
    sql`select rc.date::text as date,
               (array_agg(rc.index_after order by (c.kind = 'gc_final') desc, rc.classification_id desc))[1] as index
        from rating_change rc join classification c on c.id = rc.classification_id
        where rc.rating_version_id = ${v} and rc.rider_id = ${r} group by rc.date order by rc.date`,
    sql`with seasons as (
          select c.season, min(c.date) as d0, max(c.date) as d1 from classification c group by c.season
        ), mine as (
          select c.season, count(*)::int as counted, count(*) filter (where rc.rank = 1)::int as wins,
                 (array_agg(rc.index_after
                   order by rc.date desc, (c.kind = 'gc_final') desc, rc.classification_id desc))[1] as index
          from rating_change rc join classification c on c.id = rc.classification_id
          where rc.rating_version_id = ${v} and rc.rider_id = ${r} group by c.season
        )
        select m.season, m.counted, m.wins, m.index, s.rank
        from mine m join seasons se on se.season = m.season
        left join lateral (
          select rs.rank from ranking_snapshot rs
          where rs.rating_version_id = ${v} and rs.rider_id = ${r}
            and rs.date = (select max(date) from ranking_snapshot where rating_version_id = ${v} and date between se.d0 and se.d1)
        ) s on true
        order by m.season desc`,
    sql`select c.id, c.competition_id, c.date::text, c.season, c.kind, c.stage_number, c.stage_label, c.class_code, c.is_grand_tour,
               c.competition_name, comp.country_iso2, comp.start_date::text as race_start, comp.end_date::text as race_end, c.finishers_count, res.status, res.rank, res.team_name,
               rc.index_before, rc.delta, rc.k, rc.w_class, rc.w_type, rc.multiplier, rc.field_size, rc.in_top, rc.duels_counted,
               rc.duels_won, rc.duels_expected, rc.index_after
        from result res join classification c on c.id = res.classification_id
        left join competition comp on comp.id = c.competition_id
        left join rating_change rc on rc.rating_version_id = ${v} and rc.classification_id = c.id and rc.rider_id = res.rider_id
        where res.rider_id = ${r} and not c.cancelled
        order by c.date desc, (c.kind = 'gc_final') desc, c.id desc`,
    sql`select distinct mate.rider_id
        from result me
        join classification c on c.id = me.classification_id
        join result mate on mate.classification_id = me.classification_id
          and mate.team_name = me.team_name and mate.rider_id <> me.rider_id
        where me.rider_id = ${r} and c.date >= (${version.asOf}::date - 365)
          and c.kind not like 'championship%' and c.kind not like 'olympic%'`,
  ]);

  const rt = rating[0];
  const rank = snap[0]?.rank ?? null;
  const ids = teammateIds.map((t) => Number(t.rider_id));
  const [neighbours, mateRanks] = await Promise.all([
    rank ? rankingRows(version, Math.max(1, rank - 3), rank + 3) : Promise.resolve([] as RankedRider[]),
    ids.length
      ? sql<{ rank: number }[]>`select rank from ranking_snapshot where rating_version_id = ${v} and date = ${version.asOf}
          and rider_id in ${sql(ids)} order by rank limit 6`
      : Promise.resolve([] as { rank: number }[]),
  ]);
  const teammates = (await Promise.all(mateRanks.map((m) => rankingRows(version, m.rank, m.rank)))).flat();

  const rows: RiderResultRow[] = results.map((x) => ({
    classificationId: Number(x.id),
    competitionId: Number(x.competition_id),
    raceStart: x.race_start ?? null,
    raceEnd: x.race_end ?? null,
    date: x.date,
    season: Number(x.season),
    kind: x.kind,
    stageNumber: num(x.stage_number),
    stageLabel: x.stage_label,
    classCode: x.class_code,
    isGrandTour: Boolean(x.is_grand_tour),
    competition: x.competition_name,
    country: x.country_iso2 ?? null,
    finishers: num(x.finishers_count),
    status: x.status,
    rank: num(x.rank),
    team: x.team_name,
    calc: x.index_before === null ? null : {
      before: Number(x.index_before),
      delta: Number(x.delta),
      k: Number(x.k),
      wClass: num(x.w_class),
      wType: num(x.w_type),
      multiplier: Number(x.multiplier),
      fieldSize: Number(x.field_size),
      inTop: Boolean(x.in_top),
      counted: Number(x.duels_counted),
      won: Number(x.duels_won),
      expected: Number(x.duels_expected),
      after: Number(x.index_after),
    },
  }));

  const params = version.parameters;
  const threshold = typeof params.experience_threshold === 'number' ? params.experience_threshold : 10;

  return {
    kind: 'found',
    data: {
      version,
      rider: {
        id: r,
        slug: found.slug,
        name: found.name,
        birthDate: found.birth_date,
        nationCode: found.nation_code,
        nationIso2: found.nation_iso2,
      },
      rating: rt ? {
        index: Number(rt.current_index),
        experience: Number(rt.experience),
        status: rt.status,
        lastCounted: rt.last_counted_date,
        best: num(rt.best_index),
        bestDate: rt.best_index_date,
        counted: Number(rt.counted_classifications),
      } : null,
      rank,
      team: team[0]?.team_name ?? null,
      uci: uci[0] ? {
        rank: Number(uci[0].rank), date: uci[0].date, uciId: uci[0].uci_id, pageId: uci[0].page_id,
      } : null,
      profile: profile[0] ? {
        qid: profile[0].wikidata_qid,
        height: num(profile[0].height_m),
        weight: num(profile[0].weight_kg),
        frwiki: profile[0].frwiki_url,
        enwiki: profile[0].enwiki_url,
      } : null,
      history: history.map((h) => ({ date: h.date, index: Number(h.index) })),
      seasons: seasons.map((s) => ({
        season: Number(s.season),
        index: num(s.index),
        rank: num(s.rank),
        counted: Number(s.counted),
        wins: Number(s.wins),
      })),
      results: rows,
      wins: rows.filter((x) => x.calc && x.rank === 1 && x.date >= '2020-01-01').length,
      countedSince2020: rows.filter((x) => x.calc && x.date >= '2020-01-01').length,
      neighbours,
      teammates,
      topN: (params.top_n_by_kind ?? {}) as Record<string, number>,
      kBase: typeof params.k_base === 'number' ? params.k_base : null,
      threshold,
    },
  };
}
