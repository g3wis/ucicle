import { db } from './db';

/**
 * Shared reads of the index (the rating tables of functions/SCHEMA.md). Page-specific queries live
 * in each page's own loader (src/views/<page>/load.ts); what more than one page needs is here.
 * Every day is returned as ISO text ("2026-11-17"), never as a Date.
 */

export type RatingStatus = 'classified' | 'provisional' | 'inactive';

export type IndexVersion = {
  id: number,
  name: string,
  label: string | null,
  parameters: Record<string, unknown>,
  /** Day of the latest published ranking (the latest snapshot). */
  asOf: string,
  /** End of the latest successful collection: the page's "Mis à jour le". */
  updatedAt: string | null,
  /** The data version: ETag of every page rendered from it. */
  etag: string,
};

export type RiderRef = {
  id: number,
  slug: string,
  name: string,
  nationCode: string | null,
  nationIso2: string | null,
};

export type RankedRider = RiderRef & {
  rank: number,
  index: number,
  /**
   * The team of his latest result outside championships and the Olympics (where the "team" is the
   * nation), in the UCI's capitals (printed in band type).
   */
  team: string | null,
  /** Places gained (+) or lost (−) since the snapshot 7 days before; null if not ranked then. */
  rankMove: number | null,
};

let cached: { at: number, value: IndexVersion | null } | null = null;

/** The current version of the index, or null while none has been computed. Kept one minute. */
export async function indexVersion(): Promise<IndexVersion | null> {
  if (cached && Date.now() - cached.at < 60_000) return cached.value;
  const sql = db();
  const [v] = await sql<{ id: number, name: string, label: string | null, parameters: Record<string, unknown>, computed: number | null }[]>`
    select id, name, label, parameters, extract(epoch from computed_at)::bigint as computed
    from rating_version where is_current limit 1`;
  let value: IndexVersion | null = null;
  if (v) {
    const [d] = await sql<{ as_of: string | null }[]>`
      select max(date)::text as as_of from ranking_snapshot where rating_version_id = ${v.id}`;
    const [j] = await sql<{ updated: string | null }[]>`
      select (max(finished_at) at time zone 'Europe/Paris')::date::text as updated
      from job_run where status in ('success', 'partial')`;
    if (d?.as_of) {
      value = {
        id: v.id,
        name: v.name,
        label: v.label,
        parameters: v.parameters,
        asOf: d.as_of,
        updatedAt: j?.updated ?? null,
        etag: `${v.name}-${v.computed ?? 0}`,
      };
    }
  }
  cached = { at: Date.now(), value };
  return value;
}

/** How many riders the published ranking holds. */
export async function classifiedCount(v: IndexVersion): Promise<number> {
  const [row] = await db()<{ n: number }[]>`
    select count(*)::int as n from ranking_snapshot where rating_version_id = ${v.id} and date = ${v.asOf}`;
  return row?.n ?? 0;
}

/** Ranks `from` to `to` (inclusive) of the published ranking, with team and 7-day rank move. */
export async function rankingRows(v: IndexVersion, from: number, to: number): Promise<RankedRider[]> {
  const rows = await db()<{
    id: number, slug: string, name: string, nation_code: string | null, nation_iso2: string | null,
    rank: number, index_value: number, team: string | null, previous_rank: number | null,
  }[]>`
    select ri.id, ri.slug, ri.display_name as name, ri.nation_code, ri.nation_iso2,
           s.rank, s.index_value, t.team_name as team, p.rank as previous_rank
    from ranking_snapshot s
    join rider ri on ri.id = s.rider_id
    left join ranking_snapshot p
      on p.rating_version_id = s.rating_version_id and p.rider_id = s.rider_id
     and p.date = (${v.asOf}::date - 7)
    left join lateral (
      select r.team_name from result r join classification c on c.id = r.classification_id
      where r.rider_id = s.rider_id and r.team_name is not null
        and c.kind not like 'championship%' and c.kind not like 'olympic%'
      order by c.date desc, c.id desc limit 1
    ) t on true
    where s.rating_version_id = ${v.id} and s.date = ${v.asOf} and s.rank between ${from} and ${to}
    order by s.rank`;
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    nationCode: r.nation_code,
    nationIso2: r.nation_iso2,
    rank: r.rank,
    index: r.index_value,
    team: r.team,
    rankMove: r.previous_rank === null ? null : r.previous_rank - r.rank,
  }));
}
