import type { Lang } from '../../i18n/language';
import {
  classifiedCount, indexVersion, rankingRows, type IndexVersion, type RankedRider,
} from '../../server/index-data';
import { RANKS_PER_PAGE } from '../../app/nav';

/**
 * One page of the published ranking (50 strips). Contract with the route files: null means "no
 * such page" (the route answers 404): no computed version yet, or a page beyond the last.
 */
export type RankingData = {
  version: IndexVersion,
  page: number,
  /** Pages of the ranking (at least 1, even when nobody is classified yet). */
  pages: number,
  /** Riders in the published ranking. */
  count: number,
  /** First and last rank of this page (0 and 0 when the ranking is empty). */
  from: number,
  to: number,
  riders: RankedRider[],
  /** The day the rank moves are measured from: the ranking's day minus 7 days. */
  movesSince: string,
  /** The version's own thresholds, printed in the note under the list (null when absent). */
  experienceThreshold: number | null,
  activeDays: number | null,
};

/** "2026-11-08" minus `days`, as an ISO day (computed at noon UTC: no time zone moves it). */
function daysBefore(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

const numberParam = (value: unknown): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

export async function loadRanking(_lang: Lang, page: number): Promise<RankingData | null> {
  const version = await indexVersion();
  if (!version || !Number.isInteger(page) || page < 1) return null;
  const count = await classifiedCount(version);
  const pages = Math.max(1, Math.ceil(count / RANKS_PER_PAGE));
  if (page > pages) return null;
  const from = count ? (page - 1) * RANKS_PER_PAGE + 1 : 0;
  const to = count ? Math.min(page * RANKS_PER_PAGE, count) : 0;
  const riders = count ? await rankingRows(version, from, to) : [];
  return {
    version,
    page,
    pages,
    count,
    from,
    to,
    riders,
    movesSince: daysBefore(version.asOf, 7),
    experienceThreshold: numberParam(version.parameters.experience_threshold),
    activeDays: numberParam(version.parameters.active_days),
  };
}
