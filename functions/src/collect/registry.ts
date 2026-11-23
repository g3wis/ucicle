import type { Sql } from 'postgres';

import { DATARIDE_SOURCE, EXTERNAL_ID_SOURCES } from '../db/rows.js';
import { mapWithConcurrency } from '../utils/httpUtils.js';

import type { DataRideClient, DrRanking, DrSeason } from './dataride.js';
import type { Identity, RiderDirectory } from './identity.js';
import { cleanRawName } from './names.js';
import { dataRideIsoDate, uciRiderPageId } from './parse.js';

const WEEK_MS = 7 * 24 * 3600 * 1000;

export type RegistryResult = { seasonsFetched: number[], entries: number };

/**
 * @param row A row of the UCI World Ranking
 * @return The identity it gives (same fields as a result row)
 */
export function rankingIdentity(row: DrRanking): Identity {
    return {
        name: cleanRawName(row.DisplayName ?? ''),
        birthDate: dataRideIsoDate(row.BirthDate),
        nationCode: row.NationName?.trim() || null,
        nationIso2: row.CountryIsoCode2?.trim() || null,
        nationName: row.NationFullName?.trim() || null,
    };
}

/**
 * Picks the seasons whose ranking must be (re)loaded: a season never loaded; an open season
 * (not finished for a week) loaded more than a week ago; every season when `force`.
 */
async function seasonsToRefresh(sql: Sql, seasons: DrSeason[], force: boolean, now: Date): Promise<DrSeason[]> {
    const loaded = await sql<{ season: number, fetched_at: Date }[]>`
        select season, max(fetched_at) as fetched_at from uci_ranking_entry group by season
    `;
    const fetchedAt = new Map(loaded.map(row => [row.season, row.fetched_at]));
    return seasons.filter(season => {
        if (force) return true;
        const last: Date | undefined = fetchedAt.get(season.Year);
        if (!last) return true;
        const end: string | null = dataRideIsoDate(season.EndDate);
        const closed: boolean = end !== null && Date.parse(end) + WEEK_MS < last.getTime();
        return !closed && now.getTime() - last.getTime() > WEEK_MS;
    });
}

/**
 * Loads the UCI World Ranking (ObjectRankings, pages of 1000) of the seasons that need it, latest season
 * first, into `rider`, `rider_external_id` (ObjectId, UciId, derived P11020) and `uci_ranking_entry`.
 * @param sql Database client
 * @param client DataRide client
 * @param directory Rider directory
 * @param seasons Candidate seasons
 * @param force Reload every candidate season
 */
export async function refreshRegistry(sql: Sql, client: DataRideClient, directory: RiderDirectory, seasons: DrSeason[], force: boolean): Promise<RegistryResult> {
    // Latest season first: a new rider takes the latest spelling of his name and his latest nation
    const due: DrSeason[] = (await seasonsToRefresh(sql, seasons, force, new Date())).sort((a, b) => b.Year - a.Year);
    if (due.length === 0) return { seasonsFetched: [], entries: 0 };

    // One row per ObjectId and season (pages can overlap when the ranking changes between two requests)
    const rankings: DrRanking[][] = (await mapWithConcurrency(due, 4, season => client.getRanking(season)))
        .map(rows => [...new Map(rows.filter(row => row.ObjectId && row.DisplayName).map(row => [row.ObjectId, row])).values()]);

    // New riders are created best-ranked first, so that a homonym ranked lower gets the slug with the birth year
    const latestRow: Map<number, DrRanking> = new Map();
    const bestRank: Map<number, number> = new Map();
    for (const rows of rankings) {
        for (const row of rows) {
            if (!latestRow.has(row.ObjectId)) latestRow.set(row.ObjectId, row);
            bestRank.set(row.ObjectId, Math.min(bestRank.get(row.ObjectId) ?? Infinity, row.Rank));
        }
    }
    const byProminence: DrRanking[] = [...latestRow.values()].sort((a, b) => bestRank.get(a.ObjectId)! - bestRank.get(b.ObjectId)!);
    await directory.exclusive(async () => {
        for (const row of byProminence) await directory.resolveRegistry(String(row.ObjectId), rankingIdentity(row));
    });

    let entries = 0;
    for (const [index, season] of due.entries()) {
        const rows: DrRanking[] = rankings[index];
        const riderIds: number[] = await directory.exclusive(async () => {
            const ids: number[] = [];
            for (const row of rows) ids.push(await directory.resolveRegistry(String(row.ObjectId), rankingIdentity(row)));
            return ids;
        });
        await directory.flush();

        const fallbackDate: string = new Date().toISOString().slice(0, 10);
        const entryRows = rows.map((row, rowIndex) => ({
            rider_id: riderIds[rowIndex],
            source: DATARIDE_SOURCE,
            object_id: String(row.ObjectId),
            uci_id: row.UciId ? String(row.UciId) : null,
            season: season.Year,
            source_season_id: season.Id,
            ranking_date: dataRideIsoDate(row.ComputationDate) ?? fallbackDate,
            moment_id: row.MomentId ?? null,
            rank: row.Rank,
            points: row.Points ?? 0,
            team_code: row.TeamCode?.trim() || null,
            team_name: row.TeamName?.trim().replace(/\s+/g, ' ') || null,
            nation_code: row.NationName?.trim() || null,
            name_raw: cleanRawName(row.DisplayName ?? ''),
        }));
        const externalIdList = rows.flatMap((row, rowIndex) => {
            const ids: { source: string, external_id: string, rider_id: number }[] = [
                { source: EXTERNAL_ID_SOURCES.datarideObjectId, external_id: String(row.ObjectId), rider_id: riderIds[rowIndex] },
            ];
            if (row.UciId) {
                ids.push({ source: EXTERNAL_ID_SOURCES.uciId, external_id: String(row.UciId), rider_id: riderIds[rowIndex] });
                const pageId: number | null = uciRiderPageId(row.UciId);
                if (pageId) ids.push({ source: EXTERNAL_ID_SOURCES.uciRiderPageId, external_id: String(pageId), rider_id: riderIds[rowIndex] });
            }
            return ids;
        });
        const externalIds = [...new Map(externalIdList.map(id => [`${id.source}|${id.external_id}`, id])).values()];

        await sql.begin(async tx => {
            for (let start = 0; start < entryRows.length; start += 1000) {
                await tx`
                    insert into uci_ranking_entry ${tx(entryRows.slice(start, start + 1000), 'rider_id', 'source', 'object_id', 'uci_id', 'season',
        'source_season_id', 'ranking_date', 'moment_id', 'rank', 'points', 'team_code', 'team_name', 'nation_code', 'name_raw')}
                    on conflict (source, object_id, season, ranking_date) do update set
                        rider_id = excluded.rider_id, uci_id = excluded.uci_id, moment_id = excluded.moment_id, rank = excluded.rank,
                        points = excluded.points, team_code = excluded.team_code, team_name = excluded.team_name,
                        nation_code = excluded.nation_code, name_raw = excluded.name_raw, fetched_at = now()
                `;
            }
            for (let start = 0; start < externalIds.length; start += 2000) {
                await tx`
                    insert into rider_external_id ${tx(externalIds.slice(start, start + 2000), 'source', 'external_id', 'rider_id')}
                    on conflict (source, external_id) do nothing
                `;
            }
        });
        entries += entryRows.length;
        console.info(`Registry ${season.Year}: ${entryRows.length} ranked riders`);
    }
    return { seasonsFetched: due.map(season => season.Year), entries };
}
