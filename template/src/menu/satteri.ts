import { menuHtml } from './menu.ts';

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
