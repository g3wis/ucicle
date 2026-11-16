import axios from 'axios';

import { normalizeName, toIsoDate } from '../utils/formatUtils.js';
import { sleep, USER_AGENT, withRetry } from '../utils/httpUtils.js';

import { UciRankedRider } from './uciScrapper.js';

/**
 * Physical data and display names from Wikidata (CC0), completed by the infobox of the English Wikipedia
 * article (CC BY-SA) when Wikidata has no height or weight.
 */
const SPARQL_URL = 'https://query.wikidata.org/sparql';
const WIKIPEDIA_API_URL = 'https://en.wikipedia.org/w/api.php';
// sport cyclist, track cyclist, mountain biker
const CYCLIST_OCCUPATIONS: string[] = ['Q2309784', 'Q15117395', 'Q19799599'];
const WIKIPEDIA_BATCH_SIZE = 20;
const WIKIPEDIA_PAUSE_MS = 1000;
const REQUEST_TIMEOUT_MS = 120000;

/**
 * @param name Display name (e.g. "Tadej Pogačar"), null when Wikidata has no English label
 * @param height Height in meters, null when unknown
 * @param weight Weight in kilograms, null when unknown
 */
export type PhysicalData = {
    name: string | null,
    height: number | null,
    weight: number | null,
}

type WikidataPerson = {
    item: string,
    key: string,
    label: string | null,
    height: number | null,
    weight: number | null,
    article: string | null,
};

type SparqlBinding = Record<string, { value: string } | undefined>;

function validHeight(meters: number | null | undefined): number | null {
    if (meters === null || meters === undefined || !Number.isFinite(meters)) return null;
    return meters >= 1.4 && meters <= 2.2 ? Math.round(meters * 100) / 100 : null;
}

function validWeight(kilograms: number | null | undefined): number | null {
    if (kilograms === null || kilograms === undefined || !Number.isFinite(kilograms)) return null;
    return kilograms >= 40 && kilograms <= 110 ? Math.round(kilograms) : null;
}

async function sparql(query: string): Promise<SparqlBinding[]> {
    const response = await withRetry(() => axios.post<{ results: { bindings: SparqlBinding[] } }>(
        SPARQL_URL,
        new URLSearchParams({ query, format: 'json' }),
        {
            headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/sparql-results+json' },
            timeout: REQUEST_TIMEOUT_MS,
        }
    ));
    if (!Array.isArray(response.data?.results?.bindings)) throw new Error('Unexpected response from Wikidata SPARQL endpoint');
    return response.data.results.bindings;
}

/**
 * @param keyPattern Triple pattern binding ?item to ?key
 * @param values The values of ?key, already serialized as SPARQL terms
 * @return One entry per Wikidata item, with its first height and weight
 */
async function queryPeople(keyPattern: string, values: string[]): Promise<WikidataPerson[]> {
    if (values.length === 0) return [];

    const bindings: SparqlBinding[] = await sparql(`
        SELECT ?item ?key ?label ?height ?weight ?article WHERE {
            VALUES ?key { ${values.join(' ')} }
            ${keyPattern}
            OPTIONAL { ?item p:P2048/psn:P2048/wikibase:quantityAmount ?height }
            OPTIONAL { ?item p:P2067/psn:P2067/wikibase:quantityAmount ?weight }
            OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label) = "en") }
            OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> }
        }`);

    const people = new Map<string, WikidataPerson>();
    for (const binding of bindings) {
        const item: string | undefined = binding.item?.value;
        const key: string | undefined = binding.key?.value;
        if (!item || !key) continue;

        const person: WikidataPerson = people.get(item) ?? { item, key, label: null, height: null, weight: null, article: null };
        person.label ??= binding.label?.value ?? null;
        person.height ??= validHeight(binding.height ? parseFloat(binding.height.value) : null);
        person.weight ??= validWeight(binding.weight ? parseFloat(binding.weight.value) : null);
        person.article ??= binding.article?.value ?? null;
        people.set(item, person);
    }
    return [...people.values()];
}

/**
 * Matches riders with Wikidata items: by UCI rider ID (P11020) first, then by date of birth and name.
 * @return Wikidata person by UCI id of the rider
 */
