# Source map

This chapter maps every implementation file to its responsibility. It is an
orientation map; later chapters explain the behavior in detail.

## Project root

| Path | Role |
| :--- | :--- |
| `bin/astro-ssg.js` | The CLI. Parses commands and flags, prepares the cache, sets the environment, starts Astro, and publishes built HTML. |
| `package.json` | Metadata, the `astro-ssg` binary entry point, dependencies, and the `typecheck` script. |
| `tsconfig.json` | Strict JS type-checking for `bin/`. |
| `README.md` | User-facing quick reference and installation instructions. |
| `flake.nix`, `flake.lock` | Nix packages for running the CLI from this repository. |
| `bun.lock` | Root package lockfile. |
| `test-docs/` | Sample site used for manual verification and as a `wacss-docs` example. |
| `design/` | This book: Markdown chapters, `wacss-docs.json`, and `index.typ`. |

## CLI internals

Everything in `bin/astro-ssg.js` is organized around small helpers:

- **Paths and version** — package root detection, cache path constants, and
  `TEMPLATE_VERSION`.
- **Validation** — `normalizeTheme`, `normalizeTemplate`, `normalizeCss`,
  `normalizePort`, `normalizeHost`, and `resolveServeDir`.
- **Safety** — `assertCacheIsSafe`, `removePath`, and `makeWritable`.
- **Typst preflight** — `assertTypstAvailable`, using the template's
  `includedTypstFiles` so fragments do not trigger a false requirement.
- **Cache** — `cacheIsCurrent`, `initializeCache`, `ensureInitialized`.
- **Process spawning** — `packageManager`, `run`, `withInstalledCache`,
  `runServe`, `runBuild`.
- **Publishing** — `listSourcePages`, `markGenerated`, `builtHtmlFor`,
  `publishBuiltPages`.
- **Command definitions** — `serve`, `build`, and `themes` at the bottom.

See [CLI](/cli) and [Cache and runtime](/cache-and-runtime).

## Cached Astro template

The entire `template/` tree is copied into the cache when the cache is missing,
stale, or bound to a different directory.

| Path | Role |
| :--- | :--- |
| `template/astro.config.mjs` | Integrations, injected routes, Markdown processor configuration, Vite middleware, and feature flags. |
| `template/package.json` | Astro and template dependencies. |
| `template/public/favicon.svg` | Default favicon. |
| `template/src/routes.js` | Shared page discovery, duplicate priority, generated-HTML detection, and Typst include discovery. |
| `template/src/logger.js` | Filters noisy warnings from files that are not Astro pages. |

### Routing and layouts

| Path | Role |
| :--- | :--- |
| `template/src/missing/Index.astro` | Injected `/` default page and `/404` page; uses the active template shell. |
| `template/src/layouts/Layout.astro` | Base layout for ordinary pages, themes, user CSS, and the standalone menu. |
| `template/src/layouts/WacssDocs.astro` | The injected documentation shell for `wacss-docs`. |

### Markdown pipeline

| Path | Role |
| :--- | :--- |
| `template/src/mermaid/mermaid.ts` | Rewrites `::: mermaid` directives into `.mermaid` divs. |
| `template/src/menu/satteri.ts` | Appends the standalone menu to Markdown/MDX at render time. |
| `template/src/wacss-docs/layout-plugin.ts` | Sets `frontmatter.layout` to `WacssDocs.astro` at render time. |

### Styling and menu

| Path | Role |
| :--- | :--- |
| `template/src/theme/css.ts` | Serves the selected bundled theme stylesheet. |
| `template/src/theme/user-css.ts` | Serves the `--css` file from its original path. |
| `template/src/menu/menu.ts` | Builds menu links and the self-contained menu HTML/CSS. |
| `template/src/menu/Menu.astro` | Astro component form of the same menu. |

### Editing and Typst

| Path | Role |
| :--- | :--- |
| `template/src/edit/edit.ts` | Path resolution, source read/write, HTML/Markdown application, and containment checks. |
| `template/src/typst/typst.ts` | Typst compilation, caching, HTML decoration, title and body extraction. |
| `template/src/typst/Page.astro` | Injected Astro route for each Typst entrypoint. |

### wacss-docs

| Path | Role |
| :--- | :--- |
| `template/src/wacss-docs/config.ts` | Reads `wacss-docs.json`/`docs.json`, resolves groups against discovered pages, and builds navigation/search metadata. |
| `template/src/styles/wacss.css` | Generated WACSS stylesheet with tokens, resets, elements, components, helpers, and palettes. |
| `template/src/styles/wacss-docs.css` | Documentation-specific layer on top of WACSS. |
| `template/src/styles/WACSS-LICENSE` | MIT license for bundled WACSS code. |
| `template/src/wacss/*` | Bundled and adapted WACSS Astro components. |

See [wacss-docs configuration](/wacss-docs-config),
[wacss-docs layout](/wacss-docs-layout), and
[WACSS components](/wacss-components).

## Reading order

The chapters follow the groups in `wacss-docs.json` and `index.typ`:
foundations, CLI, rendering, advanced modes, `wacss-docs`, then reference.
The starting point is [Purpose and mental model](/purpose).
