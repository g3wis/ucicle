import { BestResult, Rider } from '../types/CyclingTypes.js';
import { computeAge, formatUciName, toCountrySlug } from '../utils/formatUtils.js';
import { mapWithConcurrency } from '../utils/httpUtils.js';
import { SECRET_RIDER_MAX_RANK } from '../utils/riderUtils.js';
import { memoryStats } from '../utils/statUtils.js';

import { computeBestResult } from './bestResult.js';
import {
    getCurrentWorldRanking, getRiderResults, getStartedSeasons, getWorldRankingOfSeason, UciRankedRider, UciSeason,
} from './uciScrapper.js';
import { getPhysicalData, PhysicalData } from './wikiScrapper.js';

const RANKING_SIZE = 1000;
// Former top riders (Froome, Nibali, Valverde...): the top 100 of every UCI World Ranking since 2016
const FORMER_RIDERS_SINCE = 2016;
const FORMER_RIDERS_TOP = 100;
// DataRide answers a rider's results in 2 to 6 seconds: keep a few requests in flight, not more
const UCI_CONCURRENCY = 4;
const MAX_ERROR_RATE = 0.2;

/**
 * A rider to publish, before the physical data and the best result are known.
 * @param ranked The rider's entry in the current ranking, or in the last past ranking where the rider appears
 * @param rank Current UCI rank, null when the rider has left the ranking
 * @param team Current team, or the last one found in a past ranking, null when the rider has no UCI team
 * @param nation Current nation, or the last one found in a past ranking
 */
type Candidate = {
    ranked: UciRankedRider,
    rank: number | null,
    team: string | null,
    nation: string | null,
};

/**
 * @return Every rider of the past rankings, as of the most recent ranking where they appear
 */
function lastAppearances(pastRankings: UciRankedRider[][]): Map<number, UciRankedRider> {
    const last = new Map<number, UciRankedRider>();
    // Rankings are most recent first: the first appearance met is the last one in time
    for (const ranking of pastRankings) {
        for (const rider of ranking) {
            if (!last.has(rider.uciId)) last.set(rider.uciId, rider);
        }
    }
    return last;
}

/**
 * The guessable riders: the current top 1000, then the former top riders out of it.
 * Team and nation missing from the current ranking are taken from the last past ranking that has them.
 */
function selectCandidates(current: UciRankedRider[], pastRankings: UciRankedRider[][]): Candidate[] {
    const currentById = new Map<number, UciRankedRider>(current.map(rider => [rider.uciId, rider]));
    const lastSeen: Map<number, UciRankedRider> = lastAppearances(pastRankings);
    const toCandidate = (ranked: UciRankedRider, rank: number | null): Candidate => ({
        ranked,
        rank,
        team: ranked.team ?? lastSeen.get(ranked.uciId)?.team ?? null,
        nation: ranked.nation ?? lastSeen.get(ranked.uciId)?.nation ?? null,
    });

    const top: UciRankedRider[] = current.slice(0, RANKING_SIZE);
    const selected = new Set<number>(top.map(rider => rider.uciId));
    const candidates: Candidate[] = top.map(rider => toCandidate(rider, rider.rank));

    for (const ranking of pastRankings) {
        for (const rider of ranking.slice(0, FORMER_RIDERS_TOP)) {
            if (selected.has(rider.uciId)) continue;
            selected.add(rider.uciId);
            // Still ranked beyond the top 1000: current rank and team; out of the ranking: no rank, last team
            const stillRanked: UciRankedRider | undefined = currentById.get(rider.uciId);
            candidates.push(stillRanked
                ? toCandidate(stillRanked, stillRanked.rank)
                : toCandidate(lastSeen.get(rider.uciId)!, null));
        }
    }
    return candidates;
}

/**
 * @return The best result of a secret rider candidate, null when it cannot be described
 * @throws When DataRide does not answer
 */
async function loadBestResult(candidate: Candidate): Promise<BestResult | null> {
    const bestResult: BestResult | null = computeBestResult(await getRiderResults(candidate.ranked));
    if (!bestResult) console.error(`No describable result for ${candidate.ranked.displayName} (rank ${candidate.rank})`);
    return bestResult;
}

