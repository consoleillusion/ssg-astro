# Configuration reference

This chapter collects every user-facing knob in one place.

## CLI commands

| Command | Meaning |
| :--- | :------ |
| `astro-ssg serve [dir]` | Start the Astro dev server for `dir` (default: current directory). |
| `astro-ssg build [dir]` | Build and publish generated HTML beside sources in `dir`. |
| `astro-ssg themes` | List bundled theme names. |
| `astro-ssg --help` | Print commands, options, and resolved cache directory. |
| `astro-ssg --version` | Print version and platform information. |

## CLI flags

| Flag | Commands | Value | Meaning |
| :--- | :--- | :--- | :------ |
| `--no-default-page` | serve, build | none | Disable injected `/` and `/404` pages. |
| `--theme [theme]` | serve, build | optional; defaults to `sakura` | Apply a bundled stylesheet. |
| `--template [template]` | serve, build | optional; defaults to `wacss-docs`; `none` disables | Apply a render-time template. |
| `--css <file>` | serve, build | required `.css` path | Serve and inject a user stylesheet. |
| `--menu` | serve, build | none | Add the standalone page menu. |
| `--edit` | serve only | none | Enable in-browser editing. |
| `--port <port>` | serve only | digits | Dev-server port. |
| `--host [host]` | serve only | optional; bare means `0.0.0.0` | Host binding. |

Put `[dir]` before optional-value flags so the directory is not consumed as a
flag value.

## Environment variables read by the CLI

| Variable | Meaning |
| :--- | :------ |
| `ASTRO_SSG_CACHE` | Cache directory. Empty falls back to the platform default. |
| `XDG_CACHE_HOME` | Unix cache base when `ASTRO_SSG_CACHE` is unset. |
| `LOCALAPPDATA` | Windows cache base when `ASTRO_SSG_CACHE` is unset. |
| `TYPST_BIN` | Typst executable used for preflight and compilation. |

## Environment variables written for Astro

| Variable | Value | Meaning |
| :--- | :--- | :------ |
| `SSG_NO_DEFAULT_PAGE` | `1` | Disable injected missing pages. |
| `SSG_THEME` | theme name | Select a bundled stylesheet. |
| `SSG_TEMPLATE` | template name or empty | Select a render-time template; always set. |
| `SSG_CSS_PATH` | absolute path | User stylesheet path. |
| `SSG_MENU` | `1` | Enable the standalone menu. |
| `SSG_EDIT` | `1` | Enable edit endpoints in `serve`. |

Only `SSG_TEMPLATE` is cleared when its flag is absent; inherited values of
other `SSG_*` variables survive.

## Legacy cache markers

Older caches may contain marker files in the project root. They are removed
during cache initialization.

| Marker | Legacy meaning |
| :--- | :------ |
| `.classless` | Removed; no current effect. |
| `.no-default-page` | Disable injected missing pages. Use `SSG_NO_DEFAULT_PAGE=1` instead. |

## Page extensions and priority

| Extension | Route priority |
| :--- | :--- |
| `.astro` | highest |
| `.html` | next |
| `.md` | next |
| `.mdx` | next |
| `.typ` | next |
| generated `.html` | lowest |

Supported page types are `.astro`, `.html`, `.md`, `.mdx`, and `.typ`.
Dynamic basenames containing `[`, underscore-prefixed paths, `node_modules`,
and Typst fragments are not routable.

## Generated markers

| Marker | Meaning |
| :--- | :------ |
| `<!-- astro-ssg:generated -->` | Current generated HTML; demoted and hidden from real routes. |
| `<!-- astro-ssg:generated-index -->` | Legacy generated index; treated as a real user page. |

## Themes

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

## Templates

| Value | Meaning |
| :--- | :------ |
| `wacss-docs` | Apply bundled WACSS styling and the documentation layout. |
| `none` | Explicitly disable templates and clear inherited `SSG_TEMPLATE`. |

## wacss-docs config fields

The config file is `wacss-docs.json`, with `docs.json` as an alias.

| Field | Type | Default |
| :--- | :--- | :------ |
| `title` | string | `Documentation` |
| `description` | string | empty |
| `home` | string | `/` |
| `palette` | string | `kinari` |
| `footer` | string | empty |
| `links` | array of `{ label, href }` | empty |
| `hide` | array of page keys | empty |
| `ungroupedTitle` | string | `More pages` |
| `groups` | array of groups | empty |

A group has `title`, `description`, and `pages`. A page entry is either a string
or `{ page, title?, description? }`.

Palettes supported by the bundled stylesheet are `kinari`, `matcha`, `aizome`,
and `sakura`.

## Built-in endpoints

| Endpoint | Purpose |
| :--- | :--- |
| `/<theme>.css` | Bundled theme stylesheet. |
| `/astro-ssg-user.css` | User stylesheet from `--css`. |
| `/astro-ssg-edit/status` | Edit eligibility for a path. |
| `/astro-ssg-edit/source` | Markdown source for editing. |
| `/astro-ssg-edit/save` | Save edited HTML or Markdown. |

## Markdown directives

| Syntax | Meaning |
| :--- | :------ |
| `::: mermaid … :::` | Render a Mermaid diagram. |
| ```` ```mermaid … ``` ```` | Ordinary fenced code; not rendered as a diagram. |
| `<!-- astro-ssg:generated -->` | Generated HTML marker; removed by edit saves only if present in submitted HTML. |

Continue with [Invariants and limitations](/invariants).
