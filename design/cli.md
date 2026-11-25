# CLI

The CLI is implemented in `bin/astro-ssg.js` with `cac`. It has three commands:
`serve`, `build`, and `themes`. Help and version are provided by `cac`.

## Commands

### `astro-ssg serve [dir]`

Prepares the cache, installs dependencies, and starts Astro's dev server.
`[dir]` defaults to the current directory.

| Flag | Type | Default | Meaning |
| :--- | :--- | :------ | :------ |
| `--no-default-page` | boolean flag | default page enabled | Do not inject a built-in `/` or `/404`. |
| `--theme [theme]` | optional string | no theme | Apply a bundled stylesheet. A bare flag selects `sakura`. |
| `--template [template]` | optional string | no template | Apply a render-time template. A bare flag selects `wacss-docs`; `none` disables it. |
| `--css <file>` | required string | none | Serve and inject a user stylesheet. |
| `--menu` | boolean flag | `false` | Add the standalone page menu. |
| `--edit` | boolean flag | `false` | Enable in-browser editing. `serve` only. |
| `--port <port>` | required string | Astro default | Dev-server port. Digits only. |
| `--host [host]` | optional string | none | Expose the dev server. A bare flag binds `0.0.0.0`. |

### `astro-ssg build [dir]`

Runs `astro build` in the cache, then writes generated HTML beside each source
page. `[dir]` defaults to the current directory.

| Flag | Meaning |
| :--- | :------ |
| `--no-default-page` | Do not inject the built-in `/` and `/404`. |
| `--theme [theme]` | Same as `serve`. |
| `--template [template]` | Same as `serve`. |
| `--css <file>` | Same as `serve`. |
| `--menu` | Same as `serve`. |

`build` does not accept `--port`, `--host`, or `--edit`. See
[Static build output](/build-output).

### `astro-ssg themes`

Prints the available theme names, marks `sakura` as the default, and shows an
example invocation.

### Help and version

- `astro-ssg` with no command prints help and exits 0.
- `-h`/`--help` prints commands, options, and the resolved cache directory.
- `-v`/`--version` prints the package version with platform information.
- An unknown command fails with a message naming the three valid commands.

## Argument order matters

Optional-value flags such as `--theme` and `--template` can consume the next
token as their value. Put the directory first:

```sh
astro-ssg serve test-docs --theme sakura
astro-ssg serve test-docs --template wacss-docs
```

Writing `astro-ssg serve --theme test-docs` tries to use `test-docs` as a theme
name. The error message says to put the directory before the flag.

## Normalization and validation

All validation happens before the cache is touched. Failures print
`astro-ssg: …` to stderr and exit 1.

### Theme

- absent, `null`, or `false` → no theme
- bare flag or empty string → `sakura`
- otherwise trimmed, lowercased, and checked against the whitelist

Unknown themes are rejected with the list of valid names.

### Template

- absent, `null`, or `false` → no template
- bare flag or empty string → `wacss-docs`
- `none` → no template
- `wacss-docs` → that template
- anything else is rejected

`--template none` is important: `SSG_TEMPLATE` is always written into the
child environment, even when empty, so this clears an inherited template.

### CSS

The path is resolved against the current working directory. It must have a
`.css` extension (case-insensitive), exist, be a regular file, and be readable.
The absolute path is passed as `SSG_CSS_PATH`.

### Port and host

`--port` accepts digits only and remains a string, so `0`, leading zeros, and
large values are passed through. `--host` passes an explicit value verbatim; a
bare `--host` becomes `0.0.0.0`.

### Directory

The resolved path must exist and be a directory. Symlinks to directories are
accepted. The cache and served directory must not contain one another.

### Node and Typst

Node `22.23.4` or newer is required, except when running under Bun. If any
routable `.typ` entrypoint exists, the CLI checks that `TYPST_BIN` or `typst`
can run `typst --version` before starting Astro. This check excludes Typst
files that are included as fragments.

## Preflight order

Both `serve` and `build` do the same checks:

1. resolve the served directory
2. check the Node version unless running under Bun
3. assert cache/served-directory containment safety
4. initialize or rebind the cache
5. assert Typst availability if needed
6. print where `/` will come from
7. install dependencies and run Astro

## Environment passed to Astro

`ssgEnv()` starts from a copy of `process.env`, then sets:

| Variable | Set when | Consumer |
| :--- | :--- | :------ |
| `SSG_NO_DEFAULT_PAGE=1` | `--no-default-page` | injected `/` and `/404` routes |
| `SSG_THEME=<name>` | theme selected | theme stylesheet route and injection |
| `SSG_TEMPLATE=<name or "">` | always | `wacss-docs` activation and layout injection |
| `SSG_CSS_PATH=<absolute>` | `--css` selected | user CSS route, layout links, watcher |
| `SSG_MENU=1` | `--menu` | standalone menu and Markdown/Typst injection |
| `SSG_EDIT=1` | `--edit` on `serve` | edit endpoints and browser bootstrap |

Only `SSG_TEMPLATE` is explicitly cleared when its flag is absent. Other
inherited `SSG_*` values are preserved. See
[Configuration reference](/configuration).

## Package manager and process handling

Under Bun, the CLI uses `process.execPath` with `bun install`, `bun run dev`,
and `bun run build`. Otherwise it uses `npm install --no-audit --no-fund`,
`npm run dev`, and `npm run build`. On Windows it uses `npm.cmd` and a shell.

The child process inherits stdio, so Astro logs appear directly. The child's
exit code becomes the CLI's exit code. `build` publishes generated HTML only
when the Astro build exits zero.

After a successful install on Linux, native packages for the foreign libc are
removed to avoid shipping both glibc and musl prebuilds. See
[Cache and runtime](/cache-and-runtime).

## Nix flake

`flake.nix` builds a single-file Bun bundle with pinned tarballs for `cac`,
`compare-versions`, `tinyglobby`, and their transitive dependencies. It copies
`template/` and `package.json` beside the bundle so package-root detection
works. Wrappers provide:

- `astroSsgCli` — the raw CLI with Bun and Typst available
- `serve` — the CLI with `serve` inserted before user arguments
- apps and packages named `default`, `serve`, and `astro-ssg`

Because the flake sources are Git sources, untracked template files are not
included in a Nix build from a working tree until they are added to Git.
