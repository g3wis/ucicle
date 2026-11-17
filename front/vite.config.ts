import { resolve } from 'path';
import { defineConfig } from 'vite';
import reactRefresh from '@vitejs/plugin-react-refresh';

// One static HTML file per page and language: head tags (title, description, hreflang, Open Graph)
// must be in the HTML, link previews do not run JavaScript. All four load the same bundle.
export default defineConfig({
  plugins: [reactRefresh()],
  build: {
    outDir: 'build',
    rollupOptions: {
      input: {
        game: resolve(__dirname, 'index.html'),
        gameEn: resolve(__dirname, 'en/index.html'),
        about: resolve(__dirname, 'a-propos/index.html'),
        aboutEn: resolve(__dirname, 'en/about/index.html'),
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://ucicle.com.s3-website.fr-par.scw.cloud',
    },
  },
});
