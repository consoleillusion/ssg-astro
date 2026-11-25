import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { globSync } from 'tinyglobby';

import { menuHtml } from '../menu/menu.ts';
import { includedTypstFiles, listPages } from '../routes.js';

const THEMES = new Set([
	'sakura',
	'sakura-dark',
	'sakura-dark-solarized',
	'sakura-earthly',
	'sakura-ink',
	'sakura-pink',
	'sakura-radical',
	'sakura-vader',
	'milligram',
	'skeleton',
]);

// Typst is fast enough for a page or two, but recompiling on every dev-server
// request is needlessly slow. Key the cache on the Typst sources' identities so
// a saved edit to an entrypoint or an included fragment produces fresh HTML.
const compiled = new Map<string, string>();

/**
 * Includes change a page's output without changing the entrypoint file, so the
 * cache key covers every Typst source under the project root.
 * @param {string} root
 */
const typstSourcesKey = (root: string) => {
	const files = globSync(['**/*.typ'], {
		cwd: root,
		ignore: ['**/node_modules/**'],
		followSymbolicLinks: false,
	}).sort();
	return files
		.map((file) => {
			try {
				const stat = fs.statSync(path.join(root, file));
				return `${file}|${stat.mtimeMs}|${stat.size}`;
			} catch {
				return `${file}|missing`;
			}
		})
		.join(';');
};

/**
 * Find the Typst source backing a URL. Routes are matched case-insensitively,
 * just like the dev server's lowercase URL rewriting.
 */
export function findTypstPage(pagesDir: string, urlPath: string): string | null {
	const lookup = (urlPath.split('?')[0] ?? '/').replace(/\/+$/, '').toLowerCase() || '/';
	const included = includedTypstFiles(pagesDir);
	const isFragment = (file: string) =>
		file.toLowerCase().endsWith('.typ') &&
		included.has(file.replaceAll(path.sep, '/'));
	// listPages() deliberately omits the root index and 404, but both can be
	// Typst pages when they win the route.
	if (lookup === '/' || lookup === '/404') {
		const relative = `${lookup === '/' ? 'index' : '404'}.typ`;
		const rootFile = path.join(pagesDir, relative);
		if (fs.existsSync(rootFile) && !isFragment(relative)) return rootFile;
	}
	for (const page of listPages(pagesDir)) {
		if (page.file.toLowerCase().endsWith('.typ') && page.lookup === lookup) {
			return path.join(pagesDir, page.file);
		}
	}
	return null;
}

/** Compile a .typ file to a complete HTML document with the Typst CLI. */
export function renderTypst(file: string, root: string): string {
	const stat = fs.statSync(file);
	const key = `${file}|${stat.mtimeMs}|${stat.size}|${typstSourcesKey(root)}`;
	const cached = compiled.get(key);
	if (cached !== undefined) return cached;

	const binary = process.env.TYPST_BIN || 'typst';
	const result = spawnSync(
		binary,
		['compile', '--features', 'html', '--format', 'html', '--root', root, file, '-'],
		{ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
	);

	if (result.error) {
		throw new Error(
			`Could not run "${binary}": ${result.error.message}. Install Typst with HTML export support (https://typst.app), or set TYPST_BIN to its path.`,
		);
	}
	if (result.status !== 0) {
		const detail = (result.stderr ?? '').trim() || `exit code ${result.status}`;
		throw new Error(`Typst could not compile ${path.basename(file)}: ${detail}`);
	}

	const html = result.stdout ?? '';
	if (compiled.size > 100) compiled.clear();
	compiled.set(key, html);
	return html;
}

/**
 * Typst emits a standalone document. Add the same opt-in chrome that other
 * Astro-rendered pages get (theme, custom stylesheet, and page menu) without
 * disturbing Typst's own markup.
 */
export function decorateTypstHtml(html: string): string {
	const theme = (process.env.SSG_THEME ?? '').trim().toLowerCase();
	const links = [
		THEMES.has(theme) && !html.includes('data-ssg-theme')
			? `<link rel="stylesheet" href="/${theme}.css" data-ssg-theme="${theme}">`
			: '',
		process.env.SSG_CSS_PATH && !html.includes('data-ssg-css')
			? '<link rel="stylesheet" href="/astro-ssg-user.css" data-ssg-css>'
			: '',
	].filter(Boolean);

	if (links.length > 0) {
		const tags = links.join('');
		html = /<\/head>/i.test(html)
			? html.replace(/<\/head>/i, `${tags}</head>`)
			: `${tags}${html}`;
	}

	if (process.env.SSG_MENU === '1' && !html.includes('class="ssg-menu"')) {
		const markup = menuHtml();
		html = /<\/body>/i.test(html)
			? html.replace(/<\/body>/i, `${markup}</body>`)
			: `${html}${markup}`;
	}

	return html;
}
