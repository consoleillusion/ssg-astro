import fs from 'node:fs';
import path from 'node:path';

import { listPages } from '../routes.js';

const pagesDir = path.join(process.cwd(), 'src', 'pages');

const indexFiles = ['index.astro', 'index.html', 'index.md', 'index.mdx', 'index.typ'];

export type MenuLink = { url: string; label: string };

const escapeHtml = (value: string): string =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

/**
 * The navigable pages, computed from disk on every call so the menu is fresh
 * in the dev server without a restart. The root index (which listPages()
 * deliberately skips for the default page) is put back first when it exists.
 */
export function menuLinks(): MenuLink[] {
	const hasIndex = indexFiles.some((file) => fs.existsSync(path.join(pagesDir, file)));
	const links = listPages(pagesDir).map(({ path: urlPath, url }) => ({
		url,
		label: urlPath,
	}));
	if (hasIndex) {
		links.unshift({ url: '/', label: '/' });
	}
	return links;
}

/** The same markup as Menu.astro, as a string for raw-HTML pages. */
export const menuHtml = (): string => {
	const links = menuLinks();
	const items = links
		.map(({ url, label }) => `<li><a href="${escapeHtml(url)}">${escapeHtml(label)}</a></li>`)
		.join('');
	const content =
		items.length > 0 ? `<ul>${items}</ul>` : '<p class="ssg-menu-empty">No navigable pages yet.</p>';
	return `<style>${MENU_CSS}</style><details class="ssg-menu"><summary aria-label="Toggle page menu" title="Site pages">☰</summary><div class="ssg-menu-panel"><div class="ssg-menu-inner"><nav class="ssg-menu-nav" aria-label="Site pages">${content}</nav></div></div></details>`;
};

/**
 * Self-contained styles for the menu. No child combinators, ampersands, or
 * angle brackets, so the same string can be inlined into a raw <style> tag in
 * Markdown output.
 */
export const MENU_CSS = `
.ssg-menu {
  position: fixed;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 9999;
  font-family: system-ui, sans-serif;
  font-size: 14px;
  color-scheme: light dark;
}
.ssg-menu summary {
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid rgba(128, 128, 128, 0.45);
  border-radius: 0.75rem;
  background: Canvas;
  color: CanvasText;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.18s cubic-bezier(0.4, 0, 0.2, 1);
}
.ssg-menu summary::-webkit-details-marker {
  display: none;
}
.ssg-menu summary::marker {
  content: none;
}
.ssg-menu summary:hover {
  transform: translateY(-1px) scale(1.04);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.24);
}
.ssg-menu summary:active {
  transform: scale(0.96);
}
.ssg-menu[open] summary {
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.24);
}
.ssg-menu-panel {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
  transform-origin: top right;
  transition: grid-template-rows 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease, transform 0.28s cubic-bezier(0.34, 1.3, 0.44, 1);
}
.ssg-menu[open] .ssg-menu-panel {
  grid-template-rows: 1fr;
  opacity: 1;
  transform: none;
}
.ssg-menu-inner {
  overflow: hidden;
  min-height: 0;
}
.ssg-menu-nav {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  width: min(80vw, 18rem);
  max-height: 70vh;
  overflow-y: auto;
  background: Canvas;
  color: CanvasText;
  border: 1px solid rgba(128, 128, 128, 0.45);
  border-radius: 0.75rem;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3);
  padding: 0.4rem;
}
.ssg-menu-nav ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.ssg-menu-nav li a {
  display: block;
  padding: 0.4rem 0.6rem;
  border-radius: 0.5rem;
  color: CanvasText;
  text-decoration: none;
  transition: background 0.15s ease;
}
.ssg-menu-nav li a:hover {
  background: rgba(128, 128, 128, 0.2);
}
.ssg-menu-empty {
  margin: 0;
  padding: 0.6rem;
}
`;
