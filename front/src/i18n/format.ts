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

// ---------------------------------------------------------------------------------------------
// The index (home, ranking, rider pages, method). Days from the database are ISO "YYYY-MM-DD".

/** "2026-11-17" to a Date at noon UTC, so no time zone moves it to another day. */
export function parseDay(day: string): Date {
  return new Date(`${day.slice(0, 10)}T12:00:00Z`);
}

/**
 * The day number never leaves its month on a narrow line ("21\u00a0sept."), the year stays
 * breakable; French writes the first of the month "1er" (Intl prints "1").
 */
function bindDay(text: string, lang: Lang): string {
  const bound = text.replace(/^(\d{1,2})[ \u202f]/, '$1\u00a0');
  return lang === 'fr' ? bound.replace(/^1(?=\u00a0)/, '1er') : bound;
}

/** "17 nov. 2026" / "17 Nov 2026" ("1er nov. 2026" in French). */
export function formatDay(day: string, lang: Lang): string {
  return bindDay(new Intl.DateTimeFormat(LOCALES[lang], {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(parseDay(day)), lang);
}

/** "17 nov." / "17 Nov": a day of the current season, in a results line. */
export function formatDayShort(day: string, lang: Lang): string {
  return bindDay(new Intl.DateTimeFormat(LOCALES[lang], { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(parseDay(day)), lang);
}

/** "juil. 2025" / "Jul 2025". */
export function formatMonth(day: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALES[lang], { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(parseDay(day));
}

/** An index value, rounded to the unit: "1 912" (narrow no-break space) / "1,912". */
export function formatIndex(value: number, lang: Lang): string {
  return new Intl.NumberFormat(LOCALES[lang], { maximumFractionDigits: 0 }).format(Math.round(value));
}

/** A figure with fixed decimals: "19,6" / "19.6". */
export function formatDecimal(value: number, lang: Lang, digits = 1): string {
  return new Intl.NumberFormat(LOCALES[lang], { minimumFractionDigits: digits, maximumFractionDigits: digits })
    .format(value);
}

/**
 * A signed change: "+5,9", "−3,2" (U+2212 minus), "0,0" when it rounds to nothing. The sign is
 * always written: a change is never told by colour.
 */
export function formatDelta(value: number, lang: Lang, digits = 1): string {
  const magnitude = Number(Math.abs(value).toFixed(digits));
  const text = formatDecimal(magnitude, lang, digits);
  if (magnitude === 0) return text;
  return `${value > 0 ? '+' : '−'}${text}`;
}

/** "1er", "2e" / "1st", "2nd", "3rd", "11th". */
export function formatOrdinal(n: number, lang: Lang): string {
  if (lang === 'fr') return n === 1 ? '1er' : `${n}e`;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

/** The country's name from its ISO 3166 alpha-2 code ("SI" to "Slovénie" / "Slovenia"). */
export function nationName(iso2: string | null, lang: Lang): string | null {
  if (!iso2) return null;
  try {
    // Rendered on the server only (Astro pages), never in the browsers of the browserslist.
    // eslint-disable-next-line compat/compat
    return new Intl.DisplayNames([LOCALES[lang]], { type: 'region' }).of(iso2.toUpperCase()) ?? null;
  } catch {
    return null;
  }
}

/** Full years between a birth day and another day. */
export function ageOn(birthDay: string, day: string): number {
  const b = parseDay(birthDay);
  const d = parseDay(day);
  let age = d.getUTCFullYear() - b.getUTCFullYear();
  const beforeBirthday = d.getUTCMonth() < b.getUTCMonth()
    || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

const TEAM_UPPER = new Set([
  'UAE', 'XRG', 'EF', 'AG2R', 'FDJ', 'BMC', 'CCC', 'NSN', 'TDT', 'DSM', 'BORA',
  'Q36.5', 'MBH', 'ATT', 'GW', 'TJ', 'ABB', 'SD', 'BH', 'CFT', 'KTM',
]);
const TEAM_LOWER = new Set(['a', 'de', 'la', 'le', 'du', 'des', 'del', 'di', 'da', 'the', 'of', 'and', 'et', 'y', 'e']);

/**
 * Team names come in the UCI's capitals ("TEAM VISMA | LEASE A BIKE"). On the page they are
 * printed in band type (capitals by CSS) from the raw name; running text (titles, descriptions)
 * gets this natural case, a heuristic: known acronyms stay in capitals.
 */
export function teamText(raw: string | null): string | null {
  if (!raw) return null;
  return raw.split(/(\s+|-)/).map((word, i) => {
    if (/^\s+$|^-$/.test(word) || !/[A-Z]/i.test(word)) return word;
    if (TEAM_UPPER.has(word.toUpperCase())) return word.toUpperCase();
    const lower = word.toLowerCase();
    if (i > 0 && TEAM_LOWER.has(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join('');
}

/** Letters Unicode decomposition does not reduce to ASCII (same table as functions/src/collect/names.ts). */
const ASCII_REPLACEMENTS: Record<string, string> = {
  ß: 'ss',
  ẞ: 'ss',
  æ: 'ae',
  Æ: 'ae',
  œ: 'oe',
  Œ: 'oe',
  ø: 'o',
  Ø: 'o',
  ł: 'l',
  Ł: 'l',
  đ: 'd',
  Đ: 'd',
  ð: 'd',
  Ð: 'd',
  þ: 'th',
  Þ: 'th',
  ı: 'i',
  ħ: 'h',
  Ħ: 'h',
};
const ASCII_PATTERN = new RegExp(`[${Object.keys(ASCII_REPLACEMENTS).join('')}]`, 'g');

/** Fold a typed name exactly like the database's `rider.search_name` (foldToAscii of the collector). */
export function foldSearch(text: string): string {
  return text
    .replace(ASCII_PATTERN, (letter) => ASCII_REPLACEMENTS[letter])
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’ʼ`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
