# WACSS components

The `wacss-docs` template bundles a small set of Astro components derived from
the [WACSS](https://github.com/consoleillusion/wacss) design system. WACSS
provides the tokens and visual language; these components provide just enough
structure for the documentation shell.

The bundled WACSS stylesheet and components are MIT licensed. The license is
preserved at `template/src/styles/WACSS-LICENSE`.

## Copied from WACSS

### `Badge`

`src/wacss/Badge/Badge.astro` renders a styled `<span>`. It accepts `label` and
`variant`; the default `secondary` variant adds no extra class. The docs home
hero uses the `accent` variant.

### `Link`

`src/wacss/Link/Link.astro` renders an anchor with optional `aria-current="page"`
and passes through remaining props. It is used by the nav bar, hero, cards, and
pagination.

### `Page`

`src/wacss/Page/Page.astro` renders `<body {...props}><slot /></body>`. The docs
layout uses it with `class="docs-body"` so all shell styles can be scoped under
one ancestor.

## Adapted from WACSS

### `NavBar`

`src/wacss/NavBar/NavBar.astro` is based on the WACSS nav bar. It loads child
components from sibling `.astro` and `.svelte` files with `import.meta.glob`,
preferring Svelte when both exist. It was extended with a `start` prop in
addition to `end`, so the drawer trigger can render before the site title while
search, palette, and mode controls render after the links.

A link is marked current for its own path and descendant paths.

`start` and `end` are arrays of component descriptors:

```astro
start={[{ component: 'DocsMenuButton' }]}
end={[{ component: 'DocsControls', data: { palette: site.palette } }]}
```

This `start` extension is the most generally useful upstream change from this
project.

### `Card`

`src/wacss/Card/Card.astro` began as the WACSS card and was simplified to a
static component with `header`, `text`, and slot content. The docs home grid
only needs that static shape. The upstream dynamic child-loading version is
more capable, so this project's simplification should not be treated as a
replacement for it.

## Newly authored

### `DocsMenuButton`

`src/wacss/DocsMenuButton/DocsMenuButton.astro` is the left-side drawer trigger.
It renders the `☰` button with `id="docs-menu"`,
`aria-controls="docs-sidebar"`, `aria-expanded="false"`, and an accessible
label. Its behavior lives in `WacssDocs.astro`.

If upstreaming, this would be more general as a `DrawerToggle` component with
`targetId` and `label` props.

### `DocsControls`

`src/wacss/DocsControls/DocsControls.astro` groups the right-side controls:
search button, palette select, and mode button. It used to contain the menu
button; that was moved to the left cluster via `NavBar`'s `start` prop.

Controls are documentation-specific rather than core WACSS components.

## Not core components

`src/layouts/WacssDocs.astro` and `src/styles/wacss-docs.css` are examples of a
complete docs application built on WACSS. They may be useful upstream as a
reference implementation, but they are not minimal library primitives.

## Styling layers

`wacss.css` declares:

```text
wacss.reset, wacss.elements, wacss.components, wacss.layout, docs
```

`wacss-docs.css` adds rules in the final `docs` layer, so it can override WACSS
defaults without escalating specificity. The docs layer defines drawer geometry,
the article surface, TOC, search dialog, cards, pagination, footer, and
responsive behavior.

Continue with [Configuration reference](/configuration).
