// @ts-check
import { defineConfig } from 'astro/config';

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
});
