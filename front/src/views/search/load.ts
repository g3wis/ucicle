import type { Lang } from '../../i18n/language';
import { db } from '../../server/db';
import {
  classifiedCount, indexVersion, type IndexVersion, type RatingStatus,
} from '../../server/index-data';
import { foldSearch } from '../../i18n/format';
import { rankAnchor } from '../../app/nav';

/** A rider found by name: what the search page and the field's list print. */
export type RiderMatch = {
  id: number,
  slug: string,
  name: string,
  nationCode: string | null,
  nationIso2: string | null,
  /** The team of his latest result outside championships and the Olympics, in the UCI's capitals. */
  team: string | null,
  /** His current index (frozen while inactive); null when no classification of his is counted. */
  index: number | null,
  /** His rank in the published ranking; null when he is not in it. */
  rank: number | null,
  /** Null when no classification of his is counted. */
  status: RatingStatus | null,
};

/** The shortest folded query that searches (fewer letters list half the peloton). */
export const MIN_QUERY = 2;
/** The longest query read: a name, never a page of text. */
export const MAX_QUERY = 120;

/**
 * Riders whose folded name (`rider.search_name`) holds every word of the query, at most `limit`.
 * Order: the query starting the name or one of its words first, then every word starting a word
 * ("pogacar tadej"), then any match inside the name; within each, ranked riders by rank, then the
 * others by index, riders without any rating last. `total` counts every match.
 */
export async function searchRiders(
  version: IndexVersion | null,
  query: string,
  limit: number,
): Promise<{ riders: RiderMatch[], total: number }> {
  const folded = foldSearch(query.slice(0, MAX_QUERY));
  if (folded.replace(/ /g, '').length < MIN_QUERY) return { riders: [], total: 0 };
  const words = folded.split(' ').filter(Boolean);
  // foldSearch leaves only [a-z0-9 ]: no LIKE wildcard can come from the query.
  const contains = words.map((w) => `%${w}%`);
  const wordStarts = words.map((w) => `% ${w}%`);
  const versionId = version?.id ?? 0;
  const asOf = version?.asOf ?? '1900-01-01';
  const sql = db();
  const rows = await sql<{
    id: number, slug: string, name: string, nation_code: string | null, nation_iso2: string | null,
    index_value: number | null, status: RatingStatus | null, rank: number | null, team: string | null,
    total: number,
  }[]>`
    with m as (
      select ri.id, ri.slug, ri.display_name as name, ri.nation_code, ri.nation_iso2,
             rr.current_index as index_value, rr.status, s.rank,
             case
               when (' ' || ri.search_name) like ${`% ${folded}%`} then 0
               when (' ' || ri.search_name) like all(${wordStarts}::text[]) then 1
               else 2
             end as tier,
             count(*) over ()::int as total
      from rider ri
      left join rider_rating rr on rr.rider_id = ri.id and rr.rating_version_id = ${versionId}
      left join ranking_snapshot s
        on s.rating_version_id = ${versionId} and s.date = ${asOf} and s.rider_id = ri.id
      where ri.search_name like all(${contains}::text[])
      order by tier, s.rank nulls last, rr.current_index desc nulls last, ri.display_name, ri.id
      limit ${limit}
    )
    select m.*, t.team_name as team
    from m
    left join lateral (
      select r.team_name from result r join classification c on c.id = r.classification_id
      where r.rider_id = m.id and r.team_name is not null
        and c.kind not like 'championship%' and c.kind not like 'olympic%'
      order by c.date desc, c.id desc limit 1
    ) t on true
    order by m.tier, m.rank nulls last, m.index_value desc nulls last, m.name, m.id`;
  return {
    total: rows[0]?.total ?? 0,
    riders: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      nationCode: r.nation_code,
      nationIso2: r.nation_iso2,
      team: r.team,
      index: r.index_value,
      rank: r.rank,
      status: r.status,
    })),
  };
}

/** How many riders the search page lists. */
export const PAGE_RESULTS = 50;

export type SearchData = {
  /** The query as typed (trimmed, at most MAX_QUERY characters), printed back on the page. */
  query: string,
  /** "Aller au rang": a rank of the ranking, answered by a 302 to its strip. */
  redirect?: string,
  /** The query is too short to search. */
  short: boolean,
  riders: RiderMatch[],
  total: number,
  /** A pure number beyond the ranking: the rank asked and the ranking's size. */
  rankOut: { rank: number, count: number } | null,
};

export async function loadSearch(lang: Lang, query: string): Promise<SearchData> {
  const q = query.trim().replace(/\s+/g, ' ').slice(0, MAX_QUERY);
  const empty: SearchData = {
    query: q, short: true, riders: [], total: 0, rankOut: null,
  };
  const version = await indexVersion();
  // A pure number is a rank ("Aller au rang"): its strip in the ranking, or a sentence if the
  // ranking does not hold it.
  if (/^[0-9]{1,6}$/.test(q)) {
    const rank = Number(q);
    const count = version ? await classifiedCount(version) : 0;
    if (rank >= 1 && rank <= count) return { ...empty, redirect: rankAnchor(lang, rank) };
    return { ...empty, short: false, rankOut: { rank, count } };
  }
  if (foldSearch(q).replace(/ /g, '').length < MIN_QUERY) return empty;
  const { riders, total } = await searchRiders(version, q, PAGE_RESULTS);
  return {
    query: q, short: false, riders, total, rankOut: null,
  };
}
