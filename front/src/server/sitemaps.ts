import { db } from './db';
import { indexVersion } from './index-data';
import { absolute, PAGES, riderPath } from '../app/nav';
import type { Lang } from '../i18n/language';

/**
 * Sitemaps written by hand (@astrojs/sitemap skips server-rendered routes). Rider pages are listed
 * only when they are indexable (classified or inactive, never provisional), with hreflang pairs and
 * <lastmod> = the day of the rider's latest index change, never the build date. Files are split
 * below 45 000 URLs.
 */
const PER_FILE = 45_000;
const FIXED: (keyof typeof PAGES)[] = ['home', 'game', 'ranking', 'method', 'about'];

export function xmlResponse(body: string): Response {
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function urlEntry(loc: string, alternates: Record<Lang, string>, lastmod?: string | null): string {
  return `  <url>
    <loc>${esc(absolute(loc))}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}
    <xhtml:link rel="alternate" hreflang="fr" href="${esc(absolute(alternates.fr))}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${esc(absolute(alternates.en))}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(absolute(alternates.fr))}"/>
  </url>`;
}

const wrap = (entries: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`;

async function indexableCount(): Promise<number> {
  const v = await indexVersion();
  if (!v) return 0;
  const [row] = await db()<{ n: number }[]>`
    select count(*)::int as n from rider_rating where rating_version_id = ${v.id} and status in ('classified', 'inactive')`;
  return row?.n ?? 0;
}

/** The names of the sitemap files: pages, then riders-fr-1..n and riders-en-1..n. */
export async function SITEMAPS(): Promise<string[]> {
  const parts = Math.max(1, Math.ceil((await indexableCount()) / PER_FILE));
  const names = ['pages'];
  for (const lang of ['fr', 'en']) for (let i = 1; i <= parts; i += 1) names.push(`riders-${lang}-${i}`);
  return names;
}

export async function sitemapBody(name: string): Promise<string | null> {
  if (name === 'pages') {
    return wrap(FIXED.flatMap((key) => (['fr', 'en'] as Lang[]).map((lang) => urlEntry(PAGES[key][lang], PAGES[key]))));
  }
  const m = /^riders-(fr|en)-([1-9][0-9]*)$/.exec(name);
  const v = await indexVersion();
  if (!m || !v) return null;
  const lang = m[1] as Lang;
  const part = Number(m[2]);
  const rows = await db()<{ slug: string, lastmod: string | null }[]>`
    select ri.slug, (select max(date)::text from rating_change rc where rc.rating_version_id = ${v.id} and rc.rider_id = ri.id) as lastmod
    from rider_rating rr join rider ri on ri.id = rr.rider_id
    where rr.rating_version_id = ${v.id} and rr.status in ('classified', 'inactive')
    order by ri.id offset ${(part - 1) * PER_FILE} limit ${PER_FILE}`;
  if (!rows.length && part > 1) return null;
  return wrap(rows.map((r) => urlEntry(
    riderPath(lang, r.slug),
    { fr: riderPath('fr', r.slug), en: riderPath('en', r.slug) },
    r.lastmod,
  )));
}
