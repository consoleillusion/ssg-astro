# Markdown and render-time injection

Astro 7 uses Sätteri as its default Markdown processor. The cached template
configures it in `astro.config.mjs` with a small set of mdast plugins. These
plugins run at render time, which is what lets the library add diagrams,
navigation, and templates without rewriting source files.

## Plugin order

```js
satteri({
  mdastPlugins: [
    mermaidMdastPlugin(),
    ...(menuEnabled && !wacssDocsEnabled ? [menuMdastPlugin()] : []),
    ...(wacssDocsEnabled ? [wacssDocsLayoutPlugin] : []),
  ],
})
```

Order matters:

1. Mermaid converts diagram directives into raw HTML nodes.
2. The standalone menu appends its markup.
3. The `wacss-docs` layout plugin sets the special `layout` frontmatter property.

The menu and template are mutually exclusive. When `wacss-docs` is active, the
standalone menu is suppressed so the docs drawer is the only navigation.

Sätteri's defaults are otherwise left alone: GFM, smart punctuation, heading
IDs, and heading metadata all work normally. The heading metadata is what the
docs layout uses for its table of contents.

## Mermaid directives

`src/mermaid/mermaid.ts` recognizes a directive written directly in Markdown
source:

````markdown
::: mermaid
graph TD
  A --> B
:::
````

Implementation notes:

- Ordinary fenced code blocks are stripped before matching, so an example of
  the syntax inside a fence is not rendered as a diagram.
- Smart punctuation can mutate node text before plugins run, so the plugin
  recovers raw diagram source from `ctx.source` in document order.
- The replacement is an mdast raw node containing
  `<div class="mermaid">…escaped code…</div>`, valid in both Markdown and MDX.
- A page script always scans for `.mermaid` elements, but dynamically imports
  Mermaid only when at least one exists. It initializes with
  `startOnLoad: false` and `securityLevel: 'loose'`.
- Triple-backtick `mermaid` fences remain ordinary code blocks.
- The plugin instance is created once, so its raw-source index is shared across
  documents in the same server process. After the first diagram it may fall
  back to the paragraph text with the marker removed.

## Standalone page menu injection

`src/menu/satteri.ts` appends `menuHtml()` to every Markdown/MDX document when
`--menu` is set and no template is active. It uses an mdast raw node rather than
a hast node because MDX cannot compile a hast raw node.

The menu is server-rendered and JS-free; the integration adds only progressive
enhancement. See [Menu](/menu).

## wacss-docs layout injection

`src/wacss-docs/layout-plugin.ts` is a Sätteri **plugin factory**. It receives
the Astro data bag before the document is parsed and mutates:

```text
ctx.data.astro.frontmatter.layout
```

This is the same `layout` property Astro reads from Markdown/MDX frontmatter.
The factory:

- skips files outside the served pages directory, accepting both the symlink
  path and its resolved real path
- skips pages that already declare a non-empty string `layout`, so author
  frontmatter always wins
- sets a relative path to `src/layouts/WacssDocs.astro`, computed from the
  page's own directory so nested pages work
- returns a no-op plugin definition because all work happens in the factory

Astro then compiles the Markdown/MDX page inside that layout and passes
`frontmatter`, `headings`, and the rendered slot to it.

Consequences:

- no `layout:` line is written into served files
- nested pages receive the same shell as root pages
- adding a Markdown or MDX file automatically gives it the shell
- `.astro` and plain `.html` source pages are served as-is; they are not
  rewritten and do not receive the injected Markdown layout

See [wacss-docs layout](/wacss-docs-layout).

## CSS from an injected layout

Astro does not reliably hoist CSS from a layout injected through frontmatter.
`WacssDocs.astro` therefore imports its stylesheets as URLs (`?url`) and emits
explicit `<link rel="stylesheet">` tags in `<head>`. This works identically in
dev and static builds.

## Edit mode interaction

The edit bootstrap operates on rendered DOM blocks. Its Markdown block splitter
understands both fenced code blocks and `::: mermaid` directives, so a diagram
remains one edit unit. A `::: mermaid` block is converted back to a `.mermaid`
div when edited HTML is applied to Markdown source. See
[Edit mode](/edit-mode).