/**
 * Builds the riders list of the game:
 * - the top 1000 of the current UCI World Ranking, and the former top 100 riders of every ranking since 2016,
 * - rank, name, country, age and team from the UCI World Ranking,
 * - height and weight from Wikidata, or the English Wikipedia infobox (null when unknown),
 * - best result from the rider's UCI results of the last 52 weeks, for the secret rider candidates only
 *   (the current top 100 with a UCI team, a height and a weight): it is the hint of the secret rider, shown for no one else.
 * Riders without country (neutral athletes) are left out; a rider of no UCI team gets a null team.
 * @param now Reference date for the season and the ages
 * @return The riders, current ones by UCI rank first, then the former ones
 */
export async function loadRiders(now: Date = new Date()): Promise<Rider[]> {
    const seasons: UciSeason[] = await getStartedSeasons(now);
    const { season, riders: current } = await getCurrentWorldRanking(seasons);
    console.info(`Loaded ${current.length} riders from the ${season.year} UCI World Ranking`);

    const pastSeasons: UciSeason[] = seasons.filter(past => past.year < season.year && past.year >= FORMER_RIDERS_SINCE);
    const pastRankings: UciRankedRider[][] = await mapWithConcurrency(pastSeasons, 2, past => getWorldRankingOfSeason(past));
    console.info(`Loaded the UCI World Rankings of ${pastSeasons.map(past => past.year).join(', ')}`);

    const candidates: Candidate[] = selectCandidates(current, pastRankings);
    const withCountry: Candidate[] = candidates.filter(candidate => candidate.nation);
    console.info(`${withCountry.length}/${candidates.length} riders (${candidates.length - Math.min(RANKING_SIZE, current.length)} former top riders) have a country, ${withCountry.filter(candidate => !candidate.team).length} of them without UCI team`);

    const physicalData: Map<number, PhysicalData> = await getPhysicalData(withCountry.map(candidate => candidate.ranked));
    const physical = (candidate: Candidate): PhysicalData =>
        physicalData.get(candidate.ranked.uciId) ?? { name: null, height: null, weight: null };
    console.info(`${withCountry.filter(candidate => physical(candidate).height && physical(candidate).weight).length}/${withCountry.length} riders have a height and a weight`);

    const secretCandidates: Candidate[] = withCountry.filter(candidate =>
        candidate.rank !== null && candidate.rank <= SECRET_RIDER_MAX_RANK && candidate.team
        && physical(candidate).height && physical(candidate).weight
    );
    let failures = 0;
    const bestResults: (BestResult | null)[] = await mapWithConcurrency(secretCandidates, UCI_CONCURRENCY, async (candidate) => {
        try {
            return await loadBestResult(candidate);
        } catch (e: unknown) {
            failures++;
            console.error(`Unable to load the results of ${candidate.ranked.displayName} (rank ${candidate.rank}): ${(e as Error)?.message}`);
            return null;
        } finally {
            memoryStats();
        }
    });
    const errorRate: number = secretCandidates.length ? failures / secretCandidates.length : 0;
    if (errorRate > MAX_ERROR_RATE) {
        throw new Error(`Error rate while loading rider results is too high (${errorRate.toFixed(2)})`);
    }
    const bestResultById = new Map<number, BestResult | null>(secretCandidates.map((candidate, i) => [candidate.ranked.uciId, bestResults[i]]));

    // The game identifies riders by name: two riders cannot share one
    const names = new Set<string>();
    const riders: Rider[] = [];
    for (const candidate of withCountry) {
        const data: PhysicalData = physical(candidate);
        const name: string = data.name ?? formatUciName(candidate.ranked.displayName);
        if (names.has(name)) {
            console.error(`Left out ${candidate.ranked.displayName} (rank ${candidate.rank}): another rider is named ${name}`);
            continue;
        }
        names.add(name);
        riders.push({
            rank: candidate.rank,
            name,
            country: toCountrySlug(candidate.nation!),
            age: computeAge(candidate.ranked.birthDate, now),
            weight: data.weight,
            height: data.height,
            bestResult: bestResultById.get(candidate.ranked.uciId) ?? null,
            team: candidate.team,
        });
    }
    return riders;
}
