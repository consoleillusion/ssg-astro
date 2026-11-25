# Cache and runtime

The library runs Astro from a writable cache rather than from the served
directory. That is what allows an ordinary folder of files to become a site
without becoming an Astro project.

## Cache location

The cache directory is chosen once at CLI startup:

1. `ASTRO_SSG_CACHE` if set and non-empty, resolved against the current directory
2. on Windows, `LOCALAPPDATA/astro-ssg` or `%USERPROFILE%/AppData/Local/astro-ssg`
3. elsewhere, `XDG_CACHE_HOME/astro-ssg` or `~/.cache/astro-ssg`

Two important paths are derived from it:

- `<cache>/src/pages` — symlink to the served directory
- `<cache>/.template-version` — template generation marker

`astro-ssg --help` prints the resolved cache directory.

## Version gate

A cache is current only when all of these are true:

- `<cache>/package.json` exists
- `<cache>/src/pages` exists
- `.template-version` contains exactly the CLI's `TEMPLATE_VERSION`

The version must be bumped whenever bundled template code changes. Otherwise
existing caches keep running stale code. The current version is `38`.

## Initialization and rebinding

If the cache is missing, stale, or bound to a different directory, the CLI:

1. asserts the cache and served directory do not contain one another
2. deletes and recreates the cache directory
3. copies the whole bundled `template/` tree into it
4. makes the copy writable (directories `0755`, files `0644`)
5. writes the current template version with no trailing newline
6. removes legacy `.classless` and `.no-default-page` marker files
7. creates `<cache>/src`, removes any existing `src/pages`, and symlinks it to
   the served directory

If the cache appears current, the CLI compares `realpathSync(serveDir)` with
`realpathSync(<cache>/src/pages)`. A mismatch rebinds the cache to the new
directory. One cache serves one directory at a time.

## Why a symlink

Astro's file router reads pages from `src/pages`. Symlinking that directory to
the served directory means:

- source files stay in their original location
- `serve` never copies content into the cache
- edits made by an author or by `--edit` are seen directly by Astro
- build output can be written next to sources without changing the cache's page
  list permanently

The template resolves the symlink with `fs.realpathSync` when it needs to watch
files or decide whether a Markdown file belongs to the served directory.

## Dependency installation

Every `serve` or `build` installs dependencies in the cache; there is no
"already installed" shortcut.

- Under Bun: `bun install`, then `bun run dev` or `bun run build`
- Under Node/npm: `npm install --no-audit --no-fund`, then `npm run dev` or
  `npm run build`

npm commands use the cache's `package-lock.json`; Bun uses the shipped
`bun.lock`. Under npm, Astro arguments are separated with `--`.

### Foreign libc pruning

After a successful install on Linux, the CLI detects glibc via
`process.report` and musl via `/usr/bin/ldd`. It then deletes prebuilt packages
for the other libc: Lightning CSS, Sharp/libvips, and Rolldown bindings. When
packages are removed, the CLI reports the count and approximate megabytes
saved. Already-missing directories are no-ops.

## Astro process handling

`serve` passes `--port` and `--host` through to `astro dev` when present.
`build` runs `astro build` with no extra Astro arguments. All feature flags
reach Astro through `SSG_*` environment variables.

The child process inherits stdio. A signal maps to exit code 1. Install, dev,
and build exit codes propagate to the CLI.

## Watch behavior in the dev server

The template adds several watch behaviors:

- The real pages directory is added to Vite's watcher because it lives outside
  the cache. Adds, unlinks, and directory changes clear the route cache,
  invalidate the module graph, and trigger a full reload.
- Typst changes invalidate and reload because compilation happens in a child
  process. Included fragments are registered as watch files for their
  entrypoints.
- The `--css` file is watched directly; changes, additions, and deletions send
  a full reload.
- HTML responses are forced to `charset=utf-8` so bare Markdown/MDX pages do
  not render mojibake.
- Noisy warnings about unsupported non-page files in the pages directory are
  filtered.

## Safety invariant

The served directory and cache must not contain one another. Without this
check, cache initialization could recursively delete user content, or Astro
could discover its own generated files as pages. The check runs before any
cache mutation. It uses `path.resolve`, not `realpath`, so symlink aliases are
not fully protected; do not point the cache inside the served directory.
