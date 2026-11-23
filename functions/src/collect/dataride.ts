import axios, { type AxiosResponse } from 'axios';

import { sleep, USER_AGENT } from '../utils/httpUtils.js';

import type { RawArchive } from './archive.js';
import { tally } from './tally.js';

/**
 * Read-only client of UCI DataRide (https://dataride.uci.ch/iframe), the backend of the UCI results pages.
 * Lists follow the Kendo convention: POST form-encoded `take`, `skip`, `page`, `pageSize` and
 * `filter[filters][i][field|value]`, answered `{ data: [...], total: N }`.
 * Only read endpoints are called: never AddRiders, UpdateResults, SubmitChanges or any other write endpoint.
 */
const DATARIDE_URL = 'https://dataride.uci.ch/iframe';
const ROAD_DISCIPLINE_ID = 10;
const MEN_ELITE_CATEGORY_ID = 22;
const ALL_RACE_TYPES_ID = 0;
const WORLD_RANKING_ID = 1;
const INDIVIDUAL_RANKING_TYPE_ID = 1;

/** Largest page asked for: a larger `take` makes DataRide answer HTTP 200 with an HTML error page */
export const MAX_PAGE_SIZE = 1000;
const LIST_PAGE_SIZE = 500;

export type DrSeason = { Id: number, Year: number, StartDate: string, EndDate: string };

export type DrCompetition = {
    CompetitionId: number,
    CompetitionName: string | null,
    StartDate: string,
    EndDate: string,
    CountryName: string | null,
    CountryIsoCode2: string | null,
    CountryIsoCode3: string | null,
    ClassCode: string | null,
};

export type DrRace = {
    Id: number,
    RaceCode: string | null,
    Index: number | null,
    StartDate: string,
    RaceName: string | null,
    CategoryCode: string | null,
    RaceTypeCode: string | null,
};

export type DrEvent = {
    EventId: number,
    EventName: string | null,
    IsTeamEvent: boolean,
    WinnerName: string | null,
};

export type DrResult = {
    ResultId: number,
    RankNumber: number | null,
    SortOrder: number | null,
    Rank: string | null,
    Bib: string | null,
    BirthDate: string | null,
    DisplayName: string | null,
    IndividualDisplayName: string | null,
    UnknownIndividualDisplayName: string | null,
    NationName: string | null,
    IndividualCountryName: string | null,
    UnknownIndividualCountryName: string | null,
    IsoCode2: string | null,
    IndividualCountryNameText: string | null,
    UnknownIndividualCountryNameText: string | null,
    TeamName: string | null,
    ResultValue: string | null,
    PointPcR: number | null,
    Irm: string | null,
};

export type DrRanking = {
    ObjectId: number,
    UciId: number | null,
    Rank: number,
    DisplayName: string | null,
    TeamName: string | null,
    TeamCode: string | null,
    NationName: string | null,
    NationFullName: string | null,
    CountryIsoCode2: string | null,
    BirthDate: string | null,
    Points: number | null,
    MomentId: number | null,
    ComputationDate: string | null,
};

type Page<T> = { data: T[], total: number };

/** A response that is not what the endpoint should return: worth retrying (DataRide errors come as HTTP 200 pages) */
class UnexpectedResponseError extends Error {
}

/** A response that will not get better by retrying (4xx other than 429) */
class PermanentHttpError extends Error {
}

export type ClientOptions = {
    /** Requests in flight at most */
    concurrency?: number,
    /** Pause of each worker between two of its requests, in milliseconds */
    pauseMs?: number,
    /** Attempts per request before giving up */
    attempts?: number,
    /** Timeout of one request, in milliseconds */
    timeoutMs?: number,
};

function isPage(fields: string[]) {
    return (value: unknown): boolean => {
        if (typeof value !== 'object' || value === null) return false;
        const page = value as Partial<Page<Record<string, unknown>>>;
        if (!Array.isArray(page.data) || typeof page.total !== 'number') return false;
        return page.data.length === 0 || fields.every(field => field in page.data![0]);
    };
}

function isArrayOf(fields: string[]) {
    return (value: unknown): boolean => Array.isArray(value)
        && (value.length === 0 || fields.every(field => field in (value[0] as Record<string, unknown>)));
}

function kendoPaging(page: number, size: number): Record<string, string | number> {
    return { take: size, skip: (page - 1) * size, page, pageSize: size };
}

function kendoFilters(filters: [string, string | number][]): Record<string, string | number> {
    const body: Record<string, string | number> = {};
    filters.forEach(([field, value], index) => {
        body[`filter[filters][${index}][field]`] = field;
        body[`filter[filters][${index}][value]`] = value;
    });
    return body;
}