async function matchRiders(riders: UciRankedRider[]): Promise<Map<number, WikidataPerson>> {
    const matches = new Map<number, WikidataPerson>();

    const byUciId: WikidataPerson[] = await queryPeople('?item wdt:P11020 ?key .', riders.map(rider => `"${rider.uciId}"`));
    for (const person of byUciId) matches.set(parseInt(person.key, 10), person);

    const unmatched: UciRankedRider[] = riders.filter(rider => !matches.has(rider.uciId));
    const birthDates: string[] = [...new Set(unmatched.map(rider => toIsoDate(rider.birthDate)))];
    const byBirthDate: WikidataPerson[] = await queryPeople(
        `VALUES ?occupation { ${CYCLIST_OCCUPATIONS.map(id => `wd:${id}`).join(' ')} }
            ?item wdt:P569 ?key; wdt:P106 ?occupation .`,
        birthDates.map(date => `"${date}T00:00:00Z"^^xsd:dateTime`)
    );
    const alreadyMatched = new Set<string>([...matches.values()].map(person => person.item));

    for (const rider of unmatched) {
        const birthDate: string = toIsoDate(rider.birthDate);
        const riderTokens: string[] = normalizeName(rider.displayName);
        const scored = byBirthDate
            .filter(person => person.key.startsWith(birthDate) && person.label && !alreadyMatched.has(person.item))
            .map(person => ({ person, score: normalizeName(person.label!).filter(token => riderTokens.includes(token)).length }))
            .filter(candidate => candidate.score >= Math.min(2, riderTokens.length))
            .sort((a, b) => b.score - a.score);

        // Same birth date and as many name tokens in common (e.g. twins): too ambiguous
        if (scored.length === 0 || (scored.length > 1 && scored[0].score === scored[1].score)) continue;
        matches.set(rider.uciId, scored[0].person);
        alreadyMatched.add(scored[0].person.item);
    }

    return matches;
}

function stripWikitext(value: string): string {
    return value
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<ref[^>]*\/>/gi, '')
        .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
}

function infoboxField(wikitext: string, field: string): string | null {
    return wikitext.match(new RegExp(`^\\s*\\|\\s*${field}\\s*=(.*)$`, 'im'))?.[1] ?? null;
}

function toNumber(value: string): number {
    return parseFloat(value.replace(',', '.'));
}

/**
 * @param raw Value of the "height" field of an infobox, e.g. "1.76 m", "{{height|m=1.76}}" or "{{convert|176|cm|ftin}}"
 * @return The height in meters, null when it can't be read
 */
export function parseInfoboxHeight(raw: string | null): number | null {
    if (!raw) return null;
    const text: string = stripWikitext(raw);

    const named: RegExpMatchArray | null = text.match(/\b(c?m)\s*=\s*(\d+(?:[.,]\d+)?)/i);
    const withUnit: RegExpMatchArray | null = text.match(/(\d+(?:[.,]\d+)?)\s*(?:\|\s*)?(cm|m)\b/i);
    const [value, unit]: [string, string] | [undefined, undefined] = named ? [named[2], named[1]] : withUnit ? [withUnit[1], withUnit[2]] : [undefined, undefined];

    if (value === undefined) {
        // Bare number: guess the unit from its magnitude
        const bare: string | undefined = text.match(/^\s*(\d+(?:[.,]\d+)?)\s*$/)?.[1];
        if (!bare) return null;
        const number: number = toNumber(bare);
        return validHeight(number > 100 ? number / 100 : number);
    }
    return validHeight(unit.toLowerCase() === 'cm' ? toNumber(value) / 100 : toNumber(value));
}

/**
 * @param raw Value of the "weight" field of an infobox, e.g. "63 kg" or "{{convert|66|kg|lb|abbr=on}}"
 * @return The weight in kilograms, null when it can't be read
 */
