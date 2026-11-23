/**
 * Rider names: the UCI writes them "FAMILY Given" with the family name in capitals
 * (e.g. "VAN DER POEL Mathieu"). These helpers derive the display name, the slug and the keys
 * used to match the same person across DataRide rows.
 */

/** Words of a family name written in lower case when they precede the rest of it ("Mathieu van der Poel") */
const PARTICLES: Set<string> = new Set(['van', 'der', 'de', 'den', 'da', 'di', 'du', 'le', 'la', 'von', 'ter']);

/**
 * Corrections table. Nations whose usage capitalizes the first particle of a family name
 * (Belgium: "Arnaud De Lie", "Jurgen Van den Broeck"; Italy: "Alessandro De Marchi"; France: "Olivier Le Gac").
 */
const CAPITALIZED_FIRST_PARTICLE: Record<string, Set<string>> = {
    BEL: new Set(['de', 'van', 'den']),
    ITA: new Set(['de', 'di', 'da', 'la', 'le']),
    FRA: new Set(['le', 'la']),
};

/** Corrections table: family names (as the UCI writes them) whose natural case the rules get wrong */
const FAMILY_NAME_CORRECTIONS: Record<string, string> = {
    'VAN AERT': 'van Aert', // Belgian, but writes his name with a lower-case particle
};

/** Letters that Unicode decomposition does not reduce to ASCII */
const ASCII_REPLACEMENTS: Record<string, string> = {
    'ß': 'ss', 'ẞ': 'ss', 'æ': 'ae', 'Æ': 'ae', 'œ': 'oe', 'Œ': 'oe', 'ø': 'o', 'Ø': 'o', 'ł': 'l', 'Ł': 'l',
    'đ': 'd', 'Đ': 'd', 'ð': 'd', 'Ð': 'd', 'þ': 'th', 'Þ': 'th', 'ı': 'i', 'ħ': 'h', 'Ħ': 'h',
};
const ASCII_REPLACEMENT_PATTERN = new RegExp(`[${Object.keys(ASCII_REPLACEMENTS).join('')}]`, 'g');

/**
 * @param text Any text
 * @return Its ASCII form, lower case, words separated by single spaces (č→c, é→e, ø→o, ß→ss, æ→ae, ł→l, đ→d)
 */
