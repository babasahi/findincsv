// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Live on Netlify subdomain until findincsv.com is purchased (SETUP.md step 1).
  site: 'https://findincsv.netlify.app',
  i18n: {
    defaultLocale: 'ar',
    locales: ['ar', 'en'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  // Draft posts never get a route (see getStaticPaths filters), so they're
  // already excluded here for free — nothing extra to filter.
  integrations: [sitemap()],
});
