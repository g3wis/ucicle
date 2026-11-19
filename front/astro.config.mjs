// Astro in server mode: the index pages (home, ranking, rider pages, method) are rendered on
// request from PostgreSQL; the game and About are prerendered (`export const prerender = true`).
// Paths are explicit per language (src/app/nav.ts): no Astro i18n routing, no automatic redirect.
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://www.ucicle.fr',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  trailingSlash: 'always',
  build: { format: 'directory' },
  // One stylesheet for the whole site, linked in the layout; no inline styles per page.
  vite: {
    css: { preprocessorOptions: { scss: { api: 'modern-compiler' } } },
  },
  server: { host: '127.0.0.1' },
});
