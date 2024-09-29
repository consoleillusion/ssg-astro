// @ts-check
import fs from 'node:fs';
import path from 'node:path';

import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';

import svelte from '@astrojs/svelte';

const indexFiles = ['index.astro', 'index.html', 'index.md', 'index.mdx'];
const notFoundFiles = ['404.astro', '404.html', '404.md', '404.mdx'];

const root = process.cwd();
const pagesDir = path.join(root, 'src', 'pages');

const hasIndexPage = indexFiles.some((file) => fs.existsSync(path.join(pagesDir, file)));
const has404Page = notFoundFiles.some((file) => fs.existsSync(path.join(pagesDir, file)));

/**
 * Show a helpful 404 page when the served directory has no index page.
 * It only describes the supported file types; it never lists the filesystem.
 *
 * @type {import('astro').AstroIntegration}
 */
const missingPage = {
	name: 'ssg-missing-page',
	hooks: {
		'astro:config:setup': ({ injectRoute }) => {
			if (hasIndexPage) {
				return;
			}

			// Leave a user-provided 404 page alone.
			if (has404Page) {
				return;
			}

			injectRoute({
				pattern: '/404',
				entrypoint: './src/missing/Index.astro',
			});
		},
	},
};

// https://astro.build/config
export default defineConfig({
	integrations: [missingPage, mdx(), svelte()],
});
