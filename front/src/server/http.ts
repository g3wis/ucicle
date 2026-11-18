import type { AstroGlobal } from 'astro';

/**
 * HTTP caching of the pages rendered from the database. No cookie is ever set on the site (a
 * shared cache stops caching for a visitor as soon as one exists). The data changes once a night,
 * so the browser keeps a page 5 minutes and the reverse proxy an hour, serving a stale copy while
 * it revalidates; the nightly job clears the proxy cache after each computation. The ETag is the
 * data version: an unchanged page answers 304.
 */
export const PAGE_CACHE = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';
/** Pages that also show today's game (the home): the stage changes at 05:00 UTC. */
export const SHORT_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

/**
 * Sets the cache headers for a page whose content depends only on `version`. Returns a 304
 * response to send instead of the page when the client already holds this version.
 */
export function cachePage(astro: AstroGlobal, version: string, policy: string = PAGE_CACHE): Response | null {
  const etag = `W/"${version}"`;
  astro.response.headers.set('Cache-Control', policy);
  astro.response.headers.set('ETag', etag);
  const match = astro.request.headers.get('if-none-match');
  if (match && match.split(',').map((s) => s.trim()).includes(etag)) {
    return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': policy } });
  }
  return null;
}

/** Pages that must never be stored by a shared cache (search results). */
export function noStore(astro: AstroGlobal): void {
  astro.response.headers.set('Cache-Control', 'no-store');
}
