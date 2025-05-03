# astro-ssg

Serve a directory of static web files with Astro. Pages can be `.astro`, `.html`, `.md`, or `.mdx`.

Requires Node.js `>= 22.23.4`, or Bun.

## Without Nix

Run these commands from the directory you want to serve:

```bash
npx --yes --package=github:consoleillusion/ssg-astro astro-ssg init
npx --yes --package=github:consoleillusion/ssg-astro astro-ssg serve
```

Pass a directory to serve something other than the current directory:

```bash
npx --yes --package=github:consoleillusion/ssg-astro astro-ssg init ./public
npx --yes --package=github:consoleillusion/ssg-astro astro-ssg serve ./public
```

Or, from a clone of this repository:

```bash
./bin/astro-ssg.js init
./bin/astro-ssg.js serve
```

`init` copies a small Astro project to `~/.cache/astro-ssg` (or `%LOCALAPPDATA%\astro-ssg` on Windows) and links the given directory (or the current directory) as its `src/pages` directory. `serve` installs dependencies and starts the Astro dev server. Set `ASTRO_SSG_CACHE` to use a different cache directory.

`serve` accepts `--port`, `--host`, `--no-default-page`, and `--classless [theme]`. Running `serve` without `init` initializes the cache for the given directory automatically. If the cache was set up for a different directory, `serve` repoints it.

### With Bun

Bun can run the CLI directly without Node.js or npm. `serve` initializes the cache automatically, so one command is enough:

```bash
bunx --bun -p github:consoleillusion/ssg-astro astro-ssg serve
```

Use `astro-ssg init` instead of `serve` if you only want to prepare the cache. Both accept the same optional directory argument as the `npx` commands above.

## With Nix

Run these commands from the directory you want to serve:

```bash
nix run github:consoleillusion/ssg-astro#init
nix run github:consoleillusion/ssg-astro#serve
```

`init` copies a small Astro project to `/tmp/astro-ssg` and links the current directory as its `src/pages` directory. `serve` installs dependencies and starts the Astro dev server.

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

`/` requires one of `index.astro`, `index.html`, `index.md`, or `index.mdx`. If none exists, `astro-ssg` generates an `index.html` that returns HTTP status 200. It explains which files are recognized and links to the other pages that exist. Paths in the generated page are lowercase and extensionless, and it does not list non-page files. When several files map to the same path, the extension priority is `.astro`, then `.html`, `.md`, and `.mdx`. A `404.astro`, `404.html`, `404.md`, or `404.mdx` in the served directory takes precedence. If you add your own index page, the generated page is removed. If you add one while `serve` is running, restart it.

## Classless stylesheets

`--classless` applies a classless stylesheet to Astro-rendered pages (`.astro`, `.md`, and `.mdx`) and to the generated default page. Static `.html` pages are served as-is and are not modified. It accepts `sakura`, `milligram`, or `skeleton`; without a value it uses `sakura`. The theme's CSS comes from the installed package and is served at `/<theme>.css`. The choice is saved during `init` and reused by `serve`:

```bash
# Node CLI
npx --yes --package=github:consoleillusion/ssg-astro astro-ssg init --classless milligram
npx --yes --package=github:consoleillusion/ssg-astro astro-ssg serve

# Nix
nix run github:consoleillusion/ssg-astro#init -- --classless milligram
nix run github:consoleillusion/ssg-astro#serve
```

Pass `--classless <theme>` to `serve` to override the saved theme for one run. Unknown theme names are rejected.

## Disabling the default missing page

Pass `--no-default-page` to `init` to remember the choice:

```bash
# Node CLI
npx --yes --package=github:consoleillusion/ssg-astro astro-ssg init --no-default-page

# Nix
nix run github:consoleillusion/ssg-astro#init -- --no-default-page
```

Pass it to `serve` to disable the page for a single run:

```bash
# Node CLI
npx --yes --package=github:consoleillusion/ssg-astro astro-ssg serve --no-default-page

# Nix
nix run github:consoleillusion/ssg-astro#serve -- --no-default-page
```

With the default page disabled, `/` and other missing URLs return Astro's built-in 404 response.
