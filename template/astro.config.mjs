// @ts-check
import fs from 'node:fs';
import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';

import svelte from '@astrojs/svelte';

const pagesDir = new URL('./src/pages/', import.meta.url);
const hasIndexPage = ['index.astro', 'index.md', 'index.mdx'].some((file) =>
  fs.existsSync(new URL(file, pagesDir))
);

/**
 * The served directory is linked as `src/pages`. When it has no index page,
 * Astro has no route for `/`, so inject a generated directory listing instead.
 */
function fallbackIndex() {
  return {
    name: 'ssg-astro:fallback-index',
    hooks: {
      /** @param {{ injectRoute: (route: { pattern: string, entrypoint: string }) => void }} options */
      'astro:config:setup': ({ injectRoute }) => {
        if (!hasIndexPage) {
          injectRoute({
            pattern: '/',
            entrypoint: './src/fallback/Index.astro'
          });
        }
      }
    }
  };
}

// https://astro.build/config
export default defineConfig({
  integrations: [mdx(), svelte(), fallbackIndex()]
});
