import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Sql } from 'postgres';

/** Directory of the numbered SQL files (functions/migrations), from build/db/ or src/db/ */
export const DEFAULT_MIGRATIONS_DIR: string = fileURLToPath(new URL('../../migrations/', import.meta.url));

const MIGRATION_FILE = /^(\d{4})_[a-z0-9_]+\.sql$/;

type AppliedMigration = { version: string, name: string, checksum: string };

/**
 * Applies, in order, the migrations of `dir` that are not recorded in `schema_migrations` yet.
 * Each file runs in its own transaction, together with its record. A file changed after it was
 * applied is reported, never re-applied: write a new numbered file instead.
 * @param sql Database client
 * @param dir Directory holding files named `NNNN_description.sql`
 * @return The names of the files applied by this call
 */
export async function runMigrations(sql: Sql, dir: string = DEFAULT_MIGRATIONS_DIR): Promise<string[]> {
    await sql`
        create table if not exists schema_migrations (
            version text primary key,
            name text not null,
            checksum text not null,
            applied_at timestamptz not null default now()
        )
    `;
    const applied: AppliedMigration[] = await sql<AppliedMigration[]>`select version, name, checksum from schema_migrations`;
    const appliedByVersion = new Map(applied.map(migration => [migration.version, migration]));

    const files: string[] = readdirSync(dir).filter(file => MIGRATION_FILE.test(file)).sort();
    const done: string[] = [];
    for (const file of files) {
        const version: string = file.slice(0, 4);
        const content: string = readFileSync(join(dir, file), 'utf8');
        const checksum: string = createHash('sha256').update(content).digest('hex');

        const previous: AppliedMigration | undefined = appliedByVersion.get(version);
        if (previous) {
            if (previous.checksum !== checksum) {
                console.warn(`Migration ${file} changed after it was applied (as ${previous.name}): not re-applied`);
            }
            continue;
        }

        await sql.begin(async tx => {
            await tx.unsafe(content);
            await tx`insert into schema_migrations (version, name, checksum) values (${version}, ${file}, ${checksum})`;
        });
        console.info(`Applied migration ${file}`);
        done.push(file);
    }
    return done;
}
