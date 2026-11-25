# Pages and routing

The served directory is treated like an Astro `src/pages` directory, with a few
additional rules implemented by the cached template.

## Page discovery

`template/src/routes.js` is the shared source of truth for discovery. The CLI
mirrors its rules for publishing build output.

`listPages(dir)` scans:

```text
**/*.{astro,html,md,mdx,typ}
```

It ignores:

- files and directories beginning with `_`
- `node_modules`
- dynamic route files whose basename contains `[`
- Typst files included by another Typst document
- the root `index.*` and root `404.*` files, which are owned by injected routes

Nested `index.*` files are normal pages. Routes are extensionless:

| File | Route |
| :--- | :---- |
| `why.md` | `/why` |
| `nested/guide.mdx` | `/nested/guide` |
| `nested/index.md` | `/nested/` |
| `index.md` | `/` (handled specially) |
| `404.md` | `/404` (handled specially) |

Each discovered page records:

- `path` — lowercase route, with a trailing slash for index pages
- `url` — percent-encoded user-facing URL
- `actual` — original-case route used for build output paths
- `lookup` — lowercase route with trailing slash removed
- `file` — path relative to the served directory
- `priority` — used for duplicate resolution

Results are sorted by lowercase path.

## Duplicate-route priority

When multiple source files map to the same route, the lowest priority number
wins:

```text
.astro > .html > .md > .mdx > .typ > generated .html
```

Generated HTML is ranked below every source type. This lets `build` write HTML
beside sources without shadowing an updated Markdown, MDX, Typst, Astro, or
plain HTML file on the next run.

Route keys are lowercased, so filenames that differ only by case collide and
the priority rule decides the winner. A `lowercaseRoutes` Vite plugin rewrites
all-lowercase requests to Astro's case-preserving route; paths containing an
uppercase character are passed through untouched.

## Typst include detection

`includedTypstFiles(dir)` scans every `.typ` file, including underscore-prefixed
fragments, for `#include "…"`, `#include '…'`, and `#include("…")`. Absolute
targets resolve from the project root; relative targets resolve against the
including file. Paths escaping above the root are discarded.

Included files are document fragments, not standalone pages. They are excluded
from routing and from the Typst availability check. Because all `.typ` files
are scanned, chained includes are found.

See [Typst](/typst).

## Injected routes

The Astro integrations in `template/astro.config.mjs` add routes that do not
exist as source files:

- `/` → `src/missing/Index.astro` when no user index exists and the built-in
  default page is enabled
- `/404` → `src/missing/Index.astro` when no user 404 page exists and the
  built-in page is enabled
- one route per `.typ` entrypoint → `src/typst/Page.astro`

A root `index.typ` only wins when no higher-priority root source (`.astro`,
`.html`, `.md`, `.mdx`) exists. The same applies to `404.typ`.

`SSG_NO_DEFAULT_PAGE=1` disables both injected default routes, but Typst root
routes are injected independently and still appear.

## Generated HTML hiding

After a build, generated `.html` files sit beside source pages. Astro's file
router would normally treat them as duplicate routes. The
`ssg-hide-generated-html` integration inspects `.html` routes during
`astro:route:setup`; if the file contains
`<!-- astro-ssg:generated -->`, the route is moved to a private pattern under
`/__astro-ssg-generated`. The file remains on disk but does not compete for the
real URL.

## Built-in default and 404 pages

Both are rendered by `src/missing/Index.astro`.

- At `/`, with no user index, it returns a "Default page served" response with
  status 200 and lists supported index filenames. It also lists discovered
  pages with their source filenames.
- At `/404`, it explains supported page types. The page list is rendered only
  for the root default page, not for 404.
- When a template is active, both pages are wrapped in `WacssDocs.astro`;
  otherwise they use the standard `Layout.astro`.
- A legacy generated `index.html` marked
  `<!-- astro-ssg:generated-index -->` is treated as a real page and left
  untouched. A current generated `index.html` is ignored.

## HTML charset and route reloads

Bare Markdown/MDX pages do not include `<meta charset>`. Middleware adds
`charset=utf-8` to every `text/html` response, including responses where Vite
passes the content type directly in `writeHead`.

When files are added or removed under the served directory, the template clears
its route cache, invalidates the module graph, and sends a full reload. This is
necessary because the pages directory is a symlink outside the cache.

## Relationship to Astro

Astro still owns normal file-based routing for `.astro`, `.html`, `.md`, and
`.mdx`. The library adds:

- a shared discovery algorithm for navigation, build publishing, and Typst
- injected routes for Typst and missing pages
- route hiding for generated HTML
- priority rules that keep source files authoritative after builds
- case-insensitive request rewriting and charset enforcement

Continue with [Markdown and render-time injection](/markdown-pipeline).
