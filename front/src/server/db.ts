import postgres from 'postgres';

/**
 * The site's read-only connection to PostgreSQL (the tables of functions/migrations, documented
 * in functions/SCHEMA.md). One pool per server process. DATABASE_URL is read at run time, never
 * baked into the build.
 */
let client: ReturnType<typeof postgres> | null = null;

export function db(): ReturnType<typeof postgres> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    client = postgres(url, {
      max: Number(process.env.DATABASE_POOL ?? 5),
      idle_timeout: 30,
      // A database that hangs must not hold a page: the loaders fall back after 5 s.
      connect_timeout: 5,
      // Numbers come back as numbers: bigint ids fit in a double for this data.
      types: { bigint: postgres.BigInt },
      transform: { undefined: null },
    });
  }
  return client;
}