export class DataRideClient {
    private readonly concurrency: number;
    private readonly pauseMs: number;
    private readonly attempts: number;
    private readonly timeoutMs: number;
    private readonly lastEnd: number[];
    private readonly freeSlots: number[];
    private readonly waiting: ((slot: number) => void)[] = [];
    /** Every worker waits until this time after a 429, a 5xx or an unexpected answer */
    private coolDownUntil = 0;

    /** Number of HTTP requests sent (retries included) */
    requests = 0;
    /** Number of attempts that failed and were retried */
    retries = 0;
    /** Duration of each HTTP request, in milliseconds */
    readonly durations: number[] = [];

    constructor(private readonly archive: RawArchive, options: ClientOptions = {}) {
        this.concurrency = options.concurrency ?? 4;
        this.pauseMs = options.pauseMs ?? 500;
        this.attempts = options.attempts ?? 6;
        this.timeoutMs = options.timeoutMs ?? 20_000;
        this.lastEnd = new Array(this.concurrency).fill(0);
        this.freeSlots = Array.from({ length: this.concurrency }, (_, index) => index);
    }

    /** @return The median duration of the requests sent so far, in milliseconds */
    medianDurationMs(): number | null {
        if (this.durations.length === 0) return null;
        const sorted: number[] = [...this.durations].sort((a, b) => a - b);
        const middle: number = Math.floor(sorted.length / 2);
        return Math.round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
    }

    private acquire(): Promise<number> {
        const slot: number | undefined = this.freeSlots.pop();
        if (slot !== undefined) return Promise.resolve(slot);
        return new Promise(resolve => this.waiting.push(resolve));
    }

    private release(slot: number): void {
        const next: ((slot: number) => void) | undefined = this.waiting.shift();
        if (next) next(slot);
        else this.freeSlots.push(slot);
    }

    private async send(method: 'GET' | 'POST', url: string, body?: URLSearchParams): Promise<AxiosResponse<string>> {
        const slot: number = await this.acquire();
        try {
            const wait: number = Math.max(this.lastEnd[slot] + this.pauseMs, this.coolDownUntil) - Date.now();
            if (wait > 0) await sleep(wait);
            this.requests++;
            const counts = tally.getStore();
            if (counts) counts.requests++;
            const start: number = Date.now();
            try {
                return await axios.request<string>({
                    method,
                    url,
                    data: body,
                    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
                    timeout: this.timeoutMs,
                    responseType: 'text',
                    transformResponse: [(data: string) => data],
                    validateStatus: () => true,
                });
            } finally {
                this.durations.push(Date.now() - start);
            }
        } finally {
            this.lastEnd[slot] = Date.now();
            this.release(slot);
        }
    }

    /**
     * Sends a request until it returns the expected JSON, with an exponential backoff on network errors,
     * timeouts, 429, 5xx and HTTP 200 answers that are not the expected JSON. The raw body is archived.
     */
    private async fetchJson<T>(method: 'GET' | 'POST', path: string, form: Record<string, string | number> | null,
        validate: (value: unknown) => boolean, archivePath: string): Promise<T> {
        const url = `${DATARIDE_URL}/${path}`;
        for (let attempt = 1; ; attempt++) {
            let retryAfterMs: number | null = null;
            try {
                const body: URLSearchParams | undefined = form
                    ? new URLSearchParams(Object.entries(form).map(([key, value]) => [key, String(value)]))
                    : undefined;
                const response: AxiosResponse<string> = await this.send(method, url, body);
                if (response.status === 429 || response.status >= 500) {
                    const retryAfter = Number(response.headers['retry-after']);
                    if (Number.isFinite(retryAfter) && retryAfter > 0) retryAfterMs = retryAfter * 1000;
                    throw new UnexpectedResponseError(`HTTP ${response.status}`);
                }
                if (response.status !== 200) throw new PermanentHttpError(`HTTP ${response.status} from ${path}`);

                let parsed: unknown;
                try {
                    parsed = JSON.parse(response.data);
                } catch {
                    throw new UnexpectedResponseError(`HTTP 200 but not JSON from ${path} (${response.data.slice(0, 60).replace(/\s+/g, ' ')}...)`);
                }
                if (!validate(parsed)) throw new UnexpectedResponseError(`Unexpected JSON shape from ${path}`);
                await this.archive.write(archivePath, response.data);
                return parsed as T;
            } catch (error: unknown) {
                if (error instanceof PermanentHttpError || attempt >= this.attempts) {
                    throw new Error(`DataRide ${path} failed after ${attempt} attempt(s): ${(error as Error).message}`, { cause: error });
                }
                this.retries++;
                const backoffMs: number = retryAfterMs ?? Math.min(60_000, 2000 * 2 ** (attempt - 1)) + Math.random() * 1000;
                this.coolDownUntil = Math.max(this.coolDownUntil, Date.now() + backoffMs);
                const reason: string = axios.isAxiosError(error) ? error.code ?? error.message : (error as Error).message;
                console.warn(`DataRide ${path} attempt ${attempt} failed (${reason}), retrying in ${Math.round(backoffMs / 1000)} s`);
                await sleep(backoffMs);
            }
        }
    }