export function foldToAscii(text: string): string {
    return text
        .replace(ASCII_REPLACEMENT_PATTERN, letter => ASCII_REPLACEMENTS[letter])
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/['’ʼ`]/g, '') // O'Connor -> oconnor
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

/**
 * @param name A name as DataRide writes it
 * @return The same name with collapsed spaces (the stored raw form)
 */
export function cleanRawName(name: string): string {
    return name.normalize('NFC').trim().replace(/\s+/g, ' ');
}

/**
 * Key of step (a) of the matching: the name as written, case-insensitive, accents kept.
 * @param name A name as DataRide writes it
 */
export function exactNameKey(name: string): string {
    return cleanRawName(name).toLowerCase();
}

/**
 * Key of step (b) of the matching: the name without accents, ß and punctuation.
 * @param name A name as DataRide writes it
 */
export function looseNameKey(name: string): string {
    return foldToAscii(name);
}

function isUpperCaseWord(word: string): boolean {
    return word === word.toUpperCase() && word !== word.toLowerCase();
}

/**
 * @param name A name as DataRide writes it ("VAN DER POEL Mathieu")
 * @return The family name (leading words in capitals) and the given name (the rest)
 */
export function splitUciName(name: string): { family: string, given: string | null } {
    const allWords: string[] = cleanRawName(name).split(' ').filter(word => word.length > 0);
    // Some names carry a transcription in another script ("黃 HUANG 文忠 Wen Chung"): keep the Latin words when there are any
    const latinWords: string[] = allWords.filter(word => /\p{Script=Latin}/u.test(word));
    const words: string[] = latinWords.length > 0 ? latinWords : allWords;
    let familyLength = 0;
    while (familyLength < words.length && isUpperCaseWord(words[familyLength])) familyLength++;
    if (familyLength === words.length && words.length > 1) familyLength = words.length - 1; // all capitals: last word is the given name
    if (familyLength === 0) familyLength = 1; // no capitals: first word is the family name
    const given: string = words.slice(familyLength).join(' ');
    return { family: words.slice(0, familyLength).join(' '), given: given.length > 0 ? given : null };
}

/**
 * @param name A name as DataRide writes it ("VAN DER POEL Mathieu")
 * @return The words of its family name without accents and particles, of three letters or more (["poel"])
 */
export function familyNameWords(name: string): string[] {
    return foldToAscii(splitUciName(name).family).split(' ').filter(word => word.length >= 3 && !PARTICLES.has(word));
}

function capitalizeWord(word: string): string {
    const lower: string = word.toLowerCase();
    const capitalized: string = lower.replace(/(^|[-'’])(\p{L})/gu, (_, separator: string, letter: string) => separator + letter.toUpperCase());
    return capitalized.replace(/^Mc(\p{Ll})/u, (_, letter: string) => `Mc${letter.toUpperCase()}`);
}

/**
 * @param family Family name in capitals ("VAN DER POEL")
 * @param nationCode UCI nation code of the rider ("NED"), used by the corrections table
 * @param atStart Whether the family name opens the display name (no given name)
 * @return The family name in natural case ("van der Poel")
 */
export function naturalFamilyName(family: string, nationCode: string | null, atStart = false): string {
    const correction: string | undefined = FAMILY_NAME_CORRECTIONS[family.toUpperCase()];
    if (correction) return atStart ? correction.charAt(0).toUpperCase() + correction.slice(1) : correction;

    const capitalizedParticles: Set<string> | undefined = nationCode ? CAPITALIZED_FIRST_PARTICLE[nationCode] : undefined;
    const words: string[] = family.split(' ');
    return words.map((word, index) => {
        const lower: string = word.toLowerCase();
        const isParticle: boolean = PARTICLES.has(lower) && index < words.length - 1;
        if (!isParticle) return capitalizeWord(word);
        if (index === 0 && (atStart || capitalizedParticles?.has(lower))) return capitalizeWord(word);
        return lower;
    }).join(' ');
}

/**
 * @param name A name as DataRide writes it ("VAN DER POEL Mathieu")
 * @param nationCode UCI nation code of the rider
 * @return The given name, the family name in natural case, and the display name "Given Family"
 */
export function displayNameParts(name: string, nationCode: string | null): { given: string | null, family: string, display: string } {
    const split = splitUciName(name);
    const naturalFamily: string = naturalFamilyName(split.family, nationCode, split.given === null);
    // A given name in capitals (when the whole name is) is written in natural case too
    const given: string | null = split.given && isUpperCaseWord(split.given)
        ? split.given.split(' ').map(capitalizeWord).join(' ')
        : split.given;
    return { given, family: naturalFamily, display: given ? `${given} ${naturalFamily}` : naturalFamily };
}

/**
 * @param displayName Display name ("Tadej Pogačar")
 * @return The base of the slug ("tadej-pogacar")
 */
export function slugBase(displayName: string): string {
    return foldToAscii(displayName).replace(/ /g, '-') || 'rider';
}

/**
 * Picks the slug of a new rider: the base, else the base and the birth year, else with "-2", "-3"...
 * @param base Base of the slug ("romain-gregoire")
 * @param birthDate Date of birth 'YYYY-MM-DD', null when unknown
 * @param taken Whether a slug is already used (by a rider or in the slug history)
 */
export function pickSlug(base: string, birthDate: string | null, taken: (slug: string) => boolean): string {
    if (!taken(base)) return base;
    const stem: string = birthDate ? `${base}-${birthDate.slice(0, 4)}` : base;
    if (stem !== base && !taken(stem)) return stem;
    for (let suffix = 2; ; suffix++) {
        const candidate = `${stem}-${suffix}`;
        if (!taken(candidate)) return candidate;
    }
}

/**
 * @param displayName Display name
 * @return The search column: ASCII, lower case, single spaces ("tadej pogacar"); search input must be folded the same way
 */
export function searchName(displayName: string): string {
    return foldToAscii(displayName);
}
