# wacss-docs layout

`WacssDocs.astro` is the shell applied to Markdown and MDX pages when
`--template wacss-docs` is active. It is injected by
[the layout plugin](/markdown-pipeline), not added by authors.

## Activation and precedence

`astro.config.mjs` enables the template when the trimmed, lowercased
`SSG_TEMPLATE` is `wacss-docs`. The CLI always writes that variable, including
an empty string when no template is selected.

The layout plugin mutates `frontmatter.layout` only when the page does not
already declare a non-empty string layout. An explicit `layout:` in a page
therefore wins. The plugin also checks that the file is inside the served
pages directory, accepting both the symlink path and its real path.

The layout receives:

- `frontmatter`
- `headings` from Sätteri
- the rendered page as a slot

The built-in missing-page component and Typst page component wrap their content
in the same shell when a template is active.

## Stylesheet loading

The layout imports its stylesheets as URLs:

```astro
import wacssCss from '../styles/wacss.css?url';
import docsCss from '../styles/wacss-docs.css?url';
```

It emits explicit `<link rel="stylesheet">` tags. Plain side-effect CSS imports
are not reliable for a layout injected through frontmatter: Astro can emit an
orphaned asset instead of hoisting it into the page. The `?url` approach works
in both dev and static builds.

User CSS is loaded after both template stylesheets when `--css` is set. Theme
and standalone menu injection are skipped entirely.

## Page chrome

The shell consists of:

- a sticky nav bar with the drawer trigger on the left, the site title, config
  links, and right-side controls
- an off-canvas chapter drawer with grouped `<details>` sections
- a scrim behind the open drawer
- a two-column content area: main article surface and an optional TOC
- a search dialog backed by the local page index
- previous/next chapter links and an optional footer

## Drawer behavior

The drawer is fixed off-screen by default. It opens with the `☰` button at the
start of the nav bar, before the site title. The button carries
`aria-controls="docs-sidebar"` and `aria-expanded`.

Opening the drawer:

- toggles `body.docs-nav-open`
- slides the sidebar in with a transform
- reveals the scrim
- moves focus to the drawer's close button
- sets `aria-expanded` to `true`

It closes from the close button, the scrim, `Escape`, or clicking a chapter
link. Focus returns to the menu button except when a chapter link was followed.
The drawer is no longer a permanent left column at any viewport width.

## Main surface

The article column is styled as a WACSS surface:

- `var(--color-surface)` background
- `var(--border-width)` border
- `var(--border-radius)` corners
- `var(--shadow-surface)`
- responsive padding

Inline code and code blocks use `var(--color-base)` so they stay distinct from
the surface. The article, hero, cards, pagination, and footer share a
`90ch` maximum width and are centered. The right TOC is narrower and hidden at
smaller widths; the article no longer reserves a permanent sidebar column.

## Search

The search index is embedded as JSON in
`<script type="application/json" id="docs-search-index">`. Search matches
label, description, and URL with a case-insensitive substring and shows at most
30 results. It opens from the search button, `/` when not typing, or `⌘K` /
`Ctrl+K`. Selecting a result closes the dialog.

## On-this-page TOC

The TOC contains headings of depth two and three. An `IntersectionObserver`
sets `aria-current` on the link whose heading is being read. The observer uses
a bottom-biased root margin so the active section changes before it reaches the
top of the viewport.

## Mode and palette

`WacssDocs.astro` restores `wacss:mode` and `wacss:palette` from `localStorage`
before first paint. The mode button toggles `data-mode` between `light` and
`dark`; before a choice is stored, light mode follows the system preference.
The palette select changes `data-palette` and persists the choice. Stored values
are applied without validation, so hand-edited storage can produce an unknown
palette.

## Home page

The root page gets a hero with the site title, description, "Start reading"
button, config links, and a card grid built from the first four items in each
group. Other pages get the article surface, TOC, pagination, and footer. A page
can force the home treatment with `frontmatter.template === 'home'`, or suppress
it with the layout's `home={false}` prop.

## Suppressed chrome

While `wacss-docs` is active:

- the bundled theme route and theme script are not injected
- the standalone menu and its script are not injected
- Typst decoration does not add theme, menu, or user CSS links

This avoids two visual systems on the same page while still allowing user CSS
overrides.

Continue with [WACSS components](/wacss-components).
