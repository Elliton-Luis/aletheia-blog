import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://seudominio.com.br',
  integrations: [sitemap()],
});
