# astro-ssg

Serve or statically build a directory of web files with Astro. Pages can be `.astro`, `.html`, `.md`, `.mdx`, or `.typ` (Typst).

Requires Node.js `>= 22.23.4`, or Bun. Typst pages additionally require the [Typst CLI](https://typst.app) with HTML export support; set `TYPST_BIN` if it is not on `PATH`.

## Quick start

Run these commands from the directory you want to serve:

```bash
npx --yes --package=github:consoleillusion/ssg-astro astro-ssg serve
```

Pass a directory to serve something other than the current directory:

```bash
npx --yes --package=github:consoleillusion/ssg-astro astro-ssg serve ./public
```

To compile the whole directory to HTML instead of serving it live, run `build` from the same directory:

```bash
npx --yes --package=github:consoleillusion/ssg-astro astro-ssg build
```

Or, from a clone of this repository:

```bash
./bin/astro-ssg.js serve
./bin/astro-ssg.js build
```

`serve` copies a small Astro project to `~/.cache/astro-ssg` (or `%LOCALAPPDATA%\astro-ssg` on Windows), links the given directory (or the current directory) as its `src/pages` directory, installs dependencies, and starts the Astro dev server. All artifacts are stored in the cache; the served directory is never written to or deleted from. The cache initializes itself the first time it is needed — there is no separate setup command. If the cache was set up for a different directory, `serve` repoints it. Set `ASTRO_SSG_CACHE` to use a different cache directory.

### With Bun

Bun can run the CLI directly without Node.js or npm:

```bash
bunx --bun -p github:consoleillusion/ssg-astro astro-ssg serve
```

### Options

`serve` accepts:

| Flag | Description |
| :--- | :---------- |
| `[dir]` | Directory to serve (default: current directory) |
| `--theme [theme]` | Style every route with a bundled theme stylesheet (see [Themes](#themes); default: `sakura`) |
| `--css <file>` | Inject a `.css` file into every Astro-rendered, Typst, and built-in default page |
| `--menu` | Show a page-navigation button in the top-right corner |
| `--edit` | Make pages backed by `.html`/`.md`/`.mdx` sources editable in the browser and persist edits to disk |
| `--no-default-page` | Do not provide the missing-index page at `/` |
| `--port <port>` | Port for the dev server |
| `--host [host]` | Expose the dev server on the network; `--host` alone or a hostname exposes all interfaces |

Run `astro-ssg serve --help` for the exact interface.

## Static build

`build` does a real static generation pass. It uses the same cached Astro project and links the given directory as `src/pages`, runs `astro build`, then writes the generated HTML **next to each source file**:

| Source | Generated file |
| :----- | :------------- |
| `index.md` | `index.html` |
| `about.astro` | `about.html` |
| `notes.typ` | `notes.html` |
| `blog/post.mdx` | `blog/post.html` |

Existing `.html` files are already HTML and are left untouched. The built-in default page and 404 page are not written into the directory. Generated files start with `<!-- astro-ssg:generated -->`, which tells `serve` to keep preferring the newer source file at that route, so you can build and keep editing without stale HTML taking over.

```bash
# Node CLI
npx --yes --package=github:consoleillusion/ssg-astro astro-ssg build ./public

# Nix
nix run github:consoleillusion/ssg-astro -- build ./public

# Bun
bunx --bun -p github:consoleillusion/ssg-astro astro-ssg build ./public
```

`build` accepts `[dir]`, `--theme`, `--css`, `--menu`, and `--no-default-page`. It does not accept the dev-server-only `--port`, `--host`, or `--edit` flags. Re-run `build` after changing a source file to refresh its HTML. Source files are never removed, so if you delete a source page, delete its generated HTML file manually.

## Typst pages

A `.typ` file is compiled with `typst compile --features html --format html` on each render (dev) or build, with the served directory as Typst's project root so relative includes and images resolve. The Typst CLI must be installed and support HTML export (Typst 0.13+); set `TYPST_BIN` to use a different executable. If no entrypoint `.typ` files are present, Typst is not needed.

A `.typ` file pulled in with `#include` (directly or through another included file) is treated as a document fragment, not as its own page. Only entrypoint files are compiled and routed, so references such as `@requests` resolve against the complete document instead of failing against a fragment in isolation. Included fragments do not appear in the page menu. Generated `.html` files beside fragments from an earlier build are ignored; delete them manually if you want them gone.

Typst emits a complete HTML document. It is served as-is, with the same opt-in theme, custom stylesheet, and page menu that Markdown pages receive. Typst pages are read-only in `--edit` mode.

```typ
= My page

A paragraph with *strong* text.
```

## With Nix

The default app runs the main CLI, so arguments after `--` are passed to it untouched:

```bash
nix run github:consoleillusion/ssg-astro -- --help
nix run github:consoleillusion/ssg-astro -- serve ./public --theme milligram --port 3000
nix run github:consoleillusion/ssg-astro -- build ./public
nix run github:consoleillusion/ssg-astro -- themes
```

`#astro-ssg` is an explicit alias for the same CLI, and `#serve` remains a shortcut that inserts `serve` for you:

```bash
nix run github:consoleillusion/ssg-astro#astro-ssg -- build ./public
nix run github:consoleillusion/ssg-astro#serve -- --theme milligram ./public --port 3000
```

The Nix apps bundle Bun and Typst from nixpkgs. The cache defaults to `~/.cache/astro-ssg`; set `ASTRO_SSG_CACHE` to override it.

## Routing

Files are routed using Astro's file-based routing:

| File              | URL          |
| :---------------- | :----------- |
| `index.md`        | `/`          |
| `about.md`        | `/about`     |
| `blog/post.mdx`   | `/blog/post` |
| `index.astro`     | `/`          |
| `about.html`      | `/about`     |
| `notes.typ`       | `/notes`     |
| `docs/index.html` | `/docs/`     |

Only `.astro`, `.html`, `.md`, `.mdx`, and `.typ` files are pages. Other files are ignored by the router. HTML pages are served as-is and do not go through Astro's renderer; Typst pages are compiled to HTML on demand.

Pages are linked with lowercase, extensionless paths, so `README.md` is linked as `/readme` and `docs/Getting-Started.md` as `/docs/getting-started`. Lowercase URLs are accepted for those pages.

`/` requires one of `index.astro`, `index.html`, `index.md`, `index.mdx`, or `index.typ`. If none exists, `astro-ssg` serves a built-in default page at `/` with HTTP status 200. It explains which files are recognized and links to the other pages that exist. Paths in the default page are lowercase and extensionless, and it does not list non-page files. The default page is rendered from the cache — no file is written to or removed from the served directory. When several files map to the same path, the extension priority is `.astro`, then `.html`, `.md`, `.mdx`, and `.typ`; HTML produced by `build` ranks below all of them. A `404.astro`, `404.html`, `404.md`, `404.mdx`, or `404.typ` in the served directory takes precedence. If you add your own index page, restart `serve` and it will be used instead. Earlier versions of `astro-ssg` generated an `index.html` inside the served directory (it contains `<!-- astro-ssg:generated-index -->`); if one is present it is left untouched and keeps being served at `/`. Delete it manually if you want the built-in default page instead.

## Themes

`--theme` applies a theme stylesheet to Astro-rendered pages (`.astro`, `.md`, and `.mdx`), Typst pages, and the built-in default page. Static `.html` pages are served as-is and are not modified. It accepts `sakura`, `sakura-dark`, `sakura-dark-solarized`, `sakura-earthly`, `sakura-ink`, `sakura-pink`, `sakura-radical`, `sakura-vader`, `milligram`, or `skeleton`; without a value it uses `sakura`. The sakura-family stylesheets come from the `sakura.css` package and each theme's CSS is served at `/<theme>.css`. (`--theme` was named `--classless` in earlier versions.)

```bash
# Node CLI
npx --yes --package=github:consoleillusion/ssg-astro astro-ssg serve --theme sakura-dark

# Nix
nix run github:consoleillusion/ssg-astro#serve -- --theme sakura-dark
```

Run `astro-ssg themes` to list the available themes and the default.

Unknown theme names are rejected.

## Custom stylesheet

`--css <file>` injects a `.css` file into every Astro-rendered page (`.astro`, `.md`, and `.mdx`), Typst page, and the built-in default page. Static `.html` pages are served as-is and are not modified. The file path is resolved against the current directory; the file is served by the dev server at `/astro-ssg-user.css` and is re-read from disk on every request. The file is watched by the dev server, and connected pages reload automatically when it changes. It can be combined with `--theme`; the custom stylesheet is loaded after the theme one and wins on equal specificity.

```bash
# Node CLI
npx --yes --package=github:consoleillusion/ssg-astro astro-ssg serve --css ./theme.css

# Nix
nix run github:consoleillusion/ssg-astro#serve -- --css ./theme.css
```

A missing or unreadable file is rejected at startup; a file that becomes unreadable afterwards yields HTTP 500 on the stylesheet route.

## Page menu

`--menu` shows a navigation button in the top-right corner of every Astro-rendered page, Typst page, and the built-in default page. Static `.html` pages are served as-is and are not modified. Activating it reveals a list of the directory's navigable pages (the same lowercase, extensionless paths used for links elsewhere); a link to `/` is included when you have an index page. The list is computed at render time, so it reflects the directory as it is — no restart needed. The menu is rendered into the page and is never written to disk. Toggling works without JavaScript, and a small enhancement closes it on Escape or on an outside click when JavaScript is available.

```bash
# Node CLI
npx --yes --package=github:consoleillusion/ssg-astro astro-ssg serve --menu

# Nix
nix run github:consoleillusion/ssg-astro#serve -- --menu
```

## Editing pages

Already serving a folder of notes, docs, or a small site and notice a typo? With `--edit` you don't need to hunt down the right file on disk — the page itself is the editor. Run the server with the flag and every page backed by an `.md`, `.mdx`, or `.html` file becomes editable in the browser; pressing Save writes your change straight back to the source file, and the dev server reloads to show it rendered.

```bash
# Node CLI
npx --yes --package=github:consoleillusion/ssg-astro astro-ssg serve --edit

# Nix
nix run github:consoleillusion/ssg-astro#serve -- --edit
```

This is particularly nice for Markdown. Each page is broken into its natural blocks (paragraphs, lists, code fences, …); hovering a block outlines it, and clicking one swaps it for an inline editor containing the raw Markdown for just that block, with a live preview right below it. Edit like you normally would in any text editor — Markdown syntax is the interface — and hit the Save button below the block (or Cancel to discard). Only that block's text is re-written in the file; the rest of the page is untouched. Front matter (the `---` metadata header) is preserved automatically.

```bash
# e.g. fix this in the browser and save:
# edit-demo/guide.md
#
#   # Getting Started
#   some text intro      ← click here to edit, save, done
```

`.mdx` files work the same way, though the edit is plain text: MDX components inside a block are edited as text and re-saved verbatim rather than parsed and re-rendered.

Fenced ` ```mermaid ` blocks render as code (like any code fence), while a `::: mermaid` container renders as an actual SVG diagram on the page — also in the edit preview:

````md
::: mermaid
graph TD
  A-->B
:::
````

Pages backed by `.html` files are edited differently: they get a plain contenteditable main-content area with a floating Save button, and saving replaces the `<main>` element in place. Navigation, headers, and any chrome outside `<main>` are left alone.

Some things are deliberately read-only: `.astro` pages (their component syntax can't be reconstructed from rendered HTML), `.typ` pages, the built-in default page, and the 404 page. And because Save rewrites files in the served directory, keep `--edit` for trusted local use — don't combine it with `--host`.

## Disabling the default missing page

Pass `--no-default-page` to `serve`:

```bash
# Node CLI
npx --yes --package=github:consoleillusion/ssg-astro astro-ssg serve --no-default-page

# Nix
nix run github:consoleillusion/ssg-astro#serve -- --no-default-page
```

With the default page disabled, `/` and other missing URLs return Astro's built-in 404 response.
