import type { Lang } from '../../i18n/language';
import { db } from '../../server/db';
import { readGameFile } from '../../server/gameData';
import {
  classifiedCount, indexVersion, rankingRows, type IndexVersion, type RankedRider,
} from '../../server/index-data';
import type { HomeRaceKind } from '../../content/home';

/**
 * Everything the home prints, read in one go: the published ranking's size and top 10, the latest
 * counted classifications with their winner and biggest index change, and the day of today's
 * game stage (only its date: the home is indexed, nothing about the mystery rider is read). Days
 * from the database are ISO text; the game's day is "YYYYMMDD", as in secret_rider.json.
 */
export type HomeRider = { id: number, slug: string, name: string };

export type HomeResult = {
  classificationId: number,
  competitionId: number,
  date: string,
  /** The UCI's competition name; print it through competitionName() (championships are renamed, D1). */
  competition: string,
  /** Host country of the competition (ISO alpha-2): names a national championship. */
  country: string | null,
  classCode: string,
  kind: HomeRaceKind,
  stageNumber: number | null,
  stageLabel: string | null,
  winner: HomeRider | null,
  /** The finisher whose index moved the most (largest absolute change) in this classification. */
  mover: HomeRider & { delta: number },
};

export type HomeData = {
  version: IndexVersion | null,
  /** The database could not be read: the home still serves the game block. */
  unavailable: boolean,
  /** Riders in the published ranking (version.asOf). */
  classified: number,
  top: RankedRider[],
  /** The latest major races (decision E5): WorldTour, ProSeries, world, Olympic, continental. */
  results: HomeResult[],
  /** Then the latest other races (.1, .2, national championships), printed as plain lines. */
  others: HomeResult[],
  /** The day the top 10's rank moves are measured from (version.asOf minus 7 days). */
  movesSince: string | null,
  /** The first computed season, warm-up included, for "since 2019". */
  since: number | null,
  /** Every rider's starting index (parameters.initial_index). */
  initialIndex: number | null,
  /** The starting index of a rider whose first counted race is CN or .2 (parameters.lower_levels), null without it. */
  lowerEntryIndex: number | null,
  game: {
    /** Today's game day ("20261117") from secret_rider.json, or null when it could not be read. */
    date: string | null,
  },
};

const TOP = 10;
const LATEST = 4;
const OTHERS = 6;
/** The classes a fan knows (decision E5); every other class goes to "Autres courses". */
const MAJOR = ['1.UWT', '2.UWT', '1.Pro', '2.Pro', '1.HC', '2.HC', 'CM', 'JO', 'CC'];
/** The rank moves of rankingRows() compare with the snapshot 7 days before version.asOf. */
const MOVE_WINDOW_DAYS = 7;

const GAME_TIMEOUT_MS = 1200;

let gameCache: { at: number, ttl: number, date: string | null } | null = null;

/**
 * Today's game day, read from the game's secret_rider.json with a short timeout. Only `date` is
 * kept; the rest of the file (the mystery rider) is dropped at once. Kept one minute (ten seconds
 * after a failure): the day changes at 05:00 UTC.
 */
async function todayGameDate(): Promise<string | null> {
  if (gameCache && Date.now() - gameCache.at < gameCache.ttl) return gameCache.date;
  let date: string | null = null;
  try {
    const text = await readGameFile('secret_rider.json', GAME_TIMEOUT_MS);
    const body = text ? JSON.parse(text) as { date?: unknown } : null;
    if (body && typeof body.date === 'string' && /^\d{8}$/.test(body.date)) date = body.date;
  } catch {
    date = null;
  }
  gameCache = { at: Date.now(), ttl: date ? 60_000 : 10_000, date };
  return date;
}

