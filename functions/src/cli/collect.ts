/**
 * Collects men elite road results from UCI DataRide into the database named by DATABASE_URL.
 *
 *   yarn collect -- --seasons 2027,2026 [--limit-competitions N] [--competition ID,ID] [--refresh]
 *   yarn collect -- --recent 14
 *
 * Options: --registry forces the UCI ranking (registry) reload, --no-registry skips it,
 * --force starts even if another run looks alive. Raw responses go to RAW_ARCHIVE_DIR.
 */
import { parseArgs } from 'node:util';

import type { Sql } from 'postgres';

import { RawArchive } from '../collect/archive.js';
import { type CollectOptions, Collector } from '../collect/collector.js';
import { DataRideClient } from '../collect/dataride.js';
import { RiderDirectory } from '../collect/identity.js';
import { emptyCounters, JobRun, recordError, type RunCounters } from '../collect/jobRun.js';
import { connect } from '../db/connection.js';

function parseNumbers(value: string | undefined, option: string): number[] | undefined {
    if (value === undefined) return undefined;
    const numbers: number[] = value.split(',').map(part => Number(part.trim()));
    if (numbers.length === 0 || numbers.some(number => !Number.isInteger(number) || number <= 0)) {
        throw new Error(`--${option} expects positive integers separated by commas, got '${value}'`);
    }
    return numbers;
}

function parseOptions(argv: string[]): { options: CollectOptions, force: boolean } {
    const { values } = parseArgs({
        args: argv.filter(arg => arg !== '--'),
        options: {
            'seasons': { type: 'string' },
            'recent': { type: 'string' },
            'limit-competitions': { type: 'string' },
            'competition': { type: 'string' },
            'refresh': { type: 'boolean', default: false },
            'registry': { type: 'boolean', default: false },
            'no-registry': { type: 'boolean', default: false },
            'force': { type: 'boolean', default: false },
        },
        strict: true,
    });
    const seasons: number[] | undefined = parseNumbers(values.seasons, 'seasons');
    const recent: number | undefined = parseNumbers(values.recent, 'recent')?.[0];
    if ((seasons === undefined) === (recent === undefined)) throw new Error('Give either --seasons 2027,2026 or --recent 14');
    if (values.registry && values['no-registry']) throw new Error('--registry and --no-registry are exclusive');

    return {
        options: {
            seasons,
            recentDays: recent,
            competitionIds: parseNumbers(values.competition, 'competition'),
            limitCompetitions: parseNumbers(values['limit-competitions'], 'limit-competitions')?.[0],
            refresh: values.refresh ?? false,
            registry: values['no-registry'] ? 'skip' : values.registry ? 'force' : 'auto',
            today: new Date().toISOString().slice(0, 10),
        },
        force: values.force ?? false,
    };
}

async function main(): Promise<number> {
    const { options, force } = parseOptions(process.argv.slice(2));
    const sql: Sql = connect(4);
    const archive = new RawArchive();
    const client = new DataRideClient(archive);
    const counters: RunCounters = emptyCounters();
    const directory: RiderDirectory = await RiderDirectory.load(sql);
    const snapshot = (): RunCounters => ({
        ...counters,
        requests: client.requests,
        requestRetries: client.retries,
        medianRequestMs: client.medianDurationMs(),
        ridersCreated: directory.created,
    });

    const kind: string = options.recentDays !== undefined ? 'collect_recent' : 'collect_full';
    const run: JobRun = await JobRun.start(sql, kind, { ...options, argv: process.argv.slice(2) }, force, snapshot);
    console.info(`Run ${run.id} (${kind}), ${directory.size} riders known, raw archive in ${archive.root}`);

    const interrupt = (): void => {
        run.finish('interrupted').finally(() => process.exit(130));
    };
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', interrupt);

    const started: number = Date.now();
    let status: 'success' | 'partial' | 'failed' = 'success';
    try {
        await new Collector(sql, client, directory, counters).run(options);
        if (counters.errors > 0) status = 'partial';
    } catch (error: unknown) {
        status = 'failed';
        recordError(counters, `Run failed: ${(error as Error).stack ?? error}`);
    }
    await run.finish(status);

    const final: RunCounters = snapshot();
    console.info(`Run ${run.id} ${status} in ${((Date.now() - started) / 60000).toFixed(1)} min: ${final.competitions} competitions, `
        + `${final.classifications} classifications, rows +${final.rowsInserted} ~${final.rowsUpdated} -${final.rowsDeleted}, `
        + `${final.ridersCreated} riders created, ${directory.reviews} review rows, ${final.requests} requests `
        + `(median ${final.medianRequestMs ?? '-'} ms, ${final.requestRetries} retried), ${final.errors} errors, `
        + `oldest changed date ${final.oldestChangedDate ?? '-'}`);
    await sql.end();
    return status === 'success' ? 0 : 1;
}

main().then(code => process.exit(code), (error: unknown) => {
    console.error(error);
    process.exit(1);
});
