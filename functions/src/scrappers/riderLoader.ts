import { BestResult, Rider } from '../types/CyclingTypes.js';
import { computeAge, formatUciName, toCountrySlug } from '../utils/formatUtils.js';
import { mapWithConcurrency } from '../utils/httpUtils.js';
import { memoryStats } from '../utils/statUtils.js';

import { computeBestResult } from './bestResult.js';
import { getRiderResults, getWorldRanking, UciRankedRider } from './uciScrapper.js';
import { getPhysicalData, PhysicalData } from './wikiScrapper.js';

const RANKING_SIZE = 1000;
// DataRide answers a rider's results in 2 to 6 seconds: keep a few requests in flight, not more
const UCI_CONCURRENCY = 4;
const MAX_ERROR_RATE = 0.2;

/**
 * Builds the riders list of the game:
 * - rank, name, country, age and team from the UCI World Ranking,
 * - height and weight from Wikidata, or the English Wikipedia infobox,
 * - best result from the rider's UCI results of the last 52 weeks.
 * Riders without team, country, height, weight or describable result are left out.
 * @param now Reference date for the season and the ages
 * @return The riders, ordered by UCI rank
 */
export async function loadRiders(now: Date = new Date()): Promise<Rider[]> {
    const ranking: UciRankedRider[] = await getWorldRanking(RANKING_SIZE, now);
    console.info(`Loaded ${ranking.length} riders from the UCI World Ranking`);

    const physicalData: Map<number, PhysicalData> = await getPhysicalData(ranking);
    const eligible: UciRankedRider[] = ranking.filter(rider => {
        const data: PhysicalData | undefined = physicalData.get(rider.uciId);
        return rider.team && rider.nation && data?.height && data?.weight;
    });
    console.info(`${eligible.length}/${ranking.length} riders have a team, a country, a height and a weight`);

    let failures = 0;
    let done = 0;
    const riders: (Rider | null)[] = await mapWithConcurrency(eligible, UCI_CONCURRENCY, async (rider) => {
        try {
            const bestResult: BestResult | null = computeBestResult(await getRiderResults(rider));
            if (!bestResult) {
                console.error(`No describable result for ${rider.displayName} (rank ${rider.rank})`);
                return null;
            }

            const data: PhysicalData = physicalData.get(rider.uciId)!;
            return {
                rank: rider.rank,
                name: data.name ?? formatUciName(rider.displayName),
                country: toCountrySlug(rider.nation!),
                age: computeAge(rider.birthDate, now),
                weight: data.weight!,
                height: data.height!,
                bestResult,
                team: rider.team!,
            };
        } catch (e: unknown) {
            failures++;
            console.error(`Unable to load the results of ${rider.displayName} (rank ${rider.rank}): ${(e as Error)?.message}`);
            return null;
        } finally {
            memoryStats();
            if (++done % 50 === 0) console.info(`Loaded the results of ${done}/${eligible.length} riders`);
        }
    });

    const errorRate: number = eligible.length ? failures / eligible.length : 0;
    if (errorRate > MAX_ERROR_RATE) {
        throw new Error(`Error rate while loading rider results is too high (${errorRate.toFixed(2)})`);
    }

    return riders.filter((rider): rider is Rider => rider !== null);
}
