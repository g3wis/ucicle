import { AsyncLocalStorage } from 'node:async_hooks';

/** What one unit of work (a competition) did, for its log line */
export type Tally = { requests: number, ridersCreated: number };

/**
 * Counts the requests sent and the riders created within `tally.run(newTally(), task)`,
 * even while other competitions run at the same time.
 */
export const tally: AsyncLocalStorage<Tally> = new AsyncLocalStorage();

export function newTally(): Tally {
    return { requests: 0, ridersCreated: 0 };
}
