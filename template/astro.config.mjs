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
const defaultPageDisabled =
	process.env.SSG_NO_DEFAULT_PAGE === '1' ||
	fs.existsSync(path.join(root, '.no-default-page'));

/**
 * Show a helpful 404 page when the served directory has no index page.
 * It describes the supported file types and links to the pages that exist,
 * without listing non-page files.
 *
 * @type {import('astro').AstroIntegration}
 */
const missingPage = {
	name: 'ssg-missing-page',
	hooks: {
		'astro:config:setup': ({ injectRoute }) => {
			if (defaultPageDisabled || hasIndexPage) {
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

const classlessThemes = ['sakura', 'milligram', 'skeleton'];
const requestedClasslessTheme = (process.env.SSG_CLASSLESS ?? '').trim().toLowerCase();
const classlessTheme = classlessThemes.includes(requestedClasslessTheme)
	? requestedClasslessTheme
	: '';

/**
 * Serve the selected classless stylesheet from node_modules and add it to
 * pages that do not already get it from Layout.astro (for example Markdown
 * pages).
 *
 * @type {import('astro').AstroIntegration}
 */
const classlessStyles = {
	name: 'ssg-classless-styles',
	hooks: {
		'astro:config:setup': ({ injectRoute, injectScript }) => {
			if (!classlessTheme) {
				return;
			}

			injectRoute({
				pattern: `/${classlessTheme}.css`,
				entrypoint: './src/theme/css.ts',
			});

			injectScript(
				'page',
				`
if (!document.querySelector('link[data-ssg-classless]')) {
	const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = ${JSON.stringify(`/${classlessTheme}.css`)};
	link.dataset.ssgClassless = ${JSON.stringify(classlessTheme)};
	document.head.appendChild(link);
}
`
			);
		},
	},
};

// https://astro.build/config
export default defineConfig({
	integrations: [missingPage, classlessStyles, mdx(), svelte()],
});
