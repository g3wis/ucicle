import type { APIRoute } from 'astro';
import { indexVersion } from '../../server/index-data';
import { searchRiders } from '../../views/search/load';

/** How many riders the search field's list shows. */
const LIST_SIZE = 8;

/**
 * The search field's list (src/components/search): GET ?q= answers at most 8 riders whose name
 * matches, as JSON `[{ slug, name, team, index, rank, status }]`. Never stored by any cache: the
 * CDN may not key on the query string. Kept out of the index (robots.txt). `lang` is accepted for
 * symmetry with the pages; nothing in the answer depends on it (slugs are the same in both).
 */
export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q') ?? '';
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex',
  };
  try {
    const version = await indexVersion();
    const { riders } = await searchRiders(version, query, LIST_SIZE);
    const body = riders.map((r) => ({
      slug: r.slug,
      name: r.name,
      team: r.team,
      index: r.index === null ? null : Math.round(r.index),
      rank: r.rank,
      status: r.status,
    }));
    return new Response(JSON.stringify(body), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ error: 'search unavailable' }), { status: 503, headers });
  }
};
