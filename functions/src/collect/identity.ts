import type { Sql } from 'postgres';

import { EXTERNAL_ID_SOURCES, type MatchMethod } from '../db/rows.js';

import {
    cleanRawName, displayNameParts, exactNameKey, familyNameWords, foldToAscii, looseNameKey, pickSlug, searchName, slugBase,
} from './names.js';
import { tally } from './tally.js';

/** A person as a DataRide row describes it */
export type Identity = {
    name: string,
    birthDate: string | null,
    nationCode: string | null,
    nationIso2: string | null,
    nationName: string | null,
};

export type Match = { riderId: number, method: MatchMethod };

type RiderEntry = { id: number, birthDate: string | null, hasRegistry: boolean };

type PendingAlias = { riderId: number, key: string, identity: Identity, method: MatchMethod, source: string };

type ReviewKind = 'ambiguous_match' | 'possible_duplicate' | 'missing_birth_date' | 'registry_duplicate';

type PendingReview = {
    kind: ReviewKind,
    dedupeKey: string,
    riderId: number,
    candidates: number[],
    identity: Identity,
    classificationId: number | null,
    note: string,
};

function add<K>(map: Map<K, Set<number>>, key: K, id: number): void {
    const ids: Set<number> | undefined = map.get(key);
    if (ids) ids.add(id);
    else map.set(key, new Set([id]));
}

/** Words of three letters or more of a name, without accents */
function nameWords(name: string): string[] {
    return foldToAscii(name).split(' ').filter(word => word.length >= 3);
}

/** Key of a name variant: the exact name, the birth date and the nation */
function aliasKey(identity: Identity): string {
    return `${exactNameKey(identity.name)}|${identity.birthDate ?? ''}|${identity.nationCode ?? ''}`;
}

/**
 * Every rider known to the database, indexed to tie DataRide rows (which carry no rider id) to riders:
 * (a) exact name and birth date; (b) birth date, nation and name without accents; (c) else a new rider,
 * with a review row when a rider born the same day has a close name. Lookups and creations run one
 * at a time (`exclusive`), so concurrent competitions never create the same rider twice.
 */
export class RiderDirectory {
    private readonly riders: Map<number, RiderEntry> = new Map();
    private readonly byAlias: Map<string, Map<number, MatchMethod>> = new Map();
    private readonly byExact: Map<string, Set<number>> = new Map();
    private readonly byLoose: Map<string, Set<number>> = new Map();
    private readonly byBirth: Map<string, Set<number>> = new Map();
    private readonly byNameWithoutBirth: Map<string, Set<number>> = new Map();
    private readonly wordsByRider: Map<number, Set<string>> = new Map();
    private readonly byNameAndNation: Map<string, Set<number>> = new Map();
    private readonly objectIds: Map<string, number> = new Map();
    private readonly slugs: Set<string> = new Set();
    private pendingAliases: PendingAlias[] = [];
    private pendingReviews: PendingReview[] = [];
    private queue: Promise<unknown> = Promise.resolve();

    /** Riders created since the directory was loaded */
    created = 0;
    /** Review rows queued since the directory was loaded */
    reviews = 0;

    private constructor(private readonly sql: Sql) {
    }

    /**
     * @param sql Database client
     * @return The directory of every rider, alias and slug in the database
     */
    static async load(sql: Sql): Promise<RiderDirectory> {
        const directory = new RiderDirectory(sql);
        const riders = await sql<{ id: number, slug: string, name_raw: string, birth_date: string | null, nation_code: string | null, has_registry: boolean }[]>`
            select r.id, r.slug, r.name_raw, r.birth_date, r.nation_code,
                   exists (select 1 from rider_external_id x where x.rider_id = r.id and x.source = ${EXTERNAL_ID_SOURCES.datarideObjectId}) as has_registry
            from rider r
        `;
        for (const rider of riders) {
            directory.riders.set(rider.id, { id: rider.id, birthDate: rider.birth_date, hasRegistry: rider.has_registry });
            directory.slugs.add(rider.slug);
            directory.index(rider.id, { name: rider.name_raw, birthDate: rider.birth_date, nationCode: rider.nation_code, nationIso2: null, nationName: null },
                rider.has_registry ? 'registry' : 'created');
        }
        for (const { slug } of await sql<{ slug: string }[]>`select slug from rider_slug_history`) directory.slugs.add(slug);

        const aliases = await sql<{ rider_id: number, name_raw: string, birth_date: string | null, nation_code: string | null, match_method: MatchMethod }[]>`
            select rider_id, name_raw, birth_date, nation_code, match_method from rider_alias
        `;
        for (const alias of aliases) {
            directory.index(alias.rider_id, { name: alias.name_raw, birthDate: alias.birth_date, nationCode: alias.nation_code, nationIso2: null, nationName: null },
                alias.match_method);
        }

        const objectIds = await sql<{ external_id: string, rider_id: number }[]>`
            select external_id, rider_id from rider_external_id where source = ${EXTERNAL_ID_SOURCES.datarideObjectId}
        `;
        for (const { external_id, rider_id } of objectIds) directory.objectIds.set(external_id, rider_id);
        return directory;
    }

