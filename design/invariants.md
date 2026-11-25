# Invariants and limitations

This chapter records what the library guarantees, what it deliberately does not
do, and the sharp edges worth knowing before changing it.

## Invariants

### Source files remain authoritative

Generated HTML is marked and ranked below every source extension. A later
`serve` or `build` reads the `.astro`, `.html`, `.md`, `.mdx`, or `.typ` source,
not the generated file beside it.

### serve does not write to the served directory

`serve` copies the template into a cache and symlinks `src/pages` to the served
directory. It never copies content into the cache and never rewrites pages.
`--edit` is the explicit exception: it writes to source files when a user asks.

### Templates do not rewrite source

`wacss-docs` sets `frontmatter.layout` at render time. A page's own `layout:`
frontmatter wins. No Markdown or Typst file is modified to apply the template.

### The cache serves one directory

The CLI compares the served directory's real path with the cache's `src/pages`
real path. If they differ, the cache is reinitialized for the new directory.

### The cache cannot contain the served directory

Both paths are checked for containment before the cache is deleted or rebind.
This prevents cache initialization from recursively deleting user content. The
check uses `path.resolve`, not `realpath`, so symlink aliases can evade it; do
not point the cache inside the served directory.

### Install and build failures do not publish

`build` publishes generated HTML only when the Astro build exits zero. A failed
install skips the build entirely.

## Deliberate limitations

- Stale generated HTML is not deleted when a source page is removed. Delete it
  manually.
- Plain `.html` pages are served as-is; theme, menu, and edit scripts reach
  Astro-rendered pages, not arbitrary static HTML.
- `.astro` and `.typ` pages are read-only in edit mode.
- There is no authentication on edit endpoints. Do not expose `--edit` with
  `--host`.
- The standalone menu is suppressed by `wacss-docs`, even if both flags are
  passed.
- Root `index.*` and root `404.*` are owned by injected routes in route
  discovery, though publishing still emits their built HTML.
- Typst fragments included by another document are not standalone pages.

## Sharp edges

### Template version

Any change to bundled template files requires a `TEMPLATE_VERSION` bump in
`bin/astro-ssg.js`. Without it, existing caches keep stale code. The current
version is `38`.

### Optional-value flags

`--theme` and `--template` may consume the following token. Put the directory
argument first. `--template none` exists specifically to clear an inherited
`SSG_TEMPLATE`.

### Inherited environment

Only `SSG_TEMPLATE` is explicitly cleared when its flag is absent. Other
inherited `SSG_*` values still affect the template.

### Node and Bun

Node `22.23.4` or newer is required, but the check is skipped under Bun. The
package manager is selected from the same runtime detection.

### Typst preflight

The preflight runs `typst --version` only. It does not verify HTML export
features or `@preview` package availability. `TYPST_BIN` is an executable
name/path, not a shell command with arguments.

### Typst cache

The compile cache keys on mtime and size of all `.typ` files, not content
hashes. A change that preserves both may not invalidate. The cache clears once
it exceeds 100 entries.

### Typst decoration

Duplicate detection for theme and menu markers uses substring checks. Markup
containing `data-ssg-theme` or `class="ssg-menu"` elsewhere can suppress
injection.

### Mermaid plugin state

`mermaidMdastPlugin()` keeps its raw-source index on the plugin instance, which
is created once. After the first diagram in a server process, the index may no
longer match the current document and the plugin falls back to the paragraph
text.

### Edit endpoint decoding

The edit status/source handling decodes the `path` query twice without a
`try`, unlike the lowercase-route middleware.

### Edit HTML application

`applyEdit()` removes every `<style>` element from submitted HTML, not just
injected chrome. It also requires a `<main>` element before replacing content.

### Menu links

`menuLinks()` checks for a root index with plain `fs.existsSync`, without
filtering generated HTML or Typst fragments the way route discovery does.

### wacss-docs config

`hide` is checked against config keys for grouped entries but against file keys
for ungrouped leftovers. A page hidden by URL key could reappear under
ungrouped pages. Stored palette and mode values are not validated before being
applied to `<html>`.

### SSG_TEMPLATE comparisons

Most template checks trim and lowercase `SSG_TEMPLATE`, but
`src/missing/Index.astro` uses an exact comparison. The CLI always sets the
value in the canonical form, so this matters only for hand-set environments.

### no-default-page and Typst

`SSG_NO_DEFAULT_PAGE=1` disables the built-in missing-page routes, but Typst
root routes are injected independently and still exist.

### Generated index legacy

An `index.html` marked `<!-- astro-ssg:generated-index -->` is treated as a real
user page and left alone. A current `<!-- astro-ssg:generated -->` index is
ignored for source-page purposes.

### Nix flake sources

Because the flake uses Git sources, untracked files in this worktree are not
included in a Nix build until they are added to Git.

## Change checklist

When changing the library:

- bump `TEMPLATE_VERSION` for any template change
- update the source map when files move
- update `wacss-docs.json` and `index.typ` when chapters change
- keep this book aligned with the code, not the other way around
