import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://seudominio.com.br',
  redirects: {
    '/artigos': '/ensaios/',
    '/artigos/[...slug]': '/ensaios/[...slug]',
  },
  integrations: [sitemap()],
});
