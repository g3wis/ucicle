/**
 * @param date A date of birth as served by the UCI (midnight, Central European Time)
 * @return The calendar date, formatted as YYYY-MM-DD
 */
export function toIsoDate(date: Date): string {
    // Shift by 12 hours so that a midnight in any European time zone falls on the right UTC day
    return new Date(date.getTime() + 12 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * @param birthDate Date of birth
 * @param now Reference date
 * @return The age in full years at the reference date
 */
export function computeAge(birthDate: Date, now: Date = new Date()): number {
    const [year, month, day] = toIsoDate(birthDate).split('-').map(Number);
    const hadBirthday: boolean = now.getUTCMonth() + 1 > month || (now.getUTCMonth() + 1 === month && now.getUTCDate() >= day);
    return now.getUTCFullYear() - year - (hadBirthday ? 0 : 1);
}

/**
 * @param name Any name
 * @return Its words, lowercased and without accents, used to compare names written differently
 */
export function normalizeName(name: string): string[] {
    return name
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z]+/g, ' ')
        .trim()
        .split(' ')
        .filter(token => token.length > 0);
}

function capitalize(word: string): string {
    return word
        .toLowerCase()
        .replace(/(^|[-'’])(\p{L})/gu, (_, separator: string, letter: string) => separator + letter.toUpperCase());
}

/**
 * @param displayName Name as written by the UCI, family name in capitals first (e.g. "VAN DER POEL Mathieu")
 * @return The name in reading order (e.g. "Mathieu Van Der Poel")
 */
export function formatUciName(displayName: string): string {
    const words: string[] = displayName.trim().split(/\s+/);
    const isFamilyName = (word: string): boolean => word === word.toUpperCase() && word !== word.toLowerCase();
    const familyName: string[] = words.filter(isFamilyName);
    const givenName: string[] = words.filter(word => !isFamilyName(word));
    return [...givenName, ...familyName.map(capitalize)].join(' ');
}

/**
 * @param nation UCI nation name (e.g. "GREAT BRITAIN", "HONG KONG, CHINA")
 * @return The country slug used by the game (e.g. "great-britain", "hong-kong-china")
 */
export function toCountrySlug(nation: string): string {
    return nation
        .toLowerCase()
        .replace(/[^\p{L}]+/gu, '-')
        .replace(/^-+|-+$/g, '');
}
