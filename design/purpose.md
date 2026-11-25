# Purpose and mental model

`astro-ssg` is a zero-configuration site publisher and development server built
on top of Astro. It lets a directory of ordinary files become a website without
requiring an Astro project in that directory.

The served directory may contain:

- `.astro` components and pages
- plain `.html` pages
- `.md` and `.mdx` documents
- `.typ` Typst documents

The directory stays where it is. Authors do not need to add frontmatter,
layouts, an `astro.config.mjs`, a `package.json`, or a build step. Runtime
features are opt-in flags on the CLI.

## The central idea

Astro needs a project root with configuration, dependencies, and a `src/pages`
directory. `astro-ssg` supplies that project in a writable cache and points its
`src/pages` at the directory the user wants to serve.

```text
served directory (user files)
        │
        ▼  symlink
cache/src/pages
        │
        ▼  Astro reads routes from src/pages
Astro dev server / static build
```

The cache contains a complete copy of the bundled Astro template. The served
directory is never copied into the cache. `serve` never writes to it. `build`
deliberately writes generated `.html` files beside source pages, marks them,
and ranks them below every source type so the sources remain authoritative.

## Two operating modes

### `serve`

`serve` prepares the cache, installs dependencies, and starts Astro's dev
server. It is for writing and previewing. Edits to pages are picked up by
Astro's watcher, and optional in-browser editing can save changes back to
`.html`, `.md`, and `.mdx` sources.

### `build`

`build` runs `astro build` in the cache, then copies each built page next to its
source as `<name>.html`. Those files are ready to be served by a plain static
web server. Source files are not rewritten; only generated HTML is added.

## What the template contributes

The cached template supplies the machinery that would otherwise live in an
Astro project:

- route discovery and duplicate-route priority rules
- injected root and 404 pages when the directory lacks them
- Typst compilation and routing
- Markdown/MDX rendering through Astro's Sätteri processor
- optional bundled themes, user CSS, page menu, and in-browser editing
- optional render-time templates, currently `wacss-docs`

All runtime behavior is communicated from the CLI to Astro with `SSG_*`
environment variables. The template does not read CLI arguments directly.

## Styling and templates are separate

A **theme** is a bundled stylesheet such as `sakura`. **User CSS** is a file
passed with `--css`. A **template** is a broader render-time presentation mode;
`wacss-docs` supplies its own layout, navigation, search, and WACSS styling.

While `wacss-docs` is active, the standalone theme and menu chrome are
suppressed so there is only one visual system. User CSS still loads, after the
template stylesheets, so authors can override them.

## Non-goals

- It is not a content management system.
- It does not own or restructure the served directory.
- It does not require a database or server-side API for normal sites.
- It does not delete stale generated HTML after a source page is removed.
- It does not rewrite source Markdown or Typst to apply styling. Templates are
  applied at render time.

## Vocabulary

| Term | Meaning |
| :--- | :------ |
| served directory | The directory passed as `[dir]` to `serve` or `build`, or the current directory when omitted. |
| template cache | The writable copy of the bundled Astro template under `ASTRO_SSG_CACHE` or the platform default cache directory. |
| source page | A routable file in the served directory: `.astro`, `.html`, `.md`, `.mdx`, or `.typ`. |
| generated HTML | An `.html` file written by `build`, marked with `<!-- astro-ssg:generated -->`. |
| template | A render-time presentation mode. Currently `wacss-docs`; `none` disables it. |
| theme | A bundled stylesheet mode such as `sakura`, ignored while a template is active. |
| fragment | A `.typ` file included by another Typst file; it is not a standalone page. |

Continue with [Source map](/source-map).
