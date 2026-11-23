import type { Lang } from './language';
import { nationName } from './format';

/**
 * Championships named in the reader's language (decision D1 of the bunshin run): the UCI's
 * competition names are English and inconsistent ("UCI Road World Championships", "UCI Cycling
 * World Championships - Road", "National Road Championships - Slovenia"). A championship is named
 * from its class and, for a national championship, from the host country of the competition
 * (`competition.country_iso2`). Every other race keeps its UCI name.
 */

/** Country names where Intl's are not the cycling ones ("R.A.S. chinoise de Hong Kong"). */
const COUNTRY: Record<Lang, Record<string, string>> = {
  fr: {
    GB: 'Grande-Bretagne', HK: 'Hong Kong', MO: 'Macao', SX: 'Saint-Martin', VC: 'Saint-Vincent-et-les-Grenadines',
  },
  en: {
    GB: 'Great Britain', HK: 'Hong Kong', MO: 'Macao',
  },
};

/** French: masculine countries, "du Danemark". */
const MASCULINE = new Set([
  'BF', 'BJ', 'BR', 'BZ', 'CA', 'CL', 'CM', 'CR', 'CV', 'DK', 'GT', 'HN', 'JP', 'KE', 'KG', 'KZ', 'LA',
  'LB', 'LS', 'LU', 'MA', 'ME', 'MX', 'NG', 'NI', 'PA', 'PE', 'PK', 'PT', 'PY', 'QA', 'RW', 'SN', 'SR', 'SV',
  'VE', 'VN', 'XK', 'ZW',
]);
/** French: plural countries, "des Pays-Bas". */
const PLURAL = new Set(['AE', 'BM', 'BS', 'KY', 'NL', 'PH', 'US', 'VG']);
/** French: feminine countries that keep their article, "de la Jamaïque". */
const WITH_ARTICLE = new Set(['BB', 'DM', 'DO', 'GD', 'JM']);
/** French: islands and cities named without an article, "de Cuba", "de Malte". */
const BARE = new Set([
  'BH', 'CU', 'CW', 'CY', 'GU', 'HK', 'LC', 'MC', 'MO', 'MT', 'MU', 'PR', 'SG', 'SX', 'TT', 'TW', 'VC',
]);

/** "de France", "d'Italie", "du Danemark", "des Pays-Bas", "de la Jamaïque". */
function frenchOf(iso2: string, name: string): string {
  const first = name.normalize('NFD').charAt(0).toLowerCase();
  const vowel = 'aeiouy'.includes(first);
  if (PLURAL.has(iso2)) return `des ${name}`;
  if (WITH_ARTICLE.has(iso2)) return `de la ${name}`;
  if (vowel) return `d’${name}`;
  if (MASCULINE.has(iso2) && !BARE.has(iso2)) return `du ${name}`;
  return `de ${name}`;
}

/** A continental championship, from the words of its UCI name. */
function continent(name: string): 'europe' | 'africa' | 'asia' | 'americas' | 'oceania' | null {
  const n = name.toLowerCase();
  if (/\buec\b|europe/.test(n)) return 'europe';
  if (/\bcac\b|afric|afrique/.test(n)) return 'africa';
  if (/asia/.test(n)) return 'asia';
  if (/pan-?am|panameri/.test(n)) return 'americas';
  if (/oceania/.test(n)) return 'oceania';
  return null;
}

const CONTINENTAL: Record<Lang, Record<NonNullable<ReturnType<typeof continent>> | 'other', string>> = {
  fr: {
    europe: 'Championnats d’Europe',
    africa: 'Championnats d’Afrique',
    asia: 'Championnats d’Asie',
    americas: 'Championnats panaméricains',
    oceania: 'Championnats d’Océanie',
    other: 'Championnats continentaux',
  },
  en: {
    europe: 'European Championships',
    africa: 'African Championships',
    asia: 'Asian Championships',
    americas: 'Pan American Championships',
    oceania: 'Oceania Championships',
    other: 'Continental Championships',
  },
};

/**
 * @param lang Language of the page
 * @param classCode UCI class of the classification ('CM', 'JO', 'CN', 'CC', or any other)
 * @param competition The UCI competition name
 * @param countryIso2 Host country of the competition (ISO 3166 alpha-2), for a national championship
 * @return The competition's name to print: the championship's name in `lang`, or the UCI name
 */
export function competitionName(
  lang: Lang, classCode: string, competition: string, countryIso2: string | null,
): string {
  if (classCode === 'CM') return lang === 'fr' ? 'Championnats du monde' : 'World Championships';
  if (classCode === 'JO') return lang === 'fr' ? 'Jeux olympiques' : 'Olympic Games';
  if (classCode === 'CC') return CONTINENTAL[lang][continent(competition) ?? 'other'];
  if (classCode === 'CN') {
    const iso2 = countryIso2?.toUpperCase() ?? null;
    const name = iso2 ? COUNTRY[lang][iso2] ?? nationName(iso2, lang) : null;
    if (!iso2 || !name) return lang === 'fr' ? 'Championnat national' : 'National Championships';
    return lang === 'fr' ? `Championnat ${frenchOf(iso2, name)}` : `${name} National Championships`;
  }
  return competition;
}
