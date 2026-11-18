/**
 * Applies the SQL migrations of functions/migrations to the database named by DATABASE_URL.
 * Usage: yarn build && DATABASE_URL=postgres://... yarn migrate
 */
import type { Sql } from 'postgres';

import { connect } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';

async function main(): Promise<void> {
    const sql: Sql = connect(1);
    try {
        const applied: string[] = await runMigrations(sql, process.env.MIGRATIONS_DIR || undefined);
        console.info(applied.length > 0 ? `${applied.length} migration(s) applied` : 'Database schema up to date');
    } finally {
        await sql.end();
    }
}

main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
});
