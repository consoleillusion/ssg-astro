import fs from 'node:fs';
import path from 'node:path';
import { listPages } from '../routes.js';

const EDITABLE = new Set(['.html', '.md', '.mdx']);

/** @param {string} pagesDir */
const pageFileFor = (pagesDir) => {
	/** @type {Map<string, string>} */
	const map = new Map();
	for (const page of listPages(pagesDir)) {
		map.set(page.lookup, path.join(pagesDir, page.file));
	}
	return map;
};

const normalizePath = (url) => {
	const clean = (url || '/').split('?')[0].split('#')[0];
	try {
		return decodeURIComponent(clean).replace(/\/+$/, '') || '/';
	} catch {
		return null;
	}
};

/** @param {string} html @returns {string} */
const stripEditorArtifacts = (html) =>
	html
		.replace(/<details class="ssg-menu"[\s\S]*?<\/details>/g, '')
		.replace(/<style>[\s\S]*?<\/style>/g, '');

const frontmatterOf = (source) => {
	const match = source.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
	return match ? { frontmatter: match[0], body: source.slice(match[0].length) } : { frontmatter: '', body: source };
};

/**
 * Map a URL pathname to the backing source file, if it is an editable one.
 * @param {string} pagesDir @param {string} urlPath
 * @returns {{ file: string, type: string } | null}
 */
export const resolveEditable = (pagesDir, urlPath) => {
	const lookup = normalizePath(urlPath);
	if (!lookup) return null;
	const file = pageFileFor(pagesDir).get(lookup.toLowerCase());
	if (!file) return null;
	const type = path.extname(file).toLowerCase();
	if (!EDITABLE.has(type)) return null;
	const real = fs.realpathSync(file);
	const root = fs.realpathSync(pagesDir);
	if (real !== root && !real.startsWith(root + path.sep)) return null;
	return { file: real, type };
};

/**
 * Return the raw markdown of a .md/.mdx page (front matter stripped).
 * @param {string} file
 * @returns {string}
 */
export const readMarkdownSource = (file) => frontmatterOf(fs.readFileSync(file, 'utf8')).body;

/**
 * Persist an edited markdown document, preserving front matter.
 * @param {string} file @param {string} markdown
 */
export const applyMarkdownEdit = (file, markdown) => {
	const { frontmatter } = frontmatterOf(fs.readFileSync(file, 'utf8'));
	const clean = markdown.endsWith('\n') ? markdown : `${markdown}\n`;
	fs.writeFileSync(file, `${frontmatter}${clean}`, 'utf8');
};

/**
 * Persist edited main-content HTML back into the HTML file it came from.
 * @param {string} file @param {string} html
 */
export const applyEdit = (file, html) => {
	const clean = stripEditorArtifacts(html);
	const source = fs.readFileSync(file, 'utf8');

	const replaced = source.replace(/(<main\b[^>]*>)([\s\S]*?)(<\/main>)/i, (_, open, _body, close) => `${open}${clean}${close}`);
	if (replaced === source && !/<main\b[^>]*>[\s\S]*?<\/main>/i.test(source)) {
		throw new Error('Could not find a <main> element in the HTML file.');
	}
	fs.writeFileSync(file, replaced, 'utf8');
};
