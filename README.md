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

`serve` accepts `--port`, `--host`, and `--no-default-page`. Running `serve` without `init` initializes the cache for the given directory automatically. If the cache was set up for a different directory, `serve` repoints it.

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

`/` requires one of `index.astro`, `index.html`, `index.md`, or `index.mdx`. If none exists, `/` serves a helpful missing page (with HTTP status 404) that explains which files are recognized. It never lists the served directory. A `404.astro`, `404.html`, `404.md`, or `404.mdx` in the served directory takes precedence. If you add an index page while `serve` is running, restart it.

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
