import { isAxiosError } from 'axios';

/**
 * User-Agent sent to every data source. Wikimedia asks automated clients to identify themselves,
 * and throttles generic agents much harder. Can be overridden with the HTTP_USER_AGENT variable.
 */
export const USER_AGENT: string = process.env.HTTP_USER_AGENT || 'ucicle-functions/1.0 (+https://www.ucicle.fr)';

const RETRYABLE_STATUSES: number[] = [429, 500, 502, 503, 504];

/**
 * @param ms Duration to wait, in milliseconds
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Runs a request, retrying it on network errors, 429 and 5xx responses with an increasing delay.
 * A `Retry-After` header (in seconds) is honoured when present.
 * @param request The request to run
 * @param attempts Maximum number of attempts
 * @return The result of the first successful attempt
 */
export async function withRetry<T>(request: () => Promise<T>, attempts = 4): Promise<T> {
    for (let attempt = 1; ; attempt++) {
        try {
            return await request();
        } catch (e: unknown) {
            const status: number | undefined = isAxiosError(e) ? e.response?.status : undefined;
            const retryable: boolean = isAxiosError(e) && (status === undefined || RETRYABLE_STATUSES.includes(status));
            if (!retryable || attempt >= attempts) throw e;

            const retryAfter = Number(isAxiosError(e) ? e.response?.headers?.['retry-after'] : undefined);
            await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * attempt);
        }
    }
}

/**
 * Maps the items with an asynchronous function, running at most `concurrency` calls at the same time.
 * @param items Items to map
 * @param concurrency Maximum number of calls in flight
 * @param mapper Asynchronous function applied to each item
 * @return The mapped items, in the same order as `items`
 */
export async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;

    async function worker(): Promise<void> {
        while (next < items.length) {
            const index: number = next++;
            results[index] = await mapper(items[index], index);
        }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
    return results;
}
