// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// GitHub Pages 部署在 https://<user>.github.io/<repo>/ 时，CI 会设置 BASE_PATH=/<repo>/
const base = process.env.BASE_PATH ?? '/';
const site = process.env.SITE_URL ?? 'https://example.github.io';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  integrations: [preact()],
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'en'],
    routing: { prefixDefaultLocale: true, redirectToDefaultLocale: true },
  },
});
