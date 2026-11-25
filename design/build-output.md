# Static build output

`build` runs Astro's static build in the cache and then publishes the result
beside the source files.

## Flow

1. Resolve the directory, check Node, assert cache safety, initialize the cache,
   check Typst availability, and print the index message.
2. Install dependencies in the cache.
3. Run `npm run build` or `bun run build`.
4. If the build exits zero, copy each built page next to its source.

Build failures do not publish anything. `build` accepts no `--port`, `--host`,
or `--edit` flags.

## Which sources are published

`BUILD_SOURCE_EXTENSIONS` is:

```text
.astro
.md
.mdx
.typ
```

Plain `.html` sources are not re-published, because they are already static
files. Existing generated HTML is also skipped as a source.

`listSourcePages()` mirrors the template's route discovery: it ignores
underscore-prefixed paths, `node_modules`, dynamic route basenames containing
`[`, and Typst fragments. It does not exclude root `index` or `404`, because
those need output too.

Duplicate routes are resolved by the same priority rules as `serve`, with
generated HTML ranked below every source type.

## Finding the built HTML

`builtHtmlFor(distDir, actual)` maps a source route to its built file:

| Source route | Built file |
| :--- | :--- |
| `/` | `dist/index.html` |
| `/404` | `dist/404.html` |
| `/why` | `dist/why/index.html` |
| `/nested/` | `dist/nested/index.html` |

If Astro did not emit a file for a source page, the CLI logs
`astro-ssg: no build output for <file>; skipping.` and continues.

## Generated marker

Before writing, `markGenerated(html)` inserts:

```html
<!-- astro-ssg:generated -->
```

immediately after the doctype when the document starts with `<!doctype html>`
case-insensitively; otherwise the marker is prepended.

The output path is the source path with `.html` appended to the original base
name. For example, `why.md` becomes `why.html`, and `nested/index.mdx` becomes
`nested/index.html`.

## Why generated HTML is safe to keep

The marker has two effects:

- `listPages()` demotes marked HTML below all source extensions during route
  discovery.
- `hideGeneratedHtml` moves marked `.html` routes to a private
  `/__astro-ssg-generated…` pattern during `astro:route:setup`.

So after a build, the generated file is available for direct static serving,
but a later `serve` still reads the Markdown, MDX, Typst, or Astro source. The
CLI never deletes stale generated HTML when a source page is removed; that is
left to the user.

## Interaction with templates

`--template wacss-docs` works for `build` exactly as it does for `serve`. The
layout plugin runs during the static render, and the CSS links emitted with
`?url` become hashed assets in `dist/_astro/`. The generated HTML therefore
contains the full docs shell, not just Markdown output.

## Publishing log

After copying, the CLI prints:

```text
Wrote N HTML file(s) next to the source pages in <dir>.
```

`N` counts only files that were actually written. Missing outputs are reported
individually.

Continue with [wacss-docs configuration](/wacss-docs-config).
