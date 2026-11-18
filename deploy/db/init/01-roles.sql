-- Read-only role of the website (service `web`). functions/migrations creates no role: the tables
-- belong to the owner role (POSTGRES_USER), which runs the migrations and the jobs.
--
-- Run by the postgres image only when the volume db_data is initialised (empty data directory),
-- before any migration: the grant on future tables (ALTER DEFAULT PRIVILEGES) covers the tables
-- `yarn migrate` creates afterwards. On an existing database, run it by hand (deploy/README.md):
--   docker compose exec -T db psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
--     -f /docker-entrypoint-initdb.d/01-roles.sql
-- psql 15+ (\getenv) reads the values from the container's environment (deploy/.env).

\getenv web_password POSTGRES_WEB_PASSWORD
\getenv owner POSTGRES_USER
\getenv dbname POSTGRES_DB

CREATE ROLE ucicle_web LOGIN PASSWORD :'web_password';
-- Belt and braces: every transaction of this role is read-only.
ALTER ROLE ucicle_web SET default_transaction_read_only = on;

GRANT CONNECT ON DATABASE :"dbname" TO ucicle_web;
GRANT USAGE ON SCHEMA public TO ucicle_web;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ucicle_web;
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public GRANT SELECT ON TABLES TO ucicle_web;