const daysBefore = (day: string, days: number): string => {
  const d = new Date(`${day.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

async function latestResults(v: IndexVersion, major: boolean, limit: number): Promise<HomeResult[]> {
  // One line per competition: its latest counted classification, a finished stage race showing its
  // final GC (dated its last day, like its last stage, and put first). Classifications by date,
  // latest first (classification_date_idx, read backwards); the lateral join keeps the counted
  // ones only and picks the biggest change of each. Ten rows per line are read, then each
  // competition's first row is kept. The competition's host country names a national
  // championship in the reader's language (competitionName, i18n/races.ts).
  const sql = db();
  const rows = await sql<{
    id: number, competition_id: number, date: string, competition_name: string, country_iso2: string | null,
    class_code: string, kind: HomeRaceKind,
    stage_number: number | null, stage_label: string | null,
    winner_id: number | null, winner_slug: string | null, winner_name: string | null,
    mover_id: number, mover_slug: string, mover_name: string, mover_delta: number,
  }[]>`
    select c.id, c.competition_id, c.date::text as date, c.competition_name, comp.country_iso2,
           c.class_code, c.kind, c.stage_number, c.stage_label,
           w.id as winner_id, w.slug as winner_slug, w.display_name as winner_name,
           mr.id as mover_id, mr.slug as mover_slug, mr.display_name as mover_name, m.delta as mover_delta
    from classification c
    left join competition comp on comp.id = c.competition_id
    cross join lateral (
      select rc.rider_id, rc.delta from rating_change rc
      where rc.rating_version_id = ${v.id} and rc.classification_id = c.id
      order by abs(rc.delta) desc, rc.delta desc, rc.rider_id
      limit 1
    ) m
    join rider mr on mr.id = m.rider_id
    left join lateral (
      select ri.id, ri.slug, ri.display_name from rider ri
      where ri.id = coalesce(c.winner_rider_id, (
        select rc1.rider_id from rating_change rc1
        where rc1.rating_version_id = ${v.id} and rc1.classification_id = c.id and rc1.rank = 1
        order by rc1.rider_id limit 1))
    ) w on true
    where not c.cancelled and c.date <= ${v.asOf}
      and ${major ? sql`c.class_code in ${sql(MAJOR)}` : sql`c.class_code not in ${sql(MAJOR)}`}
    order by c.date desc, (c.kind = 'gc_final') desc, c.id desc
    limit ${limit * 10}`;
  const seen = new Set<number>();
  const latest = rows.filter((r) => {
    const competition = Number(r.competition_id);
    if (seen.has(competition)) return false;
    seen.add(competition);
    return true;
  }).slice(0, limit);
  return latest.map((r) => ({
    classificationId: Number(r.id),
    competitionId: Number(r.competition_id),
    date: r.date,
    competition: r.competition_name,
    country: r.country_iso2 ?? null,
    classCode: r.class_code,
    kind: r.kind,
    stageNumber: num(r.stage_number),
    stageLabel: r.stage_label,
    winner: r.winner_id !== null && r.winner_slug && r.winner_name
      ? { id: Number(r.winner_id), slug: r.winner_slug, name: r.winner_name }
      : null,
    mover: {
      id: Number(r.mover_id), slug: r.mover_slug, name: r.mover_name, delta: Number(r.mover_delta),
    },
  }));
}

/**
 * The first season the version computes, warm-up included (the scope of "since 2019"): the season
 * of its earliest counted classification (classification_date_idx forwards, probed on
 * rating_change_pkey).
 */
async function firstSeason(v: IndexVersion): Promise<number | null> {
  const [row] = await db()<{ season: number | null }[]>`
    select c.season from classification c
    where exists (
      select 1 from rating_change rc where rc.rating_version_id = ${v.id} and rc.classification_id = c.id
    )
    order by c.date, c.id
    limit 1`;
  const season = num(row?.season);
  return season !== null && Number.isInteger(season) ? season : null;
}

/** The index part of the home when there is none: no version yet, or the database unreachable. */
/** The entry index of the lower levels when it differs from the initial index (parameters.lower_levels.entry_index). */
function lowerEntry(params: Record<string, unknown>, initial: number | null): number | null {
  const lower = params.lower_levels;
  const entry = lower && typeof lower === 'object' ? (lower as Record<string, unknown>).entry_index : null;
  return typeof entry === 'number' && entry !== initial ? entry : null;
}

const noIndex = (game: HomeData['game'], unavailable: boolean): HomeData => ({
  version: null,
  unavailable,
  classified: 0,
  top: [],
  results: [],
  others: [],
  movesSince: null,
  since: null,
  initialIndex: null,
  lowerEntryIndex: null,
  game,
});

// The home reads the same data in both languages; `lang` stays in the route's fixed signature.
// The home is the root's only way into the daily game: a database outage leaves the index part
// empty (and says so) instead of turning the whole page into a 500.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function loadHome(_lang: Lang): Promise<HomeData> {
  const [read, gameDate] = await Promise.all([
    indexVersion().then(
      (version) => ({ version, failed: false }),
      () => ({ version: null, failed: true }),
    ),
    todayGameDate(),
  ]);
  const game = { date: gameDate };
  const { version } = read;
  if (!version) return noIndex(game, read.failed);
  try {
    const [classified, top, results, others, since] = await Promise.all([
      classifiedCount(version),
      rankingRows(version, 1, TOP),
      latestResults(version, true, LATEST),
      latestResults(version, false, OTHERS),
      firstSeason(version),
    ]);
    const params = version.parameters;
    return {
      version,
      unavailable: false,
      classified,
      top,
      results,
      others,
      movesSince: daysBefore(version.asOf, MOVE_WINDOW_DAYS),
      since,
      initialIndex: typeof params.initial_index === 'number' ? params.initial_index : null,
      lowerEntryIndex: lowerEntry(params, typeof params.initial_index === 'number' ? params.initial_index : null),
      game,
    };
  } catch {
    return noIndex(game, true);
  }
}
