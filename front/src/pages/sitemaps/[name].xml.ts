import type { APIRoute } from 'astro';
import { sitemapBody, xmlResponse } from '../../server/sitemaps';

export const GET: APIRoute = async ({ params }) => {
  const body = await sitemapBody(params.name ?? '');
  return body ? xmlResponse(body) : new Response(null, { status: 404 });
};
