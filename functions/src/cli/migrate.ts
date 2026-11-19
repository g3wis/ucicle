/**
 * Applies the SQL migrations of functions/migrations to the database named by DATABASE_URL, then,
 * when WEB_DATABASE_PASSWORD is set, creates or updates the website's read-only role (ucicle_web).
 * Usage: yarn build && DATABASE_URL=postgres://... [WEB_DATABASE_PASSWORD=...] yarn migrate
 */
import type { Sql } from 'postgres';

import { connect } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { syncWebRole, WEB_ROLE } from '../db/webRole.js';

async function main(): Promise<void> {
    const sql: Sql = connect(1);
    try {
        const applied: string[] = await runMigrations(sql, process.env.MIGRATIONS_DIR || undefined);
        console.info(applied.length > 0 ? `${applied.length} migration(s) applied` : 'Database schema up to date');
        const webPassword: string | undefined = process.env.WEB_DATABASE_PASSWORD;
        if (webPassword) {
            await syncWebRole(sql, webPassword);
            console.info(`Role ${WEB_ROLE} up to date (read-only)`);
        }
    } finally {
        await sql.end();
    }
}

main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
});
