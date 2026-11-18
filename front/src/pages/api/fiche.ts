import type { APIRoute } from 'astro';
import { db } from '../../server/db';
import { foldSearch } from '../../i18n/format';
import { PAGES, riderPath } from '../../app/nav';

/** A 302 that no cache stores (the target depends on the query string and on the data). */
function found(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store' } });
}

/**
 * The game's end panel links here with the revealed rider's name (riders.json has no slug):
 * 302 to his rider page, or to the search when the name matches no rider or the database does not
 * answer. Never cached (no-store), never indexed (robots.txt).
 */
export const GET: APIRoute = async ({ url }) => {
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'fr';
  const name = (url.searchParams.get('nom') ?? '').slice(0, 120);
  const folded = foldSearch(name);
  if (folded.length >= 2) {
    try {
      // The game's names may be shorter than the UCI's full names ("Jonas Vingegaard" for "jonas
      // vingegaard hansen"): the exact name first, then a name starting with it, then every word.
      const words = folded.split(' ').map((w) => `%${w}%`);
      const [rider] = await db()<{ slug: string }[]>`
        select ri.slug from rider ri
        left join rider_rating rr on rr.rider_id = ri.id
          and rr.rating_version_id = (select id from rating_version where is_current limit 1)
        where ri.search_name like all(${words})
        order by (ri.search_name = ${folded}) desc, (ri.search_name like ${`${folded}%`}) desc,
                 rr.current_index desc nulls last, ri.id
        limit 1`;
      if (rider) return found(riderPath(lang, rider.slug));
    } catch {
      // The database failed: the search page still takes the player on (it says what it can).
    }
  }
  return found(`${PAGES.search[lang]}?q=${encodeURIComponent(name)}`);
};
