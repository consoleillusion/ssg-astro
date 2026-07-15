// @ts-check
import fs from 'node:fs';
import path from 'node:path';

import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';

import svelte from '@astrojs/svelte';

import { listPages } from './src/routes.js';

const notFoundFiles = ['404.astro', '404.html', '404.md', '404.mdx'];

const root = process.cwd();
const pagesDir = path.join(root, 'src', 'pages');

const has404Page = notFoundFiles.some((file) => fs.existsSync(path.join(pagesDir, file)));
const defaultPageDisabled =
	process.env.SSG_NO_DEFAULT_PAGE === '1' ||
	fs.existsSync(path.join(root, '.no-default-page'));

/**
 * Show a helpful 404 page that describes the supported file types and, when
 * the directory has no index page, links to the pages that do exist.
 *
 * @type {import('astro').AstroIntegration}
 */
const missingPage = {
	name: 'ssg-missing-page',
	hooks: {
		'astro:config:setup': ({ injectRoute }) => {
			if (defaultPageDisabled) {
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

let routeCache;

/** @returns {Map<string, { actual: string, priority: number }>} */
function routesFor() {
	if (routeCache) {
		return routeCache;
	}

	/** @type {Map<string, { actual: string, priority: number }>} */
	const routes = new Map();
	for (const page of listPages(pagesDir)) {
		const existing = routes.get(page.lookup);
		if (!existing || page.priority < existing.priority) {
			routes.set(page.lookup, { actual: page.actual, priority: page.priority });
		}
	}

	return (routeCache = routes);
}

/**
 * Rewrite lowercase URLs to the case-preserving route Astro generates.
 * This keeps links extensionless and lowercase while matching files such as
 * README.md, About.astro, or docs/Getting-Started.md.
 *
 * @type {import('vite').Plugin}
 */
const lowercaseRoutes = {
	name: 'ssg-lowercase-routes',
	enforce: 'pre',
	configureServer(server) {
		const invalidate = () => {
			routeCache = undefined;
		};

		server.watcher.on('add', invalidate);
		server.watcher.on('unlink', invalidate);
		server.watcher.on('addDir', invalidate);
		server.watcher.on('unlinkDir', invalidate);

		server.middlewares.use((req, _res, next) => {
			if (!req.url) {
				return next();
			}

			const [rawPath, query] = req.url.split('?');
			let decoded;
			try {
				decoded = decodeURIComponent(rawPath);
			} catch {
				return next();
			}

			const normalized =
				decoded.length > 1 ? decoded.replace(/\/+$/, '') || '/' : decoded;
			if (normalized !== normalized.toLowerCase()) {
				return next();
			}

			const route = routesFor().get(normalized.toLowerCase());
			if (route && route.actual !== decoded) {
				req.url = encodeURI(route.actual) + (query ? `?${query}` : '');
			}

			next();
		});
	},
};

// https://astro.build/config
export default defineConfig({
	integrations: [missingPage, classlessStyles, mdx(), svelte()],
	vite: {
		plugins: [lowercaseRoutes],
	},
});
