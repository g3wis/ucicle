import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * The game's two JSON files (riders.json, secret_rider.json), served on the site's own origin with
 * their contract unchanged. On the Linux server the game jobs write them into GAME_DATA_DIR and
 * they are read from disk; without it (transition) they are relayed from the Object Storage bucket
 * the jobs of functions/ write today (GAME_DATA_ORIGIN). The default is the bucket's HTTPS
 * path-style endpoint (the dotted bucket name breaks virtual-host TLS): over plain HTTP anything
 * on the path could alter the file served to every player.
 */
const DIR = process.env.GAME_DATA_DIR;
const ORIGIN = process.env.GAME_DATA_ORIGIN ?? 'https://s3.fr-par.scw.cloud/ucicle.com';

/** True for an origin that is HTTPS, or a local one (a fixture server on this machine). */
function isSafeOrigin(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol === 'https:') return true;
    return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname) || hostname.endsWith('.localhost');
  } catch {
    return false;
  }
}

// Said once, when the server loads this module: a plain-HTTP origin is a configuration to fix.
if (!DIR && process.env.GAME_DATA_ORIGIN && !isSafeOrigin(process.env.GAME_DATA_ORIGIN)) {
  process.emitWarning(
    `GAME_DATA_ORIGIN ${process.env.GAME_DATA_ORIGIN} is not HTTPS: the game's files can be altered in transit. `
      + 'Use an https:// origin or GAME_DATA_DIR.',
    'GameDataWarning',
  );
}

const json = (body: string) => new Response(body, {
  status: 200,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    // The mystery rider changes at 05:00 UTC; the game revalidates on every load (no-cache).
    'Cache-Control': 'public, max-age=60',
  },
});

/** The file's text, or null. A remote read gives up after `timeoutMs`. */
export async function readGameFile(
  name: 'riders.json' | 'secret_rider.json',
  timeoutMs = 5000,
): Promise<string | null> {
  if (DIR) {
    try {
      return await readFile(join(DIR, name), 'utf8');
    } catch {
      return null;
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const upstream = await fetch(`${ORIGIN}/api/${name}`, { headers: { Accept: 'application/json' }, signal: controller.signal });
    return upstream.ok ? await upstream.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function relayGameFile(name: 'riders.json' | 'secret_rider.json'): Promise<Response> {
  const body = await readGameFile(name);
  return body === null ? new Response(null, { status: 502 }) : json(body);
}
