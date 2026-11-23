import type { APIRoute } from 'astro';
import { absolute } from '../app/nav';
import { SITEMAPS, xmlResponse } from '../server/sitemaps';

/** The sitemap index: one sitemap of fixed pages, then the rider pages per language. */
export const GET: APIRoute = async () => {
  const files = await SITEMAPS();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${files.map((f) => `  <sitemap><loc>${absolute(`/sitemaps/${f}.xml`)}</loc></sitemap>`).join('\n')}
</sitemapindex>
`;
  return xmlResponse(body);
};
