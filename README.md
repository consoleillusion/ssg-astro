# astro-ssg

Serve a directory of static web files with Astro. Pages can be `.astro`, `.html`, `.md`, or `.mdx`.

Requires Node.js `>= 22.23.4`, or Bun.

## Quick start

Run these commands from the directory you want to serve:

```bash
npx --yes --package=github:consoleillusion/ssg-astro astro-ssg serve
```

Pass a directory to serve something other than the current directory:

```bash
npx --yes --package=github:consoleillusion/ssg-astro astro-ssg serve ./public
```

Or, from a clone of this repository:

```bash
./bin/astro-ssg.js serve
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
| `--classless [theme]` | Style every route with a classless stylesheet: `sakura` (default), `milligram`, or `skeleton` |
| `--css <file>` | Inject a `.css` file into every Astro-rendered page and the built-in default page |
| `--no-default-page` | Do not provide the missing-index page at `/` |
| `--port <port>` | Port for the dev server |
| `--host [host]` | Expose the dev server on the network; `--host` alone or a hostname exposes all interfaces |

Run `astro-ssg serve --help` for the exact interface.

## With Nix

```bash
nix run github:consoleillusion/ssg-astro#serve
```

Pass any arguments after `--`; they are handed to the same CLI as `astro-ssg serve`, so Nix accepts exactly the same interface:

```bash
nix run github:consoleillusion/ssg-astro#serve -- --classless milligram ./public --port 3000
```

The Nix app is a thin wrapper around `astro-ssg serve` (Bun from nixpkgs). The cache defaults to `~/.cache/astro-ssg`; set `ASTRO_SSG_CACHE` to override it.

## Routing

Files are routed using Astro's file-based routing:

| File              | URL          |
| :---------------- | :----------- |
| `index.md`        | `/`          |
| `about.md`        | `/about`     |
| `blog/post.mdx`   | `/blog/post` |
| `index.astro`     | `/`          |
| `about.html`      | `/about`     |
| `docs/index.html` | `/docs/`     |

Only `.astro`, `.html`, `.md`, and `.mdx` files are pages. Other files are ignored by the router. HTML pages are served as-is and do not go through Astro's renderer.

Pages are linked with lowercase, extensionless paths, so `README.md` is linked as `/readme` and `docs/Getting-Started.md` as `/docs/getting-started`. Lowercase URLs are accepted for those pages.

`/` requires one of `index.astro`, `index.html`, `index.md`, or `index.mdx`. If none exists, `astro-ssg` serves a built-in default page at `/` with HTTP status 200. It explains which files are recognized and links to the other pages that exist. Paths in the default page are lowercase and extensionless, and it does not list non-page files. The default page is rendered from the cache — no file is written to or removed from the served directory. When several files map to the same path, the extension priority is `.astro`, then `.html`, `.md`, and `.mdx`. A `404.astro`, `404.html`, `404.md`, or `404.mdx` in the served directory takes precedence. If you add your own index page, restart `serve` and it will be used instead. Earlier versions of `astro-ssg` generated an `index.html` inside the served directory (it contains `<!-- astro-ssg:generated-index -->`); if one is present it is left untouched and keeps being served at `/`. Delete it manually if you want the built-in default page instead.

## Classless stylesheets

`--classless` applies a classless stylesheet to Astro-rendered pages (`.astro`, `.md`, and `.mdx`) and to the built-in default page. Static `.html` pages are served as-is and are not modified. It accepts `sakura`, `milligram`, or `skeleton`; without a value it uses `sakura`. The theme's CSS comes from the installed package and is served at `/<theme>.css`.

```bash
# Node CLI
npx --yes --package=github:consoleillusion/ssg-astro astro-ssg serve --classless milligram

# Nix
nix run github:consoleillusion/ssg-astro#serve -- --classless milligram
```

Unknown theme names are rejected.

## Custom stylesheet

`--css <file>` injects a `.css` file into every Astro-rendered page (`.astro`, `.md`, and `.mdx`) and the built-in default page. Static `.html` pages are served as-is and are not modified. The file path is resolved against the current directory; the file is served by the dev server at `/astro-ssg-user.css` and is re-read from disk on every request, so editing it does not require a restart or a rebuild. It can be combined with `--classless`; the custom stylesheet is loaded after the classless one and wins on equal specificity.

```bash
# Node CLI
npx --yes --package=github:consoleillusion/ssg-astro astro-ssg serve --css ./theme.css

# Nix
nix run github:consoleillusion/ssg-astro#serve -- --css ./theme.css
```

A missing or unreadable file is rejected at startup; a file that becomes unreadable afterwards yields HTTP 500 on the stylesheet route.

## Disabling the default missing page

Pass `--no-default-page` to `serve`:

```bash
# Node CLI
npx --yes --package=github:consoleillusion/ssg-astro astro-ssg serve --no-default-page

# Nix
nix run github:consoleillusion/ssg-astro#serve -- --no-default-page
```

With the default page disabled, `/` and other missing URLs return Astro's built-in 404 response.
