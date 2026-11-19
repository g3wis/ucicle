import type { Sql } from 'postgres';

/** Login role of the website: it reads the index tables and writes nothing. */
export const WEB_ROLE = 'ucicle_web';

/**
 * Creates or updates the website's read-only role, then grants it SELECT on every table of the
 * schema, present and future. Idempotent: it runs after the migrations at every start of the jobs
 * container (yarn migrate), so a changed password or a new table needs no step by hand.
 *
 * Run by the owner role (POSTGRES_USER of the postgres image, a superuser): the tables belong to it,
 * and ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER covers the tables its later migrations create.
 * @param sql Client connected as the owner role
 * @param password Password of the role: letters and digits only, so that it can be written as a
 * literal (ALTER ROLE takes no bind parameter) and the URLs that carry it need no encoding
 */
export async function syncWebRole(sql: Sql, password: string): Promise<void> {
    if (!/^[A-Za-z0-9]{16,}$/.test(password)) {
        throw new Error(`The password of ${WEB_ROLE} must be at least 16 letters and digits (e.g. openssl rand -hex 24)`);
    }
    await sql.begin(async (tx) => {
        const [{ exists }] = await tx<{ exists: boolean }[]>`
            SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${WEB_ROLE}) AS exists`;
        const verb: string = exists ? 'ALTER' : 'CREATE';
        await tx.unsafe(`${verb} ROLE ${WEB_ROLE} LOGIN PASSWORD '${password}'`);
        // Belt and braces: every transaction of this role is read-only.
        await tx.unsafe(`ALTER ROLE ${WEB_ROLE} SET default_transaction_read_only = on`);
        const [{ db }] = await tx<{ db: string }[]>`SELECT current_database() AS db`;
        await tx.unsafe(`GRANT CONNECT ON DATABASE "${db.replaceAll('"', '""')}" TO ${WEB_ROLE}`);
        await tx.unsafe(`GRANT USAGE ON SCHEMA public TO ${WEB_ROLE}`);
        await tx.unsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${WEB_ROLE}`);
        await tx.unsafe(`ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public GRANT SELECT ON TABLES TO ${WEB_ROLE}`);
    });
}
