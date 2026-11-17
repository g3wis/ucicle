import { parseGameDate } from '../i18n/format';

/**
 * The day numbered "Étape 1". The owner chooses it; until they do, it is the day the redesign
 * was built (an assumption listed in the report). It must never change once published: shared
 * results quote the stage number.
 */
export const STAGE_ORIGIN = '20261116';

/** The mystery rider changes every day at 05:00 UTC (functions cron `0 5 * * *`). */
export const START_HOUR_UTC = 5;

export function stageNumber(date: string): number {
  const days = Math.round((parseGameDate(date).getTime() - parseGameDate(STAGE_ORIGIN).getTime()) / 86400000);
  return Math.max(1, days + 1);
}

/** Milliseconds until the next 05:00 UTC. */
export function msUntilNextStart(now: Date = new Date()): number {
  const next = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), START_HOUR_UTC,
  ));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

/** Today's game date (YYYYMMDD) from the clock: the day that started at the last 05:00 UTC. */
export function currentGameDate(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() - START_HOUR_UTC * 3600000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${shifted.getUTCFullYear()}${pad(shifted.getUTCMonth() + 1)}${pad(shifted.getUTCDate())}`;
}