    /** Number of riders known */
    get size(): number {
        return this.riders.size;
    }

    /**
     * Runs `task` after every task queued before it: lookups and creations never interleave.
     */
    exclusive<T>(task: () => Promise<T>): Promise<T> {
        const run: Promise<T> = this.queue.then(task, task);
        this.queue = run.catch(() => undefined);
        return run;
    }

    private index(riderId: number, identity: Identity, method: MatchMethod): void {
        const key: string = aliasKey(identity);
        const methods: Map<number, MatchMethod> = this.byAlias.get(key) ?? new Map();
        if (!methods.has(riderId)) methods.set(riderId, method);
        this.byAlias.set(key, methods);
        const words: Set<string> = this.wordsByRider.get(riderId) ?? new Set();
        nameWords(identity.name).forEach(word => words.add(word));
        this.wordsByRider.set(riderId, words);
        add(this.byNameAndNation, `${looseNameKey(identity.name)}|${identity.nationCode ?? ''}`, riderId);
        if (identity.birthDate) {
            add(this.byExact, `${exactNameKey(identity.name)}|${identity.birthDate}`, riderId);
            add(this.byLoose, `${looseNameKey(identity.name)}|${identity.birthDate}|${identity.nationCode ?? ''}`, riderId);
            add(this.byBirth, identity.birthDate, riderId);
        } else {
            add(this.byNameWithoutBirth, `${exactNameKey(identity.name)}|${identity.nationCode ?? ''}`, riderId);
        }
    }

    private remember(riderId: number, identity: Identity, method: MatchMethod, source: string): void {
        const key: string = aliasKey(identity);
        if (this.byAlias.get(key)?.has(riderId)) return;
        this.index(riderId, identity, method);
        this.pendingAliases.push({ riderId, key, identity, method, source });
    }

    /** Prefers the rider known to the UCI registry, then the oldest */
    private preferred(ids: Iterable<number>): number {
        return [...ids].sort((a, b) => Number(this.riders.get(b)?.hasRegistry ?? false) - Number(this.riders.get(a)?.hasRegistry ?? false) || a - b)[0];
    }

    private review(kind: ReviewKind, riderId: number, candidates: number[], identity: Identity, classificationId: number | null, note: string): void {
        const dedupeKey = `${kind}|${aliasKey(identity)}|${riderId}`;
        this.pendingReviews.push({ kind, dedupeKey, riderId, candidates, identity, classificationId, note });
        this.reviews++;
    }

    /** Steps (a) and (b), on the indexes */
    private lookup(identity: Identity): { ids: Set<number>, method: MatchMethod } | null {
        if (!identity.birthDate) {
            const ids: Set<number> | undefined = this.byNameWithoutBirth.get(`${exactNameKey(identity.name)}|${identity.nationCode ?? ''}`);
            return ids?.size ? { ids, method: 'exact' } : null;
        }
        const exact: Set<number> | undefined = this.byExact.get(`${exactNameKey(identity.name)}|${identity.birthDate}`);
        if (exact?.size) return { ids: exact, method: 'exact' };
        const loose: Set<number> | undefined = this.byLoose.get(`${looseNameKey(identity.name)}|${identity.birthDate}|${identity.nationCode ?? ''}`);
        if (loose?.size) return { ids: loose, method: 'loose' };
        return null;
    }

    /**
     * Possible duplicates of a new rider: riders born the same day whose name holds a word of the new family
     * name (three letters or more, particles aside), and riders with the same name and nation but another
     * birth date (homonym or typo in the date)
     */
    private nearCandidates(identity: Identity): number[] {
        const words: string[] = familyNameWords(identity.name);
        const sameDay: number[] = identity.birthDate
            ? [...this.byBirth.get(identity.birthDate) ?? []].filter(id => words.some(word => this.wordsByRider.get(id)?.has(word)))
            : [];
        const sameName: number[] = [...this.byNameAndNation.get(`${looseNameKey(identity.name)}|${identity.nationCode ?? ''}`) ?? []];
        return [...new Set([...sameDay, ...sameName])];
    }

    private async create(identity: Identity, createdFrom: 'dataride_registry' | 'dataride_result'): Promise<number> {
        const name: string = cleanRawName(identity.name);
        const parts = displayNameParts(name, identity.nationCode);
        const slug: string = pickSlug(slugBase(parts.display), identity.birthDate, candidate => this.slugs.has(candidate));
        this.slugs.add(slug);
        const [row] = await this.sql<{ id: number }[]>`
            insert into rider (slug, display_name, given_name, family_name, name_raw, search_name, birth_date,
                               nation_code, nation_iso2, nation_name, created_from)
            values (${slug}, ${parts.display}, ${parts.given}, ${parts.family}, ${name}, ${searchName(parts.display)},
                    ${identity.birthDate}, ${identity.nationCode}, ${identity.nationIso2}, ${identity.nationName}, ${createdFrom})
            returning id
        `;
        this.riders.set(row.id, { id: row.id, birthDate: identity.birthDate, hasRegistry: false });
        this.created++;
        const counts = tally.getStore();
        if (counts) counts.ridersCreated++;
        return row.id;
    }