    private async fetchAllPages<T>(path: string, form: Record<string, string | number>, fields: string[],
        pageSize: number, archivePath: (page: number) => string): Promise<T[]> {
        const size: number = Math.min(pageSize, MAX_PAGE_SIZE);
        const rows: T[] = [];
        for (let page = 1; ; page++) {
            const result: Page<T> = await this.fetchJson<Page<T>>('POST', `${path}/`, { ...form, ...kendoPaging(page, size) },
                isPage(fields), archivePath(page));
            rows.push(...result.data);
            if (result.data.length < size || rows.length >= result.total) return rows;
        }
    }

    /** @return The road seasons (Year and DataRide season Id, start and end dates) */
    getSeasons(): Promise<DrSeason[]> {
        return this.fetchJson<DrSeason[]>('GET', `GetRestrictedResultsDisciplineSeasons/?disciplineId=${ROAD_DISCIPLINE_ID}`, null,
            isArrayOf(['Id', 'Year', 'StartDate', 'EndDate']), 'dataride/seasons');
    }

    /**
     * @param season DataRide season
     * @return The men elite road competitions of the season (all classes)
     */
    getCompetitions(season: DrSeason): Promise<DrCompetition[]> {
        return this.fetchAllPages<DrCompetition>('Competitions', {
            disciplineId: ROAD_DISCIPLINE_ID,
            'sort[0][field]': 'StartDate', // required: DataRide answers an error page without a sort
            'sort[0][dir]': 'asc',
            ...kendoFilters([['RaceTypeId', ALL_RACE_TYPES_ID], ['CategoryId', MEN_ELITE_CATEGORY_ID], ['SeasonId', season.Id]]),
        }, ['CompetitionId', 'ClassCode', 'StartDate', 'EndDate'], LIST_PAGE_SIZE,
        page => `dataride/calendar/${season.Year}-p${page}`);
    }

    /** @return The races of a competition: stages, final classification, championship races of every category */
    getRaces(competitionId: number): Promise<DrRace[]> {
        return this.fetchAllPages<DrRace>('Races', { disciplineId: ROAD_DISCIPLINE_ID, competitionId },
            ['Id', 'RaceName', 'CategoryCode', 'RaceTypeCode'], 200,
            page => `dataride/competitions/${competitionId}/races${page > 1 ? `-p${page}` : ''}`);
    }

    /** @return The classifications of a race (general, stage, points, mountains...) */
    getEvents(competitionId: number, raceId: number): Promise<DrEvent[]> {
        return this.fetchJson<DrEvent[]>('POST', 'Events/', { disciplineId: ROAD_DISCIPLINE_ID, raceId },
            isArrayOf(['EventId', 'EventName']), `dataride/competitions/${competitionId}/events-${raceId}`);
    }

    /** @return Every row of a classification, finish order, non-finishers included */
    getResults(competitionId: number, eventId: number): Promise<DrResult[]> {
        return this.fetchAllPages<DrResult>('Results', { disciplineId: ROAD_DISCIPLINE_ID, eventId },
            ['ResultId', 'DisplayName', 'Irm', 'ResultValue'], LIST_PAGE_SIZE,
            page => `dataride/competitions/${competitionId}/results-${eventId}${page > 1 ? `-p${page}` : ''}`);
    }

    /**
     * @param season DataRide season
     * @return The latest UCI World Ranking of the season (men elite road): every rider with points
     */
    getRanking(season: DrSeason): Promise<DrRanking[]> {
        return this.fetchAllPages<DrRanking>('ObjectRankings', {
            rankingId: WORLD_RANKING_ID,
            disciplineId: ROAD_DISCIPLINE_ID,
            rankingTypeId: INDIVIDUAL_RANKING_TYPE_ID,
            ...kendoFilters([
                ['RaceTypeId', ALL_RACE_TYPES_ID],
                ['CategoryId', MEN_ELITE_CATEGORY_ID],
                ['SeasonId', season.Id],
                ['MomentId', 0], // latest computation
                ['CountryId', 0],
                ['IndividualName', ''],
                ['TeamName', ''],
            ]),
        }, ['ObjectId', 'UciId', 'DisplayName', 'BirthDate'], MAX_PAGE_SIZE,
        page => `dataride/registry/${season.Year}-p${page}`);
    }
}
