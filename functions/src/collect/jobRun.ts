import type { Sql } from 'postgres';

/** A run whose heartbeat is older than this is considered dead (crashed or killed) */
const STALE_RUN_MS = 5 * 60 * 1000;
const HEARTBEAT_MS = 30 * 1000;
const MAX_ERROR_MESSAGES = 100;

export type JobStatus = 'running' | 'success' | 'partial' | 'failed' | 'interrupted';

/** Counters of a collector run, saved in `job_run` */
export type RunCounters = {
    requests: number,
    requestRetries: number,
    medianRequestMs: number | null,
    competitions: number,
    classifications: number,
    rowsInserted: number,
    rowsUpdated: number,
    rowsDeleted: number,
    ridersCreated: number,
    errors: number,
    errorMessages: string[],
    oldestChangedDate: string | null,
    registryRefreshed: boolean,
};

export function emptyCounters(): RunCounters {
    return {
        requests: 0, requestRetries: 0, medianRequestMs: null, competitions: 0, classifications: 0, rowsInserted: 0,
        rowsUpdated: 0, rowsDeleted: 0, ridersCreated: 0, errors: 0, errorMessages: [], oldestChangedDate: null, registryRefreshed: false,
    };
}

/**
 * @param counters Counters of the run
 * @param message Error to record
 */
export function recordError(counters: RunCounters, message: string): void {
    counters.errors++;
    if (counters.errorMessages.length < MAX_ERROR_MESSAGES) counters.errorMessages.push(message);
    console.error(message);
}

/**
 * @param counters Counters of the run
 * @param date Date of a classification whose results changed
 */
export function recordChangedDate(counters: RunCounters, date: string): void {
    if (counters.oldestChangedDate === null || date < counters.oldestChangedDate) counters.oldestChangedDate = date;
}

/**
 * One row of `job_run`, kept up to date with a heartbeat while the collector runs.
 */
export class JobRun {
    private timer: NodeJS.Timeout | null = null;

    private constructor(private readonly sql: Sql, readonly id: number, private readonly snapshot: () => RunCounters) {
    }

    /**
     * Records the start of a run. Refuses to start while another run is alive (heartbeat within 5 minutes).
     * @param sql Database client
     * @param kind Kind of run ('collect_full', 'collect_recent')
     * @param args Arguments of the run
     * @param force Start even if another run looks alive
     * @param snapshot Returns the current counters (saved at each heartbeat)
     */
    static async start(sql: Sql, kind: string, args: Record<string, unknown>, force: boolean, snapshot: () => RunCounters): Promise<JobRun> {
        const [alive] = await sql<{ id: number }[]>`
            select id from job_run where status = 'running' and heartbeat_at > now() - ${STALE_RUN_MS / 1000} * interval '1 second' limit 1
        `;
        if (alive && !force) throw new Error(`Collector run ${alive.id} is still running (use --force if it is not)`);
        await sql`update job_run set status = 'interrupted', finished_at = heartbeat_at where status = 'running'`;

        const [row] = await sql<{ id: number }[]>`insert into job_run (kind, args) values (${kind}, ${sql.json(args as never)}) returning id`;
        const run = new JobRun(sql, row.id, snapshot);
        run.timer = setInterval(() => {
            run.save('running').catch((error: unknown) => console.warn(`Unable to save the heartbeat of run ${run.id}: ${(error as Error).message}`));
        }, HEARTBEAT_MS);
        run.timer.unref();
        return run;
    }

    /**
     * @param status Status to write
     */
    async save(status: JobStatus): Promise<void> {
        const counters: RunCounters = this.snapshot();
        const finished: boolean = status !== 'running';
        await this.sql`
            update job_run set
                status = ${status},
                heartbeat_at = now(),
                finished_at = ${finished ? this.sql`now()` : this.sql`null`},
                requests = ${counters.requests},
                request_retries = ${counters.requestRetries},
                median_request_ms = ${counters.medianRequestMs},
                competitions = ${counters.competitions},
                classifications = ${counters.classifications},
                rows_inserted = ${counters.rowsInserted},
                rows_updated = ${counters.rowsUpdated},
                rows_deleted = ${counters.rowsDeleted},
                riders_created = ${counters.ridersCreated},
                errors = ${counters.errors},
                error_messages = ${this.sql.json(counters.errorMessages)},
                oldest_changed_date = ${counters.oldestChangedDate},
                registry_refreshed = ${counters.registryRefreshed}
            where id = ${this.id}
        `;
    }

    /**
     * Stops the heartbeat and writes the final counters.
     * @param status Final status
     */
    async finish(status: Exclude<JobStatus, 'running'>): Promise<void> {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        await this.save(status);
    }
}
