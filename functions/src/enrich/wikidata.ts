/**
 * Rider profiles from Wikidata (CC0): item, labels, height (P2048), mass (P2067) and the French and English
 * Wikipedia articles, matched by "UCI rider ID" (P11020) from rider_external_id. Read-only SPARQL, one request at
 * a time, at least one second apart, with backoff on 429 and 5xx. No image is fetched (no licence accepted).
 */
import type { Sql } from 'postgres';

import { displayNameParts, foldToAscii } from '../collect/names.js';
import { EXTERNAL_ID_SOURCES } from '../db/rows.js';

const SPARQL_URL = 'https://query.wikidata.org/sparql';
const USER_AGENT: string = process.env.HTTP_USER_AGENT
    || 'UcicleIndexBot/1.0 (https://www.ucicle.fr; rider heights, weights and names from Wikidata, read-only)';
const MIN_INTERVAL_MS = 1000;
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 6;

type Binding = Record<string, { value: string } | undefined>;

/** One Wikidata item found for one or more P11020 values */
export type WikidataPerson = {
    qid: string,
    uciPageIds: Set<string>,
    labelEn: string | null,
    labelFr: string | null,
    labelMul: string | null,
    /** Metres */
    height: number | null,
    /** Kilograms */
    weight: number | null,
    frwiki: string | null,
    enwiki: string | null,
};

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** A polite SPARQL client: one request at a time, at least MIN_INTERVAL_MS between two requests */
export class SparqlClient {
    requests = 0;
    retries = 0;
    private lastRequestAt = 0;

