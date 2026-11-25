# Menu

`--menu` adds a small floating page-navigation button. It is separate from the
`wacss-docs` drawer and is suppressed when a template is active.

## Markup and links

`template/src/menu/menu.ts` computes links on every call from
`listPages(pagesDir)`, with the root index reinserted first when any
`index.{astro,html,md,mdx,typ}` exists. Labels are lowercase route paths. If
there are no pages, the panel shows "No navigable pages yet."

`menuHtml()` returns a self-contained string:

- inline `<style>` from `MENU_CSS`
- `<details class="ssg-menu">`
- a `<summary>` button labeled with `☰`
- an absolutely positioned panel containing `<nav>` and the links

`Menu.astro` renders the same markup for Astro layouts, using `menuLinks()`
directly. The two forms are intentionally identical so behavior does not
depend on page type.

`MENU_CSS` uses `Canvas`/`CanvasText` so it follows the user's color scheme
without a theme. It is written to be safe when inlined into a raw `<style>` in
Markdown: no child combinators, ampersands, or angle brackets beyond the tags
themselves. It animates with the grid-rows technique and is reduced-motion
friendly.

The root-link check uses plain `fs.existsSync`, so it does not filter generated
HTML or Typst fragments the way route discovery does.

## How it is attached

- **Markdown/MDX:** `src/menu/satteri.ts` appends the raw HTML at the end of the
  document.
- **Astro layouts:** `Layout.astro` renders `<Menu />` when `SSG_MENU=1`.
- **Typst:** `decorateTypstHtml()` injects the same `menuHtml()` before
  `</body>` unless the document already contains `class="ssg-menu"`.

The menu requires no JavaScript to open because it is a native `<details>`
element.

## Progressive enhancement

The `ssg-menu` Astro integration injects a page script that:

- closes any open `details.ssg-menu` on an outside click
- closes it on `Escape`

It is skipped when `wacss-docs` is active. In edit mode, injected menu details
are marked inert and stripped from submitted HTML so editor chrome is not saved
into source files.

## Why it is suppressed by wacss-docs

The docs template has its own grouped navigation drawer, search, chapter links,
and left-side trigger. Adding the standalone menu as well would produce two
competing ☰ controls and duplicate navigation. The CLI accepts both flags, but
`astro.config.mjs` checks the template first and disables theme/menu chrome.

Continue with [Edit mode](/edit-mode).