    /**
     * Ties a result row to a rider, creating the rider when no step matches. Call inside `exclusive`.
     * @param identity Name, birth date and nation of the row
     * @param classificationId Classification of the row (kept on review rows)
     */
    async resolveResult(identity: Identity, classificationId: number | null): Promise<Match> {
        const known: Map<number, MatchMethod> | undefined = this.byAlias.get(aliasKey(identity));
        if (known?.size) {
            const riderId: number = this.preferred(known.keys());
            return { riderId, method: known.get(riderId)! };
        }

        const found = this.lookup(identity);
        if (found) {
            const riderId: number = this.preferred(found.ids);
            if (found.ids.size > 1) {
                this.review('ambiguous_match', riderId, [...found.ids].filter(id => id !== riderId), identity, classificationId,
                    `${found.ids.size} riders match by ${found.method} key; the registry rider (else the oldest) was used`);
            }
            this.remember(riderId, identity, found.method, 'dataride_result');
            return { riderId, method: found.method };
        }

        const near: number[] = this.nearCandidates(identity);
        const riderId: number = await this.create(identity, 'dataride_result');
        if (!identity.birthDate) {
            this.review('missing_birth_date', riderId, near, identity, classificationId, 'Result row without a birth date: rider keyed by name and nation');
        } else if (near.length > 0) {
            this.review('possible_duplicate', riderId, near, identity, classificationId,
                'New rider (from a result) close to known riders: same birth day and a common name word, or same name and nation');
        }
        this.remember(riderId, identity, 'created', 'dataride_result');
        return { riderId, method: 'created' };
    }

    /**
     * Ties a UCI ranking entry (DataRide ObjectId) to a rider, creating the rider when needed. Call inside `exclusive`.
     * @param objectId DataRide ObjectId
     * @param identity Name, birth date and nation of the entry
     * @return The rider id
     */
    async resolveRegistry(objectId: string, identity: Identity): Promise<number> {
        const known: number | undefined = this.objectIds.get(objectId);
        if (known !== undefined) {
            this.remember(known, identity, 'registry', 'dataride_registry');
            return known;
        }

        const found = this.lookup(identity);
        let riderId: number;
        if (found) {
            riderId = this.preferred(found.ids);
            if (this.riders.get(riderId)?.hasRegistry) {
                this.review('registry_duplicate', riderId, [], identity, null,
                    `DataRide ObjectId ${objectId} has the same ${found.method} identity as a rider with another ObjectId: attached to that rider`);
            }
        } else {
            const near: number[] = this.nearCandidates(identity);
            riderId = await this.create(identity, 'dataride_registry');
            if (near.length > 0) {
                this.review('possible_duplicate', riderId, near, identity, null,
                    `New rider (DataRide ObjectId ${objectId}) close to known riders: same birth day and a common name word, or same name and nation`);
            }
        }
        const entry: RiderEntry | undefined = this.riders.get(riderId);
        if (entry) entry.hasRegistry = true;
        this.objectIds.set(objectId, riderId);
        this.remember(riderId, identity, 'registry', 'dataride_registry');
        return riderId;
    }

    /**
     * Writes the aliases and review rows queued by the resolutions.
     */
    async flush(): Promise<void> {
        const aliases: PendingAlias[] = this.pendingAliases;
        const reviews: PendingReview[] = this.pendingReviews;
        this.pendingAliases = [];
        this.pendingReviews = [];

        for (let start = 0; start < aliases.length; start += 1000) {
            const rows = aliases.slice(start, start + 1000).map(alias => ({
                rider_id: alias.riderId,
                alias_key: alias.key,
                name_raw: cleanRawName(alias.identity.name),
                birth_date: alias.identity.birthDate,
                nation_code: alias.identity.nationCode,
                match_method: alias.method,
                source: alias.source,
            }));
            await this.sql`
                insert into rider_alias ${this.sql(rows, 'rider_id', 'alias_key', 'name_raw', 'birth_date', 'nation_code', 'match_method', 'source')}
                on conflict (alias_key, rider_id) do nothing
            `;
        }
        for (const review of reviews) {
            await this.sql`
                insert into rider_review (kind, dedupe_key, rider_id, candidate_rider_ids, name_raw, birth_date, nation_code, classification_id, note)
                values (${review.kind}, ${review.dedupeKey}, ${review.riderId}, ${review.candidates}::int[], ${cleanRawName(review.identity.name)},
                        ${review.identity.birthDate}, ${review.identity.nationCode}, ${review.classificationId}, ${review.note})
                on conflict (dedupe_key) do nothing
            `;
        }
    }
}
