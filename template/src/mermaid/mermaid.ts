const escapeHtml = (value: string): string =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');

// A ::: mermaid directive as it must appear in the raw source. Fenced code
// blocks are skipped so a directive example inside one is not misread.
const directive = /^:::\s*mermaid\s*\n([\s\S]*?)\n?:::\s*$/gim;

/** Remove fenced code blocks so directive examples inside them don't match. */
const stripFences = (source: string) => {
	const out: string[] = [];
	let inFence = false;
	for (const line of source.split('\n')) {
		if (/^(```|~~~)/.test(line.trim())) {
			inFence = !inFence;
			continue;
		}
		if (!inFence) {
			out.push(line);
		}
	}
	return out.join('\n');
};

/**
 * Render '::: mermaid' container blocks as <div class="mermaid"> blocks holding
 * the raw diagram source. Satteri passes ::: directives through as ordinary
 * paragraphs (a leading name without a space is a directive node), so this
 * matches the paragraph text — either spacing. Smart punctuation rewrites the
 * text before plugins ever see it, so the raw code is pulled from the
 * fence-stripped source text in document order instead of from the node.
 * The page-side enhancer turns the div into SVG via mermaid.js, lazy-loaded
 * only when one exists.
 */
export const mermaidMdastPlugin = () => {
	let index = 0;
	return {
		name: 'ssg-mermaid',
		paragraph(node: unknown, ctx: { textContent: (node: unknown) => string; replaceNode: (node: unknown, replacement: unknown) => void; source: string }) {
			const text = ctx.textContent(node).trim();
			if (!/^:::\s*mermaid/i.test(text)) {
				return;
			}
			const candidates = [...stripFences(ctx.source).matchAll(directive)].map(
				(match) => match[1]
			);
			const code = candidates[index] ?? text.replace(/^:::\s*mermaid\s*\n?/i, '').replace(/\n?:::\s*$/, '');
			index += 1;
			ctx.replaceNode(node, { raw: `<div class="mermaid">${escapeHtml(code)}</div>`, mdxExpressions: false });
		},
	};
};
