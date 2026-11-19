#!/usr/bin/env node
/* eslint-disable no-console */
// Builds the site, starts the production server for a few seconds on a free local port, saves
// the HTML of a list of routes into snap/ next to the client assets, then stops the server.
// snap/ is a static copy that a headless browser can capture from disk (no dev server).
//
//   node scripts/snapshot.mjs [--no-build] [--routes routes.json]
//
// routes.json: [{ "url": "/recherche/?q=pog", "as": "/recherche-pog/", "status": 200 }, ...]
// `as` (optional) is where the page is written when the URL has a query string; `status` is the
// expected HTTP status (default 200). Without --routes, the default list below plus three ranked
// riders and one provisional rider read from the database.
// Needs DATABASE_URL (default: the local cluster of the bunshin run, port 5433).
// Exit code 0 only when the build passed and every route answered its expected status.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import postgres from 'postgres';

const argv = process.argv.slice(2);
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://ucicle@127.0.0.1:5433/ucicle';
const OUT = 'snap';

const DEFAULT_ROUTES = [
  { url: '/' }, { url: '/en/' },
  { url: '/jeu/' }, { url: '/en/play/' },
  { url: '/a-propos/' }, { url: '/en/about/' },
  { url: '/classement/' }, { url: '/classement/2/' }, { url: '/en/ranking/' }, { url: '/en/ranking/2/' },
  { url: '/classement/methode/' }, { url: '/en/ranking/method/' },
  { url: '/recherche/?q=pogacar', as: '/recherche-pogacar/' },
  { url: '/recherche/?q=van', as: '/recherche-van/' },
  { url: '/recherche/?q=zzzz', as: '/recherche-vide/' },
  { url: '/en/search/?q=pogacar', as: '/en/search-pogacar/' },
  { url: '/api/riders.json' }, { url: '/api/secret_rider.json' },
  { url: '/coureurs/no-such-rider/', as: '/404-coureur/', status: 404 },
  { url: '/classement/99999/', as: '/404-classement/', status: 404 },
];

async function riderRoutes() {
  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    const top = await sql`
      select ri.slug from ranking_snapshot s join rider ri on ri.id = s.rider_id
      join rating_version v on v.id = s.rating_version_id and v.is_current
      where s.date = (select max(date) from ranking_snapshot where rating_version_id = v.id)
      order by s.rank limit 3`;
    const provisional = await sql`
      select ri.slug from rider_rating rr join rider ri on ri.id = rr.rider_id
      join rating_version v on v.id = rr.rating_version_id and v.is_current
      where rr.status = 'provisional' order by rr.counted_classifications desc, ri.id limit 1`;
    const slugs = [...top, ...provisional].map((r) => r.slug);
    return slugs.flatMap((slug) => [{ url: `/coureurs/${slug}/` }, { url: `/en/riders/${slug}/` }]);
  } catch (error) {
    console.warn(`snapshot: no rider routes from the database (${error.message})`);
    return [];
  } finally {
    await sql.end();
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

function fileFor(route) {
  const path = route.as ?? route.url.split('?')[0];
  if (/\.[a-z0-9]+$/i.test(path)) return join(OUT, path);
  return join(OUT, path, 'index.html');
}

async function main() {
  if (!argv.includes('--no-build')) {
    const build = spawnSync('./node_modules/.bin/astro', ['build'], { stdio: 'inherit' });
    if (build.status !== 0) {
      console.error(`snapshot: astro build exited ${build.status}`);
      process.exit(1);
    }
  }
  const routesArg = argv.indexOf('--routes');
  const routes = routesArg >= 0
    ? JSON.parse(readFileSync(argv[routesArg + 1], 'utf8'))
    : [...DEFAULT_ROUTES, ...(await riderRoutes())];

  const port = await freePort();
  const server = spawn(process.execPath, ['dist/server/entry.mjs'], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATABASE_URL },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });
  const base = `http://127.0.0.1:${port}`;
  let up = false;
  for (let i = 0; i < 60 && !up; i += 1) {
    try {
      await fetch(`${base}/a-propos/`);
      up = true;
    } catch {
      await sleep(250);
    }
  }
  if (!up) {
    server.kill();
    console.error(`snapshot: the server did not start\n${serverLog}`);
    process.exit(1);
  }

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  cpSync('dist/client', OUT, { recursive: true });
  const report = [];
  for (const route of routes) {
    const started = Date.now();
    const res = await fetch(base + route.url, { redirect: 'manual' });
    const body = await res.text();
    const file = fileFor(route);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, body);
    const expected = route.status ?? 200;
    report.push({
      url: route.url, file, status: res.status, expected, ok: res.status === expected, ms: Date.now() - started,
    });
  }
  server.kill();
  writeFileSync(join(OUT, '_snapshot.json'), JSON.stringify(report, null, 2));
  const failed = report.filter((r) => !r.ok);
  for (const r of report) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.status} ${r.url} -> ${r.file} (${r.ms} ms)`);
  if (/error/i.test(serverLog)) console.log(`server log:\n${serverLog.slice(-4000)}`);
  console.log(`snapshot: ${report.length - failed.length}/${report.length} routes as expected`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
