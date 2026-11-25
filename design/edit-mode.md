# Edit mode

`--edit` is a `serve`-only feature that lets a browser edit source files
directly. It is designed for local authoring, not for a public server.

## Eligibility

Only these extensions are editable:

```text
.html
.md
.mdx
```

`.astro` and `.typ` pages are read-only, as are the injected `/` and `/404`
pages. A URL is mapped back to a source through the same `listPages()` lookup
used for routing, so arbitrary paths cannot be targeted by guessing a URL.

As a second layer, `src/edit/edit.ts` resolves the candidate file with
`fs.realpathSync` and requires it to be the pages directory itself or below it.
Symlink escapes are rejected.

## Server endpoints

The `ssg-edit` Vite plugin is active only when `SSG_EDIT=1`.

| Endpoint | Purpose |
| :--- | :--- |
| `GET /astro-ssg-edit/status?path=…` | Returns `{ editable, type }`. |
| `GET /astro-ssg-edit/source?path=…` | Returns Markdown source for `.md`/`.mdx`; otherwise 400. |
| `POST /astro-ssg-edit/save` | Saves `{ path, html }` or `{ path, markdown }`. |

Request bodies are capped at 10 MiB. Oversized requests are destroyed; malformed
JSON returns 400. The query `path` is decoded twice, and that decode is not
wrapped in a `try`, so malformed encodings can throw. Keep the edit server
local.

## Markdown editing

Markdown source is split into blank-line-separated blocks. Fenced code blocks
and `::: mermaid` directives are kept intact, so a diagram remains one edit
unit. The bootstrap hides existing `<main>` children except the standalone
menu, then renders each block:

- `::: mermaid` becomes a `.mermaid` div
- everything else is parsed with `marked`

Clicking a block opens a textarea with autosize, a live preview, and Save /
Cancel controls. Saving posts all blocks back as Markdown.

Frontmatter is stripped from the displayed source and preserved verbatim when
saving. The saved file always ends with a newline.

## HTML editing

For static HTML pages, the bootstrap makes `<main>` contentEditable and adds a
fixed Save button plus a status note. On save it clones the DOM, removes editor
UI and `details.ssg-menu`, and posts the result.

`applyEdit()` strips every `<details class="ssg-menu">…</details>` and every
`<style>…</style>` from the submitted HTML, then replaces the inner HTML of the
first `<main>` element. If there is no `<main>`, the save throws. This also
means author-written inline `<style>` elements inside `<main>` are removed.

## Mermaid previews

The browser bootstrap includes its own `renderMermaid()` helper with the same
initialization as the page script: dynamic import, `startOnLoad: false`, and
`securityLevel: 'loose'`. Diagram edits are re-rendered in the preview before
saving.

## Interaction with other features

- The standalone menu is made inert while editing and stripped from saves.
- Themes and user CSS are still loaded; editing changes content, not styling.
- `wacss-docs` chapters are Markdown and can be edited, but the injected docs
  layout is not part of the source file and is never saved into it.
- `--edit` is ignored by `build`; the environment variable exists only for the
  dev server, and there are no build-time edit endpoints.

## Security

There is no authentication on the edit endpoints. The README warns not to
combine `--edit` with `--host`, because that exposes write access to the
network. Use it only on a local dev server.

Continue with [Typst](/typst).
