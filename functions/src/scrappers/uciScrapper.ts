import axios from 'axios';

import { USER_AGENT, withRetry } from '../utils/httpUtils.js';

/**
 * Client for UCI DataRide (https://dataride.uci.ch), the backend of the official UCI rankings pages.
 * It serves JSON through the same endpoints the uci.org ranking iframes call.
 */
const DATARIDE_URL = 'https://dataride.uci.ch/iframe';
const ROAD_DISCIPLINE_ID = 10;
const MEN_ELITE_CATEGORY_ID = 22;
const ALL_RACE_TYPES_ID = 0;
const WORLD_RANKING_ID = 1;
const WORLD_RANKING_GROUP_ID = 1;
const INDIVIDUAL_RANKING_TYPE_ID = 1;
const REQUEST_TIMEOUT_MS = 60000;

/**
 * A rider of the UCI World Ranking.
 * @param uciId DataRide id of the rider (also stored on Wikidata as "UCI rider ID", P11020)
 * @param rank Rank in the UCI World Ranking
 * @param displayName Name as written by the UCI: family name in capitals, then given name (e.g. "POGAČAR Tadej")
 * @param team UCI team name, null when the rider has no registered team
 * @param nation UCI nation name (e.g. "GREAT BRITAIN"), null when unknown
 * @param birthDate Date of birth
 * @param momentId Ranking computation the rider comes from, needed to query its results
 * @param seasonId Season of that ranking computation
 */
export type UciRankedRider = {
    uciId: number,
    rank: number,
    displayName: string,
    team: string | null,
    nation: string | null,
    birthDate: Date,
    momentId: number,
    seasonId: number,
}

/**
 * A result that earned UCI points within the ranking window.
 * @param competition Name of the race (e.g. "Tour de France")
 * @param raceName Part of the race (e.g. "Stage 5", "Final Classification", "Men Elite - Individual Time Trial")
 * @param eventName Classification (e.g. "General Classification", "Stage Classification", "Mountain Classification")
 * @param classCode UCI class of the race (e.g. "2.UWT" for a WorldTour stage race, "1.Pro" for a one-day race, "CN" for national championships)
 * @param rank Position of the rider
 * @param points UCI points earned
 * @param date Date of the result
 * @param invalid Whether the UCI flags the result as invalid
 */
export type UciResult = {
    competition: string,
    raceName: string,
    eventName: string,
    classCode: string,
    rank: number,
    points: number,
    date: Date,
    invalid: boolean,
}

type DataRideSeason = { Id: number, Year: number, StartDate: string, EndDate: string };
type DataRideRanking = {
    ObjectId: number, Rank: number, DisplayName: string, TeamName: string | null, NationFullName: string | null,
    BirthDate: string, MomentId: number,
};
type DataRideResult = {
    CompetitionName: string | null, RaceName: string | null, EventName: string | null, ClassCode: string | null,
    Rank: number | null, Points: number | null, StartDate: string, IsInvalidResult: boolean,
};
type DataRidePage<T> = { data: T[], total: number };

/**
 * @param value A date serialized by ASP.NET, e.g. "/Date(906328800000)/"
 * @return The corresponding date
 */
export function parseDataRideDate(value: string): Date {
    const timestamp: string | undefined = value?.match(/-?\d+/)?.[0];
    if (!timestamp) throw new Error(`Unable to parse DataRide date '${value}'`);
    return new Date(parseInt(timestamp, 10));
}

async function post<T>(endpoint: string, body: Record<string, string | number>): Promise<T> {
    const form = new URLSearchParams(Object.entries(body).map(([key, value]) => [key, String(value)]));
    const response = await withRetry(() => axios.post<T>(`${DATARIDE_URL}/${endpoint}/`, form, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: REQUEST_TIMEOUT_MS,
    }));
    if (typeof response.data !== 'object' || response.data === null) {
        throw new Error(`Unexpected response from DataRide ${endpoint}: not JSON`);
    }
    return response.data;
}

/**
 * @return The road seasons that have started, most recent first
 */
