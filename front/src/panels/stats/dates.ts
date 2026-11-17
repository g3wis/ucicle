import { Lang, LOCALES } from '../../i18n/language';
import { parseGameDate } from '../../i18n/format';

const DAY = 24 * 3600 * 1000;

/** "20261116" to "2026-11-16", for `<time dateTime>`. */
export function isoDate(date: string): string {
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

/** The game date (YYYYMMDD) of the day before. */
export function dayBefore(date: string): string {
  const d = new Date(parseGameDate(date).getTime() - DAY);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

/** "dim. 15 nov." / "Sun 15 Nov", with the year only when it is not the current one. */
export function rowDate(date: string, lang: Lang, withYear: boolean): string {
  return new Intl.DateTimeFormat(LOCALES[lang], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: withYear ? 'numeric' : undefined,
    timeZone: 'UTC',
  }).format(parseGameDate(date));
}

/** "18 oct. 2026" / "18 Oct 2026": the first stage on the player's bib band. */
export function bandDate(date: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALES[lang], {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(parseGameDate(date));
}
