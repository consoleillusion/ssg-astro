# Themes and user CSS

Styling has three independent, opt-in layers:

1. a bundled **theme** stylesheet
2. a **user stylesheet** passed with `--css`
3. a render-time **template** such as `wacss-docs`, which supplies its own layout

## Bundled themes

Available themes:

```text
sakura
sakura-dark
sakura-dark-solarized
sakura-earthly
sakura-ink
sakura-pink
sakura-radical
sakura-vader
milligram
skeleton
```

`sakura` is selected by a bare `--theme`. Unknown names are rejected by the
CLI; an unknown `SSG_THEME` inherited from the environment disables the feature
inside the template.

`template/src/theme/css.ts` maps each name to a package specifier and serves the
stylesheet at `/<theme>.css`. It resolves packages with `createRequire`, reads
the file on every request, and returns:

- 404 when no valid theme is configured
- 500 with "Run the install step again" when resolution or reading fails

## How the theme reaches pages

The `ssg-theme-styles` integration injects the `/<theme>.css` route and a page
script that adds `<link data-ssg-theme>` if one is not already present.
`Layout.astro` also emits the link directly for pages that use it. The injected
script is the mechanism for Markdown/MDX pages without a layout and other pages
that do not include `Layout.astro`.

When no theme is active, `Layout.astro` adds `class="ssg-reset"` to `<html>` and
resets margin, width, and height on the document and body.

## User stylesheet

`--css <file>` is validated by the CLI and passed as `SSG_CSS_PATH`.

The `ssg-user-styles` integration injects `/astro-ssg-user.css`. The endpoint in
`template/src/theme/user-css.ts` reads the original file on every request, so
edits are picked up without restarting the dev server. It returns:

- 404 when no path is configured
- 500 with a plain-text message when the file cannot be read
- CSS bytes with `text/css; charset=utf-8` otherwise

The integration also injects a page script that adds
`<link data-ssg-css href="/astro-ssg-user.css">` if no such link exists. A Vite
plugin watches the original path and sends a full reload on change, add, or
unlink.

`Layout.astro` emits the user CSS link after the theme link, so custom CSS wins
on equal specificity.

## Typst decoration

For ordinary Typst pages, `decorateTypstHtml()` inserts theme and user CSS links
before `</head>`, skipping links that are already present by marker. It inserts
the standalone menu before `</body>` when `--menu` is set.

The duplicate checks are simple substring tests for `data-ssg-theme` and
`class="ssg-menu"`, so markup containing those strings elsewhere can suppress
injection.

## Interaction with wacss-docs

When `SSG_TEMPLATE=wacss-docs`:

- the theme route and theme injection script are skipped entirely
- the standalone menu is skipped entirely
- `WacssDocs.astro` emits `wacss.css`, then `wacss-docs.css`, then the user CSS
  link if `--css` is set
- Typst decoration does not add a user CSS link itself, because the docs layout
  already adds it

This prevents a second theme or menu from layering over the docs shell while
still letting authors override template styles with their own CSS.

## WACSS tokens in the docs template

`template/src/styles/wacss.css` is generated from the WACSS design system. It
declares layers in this order:

```text
wacss.reset, wacss.elements, wacss.components, wacss.layout, docs
```

The generated file contains:

- color, spacing, typography, radius, and shadow tokens
- dark defaults and light-scheme handling
- four palettes: `kinari`, `matcha`, `aizome`, `sakura`
- reset rules
- helper classes such as `.stack`, `.spread`, `.cluster`, `.box`, `.push`,
  `.frame`, `.center`, `.grid`, and `.visually-hidden`
- element and component rules for badges, cards, chips, nav bars, notices,
  pagination, and more

`template/src/styles/wacss-docs.css` adds the `docs` layer after those layers,
so its overrides win without fighting specificity. It defines the off-canvas
drawer, the wider article surface, the TOC, search dialog, cards, pagination,
footer, and responsive breakpoints. The bundled WACSS code is MIT licensed; see
`template/src/styles/WACSS-LICENSE`.

## Ordering summary

| Mode | Stylesheet order |
| :--- | :---------------- |
| No theme, no CSS | `Layout.astro` reset only |
| Theme | `/<theme>.css` |
| Theme + CSS | `/<theme>.css`, `/astro-ssg-user.css` |
| wacss-docs | `wacss.css`, `wacss-docs.css` |
| wacss-docs + CSS | `wacss.css`, `wacss-docs.css`, `/astro-ssg-user.css` |

Continue with [Menu](/menu).