    async select(query: string): Promise<Binding[]> {
        for (let attempt = 1; ; attempt++) {
            const wait: number = this.lastRequestAt + MIN_INTERVAL_MS - Date.now();
            if (wait > 0) await sleep(wait);
            this.lastRequestAt = Date.now();
            this.requests++;
            let retryAfterMs: number | null = null;
            let failure: string;
            try {
                const response: Response = await fetch(SPARQL_URL, {
                    method: 'POST',
                    headers: {
                        'User-Agent': USER_AGENT,
                        'Accept': 'application/sparql-results+json',
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({ query, format: 'json' }),
                    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
                });
                if (response.ok) {
                    const body = await response.json() as { results?: { bindings?: Binding[] } };
                    if (!Array.isArray(body.results?.bindings)) throw new Error('Wikidata SPARQL answered without results.bindings');
                    return body.results.bindings;
                }
                failure = `HTTP ${response.status}`;
                const retryAfter = Number(response.headers.get('retry-after'));
                if (Number.isFinite(retryAfter) && retryAfter > 0) retryAfterMs = retryAfter * 1000;
                await response.body?.cancel();
                if (response.status !== 429 && response.status < 500) throw new Error(`Wikidata SPARQL: ${failure}`);
            } catch (error: unknown) {
                const name: string = (error as Error).name;
                if (name !== 'TimeoutError' && name !== 'TypeError') throw error; // TypeError: network failure in fetch
                failure = (error as Error).message;
            }
            if (attempt >= MAX_ATTEMPTS) throw new Error(`Wikidata SPARQL failed ${attempt} times: ${failure}`);
            this.retries++;
            const backoff: number = retryAfterMs ?? Math.min(120_000, 5000 * 2 ** (attempt - 1));
            console.warn(`Wikidata SPARQL: ${failure}, retry ${attempt} in ${Math.round(backoff / 1000)} s`);
            await sleep(backoff);
        }
    }
}

function validHeight(metres: number): number | null {
    return Number.isFinite(metres) && metres >= 1.4 && metres <= 2.2 ? Math.round(metres * 100) / 100 : null;
}

function validWeight(kilograms: number): number | null {
    return Number.isFinite(kilograms) && kilograms >= 40 && kilograms <= 110 ? Math.round(kilograms * 10) / 10 : null;
}

const PREFERRED_RANK = 'http://wikiba.se/ontology#PreferredRank';

/**
 * @param client SPARQL client
 * @param uciPageIds Values of P11020 (a few hundred)
 * @return The items holding them
 */
export async function fetchPeople(client: SparqlClient, uciPageIds: string[]): Promise<WikidataPerson[]> {
    const values: string = uciPageIds.map(id => `"${id.replace(/[^0-9A-Za-z-]/g, '')}"`).join(' ');
    const bindings: Binding[] = await client.select(`
        SELECT ?item ?uci ?labelEn ?labelFr ?labelMul ?height ?heightRank ?weight ?weightRank ?frwiki ?enwiki WHERE {
            VALUES ?uci { ${values} }
            ?item wdt:P11020 ?uci .
            OPTIONAL { ?item rdfs:label ?labelEn . FILTER(LANG(?labelEn) = "en") }
            OPTIONAL { ?item rdfs:label ?labelFr . FILTER(LANG(?labelFr) = "fr") }
            OPTIONAL { ?item rdfs:label ?labelMul . FILTER(LANG(?labelMul) = "mul") }
            OPTIONAL {
                ?item p:P2048 ?heightStatement . ?heightStatement wikibase:rank ?heightRank ; psn:P2048/wikibase:quantityAmount ?height .
                FILTER(?heightRank != wikibase:DeprecatedRank)
            }
            OPTIONAL {
                ?item p:P2067 ?weightStatement . ?weightStatement wikibase:rank ?weightRank ; psn:P2067/wikibase:quantityAmount ?weight .
                FILTER(?weightRank != wikibase:DeprecatedRank)
            }
            OPTIONAL { ?frwiki schema:about ?item ; schema:isPartOf <https://fr.wikipedia.org/> }
            OPTIONAL { ?enwiki schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
        }`);

    const people = new Map<string, WikidataPerson & { heightPreferred: boolean, weightPreferred: boolean }>();
    for (const binding of bindings) {
        const qid: string | undefined = binding.item?.value.match(/(Q\d+)$/)?.[1];
        const uci: string | undefined = binding.uci?.value;
        if (!qid || !uci) continue;
        let person = people.get(qid);
        if (!person) {
            person = {
                qid, uciPageIds: new Set(), labelEn: null, labelFr: null, labelMul: null, height: null, weight: null,
                frwiki: null, enwiki: null, heightPreferred: false, weightPreferred: false,
            };
            people.set(qid, person);
        }
        person.uciPageIds.add(uci);
        person.labelEn ??= binding.labelEn?.value ?? null;
        person.labelFr ??= binding.labelFr?.value ?? null;
        person.labelMul ??= binding.labelMul?.value ?? null;
        person.frwiki ??= binding.frwiki?.value ?? null;
        person.enwiki ??= binding.enwiki?.value ?? null;
        if (binding.height) {
            const height: number | null = validHeight(Number(binding.height.value));
            const preferred: boolean = binding.heightRank?.value === PREFERRED_RANK;
            if (height !== null && (person.height === null || (preferred && !person.heightPreferred))) {
                person.height = height;
                person.heightPreferred = preferred;
            }
        }
        if (binding.weight) {
            const weight: number | null = validWeight(Number(binding.weight.value));
            const preferred: boolean = binding.weightRank?.value === PREFERRED_RANK;
            if (weight !== null && (person.weight === null || (preferred && !person.weightPreferred))) {
                person.weight = weight;
                person.weightPreferred = preferred;
            }
        }
    }
    return [...people.values()].map(person => ({
        qid: person.qid, uciPageIds: person.uciPageIds, labelEn: person.labelEn, labelFr: person.labelFr, labelMul: person.labelMul,
        height: person.height, weight: person.weight, frwiki: person.frwiki, enwiki: person.enwiki,
    }));
}

type RiderName = {
    id: number,
    display_name: string,
    display_name_source: 'rules' | 'wikidata' | 'manual',
    given_name: string | null,
    family_name: string,
    name_raw: string,
    nation_code: string | null,
};

/** Labels of a Wikidata item */
export type Labels = { en: string | null, fr: string | null, mul: string | null };

/** A new display name taken from a Wikidata label */
export type NameChange = {
    display: string,
    given: string | null,
    family: string,
    /** `spelling`: same words up to accents, case and punctuation; `subset`: some of the words of the UCI name */
    rule: 'spelling' | 'subset',
    /** Why the change deserves a human look, null when it does not */
    doubt: string | null,
};

function folded(text: string): string[] {
    return foldToAscii(text).split(' ').filter(word => word.length > 0);
}

function cleanLabel(raw: string): string {
    return raw.normalize('NFC').trim().replace(/\s+/g, ' ');
}

/**
 * Splits a label into the given part and the family part of the rule-built name.
 * @param label Label ("Jonas Vingegaard")
 * @param given Words of the rule-built given name, folded
 * @param family Words of the rule-built family name, folded
 * @param fits Whether the folded words of a part fit the folded words of the rule-built part
 * @return The two parts, null when no cut fits
 */
function splitLabel(
    label: string, given: string[], family: string[], fits: (part: string[], reference: string[]) => boolean,
): { given: string | null, family: string } | null {
    const tokens: string[] = label.split(' ');
    for (let cut = given.length > 0 ? 1 : 0; cut < tokens.length; cut++) {
        const givenPart: string = tokens.slice(0, cut).join(' ');
        const familyPart: string = tokens.slice(cut).join(' ');
        if (fits(folded(givenPart), given) && fits(folded(familyPart), family)) {
            return { given: givenPart.length > 0 ? givenPart : null, family: familyPart };
        }
    }
    return null;
}

const sameWords = (part: string[], reference: string[]): boolean => part.join(' ') === reference.join(' ');
const someWords = (part: string[], reference: string[]): boolean => part.length > 0 && part.every(word => reference.includes(word));

/**
 * Display name from the label of the Wikidata item matched by P11020 (same person), compared with the name built
 * by the rules from the UCI name (`displayNameParts`):
 * 1. subset: the folded words of the label (French label first, else English) are some of the folded words of the
 *    rule-built name (in any order), at least two, including the first word of the family name or of the given
 *    name, and at least one word of the given name when there is one ("Jonas Vingegaard Hansen" -> "Jonas Vingegaard");
 * 2. spelling: the label is the rule-built name up to accents, case and punctuation (English, French, then `mul`).
 * Any other label is ignored; `manual` names are never changed. A `wikidata` name no label qualifies for any more
 * goes back to the rule-built name (see enrichFromWikidata).
 * @param rider Current name of the rider
 * @param labels Labels of the item
 * @return The new name (possibly equal to the current one), null when no label qualifies
 */
export function nameFromLabel(rider: RiderName, labels: Labels): NameChange | null {
    if (rider.display_name_source === 'manual') return null;
    const rule = displayNameParts(rider.name_raw, rider.nation_code);
    const ruleWords: string[] = folded(rule.display);
    const givenWords: string[] = rule.given ? folded(rule.given) : [];
    const familyWords: string[] = folded(rule.family);

    for (const raw of [labels.fr, labels.en]) {
        if (!raw) continue;
        const label: string = cleanLabel(raw);
        const words: string[] = folded(label);
        if (words.join(' ') === ruleWords.join(' ')) continue; // same words: the spelling rule
        if (words.length < 2 || !words.every(word => ruleWords.includes(word))) continue;
        if (!words.includes(familyWords[0]) && !(givenWords.length > 0 && words.includes(givenWords[0]))) continue;
        if (givenWords.length > 0 && !words.some(word => givenWords.includes(word))) continue; // keeps no word of the given name

        const doubts: string[] = [];
        if (!words.some(word => familyWords.includes(word))) doubts.push('no word of the family name');
        const positions: number[] = words.map(word => ruleWords.indexOf(word));
        if (positions.some((position, index) => index > 0 && position < positions[index - 1])) doubts.push('words reordered');
        if (new Set(words).size === new Set(ruleWords).size) doubts.push('same words, not shorter');
        const parts = splitLabel(label, givenWords, familyWords, someWords);
        if (!parts) doubts.push('label not split into given and family names');
        return {
            display: label, given: parts ? parts.given : rider.given_name, family: parts ? parts.family : rider.family_name,
            rule: 'subset', doubt: doubts.length > 0 ? doubts.join(', ') : null,
        };
    }

    for (const raw of [labels.en, labels.fr, labels.mul]) {
        if (!raw) continue;
        const label: string = cleanLabel(raw);
        if (folded(label).join(' ') !== ruleWords.join(' ')) continue;
        const parts = splitLabel(label, givenWords, familyWords, sameWords);
        return {
            display: label, given: parts ? parts.given : rider.given_name, family: parts ? parts.family : rider.family_name,
            rule: 'spelling', doubt: null,
        };
    }
    return null;
}

export type EnrichmentReport = {
    riders: number,
    idsQueried: number,
    requests: number,
    retries: number,
    qid: number,
    height: number,
    weight: number,
    frwiki: number,
    enwiki: number,
    namesChanged: number,
    /** Names changed by each rule in this run */
    changedByRule: { spelling: number, subset: number },
    /** Every name changed in this run */
    changes: { before: string, after: string, rule: 'spelling' | 'subset', doubt: string | null }[],
    /** Names taken from Wikidata before that no label qualifies for any more, back to the rule-built name */
    reverted: { before: string, after: string }[],
    ambiguousRiders: number,
    sharedItems: number,
};

/**
 * Fetches every rider with a P11020 id and writes rider_profile, the wikidata_qid external ids and better names.
 * @param sql Database client
 * @param batchSize P11020 values per request
 * @param limit Stop after this many ids (tests)
 */
export async function enrichFromWikidata(sql: Sql, batchSize = 300, limit?: number): Promise<EnrichmentReport> {
    const ids = await sql<{ rider_id: number, external_id: string }[]>`
        select rider_id, external_id from rider_external_id where source = ${EXTERNAL_ID_SOURCES.uciRiderPageId}
        order by rider_id, external_id
    `;
    const selected = limit !== undefined ? ids.slice(0, limit) : ids;
    const riderByPageId = new Map<string, number>(selected.map(row => [row.external_id, row.rider_id]));
    const client = new SparqlClient();
    const peopleByRider = new Map<number, Map<string, WikidataPerson>>();
    const pageIds: string[] = [...riderByPageId.keys()];
    for (let first = 0; first < pageIds.length; first += batchSize) {
        const people: WikidataPerson[] = await fetchPeople(client, pageIds.slice(first, first + batchSize));
        for (const person of people) {
            for (const pageId of person.uciPageIds) {
                const riderId: number | undefined = riderByPageId.get(pageId);
                if (riderId === undefined) continue;
                const found = peopleByRider.get(riderId) ?? new Map<string, WikidataPerson>();
                found.set(person.qid, person);
                peopleByRider.set(riderId, found);
            }
        }
        console.info(`  ${Math.min(first + batchSize, pageIds.length)} / ${pageIds.length} ids, ${peopleByRider.size} riders found`);
    }

    // One item per rider and one rider per item, or nothing
    const report: EnrichmentReport = {
        riders: new Set(selected.map(row => row.rider_id)).size, idsQueried: pageIds.length, requests: 0, retries: 0,
        qid: 0, height: 0, weight: 0, frwiki: 0, enwiki: 0, namesChanged: 0, changedByRule: { spelling: 0, subset: 0 }, changes: [], reverted: [], ambiguousRiders: 0, sharedItems: 0,
    };
    const ridersByItem = new Map<string, number[]>();
    for (const [riderId, people] of peopleByRider) {
        if (people.size !== 1) {
            report.ambiguousRiders++;
            continue;
        }
        const qid: string = [...people.keys()][0];
        ridersByItem.set(qid, [...(ridersByItem.get(qid) ?? []), riderId]);
    }
    const matches: { riderId: number, person: WikidataPerson }[] = [];
    for (const [qid, riderIds] of ridersByItem) {
        if (riderIds.length > 1) {
            report.sharedItems++;
            continue;
        }
        matches.push({ riderId: riderIds[0], person: peopleByRider.get(riderIds[0])!.get(qid)! });
    }

    const names = new Map<number, RiderName>();
    for (let first = 0; first < matches.length; first += 2000) {
        const rows = await sql<RiderName[]>`
            select id, display_name, display_name_source, given_name, family_name, name_raw, nation_code from rider
            where id in ${sql(matches.slice(first, first + 2000).map(match => match.riderId))}
        `;
        for (const row of rows) names.set(row.id, row);
    }

    for (let first = 0; first < matches.length; first += 500) {
        const batch = matches.slice(first, first + 500);
        await sql.begin(async tx => {
            for (const { riderId, person } of batch) {
                const label: string | null = person.labelEn ?? person.labelFr ?? person.labelMul;
                await tx`
                    insert into rider_profile (rider_id, wikidata_qid, wikidata_label, height_m, weight_kg, frwiki_url, enwiki_url, fetched_at)
                    values (${riderId}, ${person.qid}, ${label}, ${person.height}, ${person.weight}, ${person.frwiki}, ${person.enwiki}, now())
                    on conflict (rider_id) do update set
                        wikidata_qid = excluded.wikidata_qid, wikidata_label = excluded.wikidata_label, height_m = excluded.height_m,
                        weight_kg = excluded.weight_kg, frwiki_url = excluded.frwiki_url, enwiki_url = excluded.enwiki_url,
                        fetched_at = excluded.fetched_at
                `;
                await tx`
                    insert into rider_external_id (source, external_id, rider_id)
                    values (${EXTERNAL_ID_SOURCES.wikidataQid}, ${person.qid}, ${riderId})
                    on conflict (source, external_id) do nothing
                `;
                const rider: RiderName | undefined = names.get(riderId);
                const change: NameChange | null = rider
                    ? nameFromLabel(rider, { en: person.labelEn, fr: person.labelFr, mul: person.labelMul })
                    : null;
                if (rider && change && (change.display !== rider.display_name || change.given !== rider.given_name
                    || change.family !== rider.family_name)) {
                    await tx`
                        update rider set display_name = ${change.display}, given_name = ${change.given}, family_name = ${change.family},
                            display_name_source = 'wikidata', updated_at = now()
                        where id = ${riderId} and display_name_source <> 'manual'
                    `;
                    report.namesChanged++;
                    report.changedByRule[change.rule]++;
                    report.changes.push({ before: rider.display_name, after: change.display, rule: change.rule, doubt: change.doubt });
                } else if (rider && !change && rider.display_name_source === 'wikidata') {
                    const rule = displayNameParts(rider.name_raw, rider.nation_code);
                    await tx`
                        update rider set display_name = ${rule.display}, given_name = ${rule.given}, family_name = ${rule.family},
                            display_name_source = 'rules', updated_at = now()
                        where id = ${riderId} and display_name_source = 'wikidata'
                    `;
                    report.reverted.push({ before: rider.display_name, after: rule.display });
                }
                report.qid++;
                if (person.height !== null) report.height++;
                if (person.weight !== null) report.weight++;
                if (person.frwiki) report.frwiki++;
                if (person.enwiki) report.enwiki++;
            }
        });
    }
    report.requests = client.requests;
    report.retries = client.retries;
    return report;
}
