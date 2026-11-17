import { Lang, LOCALES } from './language';

const UNITS: Record<Lang, { age: string, height: string, weight: string }> = {
  fr: { age: 'ans', height: 'm', weight: 'kg' },
  en: { age: 'yrs', height: 'm', weight: 'kg' },
};

// Narrow no-break space between a value and its unit, so "1,80 m" never splits.
const NBSP = ' ';

/** `unit` false: the bare figure, for the first bound of a range ("27 à 29 ans"). */
export function formatAge(age: number, lang: Lang, unit = true): string {
  return unit ? `${age}${NBSP}${UNITS[lang].age}` : String(age);
}

/** Heights are stored in metres (1.8): always two decimals, in the language's own separator. */
export function formatHeight(height: number, lang: Lang, unit = true): string {
  const value = new Intl.NumberFormat(LOCALES[lang], { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(height);
  return unit ? `${value}${NBSP}${UNITS[lang].height}` : value;
}

export function formatWeight(weight: number, lang: Lang, unit = true): string {
  return unit ? `${weight}${NBSP}${UNITS[lang].weight}` : String(weight);
}

/** "20261116" to a Date at noon UTC, so no time zone moves it to another day. */
export function parseGameDate(date: string): Date {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(4, 6));
  const d = Number(date.slice(6, 8));
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** "16 nov." / "16 Nov": the date printed on the mystery bib's band. */
export function formatBandDate(date: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALES[lang], { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(parseGameDate(date));
}

/** "lundi 16 novembre 2026": the date in full, for history rows and accessible names. */
export function formatLongDate(date: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALES[lang], {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(parseGameDate(date));
}

/** 18_753_000 ms to "05:12:33". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}