export function parseInfoboxWeight(raw: string | null): number | null {
    if (!raw) return null;
    const text: string = stripWikitext(raw);

    const named: RegExpMatchArray | null = text.match(/\b(kg|lb)\s*=\s*(\d+(?:[.,]\d+)?)/i);
    const withUnit: RegExpMatchArray | null = text.match(/(\d+(?:[.,]\d+)?)\s*(?:\|\s*)?(kg|lb)\b/i);
    const [value, unit]: [string, string] | [undefined, undefined] = named ? [named[2], named[1]] : withUnit ? [withUnit[1], withUnit[2]] : [undefined, undefined];

    if (value === undefined) {
        const bare: string | undefined = text.match(/^\s*(\d+(?:[.,]\d+)?)\s*$/)?.[1];
        return bare ? validWeight(toNumber(bare)) : null;
    }
    return validWeight(unit.toLowerCase() === 'lb' ? toNumber(value) * 0.45359237 : toNumber(value));
}

type WikipediaQuery = {
    query?: {
        normalized?: { from: string, to: string }[],
        redirects?: { from: string, to: string }[],
        pages?: { title: string, missing?: boolean, revisions?: { slots: { main: { content: string } } }[] }[],
    }
};

/**
 * @param titles Titles of English Wikipedia articles
 * @return The lead section (where the infobox lives) of each article, by requested title
 */
async function getLeadSections(titles: string[]): Promise<Map<string, string>> {
    const sections = new Map<string, string>();

    for (let i = 0; i < titles.length; i += WIKIPEDIA_BATCH_SIZE) {
        const batch: string[] = titles.slice(i, i + WIKIPEDIA_BATCH_SIZE);
        const response = await withRetry(() => axios.get<WikipediaQuery>(WIKIPEDIA_API_URL, {
            params: {
                action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', rvsection: 0,
                titles: batch.join('|'), redirects: 1, format: 'json', formatversion: 2,
            },
            headers: { 'User-Agent': USER_AGENT },
            timeout: REQUEST_TIMEOUT_MS,
        }), 6);

        const query = response.data?.query;
        const resolve = (title: string): string => {
            const normalized: string = query?.normalized?.find(entry => entry.from === title)?.to ?? title;
            return query?.redirects?.find(entry => entry.from === normalized)?.to ?? normalized;
        };
        const contentByTitle = new Map<string, string>(
            (query?.pages ?? [])
                .filter(page => !page.missing && page.revisions?.length)
                .map(page => [page.title, page.revisions![0].slots.main.content])
        );
        for (const title of batch) {
            const content: string | undefined = contentByTitle.get(resolve(title));
            if (content) sections.set(title, content);
        }

        await sleep(WIKIPEDIA_PAUSE_MS);
    }
    return sections;
}

function articleTitle(articleUrl: string): string {
    return decodeURIComponent(articleUrl.replace(/^https?:\/\/en\.wikipedia\.org\/wiki\//, '')).replaceAll('_', ' ');
}

/**
 * @param riders Riders of the UCI ranking
 * @return Name, height and weight by UCI id of the rider, for the riders found on Wikidata
 */
export async function getPhysicalData(riders: UciRankedRider[]): Promise<Map<number, PhysicalData>> {
    const matches: Map<number, WikidataPerson> = await matchRiders(riders);

    const incomplete: WikidataPerson[] = [...matches.values()].filter(person => (!person.height || !person.weight) && person.article);
    const sections: Map<string, string> = await getLeadSections(incomplete.map(person => articleTitle(person.article!)));

    const result = new Map<number, PhysicalData>();
    for (const [uciId, person] of matches) {
        const section: string | undefined = person.article ? sections.get(articleTitle(person.article)) : undefined;
        result.set(uciId, {
            name: person.label,
            height: person.height ?? (section ? parseInfoboxHeight(infoboxField(section, 'height')) : null),
            weight: person.weight ?? (section ? parseInfoboxWeight(infoboxField(section, 'weight')) : null),
        });
    }

    console.info(`Wikidata matched ${matches.size}/${riders.length} riders (${byUciIdCount(matches, riders)} by UCI id), ${sections.size} Wikipedia infoboxes read`);
    return result;
}

function byUciIdCount(matches: Map<number, WikidataPerson>, riders: UciRankedRider[]): number {
    return riders.filter(rider => matches.get(rider.uciId)?.key === String(rider.uciId)).length;
}
