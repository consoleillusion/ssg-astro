import { MENU_CSS, menuLinks } from './menu.ts';

const escapeHtml = (value: string): string =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

const menuHtml = (): string => {
	const links = menuLinks();
	const items = links
		.map(({ url, label }) => `<li><a href="${escapeHtml(url)}">${escapeHtml(label)}</a></li>`)
		.join('');
	const content =
		items.length > 0 ? `<ul>${items}</ul>` : '<p class="ssg-menu-empty">No navigable pages yet.</p>';
	return `<style>${MENU_CSS}</style><details class="ssg-menu"><summary aria-label="Toggle page menu" title="Site pages">☰</summary><div class="ssg-menu-panel"><div class="ssg-menu-inner"><nav class="ssg-menu-nav" aria-label="Site pages">${content}</nav></div></div></details>`;
};

/**
 * Append the page menu (same markup as Menu.astro) to every Markdown page,
 * including the inline stylesheet. Self-contained and JS-free; the plugin runs
 * at render time in the dev server, so the page list is always current.
 *
 * Astro 7's default Markdown processor is Sätteri; its mdast plugins can
 * splice raw HTML in (`{ raw, mdxExpressions: false }`), which is parsed into
 * elements — valid for both plain Markdown and MDX output. A hast `raw` node
 * cannot be used instead: MDX cannot compile one.
 */
export const menuMdastPlugin = () => ({
	name: 'ssg-menu',
	after(root: unknown, ctx: { appendChild: (node: unknown, child: unknown) => void }) {
		ctx.appendChild(root, { raw: menuHtml(), mdxExpressions: false });
	},
});