async function getStartedSeasons(now: Date): Promise<DataRideSeason[]> {
    const response = await withRetry(() => axios.get<DataRideSeason[]>(`${DATARIDE_URL}/GetDisciplineSeasons/`, {
        params: { disciplineId: ROAD_DISCIPLINE_ID },
        headers: { 'User-Agent': USER_AGENT },
        timeout: REQUEST_TIMEOUT_MS,
    }));
    if (!Array.isArray(response.data)) throw new Error('Unexpected response from DataRide GetDisciplineSeasons: not a list');

    return response.data
        .filter(season => parseDataRideDate(season.StartDate) <= now)
        .sort((a, b) => b.Year - a.Year);
}

async function getWorldRankingOfSeason(seasonId: number, size: number): Promise<UciRankedRider[]> {
    const filters: [string, string | number][] = [
        ['RaceTypeId', ALL_RACE_TYPES_ID],
        ['CategoryId', MEN_ELITE_CATEGORY_ID],
        ['SeasonId', seasonId],
        ['MomentId', 0], // 0 = latest computation
        ['CountryId', 0],
        ['IndividualName', ''],
        ['TeamName', ''],
    ];
    const body: Record<string, string | number> = {
        rankingId: WORLD_RANKING_ID,
        disciplineId: ROAD_DISCIPLINE_ID,
        rankingTypeId: INDIVIDUAL_RANKING_TYPE_ID,
        take: size,
        skip: 0,
        page: 1,
        pageSize: size,
    };
    filters.forEach(([field, value], index) => {
        body[`filter[filters][${index}][field]`] = field;
        body[`filter[filters][${index}][value]`] = value;
    });

    const page: DataRidePage<DataRideRanking> = await post('ObjectRankings', body);

    return page.data.map(row => ({
        uciId: row.ObjectId,
        rank: row.Rank,
        displayName: row.DisplayName,
        team: row.TeamName?.trim().replace(/\s+/g, ' ') || null,
        nation: row.NationFullName?.trim().replace(/^\*+$/, '') || null,
        birthDate: parseDataRideDate(row.BirthDate),
        momentId: row.MomentId,
        seasonId,
    }));
}

/**
 * @param size Number of riders to return
 * @param now Reference date used to pick the current season
 * @return The top `size` riders of the latest UCI World Ranking (men elite, road)
 */
export async function getWorldRanking(size: number, now: Date = new Date()): Promise<UciRankedRider[]> {
    // A new season opens in October with an empty ranking for a few days: fall back to the previous one
    for (const season of (await getStartedSeasons(now)).slice(0, 2)) {
        const ranking: UciRankedRider[] = await getWorldRankingOfSeason(season.Id, size);
        if (ranking.length > 0) return ranking;
    }
    throw new Error('No UCI World Ranking found for the current or the previous season');
}

/**
 * @param rider A rider returned by getWorldRanking
 * @return The results that earned the rider points in the ranking window (the last 52 weeks)
 */
export async function getRiderResults(rider: UciRankedRider): Promise<UciResult[]> {
    const pageSize = 500;
    const page: DataRidePage<DataRideResult> = await post('IndividualEventRankings', {
        individualId: rider.uciId,
        rankingId: WORLD_RANKING_ID,
        momentId: rider.momentId,
        groupId: WORLD_RANKING_GROUP_ID,
        baseRankingTypeId: INDIVIDUAL_RANKING_TYPE_ID,
        disciplineSeasonId: rider.seasonId,
        disciplineId: ROAD_DISCIPLINE_ID,
        categoryId: MEN_ELITE_CATEGORY_ID,
        raceTypeId: ALL_RACE_TYPES_ID,
        countryId: 0,
        teamId: 0,
        take: pageSize,
        skip: 0,
        page: 1,
        pageSize,
    });

    return page.data.map(row => ({
        competition: row.CompetitionName?.trim().replace(/\s+/g, ' ') ?? '',
        raceName: row.RaceName?.trim() ?? '',
        eventName: row.EventName?.trim() ?? '',
        classCode: row.ClassCode?.trim() ?? '',
        rank: row.Rank ?? 0,
        points: row.Points ?? 0,
        date: parseDataRideDate(row.StartDate),
        invalid: row.IsInvalidResult,
    }));
}
