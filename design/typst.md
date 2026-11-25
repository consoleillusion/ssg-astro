# Typst

`.typ` files are first-class pages. The CLI compiles them to HTML with Typst,
and the template injects Astro routes so they behave like other pages. A Typst
document can also be an entrypoint for a PDF edition, as `design/index.typ` and
`test-docs/index.typ` demonstrate.

## Preflight

If a served directory contains any routable `.typ` entrypoint, the CLI runs
`typst --version` before starting Astro. `TYPST_BIN` overrides the executable.
The check excludes files included by other Typst documents, so fragments do not
cause a false requirement. It proves only that the binary runs, not that the
required features or packages are available.

## Discovery and routing

The same `listPages()` and `includedTypstFiles()` helpers used for other pages
decide which `.typ` files are routable. Included fragments are not pages.

The `typstPages` integration injects `src/typst/Page.astro` as the component for
every Typst entrypoint. It also registers each included fragment as a watch
file, so editing a shared fragment invalidates and reloads its entrypoints.

Root `index.typ` and `404.typ` are injected separately only when they are not
fragments and are not shadowed by a higher-priority `.astro`, `.html`, `.md`, or
`.mdx` source.

`SSG_NO_DEFAULT_PAGE=1` disables the built-in missing-page routes, but Typst
root routes are still injected.

## Compilation

`renderTypst(file, root)` runs synchronously:

```sh
typst compile --features html --format html --root <pagesDir> <file> -
```

Output is UTF-8 with a large buffer. `TYPST_BIN` can point to a different
binary. Spawn errors and non-zero exits become descriptive exceptions.

`--root pagesDir` makes relative includes and images resolve from the served
directory, regardless of where the cache lives.

## Cache

Compiled results are cached in memory with a key made from:

- the entrypoint path
- its mtime and size
- the mtime, size, and sorted names of every `.typ` file under the root

That last part means editing any included fragment invalidates every
entrypoint. Failed compiles are not cached. When the cache exceeds 100 entries,
it is cleared wholesale. The key uses filesystem metadata rather than content
hashes, so a change that preserves mtime and size may not invalidate.

## Decoration

For normal Typst pages, `decorateTypstHtml()` modifies the emitted document:

- inserts `<link data-ssg-theme>` when a theme is active
- inserts `<link data-ssg-css href="/astro-ssg-user.css">` when `--css` is set
- inserts the standalone menu before `</body>` when `--menu` is set

Duplicate detection uses simple substring checks, so markup that already
contains `data-ssg-theme` or `class="ssg-menu"` suppresses injection.

`typstTitle()` extracts and strips tags from `<title>`. `typstBody()` extracts
only the inner HTML of `<body>`.

## wacss-docs mode

When `SSG_TEMPLATE=wacss-docs`, Typst decoration does not add theme, user CSS,
or menu markup. Instead, `Page.astro` extracts `typstBody()` and places it
inside `WacssDocs.astro`, with the title from `typstTitle()`. This avoids nested
`<html>` and `<body>` elements and gives Typst pages the same drawer, search,
TOC, pagination, and surface as Markdown chapters.

A Typst URL with no matching page falls back to `/404.typ` when one exists.
Typst pages remain read-only in edit mode.

## PDF editions

Typst's normal PDF output can be used for a book whose chapters are Markdown.
The pattern used by `design/index.typ` and `test-docs/index.typ` is:

```typst
#import "@preview/cmarker:0.1.10"

#let md(path) = cmarker.render(
  read(path),
  h1-level: 2,
  heading-labels: none,
  set-document-title: false,
  raw-typst: true,
)
```

`h1-level: 2` maps each chapter's Markdown `#` heading to a level-two Typst
heading, while explicit `#part(...)` calls create level-one part pages. The
same chapter order is mirrored in `wacss-docs.json` so the website and PDF stay
aligned. See `design/build.sh` for a small compile wrapper.

Continue with [Static build output](/build-output).
