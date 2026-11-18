import postgres, { type Sql } from 'postgres';

/** OIDs of the PostgreSQL types read differently from the driver's defaults */
const DATE_OID = 1082;
const INT8_OID = 20;

/**
 * Opens a pool of connections to the database named by the DATABASE_URL environment variable.
 * `date` columns are read as 'YYYY-MM-DD' strings (no time zone shift), `bigint` values (counts) as numbers.
 * @param maxConnections Size of the pool
 * @return The postgres.js client; call `end()` on it when done
 */
export function connect(maxConnections = 4): Sql {
    const url: string | undefined = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set (e.g. postgres://ucicle@127.0.0.1:5433/ucicle)');

    return postgres(url, {
        max: maxConnections,
        idle_timeout: 30,
        onnotice: () => undefined,
        connection: { application_name: 'ucicle-index-collector' },
        types: {
            isoDate: { from: [DATE_OID], parse: (raw: string): string => raw },
            count: { from: [INT8_OID], parse: (raw: string): number => Number(raw) },
        },
    }) as unknown as Sql;
}
